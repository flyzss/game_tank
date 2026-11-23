import { WORLD, WAVES, ZONES, WEAPONS, AFFIXES } from './config.js';
import { clamp } from './game.js';

/** Canvas 美术层：离屏绘制静态废墟，实时只重绘实体、灯光和反馈。 */
export class Renderer {
    constructor(canvas, radar, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.radar = radar;
        this.rctx = radar.getContext('2d');
        this.game = game;
        this.background = document.createElement('canvas');
        this.background.width = WORLD.width;
        this.background.height = WORLD.height;
        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.makeBackground();
    }
    /** 固定种子的纹理随机数让每次进入看到一致的地图，也使视觉回归更可靠。 */
    seedRandom() {
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    /** 预绘工业区地面：混凝土接缝、双车道、维修区、管线、焦土与散落碎石。 */
    makeBackground(zone = this.game.zone || 0) {
        this.zone = zone;
        const palette = ZONES[zone];
        const c = this.background.getContext('2d');
        this.seed = 37014;
        c.fillStyle = palette.ground;
        c.fillRect(0, 0, 1280, 800);
        // 地表斑驳逐块绘制，避免每帧噪声计算并让坦克剪影保持清晰。
        for (let i = 0; i < 1300; i++) {
            c.fillStyle = ['#404a35', '#2c392d', '#46503b', '#3d4634', '#4a5038'][
                Math.floor(this.seedRandom() * 5)
            ];
            c.globalAlpha = 0.12 + this.seedRandom() * 0.2;
            c.beginPath();
            c.ellipse(
                this.seedRandom() * 1280,
                this.seedRandom() * 800,
                5 + this.seedRandom() * 70,
                3 + this.seedRandom() * 30,
                this.seedRandom() * 6,
                0,
                Math.PI * 2,
            );
            c.fill();
        }
        c.globalAlpha = 1;
        c.fillStyle = palette.road;
        c.fillRect(535, 0, 210, 800);
        c.fillRect(0, 265, 1280, 190);
        c.fillStyle = '#474c3f';
        c.fillRect(490, 580, 300, 176);
        c.strokeStyle = '#66705a';
        c.lineWidth = 2;
        c.setLineDash([22, 24]);
        c.beginPath();
        c.moveTo(640, 20);
        c.lineTo(640, 550);
        c.moveTo(25, 360);
        c.lineTo(1255, 360);
        c.stroke();
        c.setLineDash([]);
        c.strokeStyle = '#74755a55';
        c.lineWidth = 1;
        for (let x = 40; x < 1280; x += 80) {
            c.beginPath();
            c.moveTo(x, 265);
            c.lineTo(x, 455);
            c.stroke();
        }
        for (let y = 0; y < 800; y += 80) {
            c.beginPath();
            c.moveTo(535, y);
            c.lineTo(745, y);
            c.stroke();
        }
        c.strokeStyle = '#202b2490';
        c.lineWidth = 2;
        for (let i = 0; i < 180; i++) {
            const x = this.seedRandom() * 1280,
                y = this.seedRandom() * 800;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + this.seedRandom() * 17, y - 6);
            c.lineTo(x + this.seedRandom() * 32, y + 8);
            c.stroke();
        }
        // 道路上的履带痕和制动印记不与动态弹道混用。
        c.strokeStyle = '#25302755';
        c.lineWidth = 5;
        for (let i = 0; i < 14; i++) {
            const x = this.seedRandom() * 1000 + 100,
                y = this.seedRandom() * 650;
            c.save();
            c.translate(x, y);
            c.rotate(this.seedRandom() * 5);
            c.setLineDash([3, 3]);
            c.beginPath();
            c.moveTo(-11, 0);
            c.lineTo(-11, 110);
            c.moveTo(11, 0);
            c.lineTo(11, 110);
            c.stroke();
            c.restore();
        }
        c.fillStyle = '#172b27';
        c.fillRect(47, 562, 116, 151);
        c.fillStyle = '#243b30';
        c.fillRect(52, 567, 106, 141);
        c.strokeStyle = '#71816a';
        c.strokeRect(44, 559, 122, 157);
        c.strokeStyle = '#4f6b4c66';
        c.lineWidth = 1;
        for (let y = 579; y < 700; y += 15) {
            c.beginPath();
            c.moveTo(58, y);
            c.lineTo(153, y);
            c.stroke();
        }
        // 旧设施与警戒线给战场提供位置记忆，而不是填充无意义的装饰。
        this.groundLabel(c, palette.subtitle, 220, 110, 20, '#9fa28360');
        this.groundLabel(c, 'KEEP CLEAR', 905, 565, 15, '#b5aa7e70');
        this.groundLabel(c, '07', 240, 725, 75, '#a2a08030');
        this.groundLabel(c, 'CORE / REACTOR', 566, 767, 13, '#a8b19799');
        c.strokeStyle = '#9c9b6a88';
        c.lineWidth = 2;
        c.strokeRect(485, 579, 310, 169);
        c.save();
        c.beginPath();
        c.rect(485, 579, 310, 10);
        c.rect(485, 739, 310, 10);
        c.clip();
        c.strokeStyle = '#b5a267';
        c.lineWidth = 6;
        for (let x = 470; x < 820; x += 18) {
            c.beginPath();
            c.moveTo(x, 575);
            c.lineTo(x - 12, 597);
            c.moveTo(x, 734);
            c.lineTo(x - 12, 756);
            c.stroke();
        }
        c.restore();
        c.strokeStyle = '#1e2a23';
        c.lineWidth = 10;
        c.beginPath();
        c.moveTo(640, 710);
        c.lineTo(640, 800);
        c.moveTo(690, 665);
        c.lineTo(805, 665);
        c.lineTo(805, 800);
        c.stroke();
        c.strokeStyle = '#5d7151';
        c.lineWidth = 3;
        c.stroke();
        for (let i = 0; i < 2500; i++) {
            const x = this.seedRandom() * 1280,
                y = this.seedRandom() * 800,
                size = this.seedRandom() * 2.2 + 0.3;
            c.fillStyle = this.seedRandom() > 0.5 ? '#b2af7e22' : '#101e1a44';
            c.fillRect(x, y, size, size);
        }
        c.strokeStyle = '#77836755';
        c.lineWidth = 1;
        c.strokeRect(20, 20, 1240, 760);
        // 灯柱、弹坑和废弃箱体沿边缘分布，绝不伪装成可碰撞的实体。
        for (const [x, y] of [
            [390, 110],
            [915, 650],
            [100, 100],
            [1170, 680],
            [430, 700],
        ]) {
            c.fillStyle = '#253126';
            c.beginPath();
            c.ellipse(x, y, 27, 17, -0.2, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#626e4d77';
            c.stroke();
            c.fillStyle = '#1c2b2388';
            c.beginPath();
            c.ellipse(x, y, 16, 9, 0, 0, Math.PI * 2);
            c.fill();
        }
        for (const [x, y] of [
            [36, 86],
            [1240, 86],
            [36, 740],
            [1240, 740],
        ]) {
            c.fillStyle = '#17231c';
            c.fillRect(x - 6, y, 12, 26);
            c.fillStyle = '#bbaa70';
            c.fillRect(x - 4, y, 8, 5);
        }
    }
    /** 地面文字统一用装甲字体，自托管字库加载后会重绘一次底图。 */
    groundLabel(c, text, x, y, size, color) {
        c.fillStyle = color;
        c.font = `700 ${size}px Chakra, sans-serif`;
        c.fillText(text, x, y);
    }
    /** 主渲染按阴影、掩体、车体、弹道、灯光、浮字顺序合成。 */
    draw(realTime) {
        const c = this.ctx,
            g = this.game,
            time = realTime / 1000;
        if (this.zone !== g.zone) this.makeBackground(g.zone);
        c.clearRect(0, 0, 1280, 800);
        c.fillStyle = '#28372c';
        c.fillRect(0, 0, 1280, 800);
        c.save();
        if (
            !this.reduceMotion &&
            g.state === 'playing' &&
            (g.shake > 0 || Math.abs(g.camera.x) + Math.abs(g.camera.y) > 0.02)
        )
            c.translate(
                g.camera.x + Math.sin(time * 85) * g.shake * 0.42,
                g.camera.y + Math.cos(time * 71) * g.shake * 0.42,
            );
        c.drawImage(this.background, 0, 0);
        for (const w of g.wrecks) this.drawWreck(c, w);
        for (const wall of g.walls) this.drawWall(c, wall);
        this.drawField(c, g, time);
        for (const barrel of g.barrels || []) if (!barrel.dead) this.drawBarrel(c, barrel, time);
        this.drawCore(c, g.core, time);
        for (const turret of g.turrets) this.drawTurret(c, turret);
        for (const item of g.pickups) this.drawPickup(c, item, time);
        // 蜂群无人机使用独立的三角机体外形，其余敌军沿用坦克绘制。
        for (const enemy of g.enemies)
            if (enemy.drone) this.drawDrone(c, enemy, time);
            else this.drawTank(c, enemy, true, time);
        for (const player of g.players)
            if (player.hp > 0) {
                this.drawTank(c, player, false, time);
                this.drawWingmen(c, player, g.time);
            }
        this.drawBullets(c, g.bullets);
        this.drawBeams(c, g.beams || [], time);
        this.drawArcs(c, g.arcs || []);
        for (const impact of g.impacts) this.drawImpact(c, impact);
        for (const r of g.rings) {
            c.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
            c.strokeStyle = r.color;
            c.lineWidth = r.fill ? 4 : 2;
            c.beginPath();
            c.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            c.stroke();
            if (r.fill) {
                c.globalAlpha *= 0.08;
                c.fillStyle = r.color;
                c.fill();
            }
        }
        c.globalAlpha = 1;
        for (const p of g.particles) {
            c.globalAlpha = Math.max(0, p.life / p.maxLife);
            c.fillStyle = p.smoke ? '#777a62' : p.color;
            if (p.smoke) {
                c.globalAlpha *= 0.3;
                c.beginPath();
                c.arc(p.x, p.y, p.size * (3 - p.life / p.maxLife), 0, Math.PI * 2);
                c.fill();
            } else if (p.debris) {
                // 残骸碎片：按自旋速度旋转的实心方块，外加深色描边，在爆炸火光中依然看得清轮廓。
                c.save();
                c.translate(p.x, p.y);
                c.rotate((p.spin || 0) * (p.maxLife - p.life));
                c.fillStyle = p.color;
                c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                c.strokeStyle = '#14201a';
                c.lineWidth = 1;
                c.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                c.restore();
            } else {
                c.save();
                c.translate(p.x, p.y);
                c.rotate(Math.atan2(p.vy, p.vx));
                c.fillRect(-p.size, -p.size / 3, p.size * 2.4, p.size * 0.65);
                c.restore();
            }
        }
        c.globalAlpha = 1;
        for (const t of g.texts) {
            c.globalAlpha = Math.min(1, (t.life / t.maxLife) * 2);
            c.fillStyle = t.color;
            // 暴击与武器名称使用大号字并在出现瞬间放大，普通伤害数字保持 17px。
            const pop = t.big ? 1 + Math.max(0, t.life / t.maxLife - 0.75) * 2.4 : 1;
            c.font = `700 ${Math.round((t.big ? 24 : 17) * pop)}px Chakra, Microsoft YaHei, sans-serif`;
            c.textAlign = 'center';
            c.strokeStyle = '#152016';
            c.lineWidth = 3;
            c.strokeText(t.text, t.x, t.y);
            c.fillText(t.text, t.x, t.y);
        }
        c.globalAlpha = 1;
        c.textAlign = 'left';
        const vignette = c.createRadialGradient(640, 400, 250, 640, 400, 760);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(1, '#071b1870');
        c.fillStyle = vignette;
        c.fillRect(0, 0, 1280, 800);
        if (g.flash > 0 && !this.reduceMotion) {
            c.fillStyle = `rgba(239,199,132,${g.flash * 0.6})`;
            c.fillRect(0, 0, 1280, 800);
        }
        // 白闪覆盖完整战斗画面而不跟随震屏偏移；系统减少动态设置会同时关闭白闪与镜头摇晃。
        if (g.whiteFlash.life > 0 && !this.reduceMotion) {
            const intensity = Math.pow(g.whiteFlash.life / g.whiteFlash.maxLife, 1.6) * g.whiteFlash.strength;
            c.save();
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.fillStyle = `rgba(255,255,255,${intensity})`;
            c.fillRect(0, 0, 1280, 800);
            c.restore();
        }
        if (g.state === 'playing' && g.pointer.used && !g.touchFire) this.drawReticle(c, g.pointer);
        if (g.combo >= 2 && g.state === 'playing') {
            // 连击字号随连击数成长（上限 52px），颜色从琥珀过渡到品红；下方显示积分倍率与剩余窗口。
            const size = Math.min(52, 28 + g.combo * 0.4);
            const hot = g.combo >= 30;
            c.textAlign = 'right';
            c.fillStyle = hot ? '#ff7ad9' : '#f6bc78';
            c.font = `700 ${Math.round(size)}px Chakra,sans-serif`;
            c.fillText(`${g.combo}× CHAIN`, 1240, 92 + size * 0.3);
            c.fillStyle = '#e3dcc0';
            c.font = '12px Microsoft YaHei,sans-serif';
            c.fillText(`连续击破 · 积分 ×${Math.min(5, 1 + (g.combo - 1) * 0.05).toFixed(2)}`, 1240, 118 + size * 0.3);
            c.fillStyle = '#f6bc7855';
            c.fillRect(1240 - 120, 124 + size * 0.3, 120 * clamp(g.comboTime / 3.5, 0, 1), 3);
            c.textAlign = 'left';
        }
        this.drawFever(c, g, time);
        // 首领终结慢动作：上下电影黑边随剩余时间收起，强调「时间停顿」的一刻。
        if ((g.slowmo || 0) > 0) {
            const bar = 60 * clamp(g.slowmo / 0.9, 0, 1);
            c.fillStyle = '#05080acc';
            c.fillRect(0, 0, 1280, bar);
            c.fillRect(0, 800 - bar, 1280, bar);
        }
        this.drawAnnounce(c, g.announce);
        const boss = g.enemies.find((e) => e.boss && !e.dead);
        if (boss) this.drawBossBar(c, boss);
        // 核心低耐久通过边缘警示反馈，而不是持续闪烁遮挡整个战场。
        if (g.core.hp < 150 && g.state === 'playing') {
            c.strokeStyle = `rgba(235,113,82,${0.3 + Math.sin(time * 4) * 0.1})`;
            c.lineWidth = 8;
            c.strokeRect(4, 4, 1272, 792);
        }
        c.restore();
        this.drawRadar(time);
    }
    /** 冲击采用明确的起爆、扩张和消散阶段；局部火光保留敌军弹幕的可读性。 */
    drawImpact(c, effect) {
        const progress = 1 - effect.life / effect.maxLife,
            remaining = 1 - progress;
        c.save();
        c.translate(effect.x, effect.y);
        c.scale(effect.strength, effect.strength);
        if (effect.kind === 'muzzle') {
            c.rotate(effect.angle);
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = remaining;
            const length = 58 * Math.sqrt(remaining);
            c.fillStyle = '#f6aa45';
            c.beginPath();
            c.moveTo(-8, 0);
            c.lineTo(16, -15 * remaining);
            c.lineTo(length, -3);
            c.lineTo(length + 14, 0);
            c.lineTo(length, 4);
            c.lineTo(13, 15 * remaining);
            c.closePath();
            c.fill();
            c.fillStyle = '#fff5c5';
            c.beginPath();
            c.moveTo(-4, 0);
            c.lineTo(15, -6);
            c.lineTo(length * 0.68, 0);
            c.lineTo(15, 6);
            c.closePath();
            c.fill();
            c.strokeStyle = '#ffd380';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(3, -10);
            c.lineTo(-8, -24 * remaining);
            c.moveTo(3, 10);
            c.lineTo(-8, 24 * remaining);
            c.stroke();
        } else if (effect.kind === 'hit') {
            c.rotate(effect.angle);
            c.globalAlpha = remaining;
            c.globalCompositeOperation = 'lighter';
            c.fillStyle = '#fff0ba';
            c.beginPath();
            c.arc(0, 0, 12 * remaining + 2, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#ffd083';
            c.lineWidth = 2.4 * remaining + 0.5;
            for (let i = 0; i < 7; i++) {
                const angle = (i - 3) * 0.35,
                    near = 7 + progress * 10,
                    far = near + 36 * remaining;
                c.beginPath();
                c.moveTo(Math.cos(angle) * near, Math.sin(angle) * near);
                c.lineTo(Math.cos(angle) * far, Math.sin(angle) * far);
                c.stroke();
            }
            c.strokeStyle = '#fff5d1';
            c.lineWidth = 1;
            c.beginPath();
            c.arc(0, 0, 8 + progress * 31, 0, Math.PI * 2);
            c.stroke();
        } else {
            const radius = 14 + Math.pow(progress, 0.55) * 105;
            // 琥珀压力光先亮后退，避免把整块战场刷成持续白屏。
            const light = c.createRadialGradient(0, 0, 2, 0, 0, radius * 1.5);
            light.addColorStop(0, `rgba(255,185,74,${remaining * 0.38})`);
            light.addColorStop(1, 'rgba(255,155,44,0)');
            c.fillStyle = light;
            c.fillRect(-radius * 1.5, -radius * 1.5, radius * 3, radius * 3);
            c.strokeStyle = `rgba(250,207,129,${remaining * 0.7})`;
            c.lineWidth = 4 * remaining + 1;
            c.beginPath();
            c.arc(0, 0, radius, 0, Math.PI * 2);
            c.stroke();
            if (progress < 0.45) {
                const fire = 1 - progress / 0.45;
                c.globalCompositeOperation = 'lighter';
                c.globalAlpha = fire;
                for (let i = 0; i < 6; i++) {
                    const angle = i * 2.4,
                        travel = progress * 65;
                    c.fillStyle = i % 2 ? '#ed7f32' : '#ffc463';
                    c.beginPath();
                    c.arc(Math.cos(angle) * travel, Math.sin(angle) * travel, 12 + fire * 22, 0, Math.PI * 2);
                    c.fill();
                }
                c.fillStyle = '#fff7d4';
                c.beginPath();
                c.arc(0, 0, fire * 23, 0, Math.PI * 2);
                c.fill();
            }
            c.globalCompositeOperation = 'source-over';
            c.globalAlpha = Math.sin(progress * Math.PI) * 0.27;
            c.fillStyle = '#494738';
            for (let i = 0; i < 4; i++) {
                c.beginPath();
                c.arc(
                    Math.cos(i * 2) * progress * 34,
                    Math.sin(i * 2) * progress * 25 - progress * 26,
                    10 + progress * 25,
                    0,
                    Math.PI * 2,
                );
                c.fill();
            }
        }
        c.restore();
    }
    /** 战场机制画在地面层：炮击倒计时可读、信标进度明确、雪与余烬只做稀疏环境纹理。 */
    drawField(c, g, time) {
        if (g.beacon) {
            const b = g.beacon;
            c.save();
            c.translate(b.x, b.y);
            c.strokeStyle = b.done ? '#c6efb3' : '#b5d7d8';
            c.lineWidth = 2;
            c.setLineDash([6, 8]);
            c.beginPath();
            c.arc(0, 0, 74, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
            c.strokeStyle = '#c7edb2';
            c.lineWidth = 5;
            c.beginPath();
            c.arc(0, 0, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.done ? 1 : b.capture / 4));
            c.stroke();
            c.fillStyle = b.done ? '#b9edac' : '#c6dbd2';
            c.fillRect(-4, -16, 8, 32);
            c.fillRect(-16, -4, 32, 8);
            c.textAlign = 'center';
            c.font = '12px Microsoft YaHei,sans-serif';
            c.fillText(b.done ? '信标已接管' : `信标争夺 ${Math.floor((b.capture / 4) * 100)}%`, 0, 96);
            c.restore();
        }
        for (const h of g.hazards) {
            if (h.detonated) continue;
            c.save();
            c.translate(h.x, h.y);
            c.fillStyle = `rgba(239,104,76,${0.07 + Math.sin(time * 15) * 0.025})`;
            c.strokeStyle = '#f49373';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, 0, h.radius, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.beginPath();
            c.arc(0, 0, h.radius * Math.max(0, h.delay / 1.6), 0, Math.PI * 2);
            c.stroke();
            c.beginPath();
            c.moveTo(-10, 0);
            c.lineTo(10, 0);
            c.moveTo(0, -10);
            c.lineTo(0, 10);
            c.stroke();
            c.font = '700 14px Chakra,sans-serif';
            c.textAlign = 'center';
            c.fillStyle = '#ffd3b0';
            c.fillText(`${Math.max(0, h.delay).toFixed(1)}s`, 0, -18);
            c.restore();
        }
        // 相位门：旋转的虚线双环 + 中心漩涡，两座门颜色一致以表明互相连通。
        for (const portal of g.portals || []) {
            c.save();
            c.translate(portal.x, portal.y);
            c.fillStyle = 'rgba(176,140,255,0.13)';
            c.beginPath();
            c.arc(0, 0, portal.radius + 8, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#c9a8ff';
            c.lineWidth = 3;
            c.setLineDash([10, 7]);
            c.rotate(this.reduceMotion ? 0 : time * 1.6);
            c.beginPath();
            c.arc(0, 0, portal.radius, 0, Math.PI * 2);
            c.stroke();
            c.rotate(this.reduceMotion ? 0 : -time * 3.4);
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, 0, portal.radius * 0.55, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
            c.restore();
            c.textAlign = 'center';
            c.fillStyle = '#d9c6ff';
            c.font = '12px Microsoft YaHei,sans-serif';
            c.fillText('相位门', portal.x, portal.y + portal.radius + 22);
            c.textAlign = 'left';
        }
        // 护盾：浅蓝色泡泡，透明度随剩余吸收量变化。
        for (const p of g.players)
            if (p.hp > 0 && p.shield > 0) {
                c.strokeStyle = `rgba(159,216,255,${0.35 + Math.min(1, p.shield / 90) * 0.5})`;
                c.fillStyle = 'rgba(159,216,255,0.08)';
                c.lineWidth = 2.5;
                c.beginPath();
                c.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
                c.fill();
                c.stroke();
            }
        for (const p of g.players)
            if (p.hp > 0 && p.overdrive > 0) {
                c.strokeStyle = '#ffd083';
                c.lineWidth = 2;
                c.setLineDash([7, 5]);
                c.beginPath();
                c.arc(p.x, p.y, p.radius + 13, 0, Math.PI * 2);
                c.stroke();
                c.setLineDash([]);
            }
        // 环境飘落物：霜区雪花向下、熔炉余烬向上，裂隙中的紫色光尘缓慢上浮。
        if (this.zone > 0 && !this.reduceMotion)
            for (let i = 0; i < 35; i++) {
                const x = (i * 173 + Math.sin(time + i) * 15) % 1280,
                    y = (i * 97 + time * (this.zone === 1 ? 24 : this.zone === 3 ? -9 : -19) + 8000) % 800;
                c.fillStyle = this.zone === 1 ? '#c6dfe157' : this.zone === 3 ? '#cdb2ff70' : '#ffb46b66';
                c.fillRect(x, y, this.zone === 1 ? 2 : 1.5, this.zone === 1 ? 3 : 2);
            }
    }
    /** 哨戒炮使用四脚底座与独立炮管，外形区别于可驾驶坦克。 */
    drawTurret(c, t) {
        c.save();
        c.translate(t.x, t.y);
        c.strokeStyle = '#9fb58d';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(-17, -17);
        c.lineTo(17, 17);
        c.moveTo(17, -17);
        c.lineTo(-17, 17);
        c.stroke();
        c.fillStyle = '#263b2c';
        c.fillRect(-12, -12, 24, 24);
        c.strokeStyle = '#c6dba9';
        c.lineWidth = 1;
        c.strokeRect(-12, -12, 24, 24);
        c.rotate(t.angle);
        c.fillStyle = '#c5d3a2';
        c.fillRect(-7, -8, 19, 16);
        // 激光哨塔进化后炮管换成青色，与普通哨戒炮一眼区分。
        c.fillStyle = t.laser ? '#7ff0ff' : '#78916c';
        c.fillRect(8 - t.recoil * 0.3, -4, 28, 8);
        c.fillStyle = '#16291e';
        c.fillRect(33 - t.recoil * 0.3, -5, 5, 10);
        c.restore();
        c.fillStyle = '#8caa78';
        c.fillRect(t.x - 15, t.y + 24, 30 * Math.max(0, t.life / (t.laser ? 18 : 12)), 2);
    }
    /** 废墟混凝土有顶面、倒角与右下投影，损坏后裂纹加深，钢墙保留独立材质。 */
    drawWall(c, w) {
        if (w.hp <= 0) {
            c.fillStyle = '#8a886044';
            c.fillRect(w.x + 5, w.y + 7, 10, 7);
            c.fillRect(w.x + 23, w.y + 23, 12, 6);
            return;
        }
        const { x, y } = w;
        c.fillStyle = '#101c1b88';
        c.fillRect(x + 7, y + 9, 40, 40);
        c.fillStyle = w.steel ? '#394942' : ZONES[this.zone].cover;
        c.fillRect(x, y, 39, 39);
        c.fillStyle = w.steel ? '#667168' : '#92927a';
        c.fillRect(x, y, 39, 4);
        c.fillRect(x, y, 3, 38);
        c.fillStyle = w.steel ? '#273b33' : '#474e3d';
        c.fillRect(x, y + 34, 39, 5);
        c.fillRect(x + 35, y, 4, 39);
        c.strokeStyle = w.steel ? '#8b9a7c77' : '#b1b29644';
        c.lineWidth = 1;
        c.strokeRect(x + 6, y + 7, 26, 22);
        if (w.steel) {
            c.strokeStyle = '#85937c';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(x + 9, y + 10);
            c.lineTo(x + 30, y + 28);
            c.moveTo(x + 30, y + 10);
            c.lineTo(x + 9, y + 28);
            c.stroke();
        } else {
            c.fillStyle = '#343f2b66';
            c.fillRect(x + 9, y + 12, 4, 3);
            c.fillRect(x + 25, y + 24, 3, 2);
            if (w.hp < w.maxHp * 0.7) {
                c.strokeStyle = '#253426';
                c.beginPath();
                c.moveTo(x + 19, y);
                c.lineTo(x + 23, y + 18);
                c.lineTo(x + 10, y + 30);
                c.lineTo(x + 13, y + 39);
                c.stroke();
            }
        }
        if (w.hit > 0) {
            c.globalAlpha = w.hit * 4;
            c.fillStyle = '#fff0c1';
            c.fillRect(x, y, 39, 39);
            c.globalAlpha = 1;
        }
    }
    /** 核心以悬浮分面晶体表现；光晕来自实际能量源，旋转环标示防守目标。 */
    drawCore(c, core, time) {
        const x = core.x,
            y = core.y,
            bob = this.reduceMotion ? 0 : Math.sin(time * 2) * 3;
        c.fillStyle = '#101f1b99';
        c.beginPath();
        c.ellipse(x + 7, y + 25, 55, 29, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#52644c';
        c.beginPath();
        c.ellipse(x, y + 18, 51, 31, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#92a67c';
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = '#243e2e';
        c.beginPath();
        c.ellipse(x, y + 13, 42, 25, 0, 0, Math.PI * 2);
        c.fill();
        const glow = c.createRadialGradient(x, y - 5, 2, x, y, 105);
        glow.addColorStop(0, '#bceea733');
        glow.addColorStop(1, '#bceea700');
        c.fillStyle = glow;
        c.fillRect(x - 105, y - 105, 210, 210);
        c.save();
        c.translate(x, y - 13 + bob);
        c.fillStyle = core.hit > 0 ? '#fff1c2' : '#a7d797';
        c.beginPath();
        c.moveTo(0, -38);
        c.lineTo(25, -6);
        c.lineTo(0, 33);
        c.lineTo(-25, -6);
        c.closePath();
        c.fill();
        c.fillStyle = '#d2f5b9';
        c.beginPath();
        c.moveTo(0, -38);
        c.lineTo(0, 1);
        c.lineTo(-25, -6);
        c.closePath();
        c.fill();
        c.fillStyle = '#79b77c';
        c.beginPath();
        c.moveTo(0, 1);
        c.lineTo(25, -6);
        c.lineTo(0, 33);
        c.closePath();
        c.fill();
        c.strokeStyle = '#e1fbc8';
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(0, -38);
        c.lineTo(0, 33);
        c.moveTo(-25, -6);
        c.lineTo(0, 1);
        c.lineTo(25, -6);
        c.stroke();
        c.restore();
        c.strokeStyle = '#b7e89c77';
        c.lineWidth = 1;
        c.setLineDash([12, 7]);
        c.beginPath();
        c.ellipse(x, y + 16, 62, 38, 0, time * 0.3, time * 0.3 + Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        c.textAlign = 'center';
        c.font = '700 10px Chakra,sans-serif';
        c.fillStyle = '#d9ebbb';
        c.fillText('CORE', x, y + 65);
        c.textAlign = 'left';
        this.drawCoreBar(c, core, time);
    }
    /**
     * 核心头顶血条：移动端 HUD 被压缩时，玩家仍能直接在战场上看到核心状态。
     * 参数 core 为核心对象（仅用 x、y、hp、maxHp、hit），time 为渲染时间（秒）。
     * 规则：比例 > 60% 绿色、> 30% 黄色、其余红色并闪烁；受伤后白色「残影」在 0.5 秒左右追上当前值，
     * 让玩家看清这一下掉了多少。残影只存在渲染器本地，不进入联机快照。
     */
    drawCoreBar(c, core, time) {
        const ratio = clamp(core.hp / core.maxHp, 0, 1);
        // 残影比例：回血时立即跟上，掉血时每帧收拢 1%（60 帧下约 0.5 秒追平一次普通受击）。
        if (this.coreTrail === undefined || ratio >= this.coreTrail) this.coreTrail = ratio;
        else this.coreTrail = Math.max(ratio, this.coreTrail - 0.01);
        // 尺寸按手机竖屏（画布缩到约 0.3 倍）仍能辨认来定：宽 180、高 18 逻辑像素。
        const width = 180,
            height = 18,
            bx = core.x - width / 2,
            by = core.y - 90;
        const color = ratio > 0.6 ? '#8fe07a' : ratio > 0.3 ? '#f2c94c' : '#ff5f4f';
        c.save();
        // 底板与描边。
        c.fillStyle = '#0b1310dd';
        c.fillRect(bx - 3, by - 3, width + 6, height + 6);
        c.strokeStyle = core.hit > 0 ? '#fff1c2' : '#a8c79a88';
        c.lineWidth = 1.5;
        c.strokeRect(bx - 3, by - 3, width + 6, height + 6);
        // 残影（刚失去的部分）与当前耐久。
        c.fillStyle = '#fff3d6cc';
        c.fillRect(bx, by, width * this.coreTrail, height);
        c.fillStyle = color;
        if (ratio <= 0.3) c.globalAlpha = 0.65 + Math.sin(time * 10) * 0.35;
        c.fillRect(bx, by, width * ratio, height);
        c.globalAlpha = 1;
        // 每 10% 一道刻度，便于估算剩余量。
        c.fillStyle = '#0b131066';
        for (let i = 1; i < 10; i++) c.fillRect(bx + (width * i) / 10 - 0.5, by, 1, height);
        // 数值：百分比放在血条中央，描边保证任意底色下可读。
        c.textAlign = 'center';
        c.font = '700 15px Chakra, Microsoft YaHei, sans-serif';
        c.lineWidth = 3;
        c.strokeStyle = '#0b1310';
        const label = `核心 ${Math.ceil(ratio * 100)}%`;
        c.strokeText(label, core.x, by + 14);
        c.fillStyle = '#f7f3e3';
        c.fillText(label, core.x, by + 14);
        c.restore();
    }
    /** 坦克由履带、斜面车体、散热格栅、炮塔与后坐炮管组成，两层朝向互相独立。 */
    drawTank(c, tank, enemy, time) {
        const { x, y } = tank,
            r = tank.radius,
            scale = r / 19;
        if (tank.warning > 0 && enemy && this.game.state !== 'menu') {
            c.strokeStyle = '#e9aa66';
            c.lineWidth = 2;
            c.setLineDash([5, 7]);
            c.beginPath();
            c.arc(x, y, r + 17, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
            c.fillStyle = '#e1b181';
            c.font = '11px Microsoft YaHei,sans-serif';
            c.textAlign = 'center';
            c.fillText('敌军进入', x, y + r + 34);
            c.textAlign = 'left';
            return;
        }
        c.save();
        // 受击车体沿弹道方向震颤，主炮开火时整车短促回坐；碰撞坐标保持不变。
        if (!this.reduceMotion)
            c.translate(
                (tank.joltX || 0) - Math.cos(tank.angle) * (tank.recoil || 0) * 0.23,
                (tank.joltY || 0) - Math.sin(tank.angle) * (tank.recoil || 0) * 0.23,
            );
        if (!enemy && tank.invincible > 0 && Math.floor(time * 12) % 2) c.globalAlpha = 0.66;
        // 右下投影让车体离开地面；炮口方向不改变履带和车身方向。
        c.save();
        c.translate(x + 7, y + 10);
        c.rotate(tank.bodyAngle);
        c.scale(scale, scale);
        c.fillStyle = '#0c1919a3';
        c.fillRect(-27, -22, 53, 44);
        c.restore();
        c.save();
        c.translate(x, y);
        c.rotate(tank.bodyAngle);
        c.scale(scale, scale);
        c.fillStyle = tank.hit > 0 ? '#fffdf4' : '#121f1c';
        c.fillRect(-25, -23, 49, 12);
        c.fillRect(-25, 11, 49, 12);
        c.strokeStyle = '#6d7765';
        c.lineWidth = 1.7;
        for (let i = -23; i < 25; i += 6) {
            const offset = tank.moving ? tank.tread % 6 : 0;
            c.beginPath();
            c.moveTo(i + offset, -22);
            c.lineTo(i + offset, -12);
            c.moveTo(i + offset, 12);
            c.lineTo(i + offset, 22);
            c.stroke();
        }
        c.fillStyle = tank.hit > 0 ? '#ffffff' : tank.color;
        c.beginPath();
        c.moveTo(-22, -15);
        c.lineTo(15, -15);
        c.lineTo(24, -9);
        c.lineTo(24, 9);
        c.lineTo(15, 15);
        c.lineTo(-22, 15);
        c.closePath();
        c.fill();
        c.fillStyle = '#e4e8be66';
        c.fillRect(-19, -15, 33, 3);
        c.fillStyle = '#172b2588';
        c.fillRect(-20, 11, 37, 4);
        c.fillStyle = '#29392b';
        c.fillRect(-20, -8, 11, 16);
        c.strokeStyle = '#889176';
        c.lineWidth = 1;
        for (let yy = -6; yy <= 6; yy += 3) {
            c.beginPath();
            c.moveTo(-18, yy);
            c.lineTo(-11, yy);
            c.stroke();
        }
        c.fillStyle = enemy ? '#f0af6c' : '#e0efbe';
        c.fillRect(18, -11, 4, 3);
        c.fillRect(18, 8, 4, 3);
        c.fillStyle = enemy ? '#762d25' : '#e1a45c';
        c.fillRect(-23, -13, 3, 5);
        c.fillRect(-23, 8, 3, 5);
        if (!enemy) {
            c.strokeStyle = '#f5f2ca';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(10, -8);
            c.lineTo(15, 0);
            c.lineTo(10, 8);
            c.stroke();
        }
        c.restore();
        c.save();
        c.translate(x, y);
        c.rotate(tank.angle);
        c.scale(scale, scale);
        c.fillStyle = '#14281dcc';
        c.beginPath();
        c.arc(2, 3, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = tank.hit > 0 ? '#ffffff' : enemy ? '#b29a75' : '#c6dcb0';
        c.beginPath();
        c.moveTo(-12, -10);
        c.lineTo(10, -10);
        c.lineTo(16, -5);
        c.lineTo(16, 5);
        c.lineTo(10, 10);
        c.lineTo(-12, 10);
        c.closePath();
        c.fill();
        c.fillStyle = '#233d2b';
        c.fillRect(-8, -6, 8, 12);
        c.fillStyle = '#97aa83';
        c.fillRect(-7, -6, 6, 2);
        const recoil = tank.recoil || 0;
        c.fillStyle = '#1c3027';
        c.fillRect(9 - recoil, -4, 31, 8);
        c.fillStyle = enemy ? '#b8a27b' : '#bdd4a3';
        c.fillRect(12 - recoil, -3, 25, 3);
        c.fillStyle = '#4a5744';
        c.fillRect(34 - recoil, -5, 8, 10);
        c.fillStyle = '#131f1b';
        c.fillRect(40 - recoil, -3, 3, 6);
        c.strokeStyle = '#162c2477';
        c.lineWidth = 1;
        c.strokeRect(-12, -10, 23, 20);
        c.restore();
        if (!enemy) {
            c.textAlign = 'center';
            c.font = '700 11px Chakra,sans-serif';
            c.fillStyle = tank.id === 1 ? '#d4edbd' : '#acd7e4';
            c.fillText(`P${tank.id}`, x, y - r - 17);
            c.fillStyle = '#11231c';
            c.fillRect(x - 20, y - r - 10, 40, 3);
            c.fillStyle = tank.hp < 30 ? '#f69473' : tank.color;
            c.fillRect(x - 20, y - r - 10, (40 * tank.hp) / tank.maxHp, 3);
            c.textAlign = 'left';
            if (tank.dashTime > 0) {
                c.strokeStyle = '#d4efb6';
                c.lineWidth = 1.5;
                c.beginPath();
                c.arc(x, y, r + 13, 0, Math.PI * 2);
                c.stroke();
            }
        } else if (tank.hp < tank.maxHp && !tank.boss) {
            c.fillStyle = '#19291c';
            c.fillRect(x - r, y - r - 11, r * 2, 3);
            c.fillStyle = '#e5aa75';
            c.fillRect(x - r, y - r - 11, r * 2 * Math.max(0, tank.hp / tank.maxHp), 3);
        }
        // 玩家特装武器：车体下方显示武器名与剩余时间条。
        if (!enemy && tank.weapon && WEAPONS[tank.weapon]) {
            const weapon = WEAPONS[tank.weapon];
            c.textAlign = 'center';
            c.font = '700 11px Microsoft YaHei,sans-serif';
            c.fillStyle = weapon.color;
            c.fillText(`${weapon.name} ${Math.ceil(tank.weaponTime)}s`, x, y + r + 22);
            c.fillRect(x - 20, y + r + 26, 40 * clamp(tank.weaponTime / weapon.duration, 0, 1), 2);
            c.textAlign = 'left';
        }
        // 精英词缀：彩色双环与词缀名，提示该目标更难缠但必掉特装武器。
        if (enemy && tank.affix && AFFIXES[tank.affix]) {
            const affix = AFFIXES[tank.affix];
            c.strokeStyle = affix.color;
            c.lineWidth = 2;
            c.setLineDash([4, 4]);
            c.beginPath();
            c.arc(x, y, r + 10, time * 2, time * 2 + Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
            c.textAlign = 'center';
            c.font = '700 11px Microsoft YaHei,sans-serif';
            c.fillStyle = affix.color;
            c.fillText(`精英·${affix.name}`, x, y - r - 16);
            c.textAlign = 'left';
        }
        // 盾卫：车头前方的弧形相位护盾，提示玩家从侧后方攻击。
        if (enemy && tank.shield) {
            c.strokeStyle = '#b9c4ffcc';
            c.lineWidth = 4;
            c.beginPath();
            c.arc(x, y, r + 8, tank.angle - 1.05, tank.angle + 1.05);
            c.stroke();
        }
        // 悬赏精英：金色脉动光环与「悬赏」标签。
        if (enemy && tank.bounty) {
            c.strokeStyle = `rgba(255,211,110,${0.55 + Math.sin(time * 6) * 0.3})`;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(x, y, r + 12, 0, Math.PI * 2);
            c.stroke();
            c.textAlign = 'center';
            c.fillStyle = '#ffd36e';
            c.font = '700 12px Microsoft YaHei,sans-serif';
            c.fillText('悬赏', x, y - r - 18);
            c.textAlign = 'left';
        }
        if (enemy && tank.type === 'sniper' && tank.fireCd < 0.65) {
            c.strokeStyle = '#f7b38a66';
            c.lineWidth = 1;
            c.setLineDash([7, 8]);
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(tank.angle) * 530, y + Math.sin(tank.angle) * 530);
            c.stroke();
            c.setLineDash([]);
        }
        if (enemy && tank.charge > 0) {
            c.strokeStyle = `rgba(245,172,109,${tank.charge})`;
            c.lineWidth = 3;
            c.setLineDash([12, 10]);
            c.beginPath();
            c.arc(x, y, tank.radius + 35 + tank.charge * 30, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash([]);
        }
        c.restore();
    }
    /** 燃料桶：红色圆桶 + 黄色危险条纹，受损时（hp 降低）冒出闪烁火星提示即将爆炸。 */
    drawBarrel(c, b, time) {
        c.save();
        c.translate(b.x, b.y);
        c.fillStyle = '#0c1919a3';
        c.beginPath();
        c.ellipse(5, 7, b.radius, b.radius * 0.8, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = b.hp < 30 && Math.floor(time * 10) % 2 ? '#ff8a5a' : '#b8322a';
        c.beginPath();
        c.arc(0, 0, b.radius, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#ffcf5a';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, b.radius - 4, 0.3, 1.3);
        c.moveTo(Math.cos(2.4) * (b.radius - 4), Math.sin(2.4) * (b.radius - 4));
        c.arc(0, 0, b.radius - 4, 2.4, 3.4);
        c.moveTo(Math.cos(4.5) * (b.radius - 4), Math.sin(4.5) * (b.radius - 4));
        c.arc(0, 0, b.radius - 4, 4.5, 5.5);
        c.stroke();
        c.fillStyle = '#2a0f0c';
        c.beginPath();
        c.arc(0, 0, 4, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }
    /** 蜂群无人机：小型三角机体 + 闪烁的尾灯，与坦克轮廓明显区分，便于玩家一眼识别「可以扫射的杂兵」。 */
    drawDrone(c, e, time) {
        if (e.warning > 0 && this.game.state !== 'menu') {
            c.strokeStyle = '#e8c56c88';
            c.lineWidth = 1.5;
            c.beginPath();
            c.arc(e.x, e.y, e.radius + 8, 0, Math.PI * 2);
            c.stroke();
            return;
        }
        c.save();
        c.translate(e.x + (e.joltX || 0), e.y + (e.joltY || 0));
        c.rotate(e.bodyAngle);
        c.fillStyle = '#0c191988';
        c.beginPath();
        c.moveTo(18, 6);
        c.lineTo(-6, -6);
        c.lineTo(-6, 18);
        c.closePath();
        c.fill();
        c.fillStyle = e.hit > 0 ? '#ffffff' : e.color;
        c.beginPath();
        c.moveTo(14, 0);
        c.lineTo(-9, -10);
        c.lineTo(-4, 0);
        c.lineTo(-9, 10);
        c.closePath();
        c.fill();
        c.fillStyle = Math.floor(time * 12 + e.netId) % 2 ? '#ff5a3a' : '#ffd27a';
        c.fillRect(-7, -2, 4, 4);
        c.restore();
    }
    /** 僚机：按模拟层相同的环绕公式（time × 3 + 序号均分角度，半径 34）绘制小型菱形无人机。 */
    drawWingmen(c, p, simTime) {
        for (let i = 0; i < (p.drones || 0); i++) {
            const orbit = simTime * 3 + (i * Math.PI * 2) / p.drones;
            c.save();
            c.translate(p.x + Math.cos(orbit) * 34, p.y + Math.sin(orbit) * 34);
            c.rotate(orbit);
            c.fillStyle = p.color;
            c.strokeStyle = '#f5f2ca';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(7, 0);
            c.lineTo(0, -5);
            c.lineTo(-7, 0);
            c.lineTo(0, 5);
            c.closePath();
            c.fill();
            c.stroke();
            c.restore();
        }
    }
    /** 棱镜光束：预警期为逐渐收窄的虚线，发射后是一道明亮的青白色粗光束并快速淡出。 */
    drawBeams(c, beams, time) {
        c.save();
        c.lineCap = 'round';
        for (const beam of beams) {
            const x2 = beam.x + Math.cos(beam.angle) * beam.length,
                y2 = beam.y + Math.sin(beam.angle) * beam.length;
            c.beginPath();
            c.moveTo(beam.x, beam.y);
            c.lineTo(x2, y2);
            if (!beam.fired) {
                const t = clamp(1 - beam.warn, 0, 1);
                c.strokeStyle = `rgba(143,231,255,${0.25 + t * 0.5 + Math.sin(time * 30) * 0.1})`;
                c.lineWidth = 1 + t * 3;
                c.setLineDash([10, 8]);
                c.stroke();
                c.setLineDash([]);
            } else {
                const t = clamp(beam.life / 0.28, 0, 1);
                c.globalCompositeOperation = 'lighter';
                c.strokeStyle = `rgba(120,220,255,${t * 0.5})`;
                c.lineWidth = 22 * t + 4;
                c.stroke();
                c.strokeStyle = `rgba(240,255,255,${t})`;
                c.lineWidth = 5 * t + 1;
                c.stroke();
                c.globalCompositeOperation = 'source-over';
            }
        }
        c.restore();
    }
    /** 连锁闪电：在两端点之间生成带随机折点的紫白电弧，每帧重新抖动以产生跳动感。 */
    drawArcs(c, arcs) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const a of arcs) {
            const alpha = clamp(a.life / a.maxLife, 0, 1);
            const dx = a.x2 - a.x1,
                dy = a.y2 - a.y1,
                length = Math.hypot(dx, dy) || 1;
            const nx = -dy / length,
                ny = dx / length;
            for (const [width, color] of [
                [6, `rgba(181,166,255,${alpha * 0.45})`],
                [2, `rgba(245,240,255,${alpha})`],
            ]) {
                c.strokeStyle = color;
                c.lineWidth = width;
                c.beginPath();
                c.moveTo(a.x1, a.y1);
                for (let i = 1; i < 6; i++) {
                    const t = i / 6,
                        jitter = (Math.random() - 0.5) * 22;
                    c.lineTo(a.x1 + dx * t + nx * jitter, a.y1 + dy * t + ny * jitter);
                }
                c.lineTo(a.x2, a.y2);
                c.stroke();
            }
        }
        c.restore();
    }
    /**
     * 狂热系统 HUD：战场底部中央显示狂热值进度条；狂热模式期间四周泛起品红光晕，
     * 进度条改为倒计时，并在顶部显示 FEVER 字样。
     */
    drawFever(c, g, time) {
        if (g.state !== 'playing' && g.state !== 'paused') return;
        const active = (g.feverTime || 0) > 0;
        if (active && !this.reduceMotion) {
            const pulse = 0.18 + Math.sin(time * 10) * 0.06;
            const edge = c.createRadialGradient(640, 400, 330, 640, 400, 780);
            edge.addColorStop(0, 'rgba(255,90,200,0)');
            edge.addColorStop(1, `rgba(255,90,200,${pulse})`);
            c.fillStyle = edge;
            c.fillRect(0, 0, 1280, 800);
        }
        const width = 260,
            x = 640 - width / 2,
            y = 772;
        c.fillStyle = '#121a16cc';
        c.fillRect(x - 4, y - 4, width + 8, 12);
        const ratio = active ? clamp(g.feverTime / 11, 0, 1) : clamp((g.fever || 0) / 100, 0, 1);
        c.fillStyle = active ? '#ff7ad9' : ratio > 0.8 ? '#ffb0e8' : '#c77bb0';
        c.fillRect(x, y, width * ratio, 4);
        c.textAlign = 'center';
        c.font = '700 11px Chakra, Microsoft YaHei, sans-serif';
        c.fillStyle = active ? '#ffd0f2' : '#d8b6cc';
        c.fillText(active ? `FEVER 狂热中 ${g.feverTime.toFixed(1)}s` : `狂热值 ${Math.floor(g.fever || 0)}%`, 640, y - 8);
        c.textAlign = 'left';
    }
    /** 屏幕中央大字播报：出现时从 1.6 倍缩放回落并淡出，用于连杀、狂热、核弹、首领阶段与夸赞（praise 带横幅）。 */
    drawAnnounce(c, a) {
        if (!a) return;
        const t = clamp(a.life / a.maxLife, 0, 1);
        const scale = this.reduceMotion ? 1 : 1 + Math.max(0, t - 0.8) * 3;
        c.save();
        c.translate(640, 250);
        c.globalAlpha = Math.min(1, t * 2.5);
        // 夸赞播报（a.praise）：先画一条横贯屏幕的暗色横幅与两道主色光边，横幅从中央向两侧展开，
        // 再配合更大的字号，让「所向披靡」「力挽狂澜」这类高光时刻比普通连杀更有分量。
        if (a.praise) {
            const open = this.reduceMotion ? 1 : clamp((1 - t) * 6, 0, 1),
                half = 640 * open;
            c.fillStyle = '#0a0d10b8';
            c.fillRect(-half, -62, half * 2, 112);
            c.fillStyle = a.color;
            c.fillRect(-half, -64, half * 2, 3);
            c.fillRect(-half, 47, half * 2, 3);
            const glow = c.createRadialGradient(0, -12, 10, 0, -12, 320);
            glow.addColorStop(0, a.color + '55');
            glow.addColorStop(1, a.color + '00');
            c.fillStyle = glow;
            c.fillRect(-half, -62, half * 2, 112);
        }
        c.scale(scale, scale);
        c.textAlign = 'center';
        c.font = `700 ${a.praise ? 76 : 54}px Chakra, Microsoft YaHei, sans-serif`;
        c.lineWidth = 6;
        c.strokeStyle = '#140d12';
        c.strokeText(a.text, 0, 0);
        c.fillStyle = a.color;
        c.fillText(a.text, 0, 0);
        c.font = '700 14px Chakra, Microsoft YaHei, sans-serif';
        c.lineWidth = 3;
        const subY = a.praise ? 36 : 28;
        if (a.praise) c.font = '700 18px Chakra, Microsoft YaHei, sans-serif';
        c.strokeText(a.sub || '', 0, subY);
        c.fillStyle = '#f3ead0';
        c.fillText(a.sub || '', 0, subY);
        c.restore();
    }
    /** 弹道采用亮色弹头与短拖尾，敌我双色在深色地面上保持区分。 */
    drawBullets(c, bullets) {
        c.save();
        c.lineCap = 'round';
        for (const b of bullets) {
            // 喷火火焰：随寿命膨胀并变暗的柔和火团，使用加色混合形成火墙。
            if (b.kind === 'flame') {
                const t = 1 - clamp(b.life / 0.55, 0, 1);
                c.save();
                c.globalCompositeOperation = 'lighter';
                c.globalAlpha = 0.55 * (1 - t) + 0.1;
                c.fillStyle = t < 0.4 ? '#ffd27a' : '#ff7a3a';
                c.beginPath();
                c.arc(b.x, b.y, 6 + t * 12, 0, Math.PI * 2);
                c.fill();
                c.restore();
                continue;
            }
            // 追踪飞弹：橙色弹体 + 长尾烟迹，便于在弹幕中辨认。
            if (b.kind === 'rocket') {
                c.strokeStyle = '#ff9a5a55';
                c.lineWidth = 6;
                c.beginPath();
                c.moveTo(b.x, b.y);
                c.lineTo(b.x - Math.cos(b.angle) * 30, b.y - Math.sin(b.angle) * 30);
                c.stroke();
                c.save();
                c.translate(b.x, b.y);
                c.rotate(b.angle);
                c.fillStyle = '#ffcf8a';
                c.fillRect(-7, -2.5, 12, 5);
                c.fillStyle = '#ff6a3a';
                c.fillRect(-10, -1.5, 4, 3);
                c.restore();
                continue;
            }
            const laser = b.kind === 'laser',
                spark = b.kind === 'spark';
            const length = b.enemy ? 14 : laser ? 46 : 24,
                color = b.tint || (b.enemy ? '#f7a466' : laser ? '#7ff0ff' : spark ? '#c9bbff' : b.crit ? '#fff27a' : '#e6f1ae');
            c.strokeStyle = b.enemy ? '#f09b5144' : laser ? '#7ff0ff44' : spark ? '#b5a6ff44' : '#dceaa43d';
            c.lineWidth = laser ? 11 : 9;
            c.beginPath();
            c.moveTo(b.x, b.y);
            c.lineTo(b.x - Math.cos(b.angle) * length, b.y - Math.sin(b.angle) * length);
            c.stroke();
            c.strokeStyle = color;
            c.lineWidth = b.enemy ? 3 : 2;
            c.stroke();
            c.fillStyle = '#fff1cf';
            c.beginPath();
            c.arc(b.x, b.y, b.enemy ? 3 : 2, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
    }
    /** 维修掉落用十字标识和小型能量环呈现，可通过形状与颜色共同辨识。 */
    drawPickup(c, p, time) {
        const bob = this.reduceMotion ? 0 : Math.sin(time * 4 + p.x) * 3;
        // 特装武器：旋转的彩色六边形，中央是单字标识，下方显示武器名；临近消失时闪烁提示。
        const weapon = WEAPONS[p.kind];
        if (weapon) {
            if (p.life < 4 && Math.floor(time * 8) % 2) return;
            c.save();
            c.translate(p.x, p.y + bob);
            const glow = c.createRadialGradient(0, 0, 2, 0, 0, 34);
            glow.addColorStop(0, weapon.color + '66');
            glow.addColorStop(1, weapon.color + '00');
            c.fillStyle = glow;
            c.fillRect(-34, -34, 68, 68);
            c.rotate(this.reduceMotion ? 0 : time * 1.5);
            c.fillStyle = '#1b1f2a';
            c.strokeStyle = weapon.color;
            c.lineWidth = 2.5;
            c.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                c.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
            }
            c.closePath();
            c.fill();
            c.stroke();
            c.restore();
            c.textAlign = 'center';
            c.fillStyle = weapon.color;
            c.font = '700 14px Microsoft YaHei,sans-serif';
            c.fillText(weapon.short, p.x, p.y + bob + 5);
            c.font = '11px Microsoft YaHei,sans-serif';
            c.fillText(weapon.name, p.x, p.y + bob + 32);
            c.textAlign = 'left';
            return;
        }
        c.save();
        c.translate(p.x, p.y + bob);
        c.rotate(Math.PI / 4);
        const shield = p.kind === 'shield';
        c.fillStyle = p.kind === 'overdrive' ? '#4d3924' : shield ? '#22344a' : '#243d2c';
        c.fillRect(-12, -12, 24, 24);
        c.strokeStyle = p.kind === 'overdrive' ? '#f7b65f' : shield ? '#9fd8ff' : '#bfdba4';
        c.strokeRect(-12, -12, 24, 24);
        c.rotate(-Math.PI / 4);
        c.fillStyle = p.kind === 'overdrive' ? '#ffd28a' : shield ? '#bfe6ff' : '#cbe8ad';
        if (shield) {
            // 护盾模块用盾形轮廓，与维修十字、超频闪电在形状上区分。
            c.beginPath();
            c.moveTo(0, -9);
            c.lineTo(8, -5);
            c.lineTo(6, 4);
            c.lineTo(0, 9);
            c.lineTo(-6, 4);
            c.lineTo(-8, -5);
            c.closePath();
            c.fill();
        } else if (p.kind === 'overdrive') {
            // 电池用闪电轮廓，维修用十字，避免只靠橙绿颜色区分拾取效果。
            c.beginPath();
            c.moveTo(2, -9);
            c.lineTo(-7, 2);
            c.lineTo(-1, 2);
            c.lineTo(-3, 10);
            c.lineTo(7, -2);
            c.lineTo(1, -2);
            c.closePath();
            c.fill();
        } else {
            c.fillRect(-7, -2, 14, 4);
            c.fillRect(-2, -7, 4, 14);
        }
        c.restore();
    }
    /** 坦克残骸逐渐褪色，记录战斗发生的位置并限制最大数量。 */
    drawWreck(c, w) {
        c.save();
        c.globalAlpha = Math.min(0.6, w.life / 15);
        c.translate(w.x, w.y);
        c.rotate(w.angle);
        c.fillStyle = '#14231c';
        c.fillRect(-w.radius, -w.radius, w.radius * 2, w.radius * 2);
        c.strokeStyle = '#6e6750';
        c.lineWidth = 3;
        c.strokeRect(-w.radius + 5, -w.radius + 4, w.radius * 1.5, w.radius * 1.3);
        c.restore();
    }
    /** 准星只在战斗且鼠标已使用时出现，不替代菜单里的系统光标。 */
    drawReticle(c, pointer) {
        c.save();
        c.translate(pointer.x, pointer.y);
        c.strokeStyle = '#e5eebf';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(0, 0, 10, 0, Math.PI * 2);
        c.moveTo(-17, 0);
        c.lineTo(-7, 0);
        c.moveTo(7, 0);
        c.lineTo(17, 0);
        c.moveTo(0, -17);
        c.lineTo(0, -7);
        c.moveTo(0, 7);
        c.lineTo(0, 17);
        c.stroke();
        c.restore();
    }
    /** 首领条固定在战场上沿，精确显示二阶段分界。 */
    drawBossBar(c, boss) {
        c.fillStyle = '#18271eea';
        c.fillRect(380, 24, 520, 50);
        c.textAlign = 'center';
        c.fillStyle = '#eac49a';
        c.font = '13px Microsoft YaHei,sans-serif';
        c.fillText(`${boss.name} · ${boss.phase === 2 ? '狂暴阶段' : boss.phase === 1 ? '第二阶段' : '重装攻城平台'}`, 640, 43);
        c.fillStyle = '#4a4935';
        c.fillRect(395, 55, 490, 5);
        c.fillStyle = boss.hp < boss.maxHp / 2 ? '#f79867' : '#c6a475';
        c.fillRect(395, 55, 490 * clamp(boss.hp / boss.maxHp, 0, 1), 5);
        c.fillStyle = '#18271e';
        c.fillRect(638, 55, 3, 5);
        c.textAlign = 'left';
    }
    /** 雷达使用同一实体坐标与状态，不显示已经阵亡或退出战场的目标。 */
    drawRadar(time) {
        const c = this.rctx,
            g = this.game,
            w = this.radar.width,
            h = this.radar.height;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#111c17';
        c.fillRect(0, 0, w, h);
        c.save();
        c.scale(w / 1280, h / 800);
        c.strokeStyle = '#40553a77';
        c.lineWidth = 4;
        for (let x = 0; x < 1280; x += 160) {
            c.beginPath();
            c.moveTo(x, 0);
            c.lineTo(x, 800);
            c.stroke();
        }
        for (let y = 0; y < 800; y += 160) {
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(1280, y);
            c.stroke();
        }
        c.fillStyle = '#516345';
        g.walls.forEach((wall) => {
            if (wall.hp > 0) c.fillRect(wall.x, wall.y, 40, 40);
        });
        c.fillStyle = '#d2453a';
        (g.barrels || []).forEach((b) => {
            if (!b.dead) c.fillRect(b.x - 8, b.y - 8, 16, 16);
        });
        c.fillStyle = '#f7ad6c';
        g.enemies.forEach((e) => {
            if (!e.dead) {
                c.beginPath();
                c.arc(e.x, e.y, e.boss ? 22 : 12, 0, Math.PI * 2);
                c.fill();
            }
        });
        c.fillStyle = '#c2e6a8';
        g.players.forEach((p) => {
            if (p.hp > 0) c.fillRect(p.x - 12, p.y - 12, 24, 24);
        });
        c.save();
        c.translate(g.core.x, g.core.y);
        c.rotate(Math.PI / 4);
        c.fillStyle = '#e5e0b2';
        c.fillRect(-15, -15, 30, 30);
        c.restore();
        if (!this.reduceMotion) {
            c.strokeStyle = '#bfdc9b27';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(640, 400);
            c.lineTo(640 + Math.cos(time * 0.7) * 700, 400 + Math.sin(time * 0.7) * 700);
            c.stroke();
        }
        c.restore();
    }
}
