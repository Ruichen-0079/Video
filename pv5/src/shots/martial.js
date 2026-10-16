// 三 · 武学的传承
// line0/1/2：同一个招式，三个时代。duel：周朝，麦田里斩断天才的左臂。school：负伤流派。purge：清洗。
// couple a/b：老武者与妻子背靠背守护（春）；妻子死后，他一个人在雪里练剑，最后松开手（放手）。tablets：历代剑圣的牌位。
import { put, POSE, walking, running, rest, blend, reachTo, toStage, fk, swordForm } from '../act.js';
import { ground, grass, wall, house, palace, plumTree, tablet, candle, lampGlow, mountains, sunGlow, flag } from '../set.js';
import { flame, fireGlow, embers, smoke, rain, slashArc, flash, drift, blood } from '../fx.js';
import { keyed, smooth, smoother, lerp, rng, clamp, TAU } from '../g2.js';
import { MBC, GENIUS, OLD, OLD_MID, WIFE, VILLAGER } from '../cast.js';
import { L, drawArm, prop } from '../puppet.js';

const P0 = { sex: 'm', head: 'jing', face: 'solid', faceCol: L.ochre, hat: 'band', bandCol: L.brown, robe: L.brown, trim: L.cream, pattern: 'plain', sleeve: 'narrow', lower: 'tunic', trousers: L.brown, boots: L.brown };
const MASTER = { sex: 'm', head: 'lao', hat: 'knotOld', hairCol: L.gray, beard: 'short', robe: L.gray, trim: L.white, pattern: 'cloud', sleeve: 'wide', lower: 'robe' };
const LATER = { sex: 'm', head: 'sheng', hat: 'band', bandCol: L.ink, robe: L.ink, trim: L.white, pattern: 'cloud', sleeve: 'wide', lower: 'robe' };

export function lineage(args) {
  const era = args.era ?? 0;
  const GY = 12;
  return {
    frame(t) {
      const u = clamp((t - 0.2) / 2.1);
      const f = swordForm(u);
      const layers = [], glow = [];
      let light, grade = { exposure: 1.0, contrast: 1.08, vignette: 0.55 };
      if (era === 0) {
        // 荒原的黄昏：一个人拿着木棍比划
        layers.push({ d: 0.55, par: 0.4, alpha: 1, draw: (c) => mountains(c, -60, 330, GY + 4, 22, { col: [130, 90, 80], seed: 50 }) });
        layers.push({ d: 0.05, draw: (c) => { ground(c, GY, -80, 330, 'plain', [140, 100, 70], 11); grass(c, -60, 320, GY, t, { h: 4, dens: 0.4, col: [150, 120, 70], seed: 3 }); } });
        layers.push({ d: 0, draw: (c) => put(c, P0, f.pose, { x: 112, y: GY, s: 0.56, face: 1, t, hold: { F: { kind: 'stick', abs: f.swordAng, len: 30 } } }) });
        glow.push(sunGlow(60, 30, 7, [255, 170, 100], 0.9));
        light = { sky: [[70, 50, 70], [190, 110, 80], [230, 140, 80], [120, 70, 40]], lamps: [{ x: 60, y: 30, r: 120, col: [255, 160, 90], k: 0.4 }] };
      } else if (era === 1) {
        // 院子里：师父做，三个弟子跟着做（慢半拍）
        layers.push({ d: 0.4, par: 0.5, alpha: 1, draw: (c) => { wall(c, -60, 330, GY + 4, 20, { col: [200, 190, 170] }); house(c, 200, GY + 4, 60, 28, { col: [180, 160, 130] }); plumTree(c, 30, GY + 4, 1.4, { bare: true }); } });
        layers.push({ d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'stone', [190, 180, 160], 12) });
        layers.push({ d: 0, draw: (c) => {
          put(c, MASTER, f.pose, { x: 150, y: GY, s: 0.5, face: -1, t, hold: { F: { kind: 'sword', abs: f.swordAng } } });
          for (let k = 0; k < 3; k++) { const g = swordForm(clamp((t - 0.35 - k * 0.1) / 2.1)); put(c, VILLAGER(k, 'm'), g.pose, { x: 60 + k * 24, y: GY, s: 0.4, face: 1, t, hold: { F: { kind: 'sword', abs: g.swordAng, len: 26 } } }); }
        } });
        light = { sky: [[170, 170, 170], [228, 220, 200], [240, 230, 210], [200, 190, 170]], lamps: [{ x: 120, y: 60, r: 130, col: [255, 240, 210], k: 0.3 }] };
      } else {
        // 雨夜：后世的剑客做这一式——剑弧扫过的地方，雨被分开
        const o = { x: 118, y: GY, s: 0.6, face: 1, t };
        const J = fk(LATER, f.pose);
        const hand = toStage(o, J.handF);
        const a = f.swordAng;
        const tip = [hand[0] + Math.sin(a) * 30 * o.s, hand[1] - Math.cos(a) * 30 * o.s];
        const on = smooth(0.25, 0.45, u) * (1 - smooth(0.85, 1, u));
        const part = (x, y) => {
          // 剑身附近的雨点不画（被推开）
          const ax = hand[0], ay = hand[1], bx = tip[0], by = tip[1];
          const vx = bx - ax, vy = by - ay, q = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
          const d = Math.hypot(x - ax - vx * q, y - ay - vy * q);
          if (d < 7 * on) return null;
          return 0;
        };
        layers.push({ d: 0.45, par: 0.5, alpha: 1, draw: (c) => { wall(c, -60, 330, GY + 4, 20, { col: [80, 80, 90] }); house(c, 60, GY + 4, 60, 28, { col: [70, 70, 80] }); } });
        layers.push({ d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'stone', [70, 70, 80], 13) });
        layers.push({ d: 0, draw: (c) => put(c, LATER, f.pose, { ...o, hold: { F: { kind: 'sword', abs: a } } }) });
        layers.push({ d: 0.05, mode: 'screen', noTexture: true, draw: (c) => rain(c, 40, 200, 0, 110, t, { n: 700, speed: 120, slant: 0.05, len: 5, col: [150, 170, 210], a: 0.6, part }) });
        glow.push(lampGlow(150, GY + 34, 50, [255, 170, 90], 0.45));
        light = { sky: [[8, 10, 18], [22, 26, 40], [34, 38, 52], [16, 18, 26]], lamps: [{ x: 140, y: 50, r: 100, col: [170, 180, 220], k: 0.3 }] };
        grade = { exposure: 1.2, contrast: 1.12, vignette: 0.6 };
      }
      return { cam: { x: keyed([[0, 116], [2.5, 118]], t), y: 38, zoom: keyed([[0, 1.55], [2.5, 1.65]], t) }, layers, glow, light, grade };
    },
  };
}

