/** 战役配置与实体参数以数据组织，服务器和浏览器共同读取同一套规则。 */
export const WORLD = { width: 1280, height: 800, cell: 40 };
/** 四个战区各六关；战区属性同时驱动碰撞地图、背景材质与房间章节选择。 */
export const ZONES = [
    { name: '灰烬工业区', subtitle: 'ASH DISTRICT', ground: '#343e30', road: '#3b4339', cover: '#6a7057' },
    { name: '霜线中继站', subtitle: 'FROST RELAY', ground: '#344a4d', road: '#46585b', cover: '#798f92' },
    { name: '熔炉禁区', subtitle: 'THE FOUNDRY', ground: '#493b32', road: '#55463c', cover: '#8a7560' },
    // 第四战区：相位裂隙撕开了旧战场，地面泛着冷紫色，敌军会闪烁位移与架盾推进。
    { name: '虚空裂隙', subtitle: 'THE RIFT', ground: '#33324a', road: '#3d3c55', cover: '#77719a' },
];
/** 事件提供不同的战术目标；描述同时出现在任务提示与房间章节介绍中。 */
export const FIELD_EVENTS = {
    supply: { name: '战地补给', description: '维修模块已投放，靠近自动拾取。' },
    overdrive: { name: '超频电池', description: '拾取橙色电池，获得 8 秒双倍射速。' },
    bombardment: { name: '危险炮击', description: '避开红色预警圈，也可将敌军引入轰炸区。' },
    beacon: { name: '信标争夺', description: '在中央信标附近坚守 4 秒，为核心修复并获得奖励。' },
    // 悬赏：本波中途出现一辆金色精英战车，耐久更高，击毁后给予大量积分与全员修复。
    bounty: { name: '悬赏目标', description: '击毁金色精英战车，奖励 1000 积分并全员修复。' },
    // 裂隙门：左右两座相位门互相连通，玩家驶入即可瞬移到另一侧，用于救援核心或甩开追兵。
    rift: { name: '相位裂隙', description: '驶入紫色相位门可瞬移到另一侧，灵活支援两翼。' },
    // 火力全开：开波即给每名玩家配发一件随机特装武器，本波武器掉率提高到三倍。
    frenzy: { name: '火力全开', description: '全员获得随机特装武器，本波武器掉率 ×3，尽情倾泻火力！' },
    // 油桶阵：战场中央额外堆放一批燃料桶，射爆即可大范围殉爆，引敌入阵一网打尽。
    barrels: { name: '燃料油桶阵', description: '射击红色油桶引发连环大爆炸，把敌军引进去再点火。' },
    // 蜂群潮：本波每隔数秒从战场边缘涌入额外的蜂群无人机，适合扫射清场。
    swarm: { name: '蜂群潮汐', description: '无人机群从四面涌来——它们很脆，按住开火扫个痛快。' },
};
/** 同屏敌军上限：既保证割草的密度，也限制服务器快照体积与寻路开销。 */
export const MAX_ENEMIES = 26;
/**
 * 特装武器：击毁敌军随机掉落，拾取后持续 duration 秒；新拾取的武器会替换当前武器并重置时间。
 * nuke 为一次性清屏核弹，没有持续时间。color 同时用于掉落物、车体标签与 HUD。
 */
export const WEAPONS = {
    fan: { name: '扇面弹幕', short: '扇', color: '#ffd36e', duration: 10 },
    laser: { name: '贯穿激光', short: '光', color: '#7ff0ff', duration: 9 },
    rocket: { name: '追踪飞弹', short: '弹', color: '#ff9a5a', duration: 10 },
    lightning: { name: '连锁闪电', short: '电', color: '#b5a6ff', duration: 10 },
    nuke: { name: '清屏核弹', short: '核', color: '#ff6b6b', duration: 0 },
};
/**
 * 精英词缀：第 4 关起普通敌军有概率附带一个词缀，耐久更高并必掉特装武器。
 * swift 提升移速与射速；armored 大幅提高耐久；volatile 阵亡时爆炸，敌我皆伤。
 */
