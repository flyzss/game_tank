import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { CHASSIS, TALENTS, ASCENSION, WAVES } from '../js/config.js';
import {
    META_KEY,
    defaultMeta,
    loadMeta,
    saveMeta,
    shardsFor,
    recordRun,
    buyChassis,
    selectChassis,
    buyTalent,
    talentCost,
    selectAscension,
} from '../js/meta.js';
import { RoomManager } from '../server/rooms.js';

/** 内存版存储，模拟浏览器 localStorage 的 getItem / setItem。 */
function memoryStorage(initial = {}) {
    const data = { ...initial };
    return { getItem: (key) => data[key] ?? null, setItem: (key, value) => (data[key] = String(value)), data };
}
/** 创建一个指定开局参数的正式对局。 */
function startGame(options = {}, mode = 1, chapter = 0) {
    const g = new Game({ play() {}, update() {} }, () => {});
    g.start(mode, chapter, options);
    return g;
}

test('存档读写往返一致，损坏或越界的存档回落到安全值', () => {
    const storage = memoryStorage();
    const meta = defaultMeta();
    meta.shards = 900;
    buyChassis(meta, 'heavy');
    buyTalent(meta, 'armor');
    saveMeta(storage, meta);
    assert.deepEqual(loadMeta(storage), meta);
    const broken = memoryStorage({
        [META_KEY]: JSON.stringify({ shards: -5, chassis: ['heavy', 'hacked'], selected: 'hacked', talents: { armor: 99, fake: 3 }, maxAscension: 99, ascension: 50 }),
    });
    const safe = loadMeta(broken);
    assert.equal(safe.shards, 0);
    assert.deepEqual(safe.chassis, ['standard', 'heavy']);
    assert.equal(safe.selected, 'standard');
    assert.equal(safe.talents.armor, TALENTS.find((t) => t.id === 'armor').costs.length);
    assert.equal(safe.talents.fake, undefined);
    assert.equal(safe.maxAscension, ASCENSION.length);
    assert.deepEqual(loadMeta(memoryStorage({ [META_KEY]: '{not json' })), defaultMeta());
    assert.deepEqual(loadMeta(null), defaultMeta());
});

test('碎片结算按积分、波数、胜利、余烬等级与打捞天赋计算，同一局只领取一次', () => {
    assert.equal(shardsFor({ score: 10000, cleared: 4, win: false, ascension: 0 }), 40);
    assert.equal(shardsFor({ score: 10000, cleared: 24, win: true, ascension: 2 }), Math.round(240 * 1.3));
    assert.equal(shardsFor({ score: 0, cleared: 2, ascension: 0 }, 2), Math.round(10 * 1.3));
    const meta = defaultMeta();
    const first = recordRun(meta, { runId: 'a', score: 5000, cleared: 3, win: false, chapter: 0, ascension: 0 });
    assert.equal(first.earned, 25);
    assert.equal(meta.shards, 25);
    assert.equal(recordRun(meta, { runId: 'a', score: 5000, cleared: 3 }), null);
    assert.equal(meta.shards, 25);
});

test('余烬等级只有从第 1 关打通当前最高等级才会解锁下一级', () => {
    const meta = defaultMeta();
    assert.equal(recordRun(meta, { runId: 'x1', win: true, chapter: 3, ascension: 0, cleared: 6 }).unlocked, 0);
    assert.equal(recordRun(meta, { runId: 'x2', win: false, chapter: 0, ascension: 0, cleared: 10 }).unlocked, 0);
    assert.equal(recordRun(meta, { runId: 'x3', win: true, chapter: 0, ascension: 0, cleared: 24 }).unlocked, 1);
    assert.equal(meta.maxAscension, 1);
    assert.equal(meta.ascension, 1);
    // 用低于最高等级的难度通关不会继续解锁。
    selectAscension(meta, 0);
    assert.equal(recordRun(meta, { runId: 'x4', win: true, chapter: 0, ascension: 0, cleared: 24 }).unlocked, 0);
    assert.equal(selectAscension(meta, 9), 1, '不能选择未解锁的等级');
});

test('底盘与天赋购买需要足够碎片，满级后不能继续购买', () => {
    const meta = defaultMeta();
    assert.equal(buyChassis(meta, 'heavy'), false);
    meta.shards = CHASSIS.heavy.cost;
    assert.equal(buyChassis(meta, 'heavy'), true);
    assert.equal(meta.shards, 0);
    assert.equal(meta.selected, 'heavy');
    assert.equal(buyChassis(meta, 'heavy'), false, '不能重复购买');
    assert.equal(selectChassis(meta, 'rapid'), false, '未拥有的底盘不能选用');
    assert.equal(selectChassis(meta, 'standard'), true);
    const reroll = TALENTS.find((t) => t.id === 'reroll');
    meta.shards = reroll.costs.reduce((a, b) => a + b, 0) + 999;
    for (const cost of reroll.costs) {
        assert.equal(talentCost(meta, 'reroll'), cost);
        assert.equal(buyTalent(meta, 'reroll'), true);
    }
    assert.equal(talentCost(meta, 'reroll'), null);
    assert.equal(buyTalent(meta, 'reroll'), false);
    assert.equal(meta.shards, 999);
});

