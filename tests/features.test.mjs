import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { WAVES, UPGRADES, MAX_ENEMIES } from '../js/config.js';
import { createSnapshot } from '../js/protocol.js';

/** 使用正式模拟器创建对局；events 记录模拟层发出的界面事件，便于断言提示文本。 */
function setup(chapter = 0, mode = 1) {
    const events = [];
    const g = new Game({ play() {}, update() {} }, (type, data) => events.push({ type, data }));
    g.start(mode, chapter);
    g.walls = [];
    return { g, events };
}
/** 生成一个已结束空投预警、可立即交战的敌人。 */
function enemyAt(g, type, x, y) {
    const e = g.makeEnemy(type, x, y);
    e.warning = 0;
    g.enemies.push(e);
    return e;
}

test('盾卫战车正面只承受 25% 伤害，侧后方与范围伤害不受护盾影响', () => {
    const { g } = setup(3);
    const front = enemyAt(g, 'guardian', 640, 300);
    front.angle = Math.PI / 2; // 车头朝下
    const hp = front.hp;
    // 炮弹自下向上飞（角度 -π/2），与车头相对，属于正面命中。
    g.damageEnemy(front, 40, false, -Math.PI / 2);
    assert.ok(Math.abs(hp - front.hp - 10) < 1e-9);
    // 炮弹沿车头方向飞行，即从背后命中，承受全额伤害。
    g.damageEnemy(front, 40, false, Math.PI / 2);
    assert.ok(Math.abs(hp - front.hp - 50) < 1e-9);
    g.damageEnemy(front, 40, true, -Math.PI / 2);
    assert.ok(Math.abs(hp - front.hp - 90) < 1e-9);
});

test('悬赏事件在本波过半时生成金色精英，击毁后发放积分与全员修复', () => {
    const { g, events } = setup(0);
    g.wave = 8; // 下一次 beginWave 进入第 9 关（悬赏）
    g.beginWave();
    assert.equal(WAVES[g.wave - 1].event, 'bounty');
    const half = Math.floor(WAVES[g.wave - 1].count / 2);
    for (let i = 0; i <= half; i++) g.spawnEnemy();
    const bounty = g.enemies.filter((e) => e.bounty);
    assert.equal(bounty.length, 1);
    g.players[0].hp = 10;
    bounty[0].warning = 0;
    const score = g.score;
    g.damageEnemy(bounty[0], bounty[0].maxHp + 1);
    assert.ok(g.score - score >= 1000);
    assert.equal(g.players[0].hp, g.players[0].maxHp);
    assert.ok(events.some((e) => e.type === 'toast' && String(e.data).includes('悬赏')));
});

test('相位门把玩家传送到另一侧并设置冷却，防止来回弹跳', () => {
    const { g } = setup(3);
    g.beginWave(); // 第 20 关；手动设置门以独立验证传送规则
    g.portals = [
        { x: 200, y: 540, radius: 30 },
        { x: 1080, y: 540, radius: 30 },
    ];
    const p = g.players[0];
    p.x = 205;
    p.y = 540;
    g.usePortal(p);
    assert.equal(p.x, 1080);
    assert.ok(p.portalCd > 0);
    g.usePortal(p);
    assert.equal(p.x, 1080);
});

test('跳弹改装让炮弹撞墙后反弹而非消失', () => {
    const { g } = setup(0);
    g.walls = [{ x: 600, y: 300, w: 40, h: 40, hp: Infinity, maxHp: 85, steel: true, hit: 0 }];
    const p = g.players[0];
    UPGRADES.find((u) => u.id === 'ricochet').apply(p);
    p.x = 500;
    p.y = 320;
    p.angle = 0;
    g.fire(p, false);
    const bullet = g.bullets[0];
    assert.equal(bullet.bounce, 1);
    for (let i = 0; i < 20; i++) g.updateBullets(1 / 60);
    assert.equal(g.bullets.length, 1);
    assert.ok(g.bullets[0].vx < 0, '撞到钢墙左侧后水平速度应反向');
});