export function duel(args) {
  const GY = 12;
  const cutT = args.cutT ?? 3.4;
  return {
    frame(t) {
      const go = smoother(cutT - 1.55, cutT, t), after = smooth(cutT, cutT + 0.5, t);
      // 明布川自左向右，天才自右向左，在 x = 118 交错
      const mx = lerp(40, 118, go) + after * 16, gx = lerp(196, 118, go) - after * 10;
      const runM = running(0, 26, t).pose, runG = running(0, 26, t + 0.2).pose;
      const pre = t < cutT - 1.55;
      let mPose = pre ? POSE.guard() : t < cutT ? blend({ ...runM, aF: 1.0, eF: 0.4 }, POSE.raise(), smooth(cutT - 0.35, cutT - 0.1, t)) : blend(POSE.cut(), POSE.guard({ head: 0.1 }), smooth(cutT + 0.6, cutT + 1.6, t));
      let mAng = pre ? 0.9 : t < cutT ? lerp(1.3, 3.5, smooth(cutT - 0.35, cutT - 0.1, t)) : lerp(1.4, 0.9, smooth(cutT + 0.6, cutT + 1.6, t));
      const kneel = smoother(cutT + 0.3, cutT + 1.3, t);
      let gPose = pre ? POSE.guard() : t < cutT ? { ...runG, aF: 1.4, eF: 0.3 } : POSE.kneel(kneel, { lean: 0.3 + 0.25 * kneel, head: 0.5 * kneel, aF: lerp(1.0, -0.2, kneel), eF: 0.2 });
      const cut = t >= cutT;
      const G = cut ? { ...GENIUS, amputate: true } : GENIUS;
      // 落下的左臂
      const dt = t - cutT;
      const arm = cut ? { x: gx + 2 - dt * 10, y: Math.max(GY + 3, GY + 30 - 60 * dt * dt), a: dt * 9 } : null;
      const flashK = Math.exp(-Math.pow((t - cutT) / 0.05, 2));
      return {
        cam: { x: keyed([[0, 118], [6.5, 120]], t), y: keyed([[0, 44], [cutT, 40], [6.5, 36]], t), zoom: keyed([[0, 1.15], [cutT, 1.3], [6.5, 1.7]], t) },
        layers: [
          { d: 0.55, par: 0.35, alpha: 1, draw: (c) => mountains(c, -60, 330, GY + 8, 16, { col: [150, 80, 60], seed: 60 }) },
          { d: 0.3, par: 0.75, draw: (c) => { ground(c, GY + 6, -80, 330, 'plain', [210, 150, 60], 14); grass(c, -60, 320, GY + 6, t, { h: 9, dens: 0.8, col: [230, 170, 70], seed: 61, wind: 1.6 }); } },
          { d: 0, draw: (c) => {
            put(c, G, gPose, { x: gx, y: GY, s: 0.42, face: -1, t, hold: t < cutT + 0.6 ? { F: { kind: 'sword', abs: t < cutT ? 1.5 : 0.3 } } : {} });
            if (t >= cutT + 0.6) { c.save(); c.translate(gx - 18, GY + 1.5); c.scale(0.42, 0.42); prop(c, 'sword', { ang: Math.PI / 2 - 0.05 }); c.restore(); }
            put(c, MBC, mPose, { x: mx, y: GY, s: 0.42, face: 1, t, hold: { F: { kind: 'sword', abs: mAng } } });
            if (arm) drawArm(c, GENIUS, arm.x, arm.y, 0.42, arm.a, -1);
            blood(c, gx, GY + 28, t, cutT, { n: 14 });
            grass(c, -60, 320, GY, t, { h: 8, dens: 0.9, col: [240, 180, 80], seed: 62, wind: 1.6 });
          } },
        ],
        glow: [sunGlow(160, 34, 7, [255, 190, 110], 0.9), slashArc(118, GY + 26, 16, 2.6, 0.3, Math.max(0, 1 - Math.abs(t - cutT) / 0.18)), flash(0.3 * flashK)],
        light: { sky: [[90, 50, 60], [210, 110, 70], [246, 160, 80], [170, 90, 40]], lamps: [{ x: 160, y: 34, r: 140, col: [255, 170, 90], k: 0.45 }] },
        grade: { exposure: 1.0, contrast: 1.1, sat: 1.05, vignette: 0.58, bloom: 0.3 },
      };
    },
  };
}