export const AFFIXES = {
    swift: { name: '迅捷', color: '#8ef0b0' },
    armored: { name: '重甲', color: '#c7c9d6' },
    volatile: { name: '爆裂', color: '#ff8a5c' },
};
/**
 * 二十四波战役：敌军数量约为旧版 1.5 倍、生成间隔更短，并逐步引入蜂群、喷火、棱镜与母舰。
 * count 为本波生成次数（蜂群一次生成一整队），interval 为两次生成间隔（秒），
 * types 按顺序循环抽取，boss 固定在本波第一次生成，event 为本波战场事件。
 */
export const WAVES = [
    { title: '废墟来客', subtitle: 'FIRST CONTACT', count: 10, interval: 1.3, types: ['scout', 'scout', 'raider'], event: 'supply' },
    { title: '钢铁洪流', subtitle: 'STEEL TIDE', count: 14, interval: 1.15, types: ['scout', 'raider', 'swarm'], event: 'frenzy' },
    { title: '远处的猎手', subtitle: 'DEADLY HORIZON', count: 16, interval: 1.15, types: ['sniper', 'scout', 'raider', 'swarm'], event: 'beacon' },
    { title: '重装来袭', subtitle: 'HEAVY PRESSURE', count: 20, interval: 1.05, types: ['heavy', 'raider', 'sniper', 'flamer'], event: 'barrels' },
    { title: '自爆车队', subtitle: 'SUICIDE CONVOY', count: 24, interval: 0.9, types: ['bomber', 'swarm', 'scout', 'raider'], event: 'swarm' },
    { title: '灰烬之王', subtitle: 'THE ASHEN COLOSSUS', count: 18, interval: 1.3, types: ['heavy', 'raider', 'flamer', 'swarm'], boss: 'boss', event: 'supply' },
    { title: '雪线遭遇', subtitle: 'WHITE CONTACT', count: 20, interval: 1.05, types: ['scout', 'engineer', 'raider', 'lancer'], event: 'beacon' },
    { title: '远程压制', subtitle: 'FALLING STEEL', count: 22, interval: 1.05, types: ['artillery', 'lancer', 'raider', 'swarm'], event: 'bombardment' },
    { title: '裂变车群', subtitle: 'FRACTURE SWARM', count: 24, interval: 0.95, types: ['splitter', 'scout', 'bomber'], event: 'bounty' },
    { title: '冰原救援', subtitle: 'THE RELAY MUST HOLD', count: 26, interval: 0.9, types: ['engineer', 'heavy', 'flamer', 'swarm'], event: 'frenzy' },
    { title: '极夜封锁', subtitle: 'POLAR SIEGE', count: 28, interval: 0.9, types: ['artillery', 'carrier', 'bomber', 'heavy'], event: 'barrels' },
    { title: '霜脊堡垒', subtitle: 'FROSTBOUND TITAN', count: 20, interval: 1.2, types: ['heavy', 'engineer', 'lancer', 'swarm'], boss: 'frostBoss', event: 'overdrive' },
    { title: '深入熔炉', subtitle: 'INTO THE FOUNDRY', count: 26, interval: 0.9, types: ['bomber', 'splitter', 'flamer', 'raider'], event: 'bombardment' },
    { title: '炼狱工兵', subtitle: 'REPAIR THE WAR', count: 28, interval: 0.9, types: ['engineer', 'heavy', 'artillery', 'flamer'], event: 'beacon' },
    { title: '爆裂回路', subtitle: 'CHAIN REACTION', count: 32, interval: 0.75, types: ['bomber', 'splitter', 'swarm', 'scout'], event: 'swarm' },
    { title: '火雨防线', subtitle: 'UNDER THE FIRESTORM', count: 30, interval: 0.85, types: ['artillery', 'lancer', 'heavy', 'carrier'], event: 'barrels' },
    { title: '黎明之前', subtitle: 'ONE LAST STAND', count: 34, interval: 0.75, types: ['splitter', 'engineer', 'bomber', 'heavy', 'flamer'], event: 'frenzy' },
    { title: '熔炉主宰', subtitle: 'HEART OF THE INFERNO', count: 24, interval: 1.1, types: ['heavy', 'artillery', 'flamer', 'carrier'], boss: 'infernoBoss', event: 'beacon' },
    // ---- 第四战区「虚空裂隙」：相位幽影、盾卫战车与裂隙主脑，配合棱镜与母舰形成立体火力 ----
    { title: '裂隙初现', subtitle: 'FIRST RIFT', count: 26, interval: 0.95, types: ['phantom', 'scout', 'raider', 'swarm'], event: 'rift' },
    { title: '盾墙推进', subtitle: 'SHIELD WALL', count: 28, interval: 0.9, types: ['guardian', 'sniper', 'flamer', 'lancer'], event: 'bounty' },
    { title: '相位猎杀', subtitle: 'PHASE HUNT', count: 30, interval: 0.85, types: ['phantom', 'bomber', 'guardian', 'swarm'], event: 'swarm' },
    { title: '虚空回廊', subtitle: 'HOLLOW CORRIDOR', count: 32, interval: 0.8, types: ['guardian', 'engineer', 'artillery', 'phantom', 'carrier'], event: 'rift' },
    { title: '最后的微光', subtitle: 'LAST LIGHT', count: 36, interval: 0.7, types: ['splitter', 'phantom', 'guardian', 'heavy', 'lancer'], event: 'frenzy' },
    { title: '裂隙主脑', subtitle: 'THE RIFT MIND', count: 26, interval: 1, types: ['guardian', 'phantom', 'artillery', 'carrier'], boss: 'riftBoss', event: 'supply' },
];
/** 不同敌人拥有独立的速度、装甲、交战距离和火力节奏。 */
export const ENEMIES = {
    scout: {
        name: '掠袭者',
        hp: 38,
        speed: 100,
        cooldown: 1.8,
        damage: 7,
        range: 230,
        score: 100,
        color: '#d5a15e',
        radius: 16,
    },
    raider: {
        name: '突击战车',
        hp: 70,
        speed: 65,
        cooldown: 2,
        damage: 10,
        range: 320,
        score: 160,
        color: '#cc7853',
        radius: 19,
    },
    sniper: {
        name: '远射猎手',
        hp: 50,
        speed: 48,
        cooldown: 3,
        damage: 17,
        range: 530,
        score: 220,
        color: '#b78b77',
        radius: 17,
    },
    heavy: {
        name: '重装堡垒',
        hp: 165,
        speed: 40,
        cooldown: 2.4,
        damage: 13,
        range: 350,
        score: 300,
        color: '#9b8c63',
        radius: 24,
    },
    bomber: {
        name: '自爆突击车',
        hp: 32,
        speed: 145,
        cooldown: 10,
        damage: 26,
        range: 65,
        score: 180,
        color: '#e8a56c',
        radius: 15,
    },
    engineer: {
        name: '战地工兵',
        hp: 95,
        speed: 58,
        cooldown: 2.8,
        damage: 6,
        range: 340,
        score: 260,
        color: '#b3be8d',
        radius: 19,
    },
    artillery: {
        name: '自行火炮',
        hp: 100,
        speed: 38,
        cooldown: 4.2,
        damage: 24,
        range: 650,
        score: 300,
        color: '#b7a596',
        radius: 23,
    },
    splitter: {
        name: '裂变母车',
        hp: 150,
        speed: 53,
        cooldown: 2.1,
        damage: 10,
        range: 280,
        score: 320,
        color: '#bfa078',
        radius: 24,
    },
    // 盾卫战车：车头装有相位护盾，正面命中只造成 25% 伤害，鼓励绕侧或用震荡与炮击破防。
    guardian: {
        name: '盾卫战车',
        hp: 125,
        speed: 50,
        cooldown: 2.3,
        damage: 11,
        range: 300,
        score: 280,
        color: '#9fa7c9',
        radius: 21,
        shield: true,
    },
    // 相位幽影：每隔数秒向目标方向闪烁一段距离，不能靠掩体长期卡位。
    phantom: {
        name: '相位幽影',
        hp: 58,
        speed: 82,
        cooldown: 1.9,
        damage: 11,
        range: 300,
        score: 240,
        color: '#b49be0',
        radius: 17,
        blink: true,
    },
    // 蜂群无人机：极脆、极快，成队出现并撞向目标自爆；单只威胁小，成群时必须扫射清理。
    swarm: {
        name: '蜂群无人机',
        hp: 16,
        speed: 165,
        cooldown: 99,
        damage: 8,
        range: 40,
        score: 40,
        color: '#e8c56c',
        radius: 11,
        drone: true,
    },
    // 喷火战车：短距离持续喷射火焰，近身压制极强，需要在射程外远程点杀。
    flamer: {
        name: '喷火战车',
        hp: 120,
        speed: 64,
        cooldown: 0.13,
        damage: 6,
        range: 175,
        score: 260,
        color: '#e0804a',
        radius: 20,
    },
    // 棱镜炮车：锁定后显示 1 秒激光预警线，随后发射贯穿光束，被掩体阻挡。
    lancer: {
        name: '棱镜炮车',
        hp: 85,
        speed: 44,
        cooldown: 3.6,
        damage: 26,
        range: 640,
        score: 300,
        color: '#8fc7d8',
        radius: 19,
    },
    // 蜂巢母舰：自身不开炮，但会周期性释放蜂群无人机；优先击毁可以截断源源不断的增援。
    carrier: {
        name: '蜂巢母舰',
        hp: 280,
        speed: 30,
        cooldown: 5,
        damage: 0,
        range: 720,
        score: 480,
        color: '#a99a70',
        radius: 27,
    },
    frostBoss: {
        name: '霜脊堡垒',
        hp: 2600,
        speed: 34,
        cooldown: 1.5,
        damage: 15,
        range: 570,
        score: 3500,
        color: '#a6cbd0',
        radius: 43,
        boss: true,
    },
    infernoBoss: {
        name: '熔炉主宰',
        hp: 3100,
        speed: 38,
        cooldown: 1.3,
        damage: 16,
        range: 590,
        score: 5000,
        color: '#ef9a62',
        radius: 45,
        boss: true,
    },
    // 裂隙主脑：最终首领，周期性瞬移并召唤相位幽影，半血后弹幕变为双层螺旋。
    riftBoss: {
        name: '裂隙主脑',
        hp: 3600,
        speed: 36,
        cooldown: 1.3,
        damage: 16,
        range: 600,
        score: 7000,
        color: '#c3a4f2',
        radius: 45,
        boss: true,
    },
    boss: {
        boss: true,
        name: '灰烬之王',
        hp: 2200,
        speed: 31,
        cooldown: 1.6,
        damage: 12,
        range: 560,
        score: 2500,
        color: '#dc8b58',
        radius: 43,
    },
};
/**
 * 改装稀有度：决定在三选一中出现的权重与卡面颜色。普通最常见，传说最稀有；
 * evolution（进化）不参与随机抽取，只在凑齐前置改装后必定出现一次。
 */
