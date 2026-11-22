import { ENEMIES } from './config.js';

/** 服务器内部字段或纯装饰字段，不进入网络快照。 */
const SKIPPED_KEYS = new Set(['path', 'pathCd', 'hitIds', 'seed', 'blinkCd', 'healCd', 'targetCore', 'explosive', 'homing', 'arc', 'rocketSide', 'owner', 'droneCd', 'feverGain', 'weaponBonus']);
/**
 * 敌人身上只有服务器结算需要、客户端渲染从不读取的字段（伤害、射速、射程、积分、移速与各类冷却）。
 * fireCd 例外：远射猎手需要它绘制瞄准线，因此只对 sniper 保留。
 */
const ENEMY_SERVER_KEYS = new Set(['damage', 'cooldown', 'range', 'score', 'speed', 'radialCd', 'fireCd', 'dead']);
/** 敌人瞬时状态的默认值：等于默认值的字段不下发，客户端还原时补回。 */
const ENEMY_DEFAULTS = { hit: 0, recoil: 0, charge: 0, warning: 0, moving: false, tread: 0, joltX: 0, joltY: 0, phase: 0 };
/**
 * 玩家下发白名单：只包含渲染、HUD 与本地移动预测（speed、radius）读取的字段。
 * 伤害、射速、穿透、吸能、暴击等改装数值只在服务器结算，客户端从不读取，不再每帧重复发送。
 */
const PLAYER_KEYS = [
    'id', 'x', 'y', 'radius', 'angle', 'bodyAngle', 'hp', 'maxHp', 'speed', 'invincible',
    'dashCd', 'dashTime', 'novaCd', 'supportCd', 'recoil', 'hit', 'moving', 'tread', 'deadTime',
    'color', 'overdrive', 'shield', 'drones', 'weapon', 'weaponTime', 'joltX', 'joltY', 'chassis',
];
/** 与 JSON 快照一致的数值压缩：保留两位小数，Infinity（钢墙耐久）写成 1e9。 */
const roundNumber = (value) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : 1e9);
/**
 * 敌人精简：凡是与该类型配置（ENEMIES[type]）或瞬时默认值相同的字段一律省略，只发实例独有的数据。
 * 例如名称、颜色、半径通常与配置一致，被省略；悬赏精英改过颜色与半径，就会照常下发。
 * 每辆敌人约从 340 字节降到 150 字节以内。
 */
function compactEnemy(e) {
    const base = ENEMIES[e.type] || {};
    const lite = {};
    for (const [key, value] of Object.entries(e)) {
        if (SKIPPED_KEYS.has(key) || (ENEMY_SERVER_KEYS.has(key) && !(key === 'fireCd' && e.type === 'sniper'))) continue;
        const fallback = key in base ? base[key] : ENEMY_DEFAULTS[key];
        if (fallback !== undefined && (typeof value === 'number' ? roundNumber(value) === roundNumber(fallback) : value === fallback))
            continue;
        lite[key] = value;
    }
    return lite;
}
/**
 * 掩体布局全量序列化：只在新连接或换战区（layoutVersion 变化）时随快照下发一次，约 2KB。
 * 平时每张快照只附带 wallHp 耐久数组，见 createSnapshot。
 */
export function serializeWalls(game) {
    return game.walls.map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h, hp: roundNumber(w.hp), maxHp: w.maxHp, steel: w.steel, hit: 0 }));
}
/**
 * 联机快照只传渲染与界面所需状态；规则、碰撞和随机数留在服务器执行。
 * 参数 options.walls 为 true 时附带完整掩体布局（新连接、换战区时使用）；
 * 否则只附带 wallHp：与布局同序的耐久整数数组，钢墙写 -1，客户端据此更新耐久与受击闪光。
 */
