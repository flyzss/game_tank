/** 服务器内部字段或纯装饰字段，不进入网络快照。 */
const SKIPPED_KEYS = new Set(['path', 'pathCd', 'hitIds', 'seed', 'blinkCd', 'healCd', 'targetCore', 'explosive', 'homing', 'arc', 'rocketSide', 'owner', 'droneCd', 'feverGain', 'weaponBonus']);
/** 联机快照只传渲染与界面所需状态；规则、碰撞和随机数留在服务器执行。 */
export function createSnapshot(game) {
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
        'walls',
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