export function school(args) {
  const GY = 12;
  return {
    frame(t) {
      // 一拍一剑：0.5 + k 秒
      const beat = (tt) => { const k = Math.floor(tt - 0.5); const ph = tt - 0.5 - k; return tt < 0.5 ? 0 : 1 - smooth(0.05, 0.6, ph) * 0 - (1 - smoother(0, 0.18, ph)) * 0 + 0 * k + (ph < 0.18 ? smoother(0, 0.18, ph) : 1 - smooth(0.45, 0.95, ph)); };
      const strike = (tt) => { const b = beat(tt); return { pose: blend(POSE.raise({ aB: -0.4, eB: -0.9 }), POSE.cut({ aB: -0.4, eB: -0.9 }), b), ang: lerp(3.5, 1.3, b) }; };
      const m = strike(t);
      return {
        cam: { x: keyed([[0, 124], [4, 130]], t), y: 40, zoom: keyed([[0, 1.45], [4, 1.55]], t) },
        layers: [
          { d: 0.45, par: 0.5, alpha: 1, draw: (c) => { wall(c, -60, 330, GY + 6, 22, { col: [190, 180, 160] }); palace(c, 120, GY + 10, 80, 40, { col: [150, 120, 100], roof: L.ink }); } },
          { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'stone', [190, 180, 160], 15) },
          // 后排弟子
          { d: 0.2, draw: (c) => { for (let k = 0; k < 7; k++) { const s2 = strike(t - 0.04 * k); put(c, { ...VILLAGER(k, 'm'), robe: L.gray, face: 'hollow' }, s2.pose, { x: 40 + k * 18, y: GY + 4, s: 0.3, face: 1, t, hold: { F: { kind: 'sword', abs: s2.ang, len: 26 } } }); } } },
          // 前排弟子与台上的师父（左袖空着）
          { d: 0, draw: (c) => {
            c.beginPath(); c.rect(160, GY, 60, 6); c.fillStyle = 'rgba(160,140,120,0.95)'; c.fill(); c.lineWidth = 0.5; c.strokeStyle = 'rgba(40,22,10,0.9)'; c.stroke();
            put(c, { ...GENIUS, amputate: true }, m.pose, { x: 186, y: GY + 6, s: 0.56, face: -1, t, hold: { F: { kind: 'sword', abs: m.ang } } });
            for (let k = 0; k < 5; k++) { const s2 = strike(t - 0.03 * k); put(c, { ...VILLAGER(k + 2, 'm'), robe: L.gray, face: 'hollow' }, s2.pose, { x: 30 + k * 24, y: GY, s: 0.38, face: 1, t, hold: { F: { kind: 'sword', abs: s2.ang, len: 26 } } }); }
          } },
        ],
        light: { sky: [[150, 150, 150], [216, 206, 190], [232, 220, 200], [190, 180, 160]], lamps: [{ x: 120, y: 60, r: 130, col: [255, 240, 210], k: 0.25 }] },
        grade: { exposure: 1.0, contrast: 1.08, sat: 0.8, vignette: 0.55 },
      };
    },
  };
}