export const RARITY = {
    common: { name: '普通', weight: 6, color: '#bfccb5' },
    rare: { name: '稀有', weight: 3, color: '#7fc8ff' },
    legendary: { name: '传说', weight: 1, color: '#ffb35c' },
    evolution: { name: '进化', weight: 0, color: '#ff7ad9' },
};
/** 升级池：每波抽取三种不同改装，效果同时作用于所有存活及复活后的玩家。 */
export const UPGRADES = [
    {
        id: 'sentry',
        rarity: 'common',
        name: '自动哨戒系统',
        text: '炮台伤害提高 40%，部署冷却缩短 20%。',
        icon: 'core',
        apply: (p) => {
            p.supportDamage *= 1.4;
            p.supportMax *= 0.8;
        },
    },
    {
        id: 'regen',
        rarity: 'common',
        name: '纳米修复层',
        text: '持续修复每秒 1.5 装甲，积少成多。',
        icon: 'shield',
        max: 3,
        apply: (p) => {
            p.regen += 1.5;
        },
    },
    {
        id: 'battery',
        rarity: 'common',
        name: '战术能量回路',
        text: '冲刺与震荡冷却各缩短 15%，维修拾取额外恢复 10 装甲。',
        icon: 'rapid',
        apply: (p) => {
            p.dashMax *= 0.85;
            p.novaMax *= 0.85;
            p.repairBonus += 10;
        },
    },
    {
        id: 'damage',
        rarity: 'common',
        name: '钨芯穿甲弹',
        text: '主炮伤害提高 30%，正面击穿重装防线。',
        icon: 'shell',
        apply: (p) => {
            p.damage *= 1.3;
        },
    },
    {
        id: 'rapid',
        rarity: 'common',
        name: '高速装填机',
        text: '主炮射速提高 22%，持续压制来袭敌军。',
        icon: 'rapid',
        apply: (p) => {
            p.fireRate = Math.max(0.085, p.fireRate * 0.78);
        },
    },
    {
        id: 'spread',
        rarity: 'rare',
        name: '双联散射炮',
        text: '额外发射一枚散射弹，扩大火力覆盖。',
        icon: 'spread',
        max: 2,
        apply: (p) => {
            p.multishot += 1;
        },
    },
    {
        id: 'armor',
        rarity: 'common',
        name: '复合反应装甲',
        text: '装甲上限增加 35，立即修复全部装甲。',
        icon: 'shield',
        apply: (p) => {
            p.maxHp += 35;
            p.hp = p.maxHp;
        },
    },
    {
        id: 'speed',
        rarity: 'common',
        name: '超频涡轮',
        text: '移动速度提高 15%，冲刺冷却缩短 15%。',
        icon: 'speed',
        apply: (p) => {
            p.speed *= 1.15;
            p.dashMax *= 0.85;
        },
    },
    {
        id: 'nova',
        rarity: 'rare',
        name: '震荡放大器',
        text: '震荡伤害提高 45%，冷却缩短 20%。',
        icon: 'nova',
        apply: (p) => {
            p.novaDamage *= 1.45;
            p.novaMax *= 0.8;
        },
    },
    {
        id: 'repair',
        rarity: 'common',
        name: '核心修复协议',
        text: '修复核心 30% 耐久，同时全员恢复装甲。',
        icon: 'core',
        apply: (p) => {
            p.hp = p.maxHp;
        },
    },
    {
        id: 'pierce',
        rarity: 'rare',
        name: '贯穿弹头',
        text: '炮弹额外穿透一个目标，弹速提高 10%。',
        icon: 'shell',
        max: 2,
        apply: (p) => {
            p.pierce += 1;
            p.bulletSpeed *= 1.1;
        },
    },
    {
        // 跳弹：命中掩体后反弹一次而不是消失，可以打到掩体后面的敌人。
        id: 'ricochet',
        rarity: 'rare',
        name: '跳弹偏转器',
        text: '炮弹撞墙后反弹一次，绕过掩体打击敌人。',
        icon: 'spread',
        max: 2,
        apply: (p) => {
            p.bounce += 1;
        },
    },
    {
        // 吸能：每次击毁敌军，全体存活队员回复少量装甲，鼓励主动进攻。
        id: 'vampire',
        rarity: 'rare',
        name: '残骸吸能装置',
        text: '每击毁一辆敌军，全员回复 4 点装甲。',
        icon: 'shield',
        max: 2,
        apply: (p) => {
            p.lifesteal += 4;
        },
    },
    {
        // 殉爆：被击毁的敌军原地爆炸，波及周围敌军，可触发连锁反应。
        id: 'chain',
        rarity: 'legendary',
        name: '殉爆诱导弹',
        text: '敌军被击毁时发生殉爆，对周围敌军造成 45 伤害。',
        icon: 'nova',
        max: 1,
        apply: (p) => {
            p.chain = true;
        },
    },
    {
        // 高爆弹头：主炮命中敌军时额外爆炸，按命中伤害比例波及周围敌军，叠加两次后清群极快。
        id: 'explosive',
        rarity: 'rare',
        name: '高爆弹头',
        text: '炮弹命中时爆炸，对周围敌军造成 40% 溅射伤害。',
        icon: 'nova',
        max: 2,
        apply: (p) => {
            p.explosive += 0.4;
        },
    },
    {
        // 致命校准：每发炮弹独立判定暴击，暴击伤害 ×2.5 并显示醒目的暴击数字。
        id: 'crit',
        rarity: 'rare',
        name: '致命校准',
        text: '炮弹有 18% 概率暴击，造成 2.5 倍伤害。',
        icon: 'shell',
        max: 2,
        apply: (p) => {
            p.crit += 0.18;
        },
    },
    {
        // 僚机无人机：围绕战车旋转的小型无人机，自动射击最近的敌军。
        id: 'drone',
        rarity: 'legendary',
        name: '僚机无人机',
        text: '获得一架环绕战车的僚机，自动射击附近敌军。',
        icon: 'core',
        max: 2,
        apply: (p) => {
            p.drones += 1;
        },
    },
    {
        // 狂热回路：击杀积攒狂热值更快，狂热模式持续时间更长。
        id: 'fever',
        rarity: 'rare',
        name: '狂热回路',
        text: '狂热值积攒速度 +40%，狂热模式持续 +3 秒。',
        icon: 'rapid',
        max: 2,
        apply: (p) => {
            p.feverGain += 0.4;
            p.feverBonus += 3;
        },
    },
    {
        // 磁吸回收：扩大掉落物吸附范围，特装武器持续时间延长。
        id: 'magnet',
        rarity: 'rare',
        name: '磁吸回收臂',
        text: '拾取范围翻倍，特装武器持续时间 +40%。',
        icon: 'speed',
        max: 1,
        apply: (p) => {
            p.magnet = 2;
            p.weaponBonus += 0.4;
        },
    },
    // ---- 进化卡：requires 中的改装全部到手后，下一次清波必定出现在候选首位，每局各一次 ----
    {
        // 弹球炸弹：跳弹 + 高爆。每次撞墙反弹都会引爆，并额外获得两次反弹，适合在掩体间打出连环爆。
        id: 'pinball',
        rarity: 'evolution',
        requires: ['ricochet', 'explosive'],
        name: '弹球炸弹',
        text: '炮弹每次撞墙反弹都会爆炸，反弹次数 +2。',
        icon: 'nova',
        max: 1,
        apply: (p) => {
            p.pinball = true;
            p.bounce += 2;
        },
    },
    {
        // 雷霆僚机：僚机 + 致命校准。僚机射速翻倍，每发僚机弹命中后都会连锁闪电。
        id: 'thunderWing',
        rarity: 'evolution',
        requires: ['drone', 'crit'],
        name: '雷霆僚机',
        text: '僚机射速翻倍，僚机弹命中后连锁闪电跳向两个敌人。',
        icon: 'rapid',
        max: 1,
        apply: (p) => {
            p.thunderWing = true;
        },
    },
    {
        // 血色连爆：殉爆 + 吸能。殉爆范围 ×1.5、伤害 ×2，每次击毁额外回复 4 装甲。
        id: 'bloodChain',
        rarity: 'evolution',
        requires: ['chain', 'vampire'],
        name: '血色连爆',
        text: '殉爆范围 ×1.5、伤害 ×2，击毁回复再 +4 装甲。',
        icon: 'shield',
        max: 1,
        apply: (p) => {
            p.chainPower = 2;
            p.lifesteal += 4;
        },
    },
    {
        // 激光哨塔：哨戒系统 + 贯穿弹头。炮台改射无限穿透激光，射速提高，持续时间延长到 18 秒。
        id: 'laserSentry',
        rarity: 'evolution',
        requires: ['sentry', 'pierce'],
        name: '激光哨塔',
        text: '炮台改为发射无限穿透的激光，射速提高 70%，持续 18 秒。',
        icon: 'core',
        max: 1,
        apply: (p) => {
            p.laserSentry = true;
        },
    },
    {
        // 永动狂热：狂热回路 + 磁吸回收臂。狂热期间每次击毁延长 0.25 秒狂热（总时长上限 20 秒）。
        id: 'eternalFever',
        rarity: 'evolution',
        requires: ['fever', 'magnet'],
        name: '永动狂热',
        text: '狂热期间每次击毁延长 0.25 秒狂热，连杀不断，狂热不止。',
        icon: 'rapid',
        max: 1,
        apply: (p) => {
            p.eternalFever = true;
        },
    },
];
/**
 * 战车底盘：局外用余烬碎片解锁，开局时套用到玩家基础属性上。联机可用（服务器只接受这里列出的编号）。
 * mods 中的乘数作用于对应属性，add 为加法；radius 改变车体尺寸（影响碰撞与外观）；drones 为开局自带僚机数。
 */
