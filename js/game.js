import { WORLD, WAVES, ENEMIES, UPGRADES, FIELD_EVENTS, ZONES, MAX_ENEMIES, WEAPONS, AFFIXES, RARITY, CHASSIS, TALENTS, ASCENSION } from './config.js';

/** 数值工具集中定义，碰撞和距离始终使用逻辑战场坐标而非屏幕像素。 */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const random = (min, max) => min + Math.random() * (max - min);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

/** 判断线段与圆是否相交，避免高速炮弹在低帧率时穿过目标。 */
function segmentCircle(x1, y1, x2, y2, target, radius) {
    const dx = x2 - x1,
        dy = y2 - y1;
    const t = clamp(((target.x - x1) * dx + (target.y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x1 + dx * t - target.x, y1 + dy * t - target.y) <= radius;
}

/** 游戏模拟层：单一时钟管理移动、AI、弹道、掉落和生命周期，暂停不会泄漏定时器。 */
export class Game {
    constructor(sound, onEvent) {
        this.sound = sound;
        this.onEvent = onEvent;
        this.keys = new Set();
        this.pointer = { x: 640, y: 200, down: false, used: false };
        this.stick = { x: 0, y: 0 };
        this.touchFire = false;
        this.autoFire = false;
        this.mode = 1;
        this.controls = new Map();
        this.nextEntityId = 1;
        this.reset();
        this.state = 'menu';
        this.enemies = [
            this.makeEnemy('raider', 940, 240),
            this.makeEnemy('heavy', 1090, 390),
            this.makeEnemy('scout', 850, 115),
        ];
    }
    /** 重置本局所有资源；保留按键容器和设置，清空上一局粒子、升级与路径数据。 */
    reset() {
        this.time = 0;
        this.wave = 0;
        this.score = 0;
        this.kills = 0;
        this.combo = 0;
        this.comboTime = 0;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.rings = [];
        this.texts = [];
        this.pickups = [];
        this.wrecks = [];
        this.turrets = [];
        this.hazards = [];
        this.beacon = null;
        // 相位门只在「相位裂隙」事件的波次出现；悬赏标记在本波生成到一半时投放精英。
        this.portals = [];
        this.bountyPending = false;
        this.eventTimer = 6;
        // 燃料桶、棱镜光束与连锁闪电弧：都属于战场实体，由服务器结算并随快照同步。
        this.barrels = [];
        this.beams = [];
        this.arcs = [];
        // 狂热值 0-100，击杀积攒；满值后进入 feverTime 秒的狂热模式（射速翻倍、伤害提高、受伤减半）。
        this.fever = 0;
        this.feverTime = 0;
        // 连杀播报：streak 为短时间内的连续击毁数，streakTimer 归零后重新计数；announce 为屏幕中央大字。
        this.streak = 0;
        this.streakTimer = 0;
        this.announce = null;
        // 每局 2 次改装刷新；S 级评价额外奖励 1 次。
        this.rerolls = 2;
        // 局外成长：余烬等级（0 为标准难度）与本局生效的天赋等级；start 时按开局参数覆盖。
        this.ascension = 0;
        this.talents = {};
        // 首领终结慢动作剩余秒数（真实时间），期间模拟按 30% 速度推进。
        this.slowmo = 0;
        // 波次评级统计：本波承受的总伤害（玩家装甲 + 核心）与最高连击；lastGrade 为上一波的评级结果。
        this.waveDamage = 0;
        this.waveMaxCombo = 0;
        this.lastGrade = null;
        this.zone = 0;
        this.controls.clear();
        this.upgrades = [];
        this.shake = 0;
        this.camera = { x: 0, y: 0, vx: 0, vy: 0 };
        this.impacts = [];
        this.hitstop = 0;
        // 普通命中的停顿冷却：高射速 + 多炮台时，连续命中不会把战斗拖成持续慢动作。
        this.hitstopCooldown = 0;
        this.flash = 0;
        this.whiteFlash = { life: 0, maxLife: 1, strength: 0 };
        this.whiteFlashCooldown = 0;
        this.waveDelay = 0;
        this.core = { x: 640, y: 664, radius: 36, hp: 500, maxHp: 500, hit: 0 };
        this.players = [this.makePlayer(1, this.mode === 2 ? 556 : 545, 631)];
        if (this.mode === 2) this.players.push(this.makePlayer(2, 724, 631));
        this.makeMap();
        this.keys.clear();
        this.pointer.down = false;
        this.touchFire = false;
        this.stick = { x: 0, y: 0 };
    }
    /** 玩家属性以秒和逻辑像素计量，避免刷新率影响火力与移动速度。 */
    makePlayer(id, x, y) {
        return {
            id,
            x,
            y,
            radius: 19,
            angle: -Math.PI / 2,
            bodyAngle: -Math.PI / 2,
            hp: 100,
            maxHp: 100,
            speed: 210,
            damage: 24,
            fireRate: 0.22,
            fireCd: 0,
            bulletSpeed: 760,
            multishot: 0,
            pierce: 0,
            invincible: 1.5,
            dashCd: 0,
            dashMax: 2.8,
            dashTime: 0,
            dashAngle: 0,
            novaCd: 0,
            novaMax: 12,
            novaDamage: 110,
            recoil: 0,
            hit: 0,
            moving: false,
            tread: 0,
            deadTime: 0,
            color: id === 1 ? '#b6d2a0' : '#8bbacb',
            supportCd: 0,
            supportMax: 22,
            supportDamage: 18,
            regen: 0,
            overdrive: 0,
            repairBonus: 0,
            // 新增改装与拾取：跳弹次数、击毁回复、殉爆开关、护盾值与相位门冷却。
            bounce: 0,
            lifesteal: 0,
            chain: false,
            shield: 0,
            portalCd: 0,
            // 新改装：溅射比例、暴击率、僚机数量与僚机射击冷却。
            explosive: 0,
            crit: 0,
            drones: 0,
            droneCd: 0,
            // 狂热积攒倍率与额外持续秒数、拾取吸附倍率、特装武器持续时间加成。
            feverGain: 1,
            feverBonus: 0,
            magnet: 1,
            weaponBonus: 0,
            // 当前特装武器（WEAPONS 的键，空字符串表示无）及剩余秒数。
            weapon: '',
            weaponTime: 0,
            // 进化卡开关：弹球炸弹、雷霆僚机、殉爆强度倍率、激光哨塔、永动狂热。
            pinball: false,
            thunderWing: false,
            chainPower: 1,
            laserSentry: false,
            eternalFever: false,
        };
    }
    /** 生成手工布置的掩体群：主通道保持畅通，混凝土可破坏，钢墙用于稳定战场结构。 */
    makeMap() {
        this.walls = [];
        const block = (x, y, w, h, steel = false) => {
            for (let row = 0; row < h; row++)
                for (let col = 0; col < w; col++) {
                    this.walls.push({
                        x: x + col * 40,
                        y: y + row * 40,
                        w: 40,
                        h: 40,
                        hp: steel ? Infinity : 85,
                        maxHp: 85,
                        steel,
                        hit: 0,
                        seed: Math.random(),
                    });
                }
        };
        block(240, 160, 3, 2);
        block(880, 160, 3, 2);
        block(440, 320, 2, 1);
        block(760, 320, 2, 1);
        block(160, 400, 2, 3);
        block(1040, 400, 2, 3);
        block(360, 520, 2, 2);
        block(840, 520, 2, 2);
        block(560, 160, 1, 2, true);
        block(680, 160, 1, 2, true);
        block(80, 160, 1, 2, true);
        block(1160, 160, 1, 2, true);
        if (this.zone === 1) {
            this.walls = [];
            for (const [x, y, w, h, steel] of [
                [160, 160, 4, 1],
                [960, 160, 4, 1],
                [400, 240, 2, 3],
                [800, 240, 2, 3],
                [120, 440, 3, 2],
                [1040, 440, 3, 2],
                [400, 560, 2, 1],
                [800, 560, 2, 1],
                [600, 120, 2, 1, true],
            ])
                block(x, y, w, h, steel);
        } else if (this.zone === 2) {
            this.walls = [];
            for (const [x, y, w, h, steel] of [
                [240, 160, 1, 4, true],
                [1000, 160, 1, 4, true],
                [480, 240, 2, 2],
                [720, 240, 2, 2],
                [120, 480, 4, 1],
                [1000, 480, 4, 1],
                [360, 560, 2, 1],
                [840, 560, 2, 1],
                [600, 400, 2, 1],
            ])
                block(x, y, w, h, steel);
        } else if (this.zone === 3) {
            // 虚空裂隙：两侧钢柱形成走廊，中部留出信标区；左右下方空地放置相位门。
            this.walls = [];
            for (const [x, y, w, h, steel] of [
                [200, 200, 2, 2],
                [1000, 200, 2, 2],
                [440, 280, 1, 3, true],
                [800, 280, 1, 3, true],
                [600, 200, 2, 1],
                [280, 440, 3, 1],
                [880, 440, 3, 1],
                [360, 600, 2, 1],
                [880, 600, 2, 1],
            ])
                block(x, y, w, h, steel);
        }
        this.mapVersion = (this.mapVersion || 0) + 1;
        // 布局版本只在整张地图重建时递增；联机服务器据此判断是否需要重新下发完整掩体布局。
        this.layoutVersion = (this.layoutVersion || 0) + 1;
    }
    /**
     * 开战入口由一次用户操作触发，音频解锁在界面控制层完成。
     * 参数 options（均可省略）：
     * - chassis：按玩家顺序排列的底盘编号数组，未知编号回落为标准底盘；
     * - talents：{ 天赋编号: 等级 }，超出范围的等级会被截断（联机时服务器传空对象）；
     * - ascension：余烬等级 0–10，启用对应及以下全部难度词条。
     */
    start(mode = 1, chapter = 0, options = {}) {
        this.mode = mode;
        this.reset();
        this.chapter = clamp(Math.floor(chapter) || 0, 0, ZONES.length - 1);
        this.wave = this.chapter * 6;
        this.ascension = clamp(Math.floor(options.ascension) || 0, 0, ASCENSION.length);
        this.talents = {};
        for (const talent of TALENTS) {
            const level = Math.floor(options.talents?.[talent.id]) || 0;
            if (level > 0) this.talents[talent.id] = Math.min(level, talent.costs.length);
        }
        // 本局编号：界面用它保证同一局只结算一次余烬碎片（刷新、重连不会重复领取）。
        this.runId = Math.random().toString(36).slice(2, 10);
        this.players.forEach((p) => this.applyChassis(p, options.chassis?.[p.id - 1]));
        // 从后续战区直接出击时配发基础作战套件，不要求玩家携带前一章节的存档。
        this.players.forEach((p) => {
            p.damage *= 1 + this.chapter * 0.5;
            p.maxHp += this.chapter * 25 + this.talentLevel('armor') * 10;
            p.hp = p.maxHp;
            p.fireRate *= 0.88 ** this.chapter;
        });
        this.core.maxHp += this.talentLevel('core') * 40;
        this.core.hp = this.core.maxHp;
        this.rerolls = Math.max(0, 2 + this.talentLevel('reroll') - (this.asc(9) ? 1 : 0));
        this.fever = this.talentLevel('fever') * 25;
        this.state = 'playing';
        this.beginWave();
        this.onEvent('start');
    }
    /** 当前余烬等级是否已启用第 level 级词条。 */
    asc(level) {
        return this.ascension >= level;
    }
    /** 读取本局某项天赋的等级，未购买为 0。 */
    talentLevel(id) {
        return this.talents?.[id] || 0;
    }
    /**
     * 把底盘属性套用到玩家：先乘 mods，再加 add，最后设置车体半径与自带僚机。
     * 参数 id 为 CHASSIS 编号，未知或缺省时使用标准底盘；结果记录在 p.chassis 供界面显示。
     */
    applyChassis(p, id) {
        const key = CHASSIS[id] ? id : 'standard';
        const data = CHASSIS[key];
        p.chassis = key;
        for (const [stat, factor] of Object.entries(data.mods || {})) p[stat] *= factor;
        for (const [stat, value] of Object.entries(data.add || {})) p[stat] += value;
        if (data.radius) p.radius = data.radius;
        p.drones += data.drones || 0;
        p.hp = p.maxHp;
    }
    /** 本波实际生成次数：余烬等级 6「人海战术」使数量 +20%。 */
    waveCount() {
        return Math.round(WAVES[this.wave - 1].count * (this.asc(6) ? 1.2 : 1));
    }
    /** 每波使用独立生成队列；清场后才进入改装，首领固定出现在最终波。 */
    beginWave() {
        this.wave++;
        const zone = Math.floor((this.wave - 1) / 6);
        if (this.zone !== zone) {
            this.zone = zone;
            this.makeMap();
            this.wrecks = [];
            this.pickups = [];
            this.bullets = [];
            this.core.hp = Math.min(this.core.maxHp, this.core.hp + 60);
            this.players.forEach((p) => {
                p.x = p.id === 1 ? 545 : 735;
                p.y = 631;
            });
        }
        this.spawned = 0;
        this.spawnTimer = 2.5;
        this.waveDamage = 0;
        this.waveMaxCombo = 0;
        this.waveDelay = 0;
        this.hazards = [];
        this.turrets = [];
        this.beacon = null;
        this.portals = [];
        this.bountyPending = false;
        this.eventTimer = 6;
        this.beams = [];
        const fieldEvent = WAVES[this.wave - 1].event;
        this.placeBarrels(fieldEvent === 'barrels');
        // 火力全开：每名存活玩家立即获得一件随机持续型特装武器（不含核弹），开波就能爽射。
        if (fieldEvent !== 'frenzy' && this.talentLevel('weapon') > 0)
            this.players
                .filter((p) => p.hp > 0)
                .forEach((p) => {
                    this.giveWeapon(p, ['fan', 'laser', 'rocket', 'lightning'][Math.floor(Math.random() * 4)]);
                    p.weaponTime = 6;
                });
        if (fieldEvent === 'frenzy')
            this.players
                .filter((p) => p.hp > 0)
                .forEach((p) => this.giveWeapon(p, ['fan', 'laser', 'rocket', 'lightning'][Math.floor(Math.random() * 4)]));
        // 悬赏目标在本波生成数过半时出现，相位门则在开波即刻展开。
        if (fieldEvent === 'bounty') this.bountyPending = true;
        if (fieldEvent === 'rift')
            this.portals = [
                { x: 200, y: 540, radius: 30 },
                { x: 1080, y: 540, radius: 30 },
            ];
        if (fieldEvent === 'supply' || fieldEvent === 'overdrive') {
            for (const [x, y] of [
                [640, 380],
                [320, 340],
                [960, 340],
            ])
                this.pickups.push({
                    x,
                    y,
                    age: 0,
                    life: 35,
                    kind: fieldEvent === 'overdrive' ? 'overdrive' : 'repair',
                });
        }
        if (fieldEvent === 'beacon') this.beacon = { x: 640, y: 380, capture: 0, done: false };
        this.sound.play('wave');
        this.players.forEach((p) => {
            p.invincible = Math.max(p.invincible, 2);
        });
        this.onEvent('wave', WAVES[this.wave - 1]);
        this.onEvent('field', FIELD_EVENTS[fieldEvent]);
    }
    /** 创建敌人时按波次和人数轻度缩放耐久，双人有更多火力但共享核心。 */
    makeEnemy(type, x, y) {
        const data = ENEMIES[type];
        const hp =
            data.hp *
            (1 + Math.max(0, this.wave - 1) * 0.08) *
            (this.mode === 2 ? 1.5 : 1) *
            (data.boss ? 1 + this.upgrades.length * 0.1 : 1) *
            // 余烬等级 1「坚固敌阵」全体 +15%，等级 8「巨像觉醒」首领再 +30%。
            (this.asc(1) ? 1.15 : 1) *
            (data.boss && this.asc(8) ? 1.3 : 1);
        return {
            ...data,
            netId: this.nextEntityId++,
            type,
            x,
            y,
            hp,
            maxHp: hp,
            // 敌军火力随波次温和成长：每波 +2.5%，第 24 波约为初始的 1.6 倍。
            // 余烬等级 5「火力升级」敌军伤害再 +20%。
            damage: data.damage * (1 + Math.max(0, this.wave - 1) * 0.025) * (this.asc(5) ? 1.2 : 1),
            // 余烬等级 3「急行军」敌军移速 +12%。
            speed: data.speed * (this.asc(3) ? 1.12 : 1),
            angle: Math.PI / 2,
            bodyAngle: Math.PI / 2,
            fireCd: random(0.8, 2.5),
            pathCd: 0,
            path: [],
            hit: 0,
            recoil: 0,
            tread: 0,
            moving: false,
            warning: 0.8,
            radialCd: data.boss ? 2.2 : 5,
            healCd: 3,
            // 相位幽影与裂隙主脑的闪烁冷却；首次闪烁略有随机，避免同一批次同步跳跃。
            blinkCd: data.blink ? random(2.5, 4) : 7,
            charge: 0,
            dead: false,
            targetCore: Math.random() > 0.4,
        };
    }
    /** 敌军从可见空投标记进入，预警期间不移动、不射击。 */
    spawnEnemy() {
        const config = WAVES[this.wave - 1];
        const portals = [
            { x: 160, y: 75 },
            { x: 640, y: 65 },
            { x: 1120, y: 75 },
            { x: 55, y: 330 },
            { x: 1225, y: 330 },
        ];
        let type = config.types[this.spawned % config.types.length];
        if (config.boss && this.spawned === 0) type = config.boss;
        const spot = ENEMIES[type].boss ? portals[1] : portals[Math.floor(Math.random() * portals.length)];
        // 蜂群：一次生成占用一个生成名额，但在空投点周围铺开一整队无人机（受同屏上限约束）。
        if (ENEMIES[type].drone) {
            this.spawnSwarm(spot.x, spot.y + 10, 4);
            this.spawned++;
            return;
        }
        const enemy = this.makeEnemy(type, spot.x + random(-10, 10), spot.y);
        this.rollAffix(enemy);
        // 悬赏精英：本波生成过半时把下一辆普通敌军升级为金色精英，耐久 ×2.5、积分 ×3。
        if (this.bountyPending && !enemy.boss && this.spawned >= Math.floor(this.waveCount() / 2)) {
            this.bountyPending = false;
            enemy.bounty = true;
            enemy.hp *= 2.5;
            enemy.maxHp = enemy.hp;
            enemy.score *= 3;
            enemy.radius += 3;
            enemy.color = '#f2c35b';
            enemy.targetCore = false;
            this.onEvent('toast', `悬赏目标出现：金色${enemy.name} · 击毁获得 1000 积分`);
        }
        this.enemies.push(enemy);
        this.spawned++;
        this.rings.push({
            x: enemy.x,
            y: enemy.y,
            radius: 8,
            max: enemy.radius + 35,
            life: 0.8,
            maxLife: 0.8,
            color: '#f3a15c',
        });
    }
    /**
     * 在 (x, y) 周围生成一队蜂群无人机。
     * 参数 count 为期望数量，实际数量受同屏上限 MAX_ENEMIES 约束；落点被掩体挡住的个体直接放弃。
     * 返回实际生成的无人机数组，供母舰与首领召唤复用。
     */
    spawnSwarm(x, y, count) {
        const made = [];
        // 只统计存活敌军：同一帧内刚阵亡、尚未被过滤的敌人不占用名额。
        let alive = this.enemies.filter((e) => !e.dead).length;
        for (let i = 0; i < count && alive < MAX_ENEMIES; i++) {
            const angle = (i / count) * Math.PI * 2;
            const drone = this.makeEnemy(
                'swarm',
                clamp(x + Math.cos(angle) * 26, 40, 1240),
                clamp(y + Math.sin(angle) * 20, 40, 760),
            );
            drone.warning = 0.45;
            // 无人机全部直扑最近的玩家或核心，避免成队后在原地发呆。
            drone.targetCore = Math.random() > 0.5;
            if (this.blocked(drone.x, drone.y, drone.radius)) continue;
            this.enemies.push(drone);
            made.push(drone);
            alive++;
        }
        return made;
    }
    /**
     * 精英词缀判定：第 4 关起普通敌军按「12% + 每波 0.6%」的概率成为精英。
     * 精英耐久 ×1.6、积分 ×2，并附带 AFFIXES 中的一个随机词缀；首领与无人机不参与。
     */
    rollAffix(enemy) {
        if (enemy.boss || enemy.drone || this.wave < 4) return;
        // 余烬等级 2「精英横行」精英概率翻倍。
        if (Math.random() > (0.12 + this.wave * 0.006) * (this.asc(2) ? 2 : 1)) return;
        const keys = Object.keys(AFFIXES);
        const affix = keys[Math.floor(Math.random() * keys.length)];
        enemy.affix = affix;
        enemy.hp *= affix === 'armored' ? 2.6 : 1.6;
        enemy.maxHp = enemy.hp;
        enemy.score *= 2;
        enemy.radius += affix === 'armored' ? 3 : 1;
        if (affix === 'swift') {
            enemy.speed *= 1.6;
            enemy.cooldown *= 0.7;
        }
    }
    /**
     * 每波重新布置燃料桶：先放置战区通用的边缘位置，油桶阵事件再在中路追加一批。
     * 参数 extra 为 true 时追加中路油桶。被掩体占据的位置会被跳过，油桶本身不阻挡移动。
     */
    placeBarrels(extra = false) {
        const spots = [
            [200, 330],
            [1080, 330],
            [330, 270],
            [950, 270],
            [120, 600],
            [1160, 600],
            [500, 110],
            [780, 110],
        ];
        if (extra)
            spots.push([420, 420], [860, 420], [640, 250], [300, 470], [980, 470], [560, 470], [720, 470], [640, 160]);
        this.barrels = [];
        for (const [x, y] of spots) {
            if (this.blocked(x, y, 16)) continue;
            this.barrels.push({ netId: this.nextEntityId++, x, y, radius: 15, hp: 30, dead: false });
        }
    }
    /**
     * 给玩家装备特装武器。参数 kind 为 WEAPONS 的键；核弹立即引爆而不占用武器槽。
     * 持续时间乘以磁吸改装的武器加成；拾取新武器会覆盖旧武器并重置时间。
     */
    giveWeapon(p, kind) {
        const weapon = WEAPONS[kind];
        if (!weapon) return;
        if (kind === 'nuke') {
            this.triggerNuke(p);
            return;
        }
        p.weapon = kind;
        p.weaponTime = weapon.duration * (1 + p.weaponBonus);
        this.sound.play('powerup', { x: p.x });
        this.texts.push({ x: p.x, y: p.y - 48, text: weapon.name, color: weapon.color, life: 1.3, maxLife: 1.3, big: true });
        this.rings.push({ x: p.x, y: p.y, radius: 10, max: 80, life: 0.45, maxLife: 0.45, color: weapon.color });
    }
    /**
     * 清屏核弹：对全部已入场敌军造成「400 + 每波 15」点范围伤害，并清空所有敌方弹幕与光束。
     * 首领同样受伤但通常不会被秒杀。参数 p 为拾取者，仅用于定位爆心特效。
     */
    triggerNuke(p) {
        this.bullets = this.bullets.filter((b) => !b.enemy);
        this.beams = [];
        this.rings.push({ x: p.x, y: p.y, radius: 20, max: 1400, life: 0.9, maxLife: 0.9, color: '#ffd9a0', fill: true });
        this.impact('explosion', p.x, p.y, 0, 3);
        this.shake = 45;
        this.flashScreen(0.95, 0.3);
        this.sound.play('nuke', { x: p.x });
        this.announceText('核爆清场！', 'TACTICAL NUKE', '#ff8a6b', 2);
        const damage = 400 + this.wave * 15;
        for (const enemy of [...this.enemies])
            if (!enemy.dead && enemy.warning <= 0) this.damageEnemy(enemy, damage, true, angleTo(p, enemy));
        for (const barrel of this.barrels) if (!barrel.dead) this.detonateBarrel(barrel);
    }
    /**
     * 屏幕中央的大字播报。参数 priority 为优先级：连杀 0、狂热与首领阶段 1、核弹与首领终结 2。
     * 当前播报仍在显示且优先级更高时，新的低优先级播报被丢弃，避免高光时刻被连杀刷掉。
     */
    announceText(text, sub, color = '#ffd36e', priority = 0) {
        if (this.announce && this.announce.life > 0 && (this.announce.priority || 0) > priority) return;
        this.announce = { text, sub, color, life: 1.6, maxLife: 1.6, priority };
    }
    /**
     * 通用爆炸结算：对半径内敌军造成范围伤害（不受盾卫护盾影响），可选波及玩家与混凝土掩体，并引爆附近油桶。
     * 参数 options.players 为对玩家的伤害（0 表示不伤玩家），options.walls 为对掩体的伤害，
     * options.skip 为不再受伤的敌人（例如已被弹体直接命中的目标），options.scale 控制特效尺寸。
     */
    explode(x, y, radius, damage, options = {}) {
        const { players = 0, walls = 0, skip = null, scale = 0.6, color = '#ffb46b' } = options;
        this.impact('explosion', x, y, 0, scale);
        this.rings.push({ x, y, radius: 8, max: radius, life: 0.3, maxLife: 0.3, color });
        for (const enemy of [...this.enemies])
            if (enemy !== skip && !enemy.dead && distance(enemy, { x, y }) < radius + enemy.radius)
                this.damageEnemy(enemy, damage, true, angleTo({ x, y }, enemy));
        if (players > 0)
            this.players.forEach((p) => {
                if (p.hp > 0 && distance(p, { x, y }) < radius + p.radius) this.damagePlayer(p, players);
            });
        if (walls > 0)
            this.walls.forEach((w) => {
                if (!w.steel && w.hp > 0 && distance({ x: w.x + 20, y: w.y + 20 }, { x, y }) < radius) {
                    w.hp -= walls;
                    if (w.hp <= 0) this.mapVersion++;
                }
            });
        for (const barrel of this.barrels)
            if (!barrel.dead && distance(barrel, { x, y }) < radius * 0.8) this.detonateBarrel(barrel);
    }
    /**
     * 油桶殉爆：半径 120 内敌军受到 140 点伤害，玩家受到 18 点伤害，混凝土掩体同样受损。
     * 先标记 dead 再结算爆炸，因此相邻油桶互相引爆时链条一定会终止。
     */
    detonateBarrel(barrel) {
        if (barrel.dead) return;
        barrel.dead = true;
        this.score += 25;
        this.shake = Math.max(this.shake, 22);
        this.flashScreen(0.3, 0.08);
        this.burst(barrel.x, barrel.y, '#ff9a4a', 40, 240);
        this.sound.play('explode', { x: barrel.x, strength: 1.2 });
        this.explode(barrel.x, barrel.y, 120, 140, { players: 18, walls: 120, scale: 1.5, color: '#ff8a4a' });
    }
    /**
     * 积攒狂热值；狂热期间不再积攒。满 100 时进入狂热模式，持续 8 秒加改装额外秒数。
     * 参数 amount 为基础积攒量，会乘以改装提供的倍率。
     */
    addFever(amount) {
        if (this.feverTime > 0) return;
        // 余烬等级 10「余烬终焉」狂热积攒速度 −30%。
        this.fever = Math.min(100, this.fever + amount * (this.players[0]?.feverGain || 1) * (this.asc(10) ? 0.7 : 1));
        if (this.fever < 100) return;
        this.fever = 0;
        this.feverTime = 8 + (this.players[0]?.feverBonus || 0);
        this.sound.play('fever');
        this.flashScreen(0.5, 0.14);
        this.announceText('狂热模式！', 'FEVER · 射速翻倍 · 伤害 +35% · 受伤减半', '#ff7ad9', 1);
        this.players.forEach((p) => {
            if (p.hp > 0) this.rings.push({ x: p.x, y: p.y, radius: 10, max: 160, life: 0.6, maxLife: 0.6, color: '#ff7ad9', fill: true });
        });
    }
    /** 统一更新顺序确保死亡目标不会再次射击，暂停与界面选择期间不推进战斗。 */
    update(dt) {
        if (this.state !== 'playing') {
            if (this.state === 'menu') this.updateEffects(dt);
            this.sound.update(false, 0);
            return;
        }
        // 首领终结慢动作：按真实时间倒计时，期间战斗以 30% 速度推进，镜头与火光仍按真实时间播放。
        if (this.slowmo > 0) {
            this.slowmo -= dt;
            this.updateEffects(dt * 0.7);
            dt *= 0.3;
        }
        if (this.hitstop > 0) {
            this.hitstop -= dt;
            // 受击停顿只冻结模拟，火光与镜头仍按真实时间推进，反馈不再拖成慢动作。
            this.updateEffects(dt);
            return;
        }
        this.time += dt;
        this.hitstopCooldown = Math.max(0, this.hitstopCooldown - dt);
        this.comboTime -= dt;
        if (this.comboTime <= 0) this.combo = 0;
        this.feverTime = Math.max(0, this.feverTime - dt);
        this.streakTimer -= dt;
        if (this.streakTimer <= 0) this.streak = 0;
        this.core.hit = Math.max(0, this.core.hit - dt);
        this.players.forEach((p) => this.updatePlayer(p, dt));
        if (this.state !== 'playing') return;
        this.enemies.forEach((e) => this.updateEnemy(e, dt));
        this.updateBullets(dt);
        this.enemies = this.enemies.filter((e) => !e.dead);
        this.updatePickups(dt);
        this.updateField(dt);
        this.updateEffects(dt);
        if (this.core.hp <= 0) {
            this.finish(false);
            return;
        }
        const config = WAVES[this.wave - 1];
        this.spawnTimer -= dt;
        if (this.spawned < this.waveCount() && this.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
            this.spawnEnemy();
            this.spawnTimer = config.interval;
        }
        if (this.spawned >= this.waveCount() && !this.enemies.length) {
            this.waveDelay += dt;
            if (this.waveDelay > 2) this.completeWave();
        }
        this.sound.update(true, Math.min(1, this.enemies.length / 10));
    }
    /** 玩家移动、武器、冷却和复活：核心仍有能量时，阵亡者七秒后消耗核心耐久重返战场。 */
    updatePlayer(p, dt) {
        p.hit = Math.max(0, p.hit - dt);
        p.invincible = Math.max(0, p.invincible - dt);
        p.recoil = Math.max(0, p.recoil - dt * 110);
        p.fireCd -= dt;
        p.dashCd = Math.max(0, p.dashCd - dt);
        p.novaCd = Math.max(0, p.novaCd - dt);
        p.supportCd = Math.max(0, p.supportCd - dt);
        p.overdrive = Math.max(0, p.overdrive - dt);
        p.portalCd = Math.max(0, p.portalCd - dt);
        p.droneCd = Math.max(0, p.droneCd - dt);
        // 特装武器到期后自动卸下；阵亡期间计时照常流逝。
        p.weaponTime = Math.max(0, p.weaponTime - dt);
        if (p.weaponTime <= 0) p.weapon = '';
        if (p.hp <= 0) {
            p.deadTime += dt;
            if (p.deadTime >= 7) {
                // 余烬等级 4「核心过载」重建代价从 40 提高到 60 核心耐久。
                const cost = this.asc(4) ? 60 : 40;
                if (this.core.hp > cost + 5) {
                    this.core.hp -= cost;
                    p.hp = p.maxHp;
                    p.x = p.id === 1 ? 545 : 735;
                    p.y = 660;
                    p.invincible = 3;
                    p.deadTime = 0;
                    this.onEvent('toast', `P${p.id} 已重返战场 · 核心消耗 ${cost} 耐久`);
                    this.burst(p.x, p.y, '#b9edac', 25, 120);
                } else if (this.players.every((player) => player.hp <= 0)) this.finish(false);
            }
            return;
        }
        const keys = this.keys;
        const control = this.controls.get(p.id);
        let dx = 0,
            dy = 0;
        if (control) {
            dx = control.x;
            dy = control.y;
        } else if (p.id === 1) {
            dx = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + this.stick.x;
            dy = Number(keys.has('KeyS')) - Number(keys.has('KeyW')) + this.stick.y;
        } else {
            dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
            dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
        }
        const length = Math.hypot(dx, dy);
        if (length > 1) {
            dx /= length;
            dy /= length;
        }
        p.moving = length > 0.1;
        if (p.moving) p.bodyAngle = Math.atan2(dy, dx);
        if (control && Number.isFinite(control.aim)) p.angle = control.aim;
        else if (!control && p.id === 1 && this.pointer.used && !this.touchFire)
            p.angle = angleTo(p, this.pointer);
        else {
            const target = this.nearestEnemy(p);
            if (target) p.angle = angleTo(p, target);
            else if (p.moving) p.angle = p.bodyAngle;
        }
        if (p.dashTime > 0) {
            p.dashTime -= dt;
            this.move(p, Math.cos(p.dashAngle) * 740 * dt, Math.sin(p.dashAngle) * 740 * dt);
            if (Math.random() < 0.6) this.burst(p.x, p.y, p.color, 2, 35);
        } else this.move(p, dx * p.speed * dt, dy * p.speed * dt);
        if (p.moving) p.tread += dt * p.speed;
        this.usePortal(p);
        const shooting = control
            ? control.fire
            : p.id === 1
              ? keys.has('Space') || this.pointer.down || this.touchFire || this.autoFire
              : keys.has('Numpad0') || keys.has('Enter');
        if (shooting && p.fireCd <= 0) {
            this.fire(p, false);
            // 超频与狂热都让射速翻倍，但两者不叠乘，避免弹量失控拖垮联机快照。
            p.fireCd = p.fireRate * (p.overdrive > 0 || this.feverTime > 0 ? 0.5 : 1);
        }
        this.updateDrones(p);
        p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    }
    /**
     * 僚机：p.drones 架无人机以 3 弧度/秒围绕战车旋转，每 0.38 秒各向 480 像素内最近的敌军射击一次。
     * 僚机弹伤害为主炮的 45%，不触发主炮的震屏与镜头后坐，避免持续抖屏。渲染层用相同公式计算环绕位置。
     */
    updateDrones(p) {
        if (p.drones <= 0 || p.droneCd > 0) return;
        const target = this.nearestEnemy(p);
        if (!target || distance(target, p) > 480) return;
        // 雷霆僚机：射速翻倍，僚机弹附带两跳连锁闪电。
        p.droneCd = p.thunderWing ? 0.19 : 0.38;
        for (let i = 0; i < p.drones; i++) {
            const orbit = this.time * 3 + (i * Math.PI * 2) / p.drones;
            const origin = { x: p.x + Math.cos(orbit) * 34, y: p.y + Math.sin(orbit) * 34, radius: 2, pierce: 0, bounce: 0 };
            this.createBullet(origin, angleTo(origin, target), false, 820, p.damage * 0.45, {
                kind: p.thunderWing ? 'spark' : 'drone',
                arc: p.thunderWing,
                arcJumps: 2,
            });
        }
    }
    /**
     * 相位门传送：玩家车体中心进入一座门的半径后，立即出现在另一座门上。
     * 参数 p 为玩家对象；传送后有 1.2 秒冷却，防止落地瞬间被弹回原门。
     */
    usePortal(p) {
        if (this.portals.length < 2 || p.portalCd > 0) return;
        const index = this.portals.findIndex((portal) => distance(p, portal) < portal.radius);
        if (index < 0) return;
        const exit = this.portals[1 - index];
        this.burst(p.x, p.y, '#c9a8ff', 22, 160);
        p.x = exit.x;
        p.y = exit.y;
        p.portalCd = 1.2;
        p.dashTime = 0;
        p.invincible = Math.max(p.invincible, 0.5);
        this.rings.push({ x: exit.x, y: exit.y, radius: 8, max: 70, life: 0.45, maxLife: 0.45, color: '#c9a8ff' });
        this.burst(exit.x, exit.y, '#c9a8ff', 22, 160);
        this.sound.play('dash');
    }
    /** 冲刺沿移动方向释放；静止时沿炮塔方向冲刺，持续无敌但不能穿墙。 */
    dash(id) {
        if (this.commandSender) return this.commandSender('dash');
        const p = this.players.find((player) => player.id === id);
        if (this.state !== 'playing' || !p || p.hp <= 0 || p.dashCd > 0) return;
        p.dashAngle = p.moving ? p.bodyAngle : p.angle;
        p.dashTime = 0.21;
        p.dashCd = p.dashMax;
        p.invincible = Math.max(p.invincible, 0.32);
        this.sound.play('dash');
        this.rings.push({ x: p.x, y: p.y, radius: 10, max: 50, life: 0.3, maxLife: 0.3, color: p.color });
    }
    /** 震荡同时清除范围弹幕并损伤敌军，给玩家主动脱险与破阵的手段。 */
    nova(id) {
        if (this.commandSender) return this.commandSender('nova');
        const p = this.players.find((player) => player.id === id);
        if (this.state !== 'playing' || !p || p.hp <= 0 || p.novaCd > 0) return;
        p.novaCd = p.novaMax;
        this.rings.push({
            x: p.x,
            y: p.y,
            radius: 10,
            max: 260,
            life: 0.65,
            maxLife: 0.65,
            color: '#c9efbb',
            fill: true,
        });
        this.enemies.forEach((e) => {
            if (distance(e, p) < 260) this.damageEnemy(e, p.novaDamage, true);
        });
        this.bullets = this.bullets.filter((b) => !b.enemy || distance(b, p) > 280);
        this.shake = 12;
        this.flash = 0.12;
        this.hitstop = 0.045;
        this.kickCamera(-Math.PI / 2, 170);
        this.flashScreen(0.46, 0.11);
        this.sound.play('nova', { x: p.x });
        this.burst(p.x, p.y, '#dbf2b8', 70, 300);
    }
    /** E 键部署临时哨戒炮；前方受阻时在车旁部署，炮台不阻挡玩家移动。 */
    deployTurret(id) {
        if (this.commandSender) return this.commandSender('support');
        const p = this.players.find((player) => player.id === id);
        if (this.state !== 'playing' || !p || p.hp <= 0 || p.supportCd > 0) return;
        let x = p.x + Math.cos(p.angle) * 55,
            y = p.y + Math.sin(p.angle) * 55;
        if (this.blocked(x, y, 15)) {
            x = p.x;
            y = p.y;
        }
        this.turrets.push({
            netId: this.nextEntityId++,
            x,
            y,
            radius: 15,
            angle: p.angle,
            bodyAngle: 0,
            damage: p.supportDamage,
            bulletSpeed: 700,
            pierce: 0,
            multishot: 0,
            fireCd: 0,
            // 激光哨塔进化：持续 18 秒并改射穿透激光。
            life: p.laserSentry ? 18 : 12,
            laser: p.laserSentry,
            recoil: 0,
        });
        if (this.turrets.length > 4) this.turrets.shift();
        p.supportCd = p.supportMax;
        this.sound.play('upgrade');
        this.onEvent('toast', `P${id} 哨戒炮已部署 · 持续 12 秒`);
    }
    /** 炮击必须先预警，随后同时影响范围内的装甲与掩体，玩家可利用它反制敌军。 */
    addHazard(x, y, damage = 28, enemy = false) {
        this.hazards.push({
            x: clamp(x, 90, 1190),
            y: clamp(y, 90, 710),
            radius: 90,
            delay: 1.6,
            life: 2,
            damage,
            enemy,
            detonated: false,
        });
        if (this.hazards.length > 10) this.hazards.shift();
    }
    /** 更新战场事件、争夺信标与临时炮台，所有收益和伤害均由同一模拟器结算。 */
    updateField(dt) {
        const config = WAVES[this.wave - 1];
        this.eventTimer -= dt;
        if (config.event === 'bombardment' && this.eventTimer <= 0) {
            this.eventTimer = 5.5;
            // 双人时随机锁定一名存活玩家，而不是永远追着 P1 轰炸。
            const alive = this.players.filter((p) => p.hp > 0);
            const target = alive[Math.floor(Math.random() * alive.length)] || { x: 640, y: 400 };
            this.addHazard(target.x + random(-80, 80), target.y + random(-60, 60));
            this.addHazard(random(180, 1100), random(160, 560));
        }
        // 蜂群潮：每 7 秒从随机一侧边缘涌入 6 架额外无人机，不计入本波生成名额。
        if (config.event === 'swarm' && this.eventTimer <= 0) {
            this.eventTimer = 7;
            const side = [
                [60, random(120, 520)],
                [1220, random(120, 520)],
                [random(200, 1080), 60],
            ][Math.floor(Math.random() * 3)];
            this.spawnSwarm(side[0], side[1], 6);
        }
        this.updateBeams(dt);
        for (const hazard of this.hazards) {
            hazard.delay -= dt;
            hazard.life -= dt;
            if (hazard.delay <= 0 && !hazard.detonated) {
                hazard.detonated = true;
                this.impact('explosion', hazard.x, hazard.y, 0, 1.4);
                this.shake = Math.max(this.shake, 18);
                this.sound.play('explode', { x: hazard.x });
                this.players.forEach((p) => {
                    if (p.hp > 0 && distance(p, hazard) < hazard.radius) this.damagePlayer(p, hazard.damage);
                });
                this.enemies.forEach((e) => {
                    if (!e.dead && distance(e, hazard) < hazard.radius) this.damageEnemy(e, 80, true);
                });
                this.walls.forEach((w) => {
                    if (!w.steel && distance({ x: w.x + 20, y: w.y + 20 }, hazard) < hazard.radius)
                        w.hp -= 100;
                });
                // 炮击落点内的油桶同样会被引爆，敌军火炮也可能替玩家点燃整片油桶阵。
                this.barrels.forEach((barrel) => {
                    if (!barrel.dead && distance(barrel, hazard) < hazard.radius) this.detonateBarrel(barrel);
                });
                if (hazard.enemy && distance(this.core, hazard) < hazard.radius)
                    this.hurtCore(hazard.damage * 0.5);
            }
        }
        this.hazards = this.hazards.filter((h) => h.life > 0);
        if (this.beacon && !this.beacon.done) {
            const held =
                this.players.some((p) => p.hp > 0 && distance(p, this.beacon) < 78) &&
                !this.enemies.some((e) => !e.dead && distance(e, this.beacon) < 105);
            this.beacon.capture = clamp(this.beacon.capture + (held ? dt : -dt * 0.4), 0, 4);
            if (this.beacon.capture >= 4) {
                this.beacon.done = true;
                this.core.hp = Math.min(this.core.maxHp, this.core.hp + 65);
                this.score += 500;
                this.players.forEach((p) => {
                    if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 30);
                });
                this.sound.play('upgrade');
                this.onEvent('toast', '信标已接管 · 核心 +65 · 全员装甲 +30 · 积分 +500');
            }
        }
        for (const turret of this.turrets) {
            turret.life -= dt;
            turret.fireCd -= dt;
            turret.recoil = Math.max(0, turret.recoil - dt * 80);
            const target = this.nearestEnemy(turret);
            if (target && distance(target, turret) < 450 && turret.fireCd <= 0) {
                turret.angle = angleTo(turret, target);
                if (turret.laser) {
                    this.createBullet(turret, turret.angle, false, 1300, turret.damage * 1.2, { kind: 'laser', pierce: 99 });
                    turret.recoil = 8;
                    this.sound.play('shoot', { x: turret.x, strength: 0.5 });
                } else this.fire(turret, false);
                turret.fireCd = turret.laser ? 0.25 : 0.42;
            }
        }
        this.turrets = this.turrets.filter((t) => t.life > 0);
    }
    /**
     * 棱镜光束：预警期（warn 秒）只显示瞄准线，归零瞬间对光束线段上的玩家造成伤害，之后淡出。
     * 光束长度在发射时按掩体截断，因此躲在墙后是有效的反制。
     */
    updateBeams(dt) {
        for (const beam of this.beams) {
            beam.warn -= dt;
            if (beam.warn <= 0 && !beam.fired) {
                beam.fired = true;
                beam.life = 0.28;
                const x2 = beam.x + Math.cos(beam.angle) * beam.length,
                    y2 = beam.y + Math.sin(beam.angle) * beam.length;
                this.players.forEach((p) => {
                    if (p.hp > 0 && segmentCircle(beam.x, beam.y, x2, y2, p, p.radius + 6)) this.damagePlayer(p, beam.damage);
                });
                if (segmentCircle(beam.x, beam.y, x2, y2, this.core, this.core.radius))
                    this.hurtCore(beam.damage * 0.6);
                this.impact('hit', x2, y2, beam.angle + Math.PI, 1.3);
                this.sound.play('laser', { x: beam.x });
            }
            if (beam.fired) beam.life -= dt;
        }
        this.beams = this.beams.filter((b) => !b.fired || b.life > 0);
    }
    /**
     * 计算从 (x, y) 沿 angle 方向射出的光束在遇到第一块存活掩体或地图边界前的长度。
     * 以 10 像素步进采样，精度足够且开销可控；参数 max 为最大射程。
     */
    beamLength(x, y, angle, max) {
        for (let d = 30; d < max; d += 10) {
            const px = x + Math.cos(angle) * d,
                py = y + Math.sin(angle) * d;
            if (px < 0 || py < 0 || px > WORLD.width || py > WORLD.height) return d;
            if (this.walls.some((w) => w.hp > 0 && px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h)) return d;
        }
        return max;
    }
    /** 查找最近可锁定敌人；双人与触屏自动瞄准使用同一规则。 */
    nearestEnemy(p) {
        let target = null,
            best = 700;
        for (const enemy of this.enemies) {
            if (enemy.dead || enemy.warning > 0) continue;
            const d = distance(p, enemy);
            if (d < best) {
                best = d;
                target = enemy;
            }
        }
        return target;
    }
    /** 检测圆形车体与轴对齐掩体的接触，地图边界留出完整车身。 */
    blocked(x, y, radius) {
        if (
            x < radius + 12 ||
            y < radius + 12 ||
            x > WORLD.width - radius - 12 ||
            y > WORLD.height - radius - 12
        )
            return true;
        return this.walls.some(
            (w) =>
                w.hp > 0 && Math.hypot(x - clamp(x, w.x, w.x + w.w), y - clamp(y, w.y, w.y + w.h)) < radius,
        );
    }
    /** 位移分段处理，长距离冲刺也不会越过单块薄墙；分轴解算可沿墙滑行。 */
    move(entity, dx, dy) {
        const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7) || 1;
        for (let i = 0; i < steps; i++) {
            const nx = entity.x + dx / steps,
                ny = entity.y + dy / steps;
            if (!this.blocked(nx, entity.y, entity.radius)) entity.x = nx;
            if (!this.blocked(entity.x, ny, entity.radius)) entity.y = ny;
        }
    }
    /** 轻量网格寻路绕开掩体；路径只在低频重新计算，墙体销毁后自然重新规划。 */
    findPath(entity, target) {
        const size = WORLD.cell,
            cols = 32,
            rows = 20;
        const sx = clamp(Math.floor(entity.x / size), 0, cols - 1),
            sy = clamp(Math.floor(entity.y / size), 0, rows - 1);
        const tx = clamp(Math.floor(target.x / size), 1, cols - 2),
            ty = clamp(Math.floor(target.y / size), 1, rows - 2);
        const start = sy * cols + sx,
            end = ty * cols + tx;
        const queue = [start],
            previous = new Int16Array(cols * rows).fill(-1);
        previous[start] = start;
        let found = false;
        for (let index = 0; index < queue.length; index++) {
            const current = queue[index];
            if (current === end) {
                found = true;
                break;
            }
            const cx = current % cols,
                cy = Math.floor(current / cols);
            for (const [ox, oy] of [
                [0, 1],
                [1, 0],
                [-1, 0],
                [0, -1],
            ]) {
                const nx = cx + ox,
                    ny = cy + oy,
                    next = ny * cols + nx;
                if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1 || previous[next] !== -1) continue;
                // 使用真实车体半径规划路线，让重装首领绕开普通坦克可通过的窄巷。
                if (this.blocked(nx * size + size / 2, ny * size + size / 2, entity.radius)) continue;
                previous[next] = current;
                queue.push(next);
            }
        }
        if (!found) return [];
        const path = [];
        for (let node = end; node !== start; node = previous[node])
            path.push({ x: (node % cols) * size + size / 2, y: Math.floor(node / cols) * size + size / 2 });
        return path.reverse();
    }
    /** 敌军根据距离选择追击或开火，狙击手显示瞄准线，首领半血后加快攻击。 */
    updateEnemy(e, dt) {
        if (e.dead) return;
        e.hit = Math.max(0, e.hit - dt);
        e.recoil = Math.max(0, e.recoil - dt * 80);
        if (e.warning > 0) {
            e.warning -= dt;
            return;
        }
        const alive = this.players.filter((p) => p.hp > 0);
        const nearest = alive.sort((a, b) => distance(a, e) - distance(b, e))[0];
        const target = nearest && (distance(nearest, e) < 260 || !e.targetCore) ? nearest : this.core;
        if (e.type === 'engineer') {
            e.healCd -= dt;
            if (e.healCd <= 0) {
                e.healCd = 4.2;
                this.enemies.forEach((ally) => {
                    if (!ally.dead && distance(ally, e) < 180)
                        ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.12);
                });
                this.rings.push({
                    x: e.x,
                    y: e.y,
                    radius: 10,
                    max: 180,
                    life: 0.55,
                    maxLife: 0.55,
                    color: '#b9edac',
                });
            }
        }
        if (e.blink || e.type === 'riftBoss') this.updateBlink(e, target, dt);
        // 自爆车与蜂群无人机贴身后引爆：无人机爆炸半径与震屏更小，但成群撞上同样致命。
        if ((e.type === 'bomber' || e.drone) && distance(e, target) < e.radius + target.radius + 14) {
            e.dead = true;
            const small = Boolean(e.drone);
            this.impact('explosion', e.x, e.y, 0, small ? 0.5 : 1.1);
            this.shake = Math.max(this.shake, small ? 6 : 16);
            if (target === this.core) this.hurtCore(e.damage);
            this.players.forEach((p) => {
                if (distance(p, e) < (small ? 55 : 100)) this.damagePlayer(p, e.damage);
            });
            this.sound.play('explode', { x: e.x, strength: small ? 0.5 : 1 });
            return;
        }
        // 首领阶段：耐久跌破 66% 与 33% 时各召唤一次蜂群护卫，并播报阶段转换。
        if (e.boss) {
            const phase = e.hp < e.maxHp / 3 ? 2 : e.hp < (e.maxHp * 2) / 3 ? 1 : 0;
            if (phase > (e.phase || 0)) {
                e.phase = phase;
                this.spawnSwarm(e.x, e.y + e.radius + 30, 6);
                this.announceText(phase === 1 ? '首领进入二阶段' : '首领狂暴！', e.name + ' 召唤了蜂群护卫', '#ff9a6a', 1);
                this.sound.play('nova');
            }
        }
        e.angle = angleTo(e, target);
        e.fireCd -= dt;
        e.pathCd -= dt;
        const d = distance(e, target);
        const obstructed = this.walls.some(
            (w) => w.hp > 0 && segmentCircle(e.x, e.y, target.x, target.y, { x: w.x + 20, y: w.y + 20 }, 28),
        );
        e.moving = e.type === 'bomber' || e.drone || d > e.range * 0.78 || obstructed;
        if (e.moving) {
            if (e.pathCd <= 0) {
                e.path = this.findPath(e, target);
                e.pathCd = random(0.65, 1.1);
            }
            while (e.path.length && distance(e, e.path[0]) < 22) e.path.shift();
            const waypoint = e.path[0] || target;
            const angle = angleTo(e, waypoint);
            const speed = e.speed * (e.boss && e.hp < e.maxHp / 2 ? 1.4 : 1);
            e.bodyAngle = angle;
            this.move(e, Math.cos(angle) * speed * dt, Math.sin(angle) * speed * dt);
            e.tread += speed * dt;
        }
        // 同阵营车辆轻度分离，避免在狭窄入口重叠成无法辨识的一团。
        for (const other of this.enemies) {
            if (other === e || other.dead) continue;
            const separation = distance(e, other),
                min = e.radius + other.radius + 3;
            if (separation < min && separation > 0.01)
                this.move(
                    e,
                    ((e.x - other.x) / separation) * 30 * dt,
                    ((e.y - other.y) / separation) * 30 * dt,
                );
        }
        if (d < e.range && e.fireCd <= 0) {
            this.fire(e, true);
            e.fireCd = e.cooldown * (e.boss && e.hp < e.maxHp / 2 ? 0.65 : 1) * random(0.9, 1.2);
        }
        if (e.boss) {
            e.radialCd -= dt;
            e.charge = e.radialCd < 1.1 ? 1 - Math.max(0, e.radialCd) / 1.1 : 0;
            if (e.radialCd <= 0) {
                const count = e.type === 'frostBoss' ? 18 : e.hp < e.maxHp / 2 ? 20 : 14;
                for (let i = 0; i < count; i++)
                    this.createBullet(e, (i / count) * Math.PI * 2 + this.time * 0.1, true, 245, e.damage);
                // 裂隙主脑半血后追加一层错位慢速弹幕，形成必须穿缝躲避的双层环。
                if (e.type === 'riftBoss' && e.hp < e.maxHp / 2)
                    for (let i = 0; i < count; i++)
                        this.createBullet(e, ((i + 0.5) / count) * Math.PI * 2 + this.time * 0.1, true, 160, e.damage);
                if (e.type === 'infernoBoss') {
                    this.players.filter((p) => p.hp > 0).forEach((p) => this.addHazard(p.x, p.y, 30, true));
                }
                e.radialCd = e.type === 'frostBoss' ? 4.5 : e.type === 'riftBoss' ? 5 : 5.5;
                this.sound.play('nova');
                this.rings.push({
                    x: e.x,
                    y: e.y,
                    radius: 20,
                    max: 110,
                    life: 0.5,
                    maxLife: 0.5,
                    color: '#f1a15f',
                });
            }
        }
    }
    /**
     * 相位闪烁：幽影朝目标方向跳跃 120 像素；裂隙主脑则跳到战场上随机空地并召唤两只幽影。
     * 参数 e 为敌人，target 为当前追击目标，dt 为秒。落点被掩体阻挡时放弃本次闪烁，不会卡进墙里。
     */
    updateBlink(e, target, dt) {
        e.blinkCd -= dt;
        if (e.blinkCd > 0) return;
        if (e.type === 'riftBoss') {
            e.blinkCd = e.hp < e.maxHp / 2 ? 6 : 8;
            for (let attempt = 0; attempt < 12; attempt++) {
                const x = random(200, 1080),
                    y = random(130, 420);
                if (this.blocked(x, y, e.radius)) continue;
                this.burst(e.x, e.y, '#c9a8ff', 40, 220);
                e.x = x;
                e.y = y;
                e.path = [];
                break;
            }
            this.rings.push({ x: e.x, y: e.y, radius: 10, max: 120, life: 0.6, maxLife: 0.6, color: '#c9a8ff' });
            // 召唤受敌军总数上限约束，避免首领战无限堆怪。
            for (const offset of [-60, 60]) {
                if (this.enemies.length >= MAX_ENEMIES) break;
                const minion = this.makeEnemy('phantom', clamp(e.x + offset, 60, 1220), e.y + 30);
                minion.warning = 0.6;
                if (!this.blocked(minion.x, minion.y, minion.radius)) this.enemies.push(minion);
            }
            this.sound.play('nova');
            return;
        }
        e.blinkCd = random(3.2, 4.6);
        if (distance(e, target) < 140) return;
        const angle = angleTo(e, target),
            x = e.x + Math.cos(angle) * 120,
            y = e.y + Math.sin(angle) * 120;
        if (this.blocked(x, y, e.radius)) return;
        this.burst(e.x, e.y, '#b49be0', 14, 120);
        e.x = x;
        e.y = y;
        e.path = [];
        this.rings.push({ x, y, radius: 6, max: 40, life: 0.35, maxLife: 0.35, color: '#c9a8ff' });
    }
    /** 主炮统一生成弹道，双联炮和首领扇形攻击通过相同弹道规则处理。 */
    fire(entity, enemy) {
        if (enemy && (entity.type === 'bomber' || entity.drone)) return;
        // 喷火战车：每次喷出两团短命火焰，带随机散布，近身形成火墙；不播放炮声以免持续刷屏。
        if (enemy && entity.type === 'flamer') {
            for (let i = 0; i < 2; i++)
                this.createBullet(entity, entity.angle + random(-0.28, 0.28), true, random(300, 360), entity.damage, {
                    kind: 'flame',
                    life: 0.55,
                    radius: 7,
                });
            return;
        }
        // 棱镜炮车：锁定当前朝向发射一道预警光束，1 秒后结算；同一辆车同时只保留一道光束。
        if (enemy && entity.type === 'lancer') {
            if (this.beams.some((b) => b.owner === entity.netId)) return;
            const x = entity.x + Math.cos(entity.angle) * (entity.radius + 14),
                y = entity.y + Math.sin(entity.angle) * (entity.radius + 14);
            this.beams.push({
                owner: entity.netId,
                x,
                y,
                angle: entity.angle,
                length: this.beamLength(x, y, entity.angle, 1400),
                warn: 1,
                fired: false,
                life: 0,
                damage: entity.damage,
            });
            entity.recoil = 9;
            return;
        }
        // 蜂巢母舰：开舱释放 3 架无人机，代替普通炮击。
        if (enemy && entity.type === 'carrier') {
            const angle = entity.bodyAngle + Math.PI;
            if (this.spawnSwarm(entity.x + Math.cos(angle) * 40, entity.y + Math.sin(angle) * 40, 3).length)
                this.rings.push({ x: entity.x, y: entity.y, radius: 10, max: 60, life: 0.4, maxLife: 0.4, color: '#e8c56c' });
            return;
        }
        if (enemy && entity.type === 'artillery') {
            const target =
                this.players
                    .filter((p) => p.hp > 0)
                    .sort((a, b) => distance(a, entity) - distance(b, entity))[0] || this.core;
            this.addHazard(target.x, target.y, entity.damage, true);
            entity.recoil = 12;
            this.sound.play('enemy', { x: entity.x });
            return;
        }
        // 玩家特装武器只对亲自驾驶的战车生效（哨戒炮没有 weapon 字段）；狂热模式额外提高 35% 伤害。
        const weapon = !enemy ? entity.weapon || '' : '';
        const fever = !enemy && entity.id && this.feverTime > 0 ? 1.35 : 1;
        const count = enemy
            ? entity.boss
                ? entity.type === 'frostBoss'
                    ? 5
                    : 3
                : 1
            : entity.multishot + 1 + (weapon === 'fan' ? 4 : 0);
        // 扇面弹幕拉大散布角，形成覆盖前方的扇形火网。
        const spread = enemy ? 0.17 : weapon === 'fan' ? 0.16 : 0.115;
        if (!enemy && weapon) {
            for (let i = 0; i < count; i++) {
                const offset = (i - (count - 1) / 2) * spread;
                this.createPlayerShot(entity, entity.angle + offset, weapon, fever);
            }
            // 追踪飞弹：每次开火额外从车体两侧交替发射一枚追踪导弹，命中后小范围爆炸。
            if (weapon === 'rocket') {
                entity.rocketSide = -(entity.rocketSide || 1);
                this.createBullet(entity, entity.angle + entity.rocketSide * 0.9, false, 430, entity.damage * 1.4 * fever, {
                    kind: 'rocket',
                    homing: true,
                    life: 2.4,
                    radius: 5,
                    pierce: 0,
                    bounce: 0,
                });
            }
        } else
            for (let i = 0; i < count; i++) {
                const offset = (i - (count - 1) / 2) * spread;
                this.createBullet(
                entity,
                entity.angle + offset,
                enemy,
                enemy
                    ? entity.type === 'sniper'
                        ? 490
                        : entity.type === 'frostBoss'
                          ? 235
                          : 285
                    : entity.bulletSpeed,
                    entity.damage * fever,
                    enemy ? {} : this.shotTraits(entity),
                );
            }
        entity.recoil = enemy ? 7 : 14;
        const muzzle = entity.radius + 20;
        this.burst(
            entity.x + Math.cos(entity.angle) * muzzle,
            entity.y + Math.sin(entity.angle) * muzzle,
            '#ffe9a3',
            5,
            75,
        );
        this.impact(
            'muzzle',
            entity.x + Math.cos(entity.angle) * muzzle,
            entity.y + Math.sin(entity.angle) * muzzle,
            entity.angle,
            enemy ? 0.65 : 1,
        );
        this.sound.play(enemy ? 'enemy' : 'shoot', { x: entity.x });
        // 只有玩家亲自开火才震屏与推镜头；哨戒炮持续射击不再让画面一直抖动。
        if (!enemy && entity.id) {
            this.shake = Math.max(this.shake, 5);
            this.kickCamera(entity.angle + Math.PI, 88);
        }
    }
    /** 弹体记录已穿透目标集合，防止连续多帧对同一车辆重复结算伤害。 */
    /**
     * 参数 options 可覆盖弹体属性：kind（flame/laser/rocket/drone/spark 渲染与规则类型）、life、radius、pierce，
     * 以及玩家弹的 crit（暴击）、explosive（溅射比例）、arc（连锁闪电）、homing（追踪）、damageScale（暴击倍率）。
     * 玩家炮弹寿命 1.7 秒，足够飞越整个战场，又能限制同屏弹量。
     */
    createBullet(entity, angle, enemy, speed, damage, options = {}) {
        const offset = entity.radius + 13;
        // 同屏弹体总量上限：超出时丢弃最早的玩家弹，敌弹始终保留以保证威胁可读。
        if (this.bullets.length > 320) {
            const index = this.bullets.findIndex((b) => !b.enemy);
            if (index >= 0) this.bullets.splice(index, 1);
        }
        const { damageScale = 1, ...rest } = options;
        this.bullets.push({
            x: entity.x + Math.cos(angle) * offset,
            y: entity.y + Math.sin(angle) * offset,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            angle,
            enemy,
            damage: damage * damageScale,
            life: enemy ? 2.7 : 1.7,
            radius: enemy ? 4 : 3,
            pierce: enemy ? 0 : entity.pierce || 0,
            bounce: enemy ? 0 : entity.bounce || 0,
            tint: entity.type === 'frostBoss' ? '#b8e9f3' : entity.type === 'riftBoss' ? '#d6b8ff' : null,
            kind: '',
            crit: false,
            explosive: 0,
            arc: false,
            homing: false,
            hitIds: new Set(),
            dead: false,
            ...rest,
        });
    }
    /**
     * 计算玩家普通炮弹的附加属性：暴击按 crit 概率独立判定（伤害 ×2.5），溅射比例来自高爆改装。
     * 参数 entity 为玩家或哨戒炮；哨戒炮没有这些改装字段，返回值自然为默认值。
     */
    shotTraits(entity) {
        const crit = Math.random() < (entity.crit || 0);
        return { crit, explosive: entity.explosive || 0, damageScale: crit ? 2.5 : 1, pinball: Boolean(entity.pinball) };
    }
    /**
     * 特装武器的单发炮弹：激光高速无限穿透，闪电命中后跳向附近敌人，其余武器沿用普通弹并保留改装效果。
     * 参数 fever 为狂热伤害倍率。
     */
    createPlayerShot(p, angle, weapon, fever) {
        const traits = this.shotTraits(p);
        const laser = weapon === 'laser';
        this.createBullet(p, angle, false, p.bulletSpeed * (laser ? 1.7 : 1), p.damage * (laser ? 1.25 : 1) * fever, {
            ...traits,
            kind: laser ? 'laser' : weapon === 'lightning' ? 'spark' : '',
            pierce: laser ? 99 : p.pierce,
            arc: weapon === 'lightning',
        });
    }
    /** 弹道先检查遮挡再检查目标；友军火力不损伤队友与核心。 */
    updateBullets(dt) {
        for (const b of this.bullets) {
            if (b.dead) continue;
            const ox = b.x,
                oy = b.y;
            if (b.homing) this.steerRocket(b, dt);
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) {
                b.dead = true;
                continue;
            }
            const wall = this.walls.find((w) => w.hp > 0 && this.segmentRect(ox, oy, b.x, b.y, w));
            if (wall) {
                b.dead = true;
                wall.hit = 0.12;
                this.burst(b.x, b.y, wall.steel ? '#e6d2a1' : '#a69c73', 6, 90);
                this.impact('hit', b.x, b.y, b.angle + Math.PI, 0.6);
                if (!wall.steel) {
                    wall.hp -= b.damage;
                    if (wall.hp <= 0) {
                        this.burst(wall.x + 20, wall.y + 20, '#a49b7c', 18, 110);
                        this.mapVersion++;
                    }
                }
                // 跳弹：退回上一帧位置，按撞击面翻转速度分量；上一帧在墙体左右侧则水平反弹，否则垂直反弹。
                // 追踪飞弹撞墙也会爆炸，照样能炸到墙后的敌人。
                if (b.kind === 'rocket') this.explode(b.x, b.y, 70, b.damage * 0.7, { walls: 40, scale: 0.6 });
                // 弹球炸弹：每次撞墙都在撞击点爆炸。
                else if (b.pinball) this.explode(b.x, b.y, 70, b.damage * 0.8, { scale: 0.6, color: '#ff9a5a' });
                if (b.bounce > 0) {
                    b.bounce--;
                    b.dead = false;
                    if (ox < wall.x || ox > wall.x + wall.w) b.vx = -b.vx;
                    else b.vy = -b.vy;
                    b.x = ox;
                    b.y = oy;
                    b.angle = Math.atan2(b.vy, b.vx);
                    b.hitIds.clear();
                }
                continue;
            }
            // 油桶会被任意阵营的炮弹引爆：玩家射爆它清场，敌军流弹也可能在玩家身边点燃它。
            const barrel = this.barrels.find(
                (item) => !item.dead && segmentCircle(ox, oy, b.x, b.y, item, item.radius + b.radius),
            );
            if (barrel) {
                b.dead = true;
                barrel.hp -= b.damage;
                if (barrel.hp <= 0) this.detonateBarrel(barrel);
                else this.burst(b.x, b.y, '#ff9a4a', 4, 80);
                continue;
            }
            if (b.enemy) {
                const player = this.players.find(
                    (p) => p.hp > 0 && segmentCircle(ox, oy, b.x, b.y, p, p.radius + b.radius),
                );
                if (player) {
                    b.dead = true;
                    this.damagePlayer(player, b.damage);
                    continue;
                }
                if (segmentCircle(ox, oy, b.x, b.y, this.core, this.core.radius + b.radius)) {
                    b.dead = true;
                    if (this.core.hit <= 0) {
                        this.hurtCore(b.damage);
                        this.core.hit = 0.14;
                        this.shake = 7;
                        this.sound.play('hurt');
                        this.burst(this.core.x, this.core.y, '#b7e7a1', 10, 100);
                    }
                }
            } else {
                for (const enemy of this.enemies) {
                    if (enemy.dead || enemy.warning > 0 || b.hitIds.has(enemy)) continue;
                    if (segmentCircle(ox, oy, b.x, b.y, enemy, enemy.radius + b.radius)) {
                        b.hitIds.add(enemy);
                        this.damageEnemy(enemy, b.damage, false, b.angle, b.crit);
                        this.burst(b.x, b.y, b.crit ? '#fff27a' : '#ffe5a5', b.crit ? 12 : 6, b.crit ? 170 : 110);
                        this.onBulletHit(b, enemy);
                        if (b.pierce-- <= 0) {
                            b.dead = true;
                            break;
                        }
                    }
                }
            }
        }
        this.bullets = this.bullets.filter((b) => !b.dead);
    }
    /**
     * 追踪飞弹转向：锁定最近的敌人，以每秒 5.5 弧度的上限把速度方向转向目标，速度大小保持不变。
     * 参数 b 为弹体，dt 为秒。目标阵亡后会在下一帧自动换锁。
     */
    steerRocket(b, dt) {
        const target = this.nearestEnemy(b);
        if (!target) return;
        const speed = Math.hypot(b.vx, b.vy);
        const desired = angleTo(b, target);
        let diff = Math.atan2(Math.sin(desired - b.angle), Math.cos(desired - b.angle));
        diff = clamp(diff, -5.5 * dt, 5.5 * dt);
        b.angle += diff;
        b.vx = Math.cos(b.angle) * speed;
        b.vy = Math.sin(b.angle) * speed;
    }
    /**
     * 玩家弹命中敌军后的附加效果：追踪飞弹爆炸、高爆弹头溅射、连锁闪电跳跃。
     * 参数 b 为弹体，enemy 为直接命中的目标（溅射不会对它重复结算）。
     */
    onBulletHit(b, enemy) {
        if (b.kind === 'rocket') {
            this.explode(b.x, b.y, 75, b.damage * 0.7, { skip: enemy, walls: 40, scale: 0.7 });
            this.sound.play('explode', { x: b.x, strength: 0.55 });
        }
        if (b.explosive > 0) this.explode(b.x, b.y, 58, b.damage * b.explosive, { skip: enemy, scale: 0.4, color: '#ffd27a' });
        if (b.arc) this.chainLightning(enemy, b.damage * 0.6, b.arcJumps || 3);
    }
    /**
     * 连锁闪电：从 source 出发依次跳向 170 像素内最近的未命中敌人，最多 jumps 次，每跳伤害为 damage。
     * 每一跳记录一条短暂的电弧供渲染；伤害视为范围伤害（无视盾卫正面护盾）。
     */
    chainLightning(source, damage, jumps) {
        const hit = new Set([source]);
        let from = source;
        for (let i = 0; i < jumps; i++) {
            let next = null,
                best = 170;
            for (const enemy of this.enemies) {
                if (enemy.dead || enemy.warning > 0 || hit.has(enemy)) continue;
                const d = distance(enemy, from);
                if (d < best) {
                    best = d;
                    next = enemy;
                }
            }
            if (!next) break;
            hit.add(next);
            this.arcs.push({ x1: from.x, y1: from.y, x2: next.x, y2: next.y, life: 0.22, maxLife: 0.22, seed: Math.random() });
            this.damageEnemy(next, damage, true, angleTo(from, next));
            from = next;
        }
        if (this.arcs.length > 40) this.arcs.splice(0, this.arcs.length - 40);
    }
    /** 线段与矩形裁剪；使用进入/退出参数避免薄墙漏判。 */
    segmentRect(x1, y1, x2, y2, rect) {
        let near = 0,
            far = 1;
        const dx = x2 - x1,
            dy = y2 - y1;
        for (const [p, q] of [
            [-dx, x1 - rect.x],
            [dx, rect.x + rect.w - x1],
            [-dy, y1 - rect.y],
            [dy, rect.y + rect.h - y1],
        ]) {
            if (p === 0) {
                if (q < 0) return false;
                continue;
            }
            const t = q / p;
            if (p < 0) near = Math.max(near, t);
            else far = Math.min(far, t);
            if (near > far) return false;
        }
        return true;
    }
    /** 核心受伤统一入口：扣除耐久并计入本波承伤，供波次评级使用。参数 amount 为伤害值。 */
    hurtCore(amount) {
        this.core.hp = Math.max(0, this.core.hp - amount);
        this.waveDamage += amount;
    }
    /** 装甲命中带短暂无敌，避免一帧内叠加多发炮弹造成不可读的瞬间死亡。 */
    damagePlayer(p, amount) {
        if (p.invincible > 0 || p.hp <= 0) return;
        // 狂热模式下全员受到的伤害减半，鼓励玩家趁势冲进敌群。
        if (this.feverTime > 0) amount *= 0.5;
        // 护盾优先吸收伤害，被完全吸收时仍给予短暂无敌，但不扣装甲。
        if (p.shield > 0) {
            const absorbed = Math.min(p.shield, amount);
            p.shield -= absorbed;
            amount -= absorbed;
            p.invincible = 0.3;
            this.texts.push({ x: p.x, y: p.y - 30, text: '护盾', color: '#9fd8ff', life: 0.6, maxLife: 0.6 });
            if (p.shield <= 0) this.burst(p.x, p.y, '#9fd8ff', 20, 150);
            if (amount <= 0) return;
        }
        p.hp = Math.max(0, p.hp - amount);
        this.waveDamage += amount;
        p.hit = 0.18;
        p.invincible = 0.45;
        this.shake = 8;
        this.flash = 0.09;
        this.sound.play('hurt');
        this.texts.push({
            x: p.x,
            y: p.y - 30,
            text: `−${Math.round(amount)}`,
            color: '#ff9a7c',
            life: 0.8,
            maxLife: 0.8,
        });
        if (p.hp <= 0) {
            p.deadTime = 0;
            this.impact('explosion', p.x, p.y, p.angle, 1.2);
            this.flashScreen(0.56, 0.12);
            this.burst(p.x, p.y, '#ffa466', 45, 180);
            this.sound.play('explode');
            this.onEvent('toast', `P${p.id} 装甲损毁 · 7 秒后消耗核心能量重建`);
        }
    }
    /** 伤害统一结算击杀、连击、积分、残骸和修复掉落，范围技能也复用该入口。 */
    damageEnemy(enemy, amount, heavy = false, impactAngle = 0, crit = false) {
        if (enemy.dead || enemy.warning > 0) return;
        // 命中停顿统一受冷却约束：火箭、溅射和连锁闪电一帧内的大量命中不会把战斗冻成幻灯片。
        const canStop = this.hitstopCooldown <= 0;
        // 盾卫正面格挡：炮弹飞行方向与车头朝向相反（夹角 > 120°）视为正面命中，只造成 25% 伤害。
        // 震荡、炮击、殉爆等范围伤害（heavy）不受护盾影响。
        const blocked = enemy.shield && !heavy && Math.cos(impactAngle - enemy.angle) < -0.5;
        if (blocked) {
            amount *= 0.25;
            this.burst(
                enemy.x + Math.cos(enemy.angle) * enemy.radius,
                enemy.y + Math.sin(enemy.angle) * enemy.radius,
                '#b9c4ff',
                5,
                90,
            );
        }
        enemy.hp -= amount;
        enemy.hit = 0.14;
        // 装甲视觉位移不会改变真实碰撞体，保留原有平衡与寻路结果。
        enemy.joltX = Math.cos(impactAngle) * (heavy ? 8 : 5);
        enemy.joltY = Math.sin(impactAngle) * (heavy ? 8 : 5);
        this.impact('hit', enemy.x, enemy.y, impactAngle + Math.PI, heavy ? 1.5 : 1);
        this.shake = Math.max(this.shake, heavy ? 16 : 10);
        this.kickCamera(impactAngle, heavy ? 260 : 180);
        if (canStop) {
            this.hitstop = Math.max(this.hitstop, heavy ? 0.05 : 0.032);
            this.hitstopCooldown = 0.12;
        }
        this.sound.play('hit', { x: enemy.x });
        this.texts.push({
            x: enemy.x + random(-10, 10),
            y: enemy.y - enemy.radius,
            text: blocked ? `格挡 ${Math.round(amount)}` : crit ? `暴击 ${Math.round(amount)}!` : `${Math.round(amount)}`,
            color: blocked ? '#b9c4ff' : crit ? '#fff27a' : heavy ? '#c4efae' : '#eee8c7',
            life: crit ? 0.9 : 0.65,
            maxLife: crit ? 0.9 : 0.65,
            big: crit,
        });
        if (enemy.hp <= 0) {
            enemy.dead = true;
            this.kills++;
            // 连击不再封顶，积分倍率每连击 +5%，最高 ×5；连击窗口 3.5 秒。
            this.combo = Math.min(999, this.combo + 1);
            this.comboTime = 3.5;
            this.waveMaxCombo = Math.max(this.waveMaxCombo, this.combo);
            this.score += Math.round(enemy.score * Math.min(5, 1 + (this.combo - 1) * 0.05));
            // 击杀音阶：每次击毁按连击数在五声音阶上升一级，连杀时像在弹琴。
            this.sound.play('killnote', { step: this.combo });
            // 残骸碎片：按敌人颜色四溅的大块碎片，由客户端按爆裂参数本地生成，不占快照体积。
            this.burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 40 : enemy.drone ? 4 : 10, enemy.boss ? 320 : 220, 'debris');
            if (enemy.boss) {
                this.slowmo = 0.9;
                this.announceText('终结！', `${enemy.name} 已被击毁`, '#ffd36e', 2);
            }
            this.shake = Math.max(this.shake, enemy.boss ? 40 : enemy.drone ? 10 : 22);
            // 击毁停顿只在冷却结束时触发（首领例外），清屏时依然流畅。
            if (enemy.boss) this.hitstop = 0.16;
            else if (canStop) this.hitstop = Math.max(this.hitstop, 0.06);
            this.flashScreen(enemy.boss ? 0.74 : 0.4, enemy.boss ? 0.15 : 0.095);
            this.impact('explosion', enemy.x, enemy.y, impactAngle, enemy.boss ? 2.3 : 1);
            this.kickCamera(impactAngle, enemy.boss ? 400 : 280);
            this.sound.play('explode', { x: enemy.x, strength: enemy.boss ? 1.25 : 1 });
            this.burst(enemy.x, enemy.y, '#f7a35b', enemy.boss ? 120 : 35, enemy.boss ? 280 : 150);
            this.rings.push({
                x: enemy.x,
                y: enemy.y,
                radius: 6,
                max: enemy.radius * 3,
                life: 0.4,
                maxLife: 0.4,
                color: '#e6a65e',
            });
            this.wrecks.push({
                x: enemy.x,
                y: enemy.y,
                angle: enemy.bodyAngle,
                radius: enemy.radius,
                life: 30,
            });
            if (enemy.type === 'splitter') {
                for (const offset of [-28, 28]) {
                    const drone = this.makeEnemy('scout', clamp(enemy.x + offset, 40, 1240), enemy.y);
                    drone.hp *= 0.65;
                    drone.maxHp = drone.hp;
                    drone.warning = 0.35;
                    if (!this.blocked(drone.x, drone.y, drone.radius)) this.enemies.push(drone);
                }
            }
            if (this.wrecks.length > 35) this.wrecks.shift();
            this.onKillRewards(enemy);
            this.dropLoot(enemy);
        }
    }
    /**
     * 击毁掉落：首领爆出一圈武器与核弹；精英必掉特装武器；普通敌军按概率掉落武器，
     * 其余情况约每 6 杀掉一次维修/护盾模块（无人机不掉维修，避免满地补给）。
     * 「火力全开」事件波武器掉率 ×3。
     */
    dropLoot(enemy) {
        const drop = (kind, x = enemy.x, y = enemy.y) =>
            this.pickups.push({ x: clamp(x, 40, 1240), y: clamp(y, 40, 760), life: 18, age: 0, kind });
        const weapons = ['fan', 'laser', 'rocket', 'lightning'];
        const randomWeapon = () => (Math.random() < 0.1 ? 'nuke' : weapons[Math.floor(Math.random() * weapons.length)]);
        if (enemy.boss) {
            drop('nuke');
            weapons.forEach((kind, i) => {
                const angle = (i / weapons.length) * Math.PI * 2;
                drop(kind, enemy.x + Math.cos(angle) * 70, enemy.y + Math.sin(angle) * 70);
            });
            drop('repair', enemy.x, enemy.y + 40);
            return;
        }
        const frenzy = WAVES[this.wave - 1]?.event === 'frenzy' ? 3 : 1;
        if (enemy.affix || enemy.bounty || Math.random() < (enemy.drone ? 0.02 : 0.06) * frenzy * (this.asc(7) ? 0.5 : 1)) {
            drop(randomWeapon());
            return;
        }
        if (!enemy.drone && (this.kills % 6 === 0 || Math.random() < 0.1))
            drop(Math.random() < 0.18 ? 'shield' : 'repair');
    }
    /**
     * 击毁后的附加奖励：悬赏结算、吸能回复、殉爆连锁与连击狂热。
     * 参数 enemy 为刚被击毁的敌人。殉爆通过 damageEnemy 递归，但每个敌人只会死亡一次，链条必然终止。
     */
    onKillRewards(enemy) {
        const alive = this.players.filter((p) => p.hp > 0);
        if (enemy.bounty) {
            this.score += 1000;
            this.core.hp = Math.min(this.core.maxHp, this.core.hp + 40);
            alive.forEach((p) => (p.hp = p.maxHp));
            this.texts.push({ x: enemy.x, y: enemy.y - 40, text: '悬赏 +1000', color: '#ffd36e', life: 1.4, maxLife: 1.4 });
            this.onEvent('toast', '悬赏目标已击毁 · 积分 +1000 · 全员装甲修满 · 核心 +40');
            this.sound.play('upgrade');
        }
        // 吸能改装由全队共享，取任一玩家的数值即可（改装对所有玩家同步生效）。
        const lifesteal = this.players[0]?.lifesteal || 0;
        if (lifesteal > 0) alive.forEach((p) => (p.hp = Math.min(p.maxHp, p.hp + lifesteal)));
        if (this.players.some((p) => p.chain)) {
            // 血色连爆进化：范围 ×1.5、伤害 ×2，并换成暗红色冲击环。
            const power = this.players[0]?.chainPower || 1,
                radius = power > 1 ? 128 : 85;
            this.rings.push({ x: enemy.x, y: enemy.y, radius: 10, max: radius, life: 0.35, maxLife: 0.35, color: power > 1 ? '#ff5a6a' : '#ffb46b' });
            for (const other of this.enemies)
                if (other !== enemy && !other.dead && distance(other, enemy) < radius + other.radius)
                    this.damageEnemy(other, 45 * power, true, angleTo(enemy, other));
        }
        // 永动狂热进化：狂热期间每次击毁延长 0.25 秒，总时长不超过 20 秒。
        if (this.feverTime > 0 && this.players[0]?.eternalFever) this.feverTime = Math.min(20, this.feverTime + 0.25);
        // 连击超频：连击达到 5 以及每满 10 时，全员获得 4 秒超频射速，奖励连续击破。
        if (this.combo === 5 || this.combo % 10 === 0) {
            alive.forEach((p) => (p.overdrive = Math.max(p.overdrive, 4)));
            this.onEvent('toast', `${this.combo} 连击 · 火力狂热！全员超频 4 秒`);
        }
        // 狂热值：普通 4、精英/悬赏 15、首领直接灌满；无人机只给 1.5，避免蜂群波狂热永不停。
        this.addFever(enemy.boss ? 100 : enemy.affix || enemy.bounty ? 15 : enemy.drone ? 1.5 : 4);
        // 连杀：0.6 秒内连续击毁计入同一轮，达到 3/6/10/15/25 时播报大字。
        this.streak++;
        this.streakTimer = 0.6;
        const names = { 3: '三连破！', 6: '六连屠戮！', 10: '十连横扫！', 15: '暴走！', 25: '钢铁风暴！' };
        if (names[this.streak]) {
            this.announceText(names[this.streak], `${this.streak} KILL STREAK · 积分 +${this.streak * 40}`, this.streak >= 10 ? '#ff7ad9' : '#ffd36e');
            this.score += this.streak * 40;
            this.sound.play('streak', { strength: Math.min(2, this.streak / 6) });
        }
        // 爆裂精英阵亡时炸开，敌我都会受伤；玩家可以借此把它引进敌群。
        if (enemy.affix === 'volatile') {
            this.sound.play('explode', { x: enemy.x, strength: 1.1 });
            this.explode(enemy.x, enemy.y, 110, 90, { players: 20, walls: 60, scale: 1.2, skip: enemy, color: '#ff8a5c' });
        }
    }
    /** 维修模块靠近后自动吸附，修复装甲并给核心补充少量能量。 */
    updatePickups(dt) {
        for (const pickup of this.pickups) {
            pickup.life -= dt;
            pickup.age += dt;
            // 吸附半径：基础 100，磁吸改装翻倍，狂热模式再扩大到 260。
            const reach = (p) => (this.feverTime > 0 ? 260 : 100 * p.magnet);
            const player = this.players.find((p) => p.hp > 0 && distance(p, pickup) < reach(p));
            if (!player) continue;
            const d = distance(player, pickup);
            if (d < 28) {
                pickup.life = 0;
                // 特装武器与核弹走独立的装备流程，不提供维修与核心补能。
                if (WEAPONS[pickup.kind]) {
                    this.giveWeapon(player, pickup.kind);
                    this.score += 80;
                    continue;
                }
                if (pickup.kind === 'overdrive') player.overdrive = 8;
                // 护盾模块提供 45 点可叠加吸收量，上限 90，防止囤积成无敌。
                else if (pickup.kind === 'shield') player.shield = Math.min(90, player.shield + 45);
                else player.hp = Math.min(player.maxHp, player.hp + 22 + player.repairBonus);
                this.core.hp = Math.min(this.core.maxHp, this.core.hp + 8);
                this.score += 50;
                this.sound.play('pickup');
                this.texts.push({
                    x: player.x,
                    y: player.y - 35,
                    text:
                        pickup.kind === 'overdrive'
                            ? '超频 8 秒'
                            : pickup.kind === 'shield'
                              ? '护盾 +45'
                              : `+${22 + player.repairBonus} 修复`,
                    color: '#c5efa8',
                    life: 1,
                    maxLife: 1,
                });
            } else {
                pickup.x += ((player.x - pickup.x) / d) * 320 * dt;
                pickup.y += ((player.y - pickup.y) / d) * 320 * dt;
            }
        }
        this.pickups = this.pickups.filter((p) => p.life > 0);
    }
    /** 粒子有固定上限；爆炸采用少量高对比火星与慢速烟尘避免过度遮挡。 */
    burst(x, y, color, count, speed, kind = '') {
        // 联机服务器不广播粒子数组（曾占快照体积的七成），只记录生成参数，由客户端本地复现火花。
        if (this.burstLog) {
            this.burstLog.push(kind ? [Math.round(x), Math.round(y), color, count, speed, kind] : [Math.round(x), Math.round(y), color, count, speed]);
            if (this.burstLog.length > 120) this.burstLog.shift();
        }
        // 手机等触屏设备由界面层把 particleScale 设为 0.5，火花减半以保持帧率；规则不受影响。
        count = Math.ceil(count * (this.particleScale ?? 1));
        for (let i = 0; i < count; i++) {
            const angle = random(0, Math.PI * 2),
                velocity = random(speed * 0.15, speed),
                life = random(0.2, 0.8);
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                color,
                life,
                maxLife: life,
                size: random(1.2, 4),
                smoke: i % 5 === 0,
            });
            // 碎片：更大、更慢消散、带自旋的方块，覆盖默认火星外观。
            if (kind === 'debris') {
                const debris = this.particles[this.particles.length - 1];
                debris.debris = true;
                debris.smoke = false;
                debris.size = random(3, 7);
                debris.life = debris.maxLife = random(0.6, 1.2);
                debris.spin = random(-12, 12);
            }
        }
        if (this.particles.length > 750) this.particles.splice(0, this.particles.length - 750);
    }
    /** 击毁产生短促白闪，连续击毁最多每 0.4 秒触发一次，首领强闪可覆盖弱闪。 */
    flashScreen(strength, duration) {
        if (this.whiteFlashCooldown > 0 && strength <= this.whiteFlash.strength) return;
        this.whiteFlash = { life: duration, maxLife: duration, strength };
        this.whiteFlashCooldown = 0.4;
    }
    /** 方向冲量由弹簧镜头吸收；连续射击限制最大速度，避免镜头累积漂走。 */
    kickCamera(angle, force) {
        this.camera.vx = clamp(this.camera.vx + Math.cos(angle) * force, -400, 400);
        this.camera.vy = clamp(this.camera.vy + Math.sin(angle) * force, -400, 400);
    }
    /** 短时冲击实体统一设上限，枪口、命中和爆炸分别使用不同的生命与尺度。 */
    impact(kind, x, y, angle, strength = 1) {
        const life = kind === 'muzzle' ? 0.095 : kind === 'hit' ? 0.18 : 0.8;
        this.impacts.push({ kind, x, y, angle, strength, life, maxLife: life });
        if (this.impacts.length > 90) this.impacts.shift();
    }
    /** 纯视觉计时与实体逻辑分离，菜单演示也能保持核心呼吸和环境动画。 */
    updateEffects(dt) {
        const camera = this.camera;
        camera.vx += (-camera.x * 180 - camera.vx * 15) * dt;
        camera.vy += (-camera.y * 180 - camera.vy * 15) * dt;
        camera.x = clamp(camera.x + camera.vx * dt, -28, 28);
        camera.y = clamp(camera.y + camera.vy * dt, -28, 28);
        this.whiteFlash.life = Math.max(0, this.whiteFlash.life - dt);
        this.whiteFlashCooldown = Math.max(0, this.whiteFlashCooldown - dt);
        this.impacts.forEach((effect) => {
            effect.life -= dt;
        });
        this.impacts = this.impacts.filter((effect) => effect.life > 0);
        [...this.players, ...this.enemies].forEach((entity) => {
            entity.joltX = (entity.joltX || 0) * Math.exp(-dt * 28);
            entity.joltY = (entity.joltY || 0) * Math.exp(-dt * 28);
        });
        this.shake = Math.max(0, this.shake - dt * 65);
        this.flash = Math.max(0, this.flash - dt);
        this.walls.forEach((w) => {
            w.hit = Math.max(0, w.hit - dt);
        });
        this.particles.forEach((p) => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= Math.exp(-dt * 3);
            p.vy *= Math.exp(-dt * 3);
        });
        this.particles = this.particles.filter((p) => p.life > 0);
        this.rings.forEach((r) => {
            r.life -= dt;
            r.radius += (r.max - r.radius) * Math.min(1, dt * 8);
        });
        this.rings = this.rings.filter((r) => r.life > 0);
        this.texts.forEach((t) => {
            t.life -= dt;
            t.y -= dt * 32;
        });
        this.texts = this.texts.filter((t) => t.life > 0);
        if (this.texts.length > 90) this.texts.splice(0, this.texts.length - 90);
        if (this.rings.length > 80) this.rings.splice(0, this.rings.length - 80);
        this.arcs.forEach((a) => {
            a.life -= dt;
        });
        this.arcs = this.arcs.filter((a) => a.life > 0);
        if (this.announce) {
            this.announce.life -= dt;
            if (this.announce.life <= 0) this.announce = null;
        }
        this.wrecks.forEach((w) => {
            w.life -= dt;
        });
        this.wrecks = this.wrecks.filter((w) => w.life > 0);
    }
    /** 清波补给先恢复全员部分装甲，再提供不重复的三选一改装。 */
    completeWave() {
        if (this.wave >= WAVES.length) {
            this.finish(true);
            return;
        }
        this.state = 'upgrade';
        this.bullets = [];
        this.beams = [];
        // 余烬等级 4「核心过载」清波不再修复核心。
        if (!this.asc(4)) this.core.hp = Math.min(this.core.maxHp, this.core.hp + 15);
        this.players.forEach((p) => {
            p.hp = Math.min(p.maxHp, Math.max(p.hp, 1) + 35);
            p.dashCd = 0;
            p.novaCd = 0;
            p.supportCd = 0;
        });
        this.gradeWave();
        this.choices = this.drawChoices();
        this.sound.play('upgrade');
        this.onEvent('upgrade', this.choices);
    }
    /**
     * 波次评级：评分 = 100 − 本波承伤 × 0.6 + 本波最高连击（最多计 40）。
     * S ≥ 115：+1500 积分并额外获得 1 次刷新；A ≥ 95：+800；B ≥ 70：+300；其余为 C。
     * 结果保存在 lastGrade，供改装界面展示。
     */
    gradeWave() {
        const points = 100 - this.waveDamage * 0.6 + Math.min(40, this.waveMaxCombo);
        const grade = points >= 115 ? 'S' : points >= 95 ? 'A' : points >= 70 ? 'B' : 'C';
        const bonus = { S: 1500, A: 800, B: 300, C: 0 }[grade];
        this.score += bonus;
        if (grade === 'S') this.rerolls++;
        this.lastGrade = { grade, bonus, damage: Math.round(this.waveDamage), combo: this.waveMaxCombo };
    }
    /**
     * 抽取三张改装候选：
     * 1. 若存在「前置已凑齐、尚未获得」的进化卡，必定放在首位（每次只放一张）；
     * 2. 其余按稀有度权重（普通 6、稀有 3、传说 1）不放回加权抽取，已达上限的改装不再出现。
     */
    drawChoices() {
        const owned = (id) => this.upgrades.filter((item) => item === id).length;
        const choices = [];
        const evolution = UPGRADES.find(
            (u) => u.requires && !owned(u.id) && u.requires.every((id) => owned(id) > 0),
        );
        if (evolution) choices.push(evolution);
        const pool = UPGRADES.filter((u) => !u.requires && (!u.max || owned(u.id) < u.max));
        while (choices.length < 3 && pool.length) {
            const total = pool.reduce((sum, u) => sum + (RARITY[u.rarity]?.weight || 1), 0);
            let roll = Math.random() * total,
                index = 0;
            while (index < pool.length - 1 && (roll -= RARITY[pool[index].rarity]?.weight || 1) > 0) index++;
            choices.push(pool.splice(index, 1)[0]);
        }
        return choices;
    }
    /** 消耗一次刷新，重新抽取改装候选（进化卡保底规则不变）；联机时由服务器执行并重置双方投票。 */
    rerollUpgrade() {
        if (this.commandSender) return this.commandSender('reroll');
        if (this.state !== 'upgrade' || this.rerolls <= 0) return;
        this.rerolls--;
        this.choices = this.drawChoices();
        this.sound.play('powerup');
        this.onEvent('upgrade', this.choices);
    }
    /** 改装只允许从当前候选中选择一次，防止重复点击叠加多次升级。 */
    chooseUpgrade(id) {
        if (this.commandSender) return this.commandSender('vote', { id });
        if (this.state !== 'upgrade') return;
        const upgrade = this.choices.find((u) => u.id === id);
        if (!upgrade) return;
        this.players.forEach((p) => upgrade.apply(p));
        if (id === 'repair') this.core.hp = Math.min(this.core.maxHp, this.core.hp + 150);
        this.upgrades.push(id);
        this.sound.play('upgrade');
        this.state = 'playing';
        this.onEvent('upgraded', upgrade);
        this.beginWave();
    }
    /** 暂停清理瞬时输入，避免恢复后角色自动行走或继续开火。 */
    pause() {
        if (this.commandSender) return this.commandSender('pause');
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.clearInput();
        this.onEvent('pause');
    }
    /** 继续游戏时保留所有实体与剩余冷却。 */
    resume() {
        if (this.commandSender) return this.commandSender('resume');
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.clearInput();
        this.onEvent('resume');
    }
    /** 失焦、暂停及重开共用输入释放逻辑。 */
    clearInput() {
        this.keys.clear();
        this.pointer.down = false;
        this.touchFire = false;
        this.stick.x = 0;
        this.stick.y = 0;
    }
    /** 结算后不再模拟；最高积分安全保存到本机，不引入账号或在线请求。 */
    finish(win) {
        if (this.state !== 'playing') return;
        this.state = win ? 'won' : 'lost';
        this.clearInput();
        this.sound.play(win ? 'win' : 'lose');
        try {
            this.best = Math.max(this.score, Number(localStorage.getItem('emberline-best')) || 0);
            localStorage.setItem('emberline-best', String(this.best));
        } catch {
            this.best = this.score;
        }
        // 附带局外结算需要的信息：本局编号、余烬等级、开局战区与本局肃清的波数（胜利时计满）。
        this.onEvent('finish', {
            win,
            score: this.score,
            kills: this.kills,
            time: this.time,
            best: this.best,
            runId: this.runId,
            mode: this.mode,
            ascension: this.ascension,
            chapter: this.chapter,
            cleared: win ? WAVES.length - this.chapter * 6 : Math.max(0, this.wave - 1 - this.chapter * 6),
        });
    }
}