export function purge(args) {
  const GY = 12;
  const R = rng(8);
  const swords = Array.from({ length: 9 }, () => [60 + R() * 130, R() * 0.6 - 0.3 + Math.PI / 2, R()]);
  return {
    frame(t) {
      const bow = smoother(2.4, 3.6, t);
      return {
        cam: { x: keyed([[0, 116], [4.5, 120]], t), y: keyed([[0, 42], [4.5, 38]], t), zoom: keyed([[0, 1.35], [4.5, 1.6]], t) },
        layers: [
          { d: 0.4, par: 0.6, alpha: 1, draw: (c) => { palace(c, 120, GY + 4, 120, 56, { col: [120, 60, 40], roof: L.ink, steps: false }); for (let k = 0; k < 8; k++) flame(c, 70 + k * 14, GY + 12 + (k % 3) * 8, 12, t, { seed: k + 20 }); } },
          { d: 0.7, par: 0.4, noTexture: true, draw: (c) => smoke(c, 120, GY + 40, t, { n: 14, spread: 100, rise: 4, size: 22, col: [40, 20, 14], a: 0.45, life: 6 }) },
          { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'floor', [110, 70, 50], 16) },
          { d: 0, draw: (c) => {
            for (const [x, a] of swords) { c.save(); c.translate(x, GY + 0.6); c.scale(0.4, 0.4); prop(c, 'sword', { ang: a, tassel: false }); c.restore(); }
            put(c, MBC, POSE.guard({ head: lerp(0.05, 0.5, bow), lean: lerp(0.08, 0.2, bow), aF: lerp(0.35, 0.05, bow), eF: lerp(0.6, 0.1, bow) }), { x: 118, y: GY, s: 0.5, face: 1, t, hold: { F: { kind: 'sword', abs: lerp(0.9, 0.15, bow) } } });
          } },
          { d: 0.2, mode: 'screen', noTexture: true, draw: (c) => embers(c, 60, 200, GY, 70, t, { n: 40, seed: 12 }) },
        ],
        glow: [fireGlow(100, GY + 30, 50, t, 0.5, 1), fireGlow(150, GY + 26, 50, t, 0.5, 2)],
        light: FIRE_SKY2,
        grade: { exposure: 1.05, contrast: 1.12, sat: 1.0, vignette: 0.62, bloom: 0.3 },
      };
    },
  };
}
const FIRE_SKY2 = { sky: [[20, 8, 6], [70, 26, 14], [120, 50, 24], [50, 20, 12]], lamps: [{ x: 120, y: 40, r: 90, col: [255, 140, 60], k: 0.25 }], flicker: 0.08 };