export const CHASSIS = {
    standard: {
        name: '轻型突击战车',
        short: '突击',
        cost: 0,
        text: '均衡的标准底盘，没有短板。',
        mods: {},
    },
    heavy: {
        name: '重炮战车 · 犀牛',
        short: '重炮',
        cost: 300,
        text: '主炮伤害 +45%、装甲 +40，但射速 −26%、移速 −12%。一炮一个坑。',
        mods: { damage: 1.45, fireRate: 1.35, speed: 0.88, bulletSpeed: 1.1 },
        add: { maxHp: 40 },
        radius: 22,
    },
    rapid: {
        name: '速射战车 · 黄蜂',
        short: '速射',
        cost: 300,
        text: '射速 +66%、移速 +10%，但单发伤害 −28%、装甲 −15。弹雨洗地。',
        mods: { damage: 0.72, fireRate: 0.6, speed: 1.1 },
        add: { maxHp: -15 },
        radius: 17,
    },
    engineer: {
        name: '工程战车 · 工蜂',
        short: '工程',
        cost: 500,
        text: '开局自带一架僚机，炮台冷却 −40%、伤害 +50%，主炮伤害 −10%。',
        mods: { damage: 0.9, supportMax: 0.6, supportDamage: 1.5 },
        add: { maxHp: 10 },
        drones: 1,
    },
};
/**
 * 永久天赋：用余烬碎片逐级购买，costs[i] 为升到第 i+1 级的价格。
 * 只在单人与同屏双人模式生效；联机房间双方一律使用基础数值，保证公平。
 */