export function createSnapshot(game, options = {}) {
    const fields = [
        'state',
        'mode',
        'chapter',
        'time',
        'wave',
        'zone',
        'score',
        'kills',
        'combo',
        'comboTime',
        'core',
        'players',
        'enemies',
        'bullets',
        'layoutVersion',
        'rings',
        'texts',
        'pickups',
        'wrecks',
        'impacts',
        'camera',
        'shake',
        'flash',
        'whiteFlash',
        'turrets',
        'hazards',
        'beacon',
        'portals',
        // 新增战场实体与爽快度系统：油桶、棱镜光束、闪电弧、狂热值、连杀播报。
        'barrels',
        'beams',
        'arcs',
        'fever',
        'feverTime',
        'streak',
        'announce',
        // 改装刷新次数、上一波评级与首领终结慢动作。
        'rerolls',
        // 余烬等级：客户端 HUD 显示当前难度。
        'ascension',
        'lastGrade',
        'slowmo',
        'upgrades',
        'spawned',
        'best',
    ];
    const result = {};
    for (const key of fields) result[key] = game[key];
    // 弹体是快照里数量最多的实体：客户端只用它渲染，因此只保留坐标、朝向、阵营与非默认的外观字段。
    // 火焰需要 life 计算膨胀与淡出；其余默认值（空 kind、无暴击、无染色）一律省略，满屏弹幕时体积可降到约三分之一。
    result.bullets = (game.bullets || []).map((b) => {
        const lite = { x: b.x, y: b.y, angle: b.angle, enemy: b.enemy };
        if (b.kind) lite.kind = b.kind;
        if (b.kind === 'flame') lite.life = b.life;
        if (b.crit) lite.crit = true;
        if (b.tint) lite.tint = b.tint;
        return lite;
    });
    result.enemies = (game.enemies || []).map(compactEnemy);
    result.players = (game.players || []).map((p) => Object.fromEntries(PLAYER_KEYS.map((key) => [key, p[key]])));
    result.wallHp = (game.walls || []).map((w) => (w.steel ? -1 : Math.max(0, Math.round(w.hp))));
    if (options.walls) result.walls = serializeWalls(game);
    result.choices = (game.choices || []).map((choice) => choice.id);
    // 省略只供服务器使用的寻路、穿透集合与掩体噪声种子；粒子改由客户端按 bursts 参数本地生成。
    // 数值保留两位小数：逻辑坐标以像素计，0.01 像素与 0.01 弧度的误差肉眼不可见，却能明显缩小快照。
    return JSON.parse(
        JSON.stringify(result, (key, value) => {
            if (SKIPPED_KEYS.has(key)) return undefined;
            if (typeof value === 'number')
                return Number.isFinite(value) ? Math.round(value * 100) / 100 : 1e9;
            return value;
        }),
    );
}
/**
 * 客户端还原快照（在 Object.assign 之后调用）：
 * 1. 敌人用「瞬时默认值 + 类型配置 + 下发字段」三层合并，恢复渲染需要的名称、颜色、半径等；
 * 2. 布局版本一致时按 wallHp 更新掩体耐久，耐久下降的掩体触发 0.12 秒受击闪光。
 * 参数 game 为客户端游戏实例，snapshot 为刚收到的快照。
 */
export function expandSnapshot(game, snapshot) {
    if (Array.isArray(snapshot.enemies))
        game.enemies = snapshot.enemies.map((e) => ({ ...ENEMY_DEFAULTS, ...(ENEMIES[e.type] || {}), ...e }));
    if (Array.isArray(snapshot.wallHp) && Array.isArray(game.walls) && snapshot.wallHp.length === game.walls.length)
        snapshot.wallHp.forEach((hp, index) => {
            const wall = game.walls[index];
            if (hp < 0) return;
            if (hp < wall.hp) wall.hit = 0.12;
            wall.hp = hp;
        });
}
/** 只接收有限范围的操作数据，不接收客户端位置、血量、积分或伤害。 */
export function sanitizeInput(value = {}) {
    const number = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    let x = Math.max(-1, Math.min(1, number(value.x))),
        y = Math.max(-1, Math.min(1, number(value.y)));
    const length = Math.hypot(x, y);
    if (length > 1) {
        x /= length;
        y /= length;
    }
    return {
        x,
        y,
        fire: value.fire === true,
        aim:
            typeof value.aim === 'number' && Number.isFinite(value.aim)
                ? Math.atan2(Math.sin(value.aim), Math.cos(value.aim))
                : null,
    };
}