test('护盾模块优先吸收伤害，吸收不足部分才扣装甲', () => {
    const { g } = setup(0);
    const p = g.players[0];
    p.invincible = 0;
    g.pickups.push({ x: p.x, y: p.y, life: 10, age: 0, kind: 'shield' });
    g.updatePickups(0.016);
    assert.equal(p.shield, 45);
    g.damagePlayer(p, 30);
    assert.equal(p.hp, p.maxHp);
    assert.equal(p.shield, 15);
    p.invincible = 0;
    g.damagePlayer(p, 25);
    assert.equal(p.shield, 0);
    assert.equal(p.hp, p.maxHp - 10);
});

test('殉爆改装引发连锁击毁，连击达到 5 时全员获得超频', () => {
    const { g } = setup(0);
    UPGRADES.find((u) => u.id === 'chain').apply(g.players[0]);
    const row = [0, 1, 2, 3, 4].map((i) => enemyAt(g, 'scout', 300 + i * 60, 200));
    row.forEach((e) => (e.hp = 30));
    g.damageEnemy(row[0], 100);
    assert.ok(row.every((e) => e.dead), '相邻侦察车应被殉爆依次引爆');
    assert.ok(g.players[0].overdrive > 0);
});

test('裂隙主脑周期瞬移并召唤幽影，召唤数受敌军上限约束', () => {
    const { g } = setup(3);
    const boss = enemyAt(g, 'riftBoss', 640, 200);
    boss.blinkCd = 0;
    g.updateBlink(boss, g.core, 0.016);
    assert.ok(g.enemies.filter((e) => e.type === 'phantom').length >= 1);
    while (g.enemies.length < MAX_ENEMIES) enemyAt(g, 'scout', 100, 100);
    boss.blinkCd = 0;
    g.updateBlink(boss, g.core, 0.016);
    assert.equal(g.enemies.length, MAX_ENEMIES);
});

test('联机快照不再携带粒子与寻路数据，体积受控', () => {
    const { g } = setup(2, 2);
    g.burst(100, 100, '#fff', 300, 200);
    const snapshot = createSnapshot(g);
    assert.equal(snapshot.particles, undefined);
    assert.ok(g.particles.length > 0);
    assert.ok(Array.isArray(snapshot.portals));
    assert.ok(JSON.stringify(snapshot).length < 20000);
});

test('棱镜炮车先预警后发射光束，掩体截断光束并保护玩家', () => {
    const { g } = setup(1);
    const p = g.players[0];
    p.invincible = 0;
    p.x = 640;
    p.y = 600;
    const lancer = enemyAt(g, 'lancer', 640, 200);
    lancer.angle = Math.PI / 2;
    g.fire(lancer, true);
    assert.equal(g.beams.length, 1);
    g.updateBeams(0.5);
    assert.equal(p.hp, p.maxHp, '预警期间不造成伤害');
    g.updateBeams(0.6);
    assert.ok(p.hp < p.maxHp, '预警结束后光束命中玩家');
    // 中间放一块钢墙，新光束长度被截断，不再伤到墙后的玩家。
    g.walls = [{ x: 620, y: 380, w: 40, h: 40, hp: Infinity, maxHp: 85, steel: true, hit: 0 }];
    g.beams = [];
    p.hp = p.maxHp;
    p.invincible = 0;
    g.fire(lancer, true);
    assert.ok(g.beams[0].length < 260);
    g.updateBeams(1.1);
    assert.equal(p.hp, p.maxHp);
});

test('蜂群生成受同屏上限约束，贴身自爆伤害玩家', () => {
    const { g } = setup(0);
    g.enemies = [];
    const made = g.spawnSwarm(640, 300, 40);
    assert.equal(made.length, MAX_ENEMIES);
    const p = g.players[0];
    p.invincible = 0;
    g.enemies = [];
    const drone = enemyAt(g, 'swarm', p.x + 20, p.y);
    g.updateEnemy(drone, 0.016);
    assert.equal(drone.dead, true);
    assert.ok(p.hp < p.maxHp);
});