export const TALENTS = [
    { id: 'armor', name: '加固装甲', text: '每级装甲上限 +10。', costs: [150, 300, 450] },
    { id: 'core', name: '核心稳压', text: '每级核心耐久上限 +40。', costs: [150, 300, 450] },
    { id: 'reroll', name: '战术备忘录', text: '每级每局改装刷新 +1。', costs: [250, 500] },
    { id: 'fever', name: '余烬火种', text: '每级开局狂热值 +25%。', costs: [200, 400] },
    { id: 'weapon', name: '先发特装', text: '每波开局随机获得一件特装武器，持续 6 秒。', costs: [450] },
    { id: 'salvage', name: '打捞协议', text: '每级结算获得的余烬碎片 +15%。', costs: [300, 600] },
];
/**
 * 余烬等级（难度阶梯）：等级 N 同时启用 1…N 的全部词条。
 * 从第 1 关开局并打通全部战役，才能解锁下一级；更高等级结算碎片 +15%/级。
 */
export const ASCENSION = [
    { level: 1, name: '坚固敌阵', text: '敌军耐久 +15%。' },
    { level: 2, name: '精英横行', text: '精英出现概率翻倍。' },
    { level: 3, name: '急行军', text: '敌军移速 +12%。' },
    { level: 4, name: '核心过载', text: '清波不再修复核心，阵亡重建消耗 60 核心耐久。' },
    { level: 5, name: '火力升级', text: '敌军伤害 +20%。' },
    { level: 6, name: '人海战术', text: '每波敌军数量 +20%。' },
    { level: 7, name: '补给短缺', text: '特装武器掉率减半。' },
    { level: 8, name: '巨像觉醒', text: '首领耐久 +30%。' },
    { level: 9, name: '情报封锁', text: '每局改装刷新 −1。' },
    { level: 10, name: '余烬终焉', text: '狂热值积攒速度 −30%。' },
];
/** 四位首领的类型编号，用于「首领猎手」成就与图鉴分组。 */
export const BOSS_TYPES = ['boss', 'frostBoss', 'infernoBoss', 'riftBoss'];
/**
 * 成就：每局结算时检查，首次达成发放 reward 余烬碎片。
 * check(result, meta) 中 result 为模拟层 finish 事件数据（含 stats 单局统计），
 * meta 为已合并本局图鉴后的存档；每个成就只会解锁一次。
 */
