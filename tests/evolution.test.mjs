import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { UPGRADES, RARITY } from '../js/config.js';

/** 使用正式模拟器创建对局并清空掩体；sounds 记录音效事件名，便于断言反馈是否触发。 */
function setup(chapter = 0) {
    const sounds = [];
    const g = new Game({ play: (event) => sounds.push(event), update() {} }, () => {});
    g.start(1, chapter);
    g.walls = [];
    g.barrels = [];
    return { g, sounds };
}
/** 生成一个已结束空投预警的敌人。 */
function enemyAt(g, type, x, y) {
    const e = g.makeEnemy(type, x, y);
    e.warning = 0;
    g.enemies.push(e);
    return e;
}
/** 通过正式入口为全队装配一项改装（与玩家在界面上选择效果相同）。 */
function equip(g, id) {
    g.players.forEach((p) => UPGRADES.find((u) => u.id === id).apply(p));
    g.upgrades.push(id);
}

test('每张改装都有合法稀有度，进化卡的前置改装都存在', () => {
    for (const u of UPGRADES) {
        assert.ok(RARITY[u.rarity], `${u.id} 缺少稀有度`);
        if (u.requires) {
            assert.equal(u.rarity, 'evolution');
            assert.ok(u.requires.every((id) => UPGRADES.some((item) => item.id === id && !item.requires)));
        }
    }
});

test('凑齐前置后进化卡必定出现在首位，获得后不再出现；普通抽取不会出现进化卡', () => {
    const { g } = setup();
    for (let i = 0; i < 50; i++) assert.ok(g.drawChoices().every((u) => !u.requires));
    equip(g, 'ricochet');
    equip(g, 'explosive');
    for (let i = 0; i < 20; i++) {
        const choices = g.drawChoices();
        assert.equal(choices[0].id, 'pinball');
        assert.equal(new Set(choices.map((u) => u.id)).size, 3, '候选不重复');
    }
    g.upgrades.push('pinball');
    assert.ok(g.drawChoices().every((u) => u.id !== 'pinball'));
});

test('稀有度权重让普通改装明显多于传说改装', () => {
    const { g } = setup();
    const counts = { common: 0, legendary: 0 };
    for (let i = 0; i < 400; i++)
        for (const u of g.drawChoices()) if (u.rarity in counts) counts[u.rarity]++;
    assert.ok(counts.common > counts.legendary * 3, JSON.stringify(counts));
});

test('刷新消耗次数并重新抽取，次数用尽后无效', () => {
    const { g } = setup();
    g.completeWave();
    assert.equal(g.state, 'upgrade');
    const start = g.rerolls;
    g.rerollUpgrade();
    assert.equal(g.rerolls, start - 1);
    assert.equal(g.choices.length, 3);
    while (g.rerolls > 0) g.rerollUpgrade();
    const choices = g.choices;
    g.rerollUpgrade();
    assert.equal(g.rerolls, 0);
    assert.equal(g.choices, choices);
});

test('波次评级：无伤高连击为 S 并奖励积分与刷新，承伤过多为 C', () => {
    const { g } = setup();
    g.waveDamage = 0;
    g.waveMaxCombo = 20;
    const score = g.score,
        rerolls = g.rerolls;
    g.gradeWave();
    assert.equal(g.lastGrade.grade, 'S');
    assert.equal(g.score - score, 1500);
    assert.equal(g.rerolls, rerolls + 1);
    g.waveDamage = 120;
    g.waveMaxCombo = 2;
    g.gradeWave();
    assert.equal(g.lastGrade.grade, 'C');
    // 玩家与核心受伤都计入承伤。
    g.waveDamage = 0;
    const p = g.players[0];
    p.invincible = 0;
    g.damagePlayer(p, 10);
    g.hurtCore(5);
    assert.equal(g.waveDamage, 15);
});