test('底盘改变玩家属性：重炮更痛更慢，速射更快更脆，工程自带僚机', () => {
    const base = startGame().players[0];
    const heavy = startGame({ chassis: ['heavy'] }).players[0];
    const rapid = startGame({ chassis: ['rapid'] }).players[0];
    const engineer = startGame({ chassis: ['engineer'] }).players[0];
    assert.ok(heavy.damage > base.damage && heavy.fireRate > base.fireRate && heavy.speed < base.speed);
    assert.equal(heavy.maxHp, base.maxHp + 40);
    assert.equal(heavy.hp, heavy.maxHp);
    assert.equal(heavy.chassis, 'heavy');
    assert.ok(rapid.fireRate < base.fireRate && rapid.damage < base.damage && rapid.radius < base.radius);
    assert.equal(engineer.drones, 1);
    assert.equal(startGame({ chassis: ['hacked'] }).players[0].chassis, 'standard');
    // 同屏双人按顺序分别套用。
    const duo = startGame({ chassis: ['heavy', 'rapid'] }, 2);
    assert.deepEqual(duo.players.map((p) => p.chassis), ['heavy', 'rapid']);
});

test('天赋影响开局：装甲、核心、刷新、狂热与先发特装，越界等级被截断', () => {
    const g = startGame({ talents: { armor: 3, core: 2, reroll: 2, fever: 2, weapon: 1, salvage: 9 } });
    const p = g.players[0];
    assert.equal(p.maxHp, 130);
    assert.equal(g.core.maxHp, 580);
    assert.equal(g.core.hp, 580);
    assert.equal(g.rerolls, 4);
    assert.equal(g.fever, 50);
    assert.ok(p.weapon && p.weaponTime <= 6);
    assert.equal(g.talents.salvage, 2);
});

test('余烬等级词条：耐久、精英、移速、核心、伤害、数量、掉率、首领、刷新与狂热', () => {
    const normal = startGame();
    const hard = startGame({ ascension: ASCENSION.length });
    const a = normal.makeEnemy('raider', 0, 0),
        b = hard.makeEnemy('raider', 0, 0);
    assert.ok(Math.abs(b.maxHp / a.maxHp - 1.15) < 1e-9);
    assert.ok(Math.abs(b.speed / a.speed - 1.12) < 1e-9);
    assert.ok(Math.abs(b.damage / a.damage - 1.2) < 1e-9);
    const bossA = normal.makeEnemy('boss', 0, 0),
        bossB = hard.makeEnemy('boss', 0, 0);
    assert.ok(Math.abs(bossB.maxHp / bossA.maxHp - 1.15 * 1.3) < 1e-9);
    assert.equal(hard.waveCount(), Math.round(WAVES[0].count * 1.2));
    assert.equal(hard.rerolls, 1);
    // 核心过载：清波不修复核心，重建消耗 60。
    hard.core.hp = 300;
    hard.enemies = [];
    hard.completeWave();
    assert.equal(hard.core.hp, 300);
    const revive = startGame({ ascension: 4 });
    const p = revive.players[0];
    p.hp = 0;
    p.deadTime = 7;
    revive.updatePlayer(p, 1 / 60);
    assert.equal(revive.core.hp, revive.core.maxHp - 60);
    // 狂热积攒 −30%。
    hard.fever = 0;
    hard.feverTime = 0;
    hard.addFever(10);
    assert.ok(Math.abs(hard.fever - 7) < 1e-9);
});

test('结算事件携带本局编号、余烬等级与肃清波数', () => {
    const events = [];
    const g = new Game({ play() {}, update() {} }, (type, data) => events.push({ type, data }));
    g.start(1, 1, { ascension: 2 });
    g.wave = 10;
    g.finish(false);
    const result = events.find((e) => e.type === 'finish').data;
    assert.equal(result.ascension, 2);
    assert.equal(result.chapter, 1);
    assert.equal(result.cleared, 3);
    assert.ok(result.runId);
});

test('联机房间只接受合法底盘编号与等级范围，开局不读取任何天赋', () => {
    const manager = new RoomManager();
    const sent = [];
    const socket = (name) => ({ name, readyState: 1, send: (text) => sent.push([name, JSON.parse(text)]), close() {} });
    const host = socket('host'),
        guest = socket('guest');
    manager.handle(host, { type: 'create', chapter: 0, ascension: 99 });
    const room = [...manager.rooms.values()][0];
    assert.equal(room.ascension, ASCENSION.length);
    manager.handle(guest, { type: 'join', code: room.code });
    manager.handle(host, { type: 'ready', ready: true, chassis: 'heavy' });
    manager.handle(guest, { type: 'ready', ready: true, chassis: 'hacked' });
    manager.handle(host, { type: 'start' });
    assert.deepEqual(room.game.players.map((p) => p.chassis), ['heavy', 'standard']);
    assert.equal(room.game.ascension, ASCENSION.length);
    assert.deepEqual(room.game.talents, {});
});
