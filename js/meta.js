import { CHASSIS, TALENTS, ASCENSION } from './config.js';

/**
 * 局外成长存档：余烬碎片、已解锁底盘、天赋等级与余烬等级进度。
 * 本模块只含纯逻辑，存储对象（浏览器中为 localStorage）由调用方传入，便于在 Node 中测试。
 * 存档只保存在本机，不涉及账号或网络请求。
 */
export const META_KEY = 'emberline-meta';

/** 新玩家的初始存档：只有标准底盘，余烬等级 0。 */
export function defaultMeta() {
    return {
        shards: 0,
        totalShards: 0,
        chassis: ['standard'],
        selected: 'standard',
        talents: {},
        maxAscension: 0,
        ascension: 0,
        lastRunId: '',
        runs: 0,
    };
}

/**
 * 读取并校验存档：字段缺失或被手工改坏时回落到安全默认值，而不是让界面崩溃。
 * 参数 storage 需提供 getItem；读取失败（隐私模式等）时返回全新存档。
 */
export function loadMeta(storage) {
    const meta = defaultMeta();
    try {
        const saved = JSON.parse(storage?.getItem(META_KEY) || 'null');
        if (!saved || typeof saved !== 'object') return meta;
        const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
        meta.shards = count(saved.shards);
        meta.totalShards = count(saved.totalShards);
        meta.runs = count(saved.runs);
        meta.lastRunId = typeof saved.lastRunId === 'string' ? saved.lastRunId : '';
        if (Array.isArray(saved.chassis))
            meta.chassis = ['standard', ...saved.chassis.filter((id) => CHASSIS[id] && id !== 'standard')];
        meta.selected = meta.chassis.includes(saved.selected) ? saved.selected : 'standard';
        for (const talent of TALENTS) {
            const level = count(saved.talents?.[talent.id]);
            if (level) meta.talents[talent.id] = Math.min(level, talent.costs.length);
        }
        meta.maxAscension = Math.min(ASCENSION.length, count(saved.maxAscension));
        meta.ascension = Math.min(meta.maxAscension, count(saved.ascension));
    } catch {
        /* 存档损坏时使用默认存档。 */
    }
    return meta;
}

/** 写入存档；存储不可用时静默放弃，本次会话内的进度仍保留在内存中。 */
export function saveMeta(storage, meta) {
    try {
        storage?.setItem(META_KEY, JSON.stringify(meta));
    } catch {
        /* 隐私模式或存储已满。 */
    }
}

/**
 * 计算一局结算获得的余烬碎片：
 * 基础 = 积分 / 500（取整）+ 肃清波数 × 5 + 胜利 100；
 * 再乘以余烬等级加成（每级 +15%）与「打捞协议」天赋加成（每级 +15%）。
 * 参数 result 为模拟层 finish 事件数据，salvage 为打捞协议等级。
 */
export function shardsFor(result, salvage = 0) {
    const base = Math.floor((result.score || 0) / 500) + (result.cleared || 0) * 5 + (result.win ? 100 : 0);
    return Math.round(base * (1 + (result.ascension || 0) * 0.15) * (1 + salvage * 0.15));
}

/**
 * 结算一局：发放碎片并判定是否解锁下一级余烬等级。
 * 解锁条件：从第 1 关开局（chapter 0）、打通全部战役、且挑战的正是当前最高已解锁等级。
 * 同一 runId 只结算一次，刷新页面或断线重连收到重复结算事件时返回 null。
 * 返回 { earned, unlocked }，unlocked 为新解锁的等级（没有则为 0）。会直接修改 meta。
 */
export function recordRun(meta, result) {
    if (!result?.runId || result.runId === meta.lastRunId) return null;
    meta.lastRunId = result.runId;
    meta.runs++;
    const earned = shardsFor(result, meta.talents.salvage || 0);
    meta.shards += earned;
    meta.totalShards += earned;
    let unlocked = 0;
    if (
        result.win &&
        result.chapter === 0 &&
        result.ascension === meta.maxAscension &&
        meta.maxAscension < ASCENSION.length
    ) {
        meta.maxAscension++;
        meta.ascension = meta.maxAscension;
        unlocked = meta.maxAscension;
    }
    return { earned, unlocked };
}

/** 购买底盘：未拥有且碎片足够时扣费解锁并自动选用，返回是否成功。 */
export function buyChassis(meta, id) {
    const data = CHASSIS[id];
    if (!data || meta.chassis.includes(id) || meta.shards < data.cost) return false;
    meta.shards -= data.cost;
    meta.chassis.push(id);
    meta.selected = id;
    return true;
}

/** 选用已拥有的底盘，返回是否成功。 */
export function selectChassis(meta, id) {
    if (!meta.chassis.includes(id)) return false;
    meta.selected = id;
    return true;
}

/** 下一级天赋的价格；已满级或天赋不存在时返回 null。 */
export function talentCost(meta, id) {
    const talent = TALENTS.find((item) => item.id === id);
    if (!talent) return null;
    return talent.costs[meta.talents[id] || 0] ?? null;
}

/** 购买一级天赋：未满级且碎片足够时扣费升级，返回是否成功。 */
export function buyTalent(meta, id) {
    const cost = talentCost(meta, id);
    if (cost === null || meta.shards < cost) return false;
    meta.shards -= cost;
    meta.talents[id] = (meta.talents[id] || 0) + 1;
    return true;
}

/** 选择本局挑战的余烬等级，只能在 0 与已解锁最高等级之间。 */
export function selectAscension(meta, level) {
    meta.ascension = Math.max(0, Math.min(meta.maxAscension, Math.floor(level) || 0));
    return meta.ascension;
}