export const ACHIEVEMENTS = [
    { id: 'firstRun', name: '初次出击', text: '完成任意一局作战。', reward: 50, check: () => true },
    { id: 'dawn', name: '黎明守护者', text: '打通二十四波战役。', reward: 300, check: (r) => r.win },
    { id: 'combo100', name: '百连斩', text: '单局最高连击达到 100。', reward: 150, check: (r) => r.stats?.maxCombo >= 100 },
    { id: 'nuker', name: '核爆专家', text: '单局拾取 3 枚清屏核弹。', reward: 150, check: (r) => r.stats?.nukes >= 3 },
    { id: 'evolved', name: '进化体', text: '单局获得一张进化改装。', reward: 100, check: (r) => r.stats?.evolutions >= 1 },
    {
        id: 'allEvolutions',
        name: '完全进化',
        text: '图鉴中集齐全部进化改装。',
        reward: 300,
        check: (r, m) => UPGRADES.filter((u) => u.requires).every((u) => m.codex.upgrades.includes(u.id)),
    },
    { id: 'perfect', name: '完美防线', text: '单局获得 5 次 S 级波次评价。', reward: 200, check: (r) => r.stats?.sGrades >= 5 },
    { id: 'pyro', name: '油桶艺术家', text: '单局引爆 30 个燃料桶。', reward: 150, check: (r) => r.stats?.barrels >= 30 },
    {
        id: 'bossHunter',
        name: '首领猎手',
        text: '累计击毁全部四位首领。',
        reward: 250,
        check: (r, m) => BOSS_TYPES.every((type) => m.codex.enemies[type] !== undefined),
    },
    { id: 'endless30', name: '无尽 · 三十波', text: '无尽模式坚持到第 30 波。', reward: 250, check: (r) => r.endless && r.wave >= 30 },
    { id: 'endless50', name: '无尽 · 五十波', text: '无尽模式坚持到第 50 波。', reward: 500, check: (r) => r.endless && r.wave >= 50 },
    { id: 'asc5', name: '余烬五阶', text: '在余烬等级 5 及以上打通战役。', reward: 300, check: (r) => r.win && r.ascension >= 5 },
    { id: 'asc10', name: '余烬终焉', text: '在余烬等级 10 打通战役。', reward: 800, check: (r) => r.win && r.ascension >= 10 },
    { id: 'fever10', name: '狂热成瘾', text: '单局进入狂热模式 10 次。', reward: 150, check: (r) => r.stats?.fevers >= 10 },
    {
        id: 'collector',
        name: '图鉴收集者',
        text: '累计击毁过全部种类的敌军。',
        reward: 300,
        check: (r, m) => Object.keys(ENEMIES).every((type) => m.codex.enemies[type] !== undefined),
    },
    { id: 'rich', name: '碎片富翁', text: '累计获得 5000 余烬碎片。', reward: 200, check: (r, m) => m.totalShards >= 5000 },
];
/** 改装图标使用统一描边的 SVG，而不是依赖表情符号字体。 */
export function iconSvg(kind) {
    const paths = {
        shell: '<path d="m12 3 4 6v10H8V9Z M8 14h8 M9 22h6"/>',
        rapid: '<path d="m13 2-8 12h6l-1 8 9-13h-7Z"/>',
        spread: '<path d="M12 21V6 M4 16V7 M20 16V7 M9 9l3-4 3 4 M1 10l3-4 3 4 M17 10l3-4 3 4"/>',
        shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z M8 12l3 3 5-6"/>',
        speed: '<path d="m5 5 7 7-7 7 M13 5l7 7-7 7"/>',
        nova: '<circle cx="12" cy="12" r="4"/><path d="M12 1v4 M12 19v4 M1 12h4 M19 12h4 M4 4l3 3 M17 17l3 3 M4 20l3-3 M17 7l3-3"/>',
        core: '<path d="m12 2 8 10-8 10-8-10Z M12 7v10 M7 12h10"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || paths.shell}</svg>`;
}