export function couple(args) {
  const part = args.part || 'a';
  const GY = 12;
  return {
    frame(t) {
      const A = part === 'a';
      const u = A ? clamp((t - 0.2) / 3.4) : clamp((t - 0.2) / 2.6);
      const f = swordForm(u * 0.72);
      const layers = [
        { d: 0.4, par: 0.5, alpha: 1, draw: (c) => { wall(c, -60, 330, GY + 4, 22, { col: A ? [200, 170, 140] : [190, 196, 210] }); house(c, 200, GY + 4, 56, 26, { col: A ? [190, 150, 110] : [170, 176, 190] }); } },
        { d: 0.05, draw: (c) => { ground(c, GY, -80, 330, A ? 'stone' : 'plain', A ? [190, 170, 140] : [236, 238, 244], 17); plumTree(c, 52, GY, 1.7, { bare: !A, fcol: L.rose, seed: 7 }); } },
      ];
      if (A) {
        // 背靠背：两个人朝相反的方向出同一式，各护一面
        layers.push({ d: 0, draw: (c) => {
          put(c, WIFE, f.pose, { x: 112, y: GY, s: 0.5, face: -1, t, hold: { F: { kind: 'sword', abs: f.swordAng } } });
          put(c, OLD_MID, f.pose, { x: 126, y: GY, s: 0.52, face: 1, t, hold: { F: { kind: 'sword', abs: f.swordAng } } });
        } });
        layers.push({ d: 0.3, draw: (c) => drift(c, -40, 280, 0, 100, t, { n: 30, kind: 'petal', col: L.rose, wind: 3, speed: 3, size: 0.8 }) });
      } else {
        // 雪里，一个人；最后放下剑，松开手——剑插在雪里
        const let_ = smoother(2.6, 3.4, t);
        const pose = blend(f.pose, POSE.stand({ head: 0.25, aF: 0.6, eF: 0.2 }), smoother(2.2, 2.8, t));
        layers.push({ d: 0, draw: (c) => {
          put(c, OLD, pose, { x: 120, y: GY, s: 0.52, face: 1, t, hold: let_ < 0.5 ? { F: { kind: 'sword', abs: lerp(f.swordAng, 0.0, smoother(2.2, 2.8, t)) } } : {}, hand: { F: let_ > 0.5 ? 'open' : 'fist' } });
          if (let_ >= 0.5) { c.save(); c.translate(132, GY + 13 - 13 * smooth(2.9, 3.2, t)); c.scale(0.5, 0.5); prop(c, 'sword', { ang: 0.05 }); c.restore(); }
        } });
        layers.push({ d: 0.15, mode: 'screen', noTexture: true, draw: (c) => drift(c, -40, 280, 0, 100, t, { n: 120, kind: 'snow', col: [255, 255, 255], wind: 2, speed: 5, size: 0.5, a: 0.8 }) });
      }
      return {
        cam: { x: keyed([[0, 116], [4, 120]], t), y: 38, zoom: keyed([[0, 1.55], [4, 1.7]], t) },
        layers,
        glow: A ? [sunGlow(200, 70, 6, [255, 220, 170], 0.6)] : [],
        light: A ? { sky: [[150, 140, 130], [226, 200, 160], [244, 220, 180], [200, 176, 140]], lamps: [{ x: 190, y: 70, r: 140, col: [255, 220, 170], k: 0.35 }] }
          : { sky: [[60, 66, 84], [120, 130, 150], [150, 158, 176], [110, 116, 130]], lamps: [{ x: 120, y: 60, r: 120, col: [200, 210, 240], k: 0.25 }] },
        grade: A ? { exposure: 1.0, contrast: 1.06, sat: 1.0, vignette: 0.5 } : { exposure: 1.0, contrast: 1.08, sat: 0.55, vignette: 0.6 },
      };
    },
  };
}

export function tablets(args) {
  const GY = 14;
  return {
    frame(t) {
      return {
        cam: { x: keyed([[0, 70], [3.6, 156], [4.5, 158]], t), y: 40, zoom: 1.7 },
        layers: [
          { d: 0.05, draw: (c) => {
            ground(c, GY, -80, 330, 'floor', [90, 50, 40], 18);
            c.beginPath(); c.rect(-40, GY, 260, 10); c.fillStyle = 'rgba(110,40,30,0.95)'; c.fill(); c.lineWidth = 0.5; c.strokeStyle = 'rgba(40,22,10,0.9)'; c.stroke();
            for (let k = 0; k < 9; k++) { tablet(c, 10 + k * 20, GY + 10, 1.3); candle(c, 18 + k * 20, GY + 10, 0.8, t); }
          } },
          // 牌位的尽头，站着一个人（墨蓝的袍子——明布川）
          { d: 0, draw: (c) => put(c, MBC, POSE.behind({ head: 0.15 }), { x: 204, y: GY, s: 0.5, face: -1, t }) },
        ],
        glow: Array.from({ length: 9 }, (_, k) => lampGlow(18 + k * 20, GY + 16, 9, [255, 180, 90], 0.75 + 0.1 * Math.sin(t * 9 + k))),
        light: { sky: [[10, 6, 6], [30, 16, 12], [46, 26, 18], [24, 12, 10]], lamps: [{ x: 150, y: 30, r: 90, col: [255, 160, 80], k: 0.2 }], flicker: 0.04 },
        grade: { exposure: 1.15, contrast: 1.1, sat: 1.0, vignette: 0.6, bloom: 0.35 },
      };
    },
  };
}