test('弹球炸弹：炮弹撞墙反弹时在撞击点爆炸，波及墙边敌军', () => {
    const { g } = setup();
    equip(g, 'ricochet');
    equip(g, 'explosive');
    equip(g, 'pinball');
    const p = g.players[0];
    assert.equal(p.bounce, 3);
    g.walls = [{ x: 600, y: 300, w: 40, h: 40, hp: Infinity, maxHp: 85, steel: true, hit: 0 }];
    const enemy = enemyAt(g, 'heavy', 590, 380);
    p.x = 450;
    p.y = 320;
    p.angle = 0;
    g.createBullet(p, 0, false, 1200, 40, g.shotTraits(p));
    for (let i = 0; i < 10; i++) g.updateBullets(1 / 60);
    assert.ok(enemy.hp < enemy.maxHp, '墙边敌军应被反弹爆炸波及');
});

test('雷霆僚机射速翻倍，僚机弹附带连锁闪电', () => {
    const { g } = setup();
    equip(g, 'drone');
    equip(g, 'crit');
    equip(g, 'thunderWing');
    const p = g.players[0];
    enemyAt(g, 'heavy', p.x, p.y - 200);
    g.updateDrones(p);
    assert.equal(p.droneCd, 0.19);
    assert.ok(g.bullets.some((b) => b.arc && b.arcJumps === 2));
});

test('血色连爆扩大殉爆范围并加倍伤害', () => {
    const { g } = setup();
    equip(g, 'chain');
    equip(g, 'vampire');
    equip(g, 'bloodChain');
    const source = enemyAt(g, 'scout', 300, 300);
    const far = enemyAt(g, 'heavy', 300 + 110, 300);
    g.damageEnemy(source, 9999);
    // 普通殉爆半径 85 打不到 110 外的敌人，血色连爆（128）可以，且伤害为 90。
    assert.ok(Math.abs(far.maxHp - far.hp - 90) < 1e-6);
});

test('激光哨塔：炮台持续 18 秒并发射无限穿透的激光', () => {
    const { g } = setup();
    equip(g, 'sentry');
    equip(g, 'pierce');
    equip(g, 'laserSentry');
    enemyAt(g, 'heavy', 640, 300);
    g.deployTurret(1);
    assert.equal(g.turrets[0].life, 18);
    g.updateField(0.016);
    const laser = g.bullets.find((b) => b.kind === 'laser');
    assert.ok(laser && laser.pierce >= 99);
});

test('永动狂热：狂热期间击毁延长狂热时间，且有 20 秒上限', () => {
    const { g } = setup();
    equip(g, 'fever');
    equip(g, 'magnet');
    equip(g, 'eternalFever');
    g.feverTime = 5;
    g.damageEnemy(enemyAt(g, 'scout', 300, 300), 9999);
    assert.ok(g.feverTime > 5);
    g.feverTime = 19.9;
    g.damageEnemy(enemyAt(g, 'scout', 400, 300), 9999);
    assert.equal(g.feverTime, 20);
});

test('击毁触发音阶与残骸碎片，首领终结进入慢动作并按 30% 速度推进', () => {
    const { g, sounds } = setup();
    g.burstLog = [];
    g.damageEnemy(enemyAt(g, 'raider', 300, 300), 9999);
    assert.ok(sounds.includes('killnote'));
    assert.ok(g.burstLog.some((entry) => entry[5] === 'debris'));
    assert.ok(g.particles.some((p) => p.debris));
    g.damageEnemy(enemyAt(g, 'boss', 640, 200), 1e7);
    assert.ok(g.slowmo > 0);
    g.hitstop = 0;
    const before = g.time;
    g.update(0.1);
    assert.ok(Math.abs(g.time - before - 0.03) < 1e-9);
});

test('高优先级播报（首领终结）不会被同时触发的连杀播报覆盖', () => {
    const { g } = setup();
    g.damageEnemy(enemyAt(g, 'boss', 640, 200), 1e7);
    assert.equal(g.announce.text, '终结！');
    for (let i = 0; i < 6; i++) g.damageEnemy(enemyAt(g, 'scout', 200 + i * 60, 400), 9999);
    assert.equal(g.announce.text, '终结！');
});