test('油桶被射爆后范围伤害敌军并连锁引爆相邻油桶', () => {
    const { g } = setup(0);
    g.barrels = [
        { x: 400, y: 300, radius: 15, hp: 30, dead: false },
        { x: 480, y: 300, radius: 15, hp: 30, dead: false },
    ];
    const enemy = enemyAt(g, 'raider', 560, 300);
    const p = g.players[0];
    p.x = 300;
    p.y = 300;
    g.createBullet(p, 0, false, 2000, 40);
    g.updateBullets(0.05);
    assert.ok(g.barrels.every((b) => b.dead), '两只油桶都应爆炸');
    assert.ok(enemy.hp < enemy.maxHp);
});

test('特装武器：扇面增加弹数，激光无限穿透，核弹清屏且不占武器槽', () => {
    const { g } = setup(0);
    const p = g.players[0];
    g.giveWeapon(p, 'fan');
    assert.equal(p.weapon, 'fan');
    assert.ok(p.weaponTime > 0);
    g.fire(p, false);
    assert.equal(g.bullets.length, 5);
    g.bullets = [];
    g.giveWeapon(p, 'laser');
    g.fire(p, false);
    assert.ok(g.bullets[0].pierce >= 99);
    const enemies = [0, 1, 2].map((i) => enemyAt(g, 'scout', 300 + i * 200, 200));
    g.giveWeapon(p, 'nuke');
    assert.equal(p.weapon, 'laser');
    assert.ok(enemies.every((e) => e.dead));
    g.updatePlayer(p, 20);
    assert.equal(p.weapon, '');
});

test('击杀积攒狂热值，满值进入狂热模式：射速翻倍、受伤减半', () => {
    const { g } = setup(0);
    const p = g.players[0];
    for (let i = 0; i < 25; i++) g.damageEnemy(enemyAt(g, 'raider', 200 + i * 10, 200), 9999);
    assert.ok(g.feverTime > 0, '25 次普通击毁应填满狂热值');
    p.invincible = 0;
    g.damagePlayer(p, 20);
    assert.equal(p.hp, p.maxHp - 10);
    g.keys.add('Space');
    p.fireCd = 0;
    g.updatePlayer(p, 0.001);
    assert.ok(Math.abs(p.fireCd - p.fireRate * 0.5) < 1e-9);
});

test('精英与首领必掉特装武器，首领还会掉落核弹', () => {
    const { g } = setup(0);
    g.wave = 10;
    const elite = enemyAt(g, 'raider', 400, 300);
    elite.affix = 'swift';
    g.pickups = [];
    g.damageEnemy(elite, 9999);
    assert.ok(g.pickups.some((item) => ['fan', 'laser', 'rocket', 'lightning', 'nuke'].includes(item.kind)));
    g.pickups = [];
    const boss = enemyAt(g, 'boss', 640, 200);
    g.damageEnemy(boss, 1e6);
    assert.ok(g.pickups.some((item) => item.kind === 'nuke'));
    assert.ok(g.pickups.length >= 5);
});

test('首领跌破三分之二耐久时进入二阶段并召唤蜂群护卫', () => {
    const { g } = setup(0);
    g.enemies = [];
    const boss = enemyAt(g, 'boss', 640, 200);
    boss.hp = boss.maxHp * 0.6;
    g.updateEnemy(boss, 0.016);
    assert.equal(boss.phase, 1);
    assert.ok(g.enemies.some((e) => e.drone));
    assert.ok(g.announce);
});

test('连锁闪电命中后跳向附近敌人，高爆弹头对周围敌军溅射', () => {
    const { g } = setup(0);
    const p = g.players[0];
    const targets = [0, 1, 2].map((i) => enemyAt(g, 'heavy', 500 + i * 100, 300));
    g.chainLightning(targets[0], 30, 3);
    assert.ok(targets[1].hp < targets[1].maxHp && targets[2].hp < targets[2].maxHp);
    assert.ok(g.arcs.length >= 2);
    UPGRADES.find((u) => u.id === 'explosive').apply(p);
    const a = enemyAt(g, 'heavy', 300, 600),
        b = enemyAt(g, 'heavy', 340, 600);
    p.x = 150;
    p.y = 600;
    g.createBullet(p, 0, false, 2000, 50, { explosive: p.explosive });
    g.updateBullets(0.1);
    assert.ok(b.hp < b.maxHp, '相邻敌军受到溅射');
});
