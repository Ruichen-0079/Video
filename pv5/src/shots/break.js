// 二 · 历史秩序的断裂
// siegeA：夜，火把的长队逼近宫城。siegeB：老人在阶前替人类的开国皇帝挡下亚人守卫（三剑）。
// siegeC：宫殿起火，龙旗倒下，皇帝举剑。herb：药烟逼出原形。bannerA/B：复国的旗与帐中交易。escape：雨夜竹林出逃。
import { put, POSE, walking, running, rest, blend, reachTo, toStage, fk } from '../act.js';
import { ground, palace, wall, flag, house, hangLantern, lampGlow, tent, table, bamboo, mountains, stairs, sunGlow } from '../set.js';
import { flame, fireGlow, embers, smoke, rain, slashArc, flash, drift } from '../fx.js';
import { keyed, smooth, smoother, lerp, rng, clamp } from '../g2.js';
import { OLD, EMPEROR, DEMI_GUARD, HUMAN_SOLDIER, VILLAGER, ZFY_TEEN, ZFY_RUN, LORD, NOBLE } from '../cast.js';
import { L, prop } from '../puppet.js';

const FIRE_SKY = { sky: [[20, 8, 6], [70, 24, 14], [130, 52, 24], [60, 22, 12]], lamps: [{ x: 120, y: 40, r: 90, col: [255, 140, 60], k: 0.25 }], flicker: 0.08 };

export function siege(args) {
  const part = args.part || 'a';
  const GY = 12;
  return {
    frame(t) {
      const layers = [], glow = [];
      let cam;
      // 宫城在远处烧
      const burn = part === 'a' ? 0.5 + 0.1 * t : part === 'b' ? 0.9 : 1;
      layers.push({ d: 0.5, par: 0.45, alpha: 1, draw: (c) => {
        wall(c, -60, 320, GY + 8, 10, { col: L.gray });
        palace(c, 120, GY + 8, 76, 48, { col: L.crimson, roof: L.ink });
        for (let k = 0; k < 7; k++) flame(c, 70 + k * 16, GY + 30 + (k % 2) * 8, 10 + 6 * burn, t, { seed: k });
      } });
      for (let k = 0; k < 4; k++) glow.push(fireGlow(80 + k * 28, GY + 40, 40, t, 0.35 * burn, k));
      layers.push({ d: 0.7, par: 0.4, noTexture: true, draw: (c) => smoke(c, 120, GY + 50, t, { n: 16, spread: 80, rise: 5, size: 18, col: [40, 20, 14], a: 0.4, wind: 2, life: 5 }) });
      layers.push({ d: 0.1, draw: (c) => ground(c, GY, -80, 330, 'stone', [120, 80, 60], 5) });
      if (part === 'a') {
        // 火把：一排排人类士兵从右往左压过来（远的小而虚）
        for (const [row, d, s, y, n] of [[0, 0.45, 0.16, GY + 6, 14], [1, 0.25, 0.22, GY + 3, 11], [2, 0, 0.32, GY, 8]]) {
          layers.push({ d, draw: (c) => {
            for (let k = 0; k < n; k++) {
              const x = 250 - k * (80 * s) - 9 * t + row * 6;
              const w = walking(0, 9, t + k * 0.17 + row, { stride: 0.32 });
              put(c, HUMAN_SOLDIER(k), { ...w.pose, aF: 2.3, eF: 0.5 }, { x, y, s, face: -1, t, hold: { F: { kind: k % 2 ? 'torch' : 'spear', abs: 3.0, len: 60 } } });
            }
          } });
        }
        cam = { x: keyed([[0, 150], [4.5, 132]], t), y: keyed([[0, 44], [4.5, 42]], t), zoom: keyed([[0, 1.15], [4.5, 1.3]], t) };
        for (let k = 0; k < 8; k++) glow.push(fireGlow(250 - k * 26 - 9 * t, GY + 30, 10, t, 0.5, k + 9));
      } else if (part === 'b') {
        // 阶前：老人挡在皇帝前面，三个亚人守卫扑上来，各挨一剑倒下
        const hits = [0.75, 2.18, 3.61];
        const o = { x: 118, y: GY, s: 0.5, face: 1, t };
        let k = 0; while (k < 2 && t > hits[k] + 0.5) k++;
        const ph = clamp((t - hits[k] + 0.45) / 0.9);
        const sw = ph < 0.5 ? POSE.raise({ lean: -0.05 }) : POSE.cut({ lean: 0.3 });
        const oldPose = blend(blend(POSE.guard(), POSE.raise(), smoother(0, 0.45, ph)), POSE.cut(), smoother(0.45, 0.6, ph));
        const swAbs = lerp(lerp(0.9, 3.5, smoother(0, 0.45, ph)), 1.3, smoother(0.45, 0.6, ph));
        layers.push({ d: 0, draw: (c) => {
          stairs(c, 150, GY, 210, GY + 16, 8, [200, 170, 140]);
          put(c, EMPEROR, POSE.stand({ aF: 0.4, eF: 0.4, head: 0.05 }), { x: 84, y: GY, s: 0.52, face: 1, t, hold: { F: { kind: 'sword', abs: 0.5 } } });
          put(c, OLD, oldPose, { ...o, hold: { F: { kind: 'sword', abs: swAbs, len: 32 } } });
          hits.forEach((h, i) => {
            const x0 = 190 + i * 14, run = smoother(h - 0.9, h, t), fall = smoother(h, h + 0.6, t);
            const x = lerp(x0, 140, run);
            if (t < h - 1.0) return;
            const pose = fall > 0 ? POSE.kneel(fall, { lean: 0.5 * fall, head: 0.6 * fall, aF: lerp(2.2, -0.2, fall) }) : { ...running(0, 20, t).pose, aF: 2.5, eF: 0.4 };
            put(c, DEMI_GUARD(i), pose, { x: x + fall * 4, y: GY, s: 0.48, face: -1, t, hold: fall < 0.5 ? { F: { kind: 'spear', abs: 1.6, len: 50 } } : {} });
          });
        } });
        hits.forEach((h) => glow.push(slashArc(140, GY + 30, 16, 2.4, 0.2, Math.max(0, 1 - Math.abs(t - h) / 0.15))));
        cam = { x: keyed([[0, 128], [4, 132]], t), y: 36, zoom: keyed([[0, 1.75], [4, 1.85]], t) };
      } else {
        // 龙旗在火里横着倒下（2.4 秒），皇帝举剑，士兵欢呼
        const fall = smoother(1.4, 2.5, t);
        layers.push({ d: 0.05, draw: (c) => {
          flag(c, 168, GY, 52, t, { col: L.yellow, w: 26, fh: 18, ang: fall * 1.42, burn: smooth(0.5, 3.5, t) * 0.6, droop: 0.2 });
          flame(c, 168 + 20 * fall, GY + 1, 10, t, { seed: 4 });
        } });
        layers.push({ d: 0, draw: (c) => {
          put(c, EMPEROR, POSE.raise({ head: -0.15 }), { x: 92, y: GY, s: 0.5, face: 1, t, hold: { F: { kind: 'sword', abs: 3.2 } } });
          for (let k = 0; k < 6; k++) { const arm = 0.5 + 0.5 * Math.sin(t * 4 + k); put(c, HUMAN_SOLDIER(k), POSE.stand({ aF: lerp(1.6, 3.0, arm * smooth(2.4, 2.8, t)), eF: 0.3 }), { x: 30 + k * 11, y: GY, s: 0.38 - (k % 2) * 0.04, face: 1, t, hold: { F: { kind: 'spear', abs: 3.0, len: 60 } } }); }
          put(c, OLD, POSE.stand({ head: 0.15, aF: 0.3, eF: 0.4 }), { x: 116, y: GY, s: 0.48, face: 1, t, hold: { F: { kind: 'sword', abs: 0.3, len: 32 } } });
        } });
        layers.push({ d: 0.2, mode: 'screen', noTexture: true, draw: (c) => embers(c, 120, 230, GY, 70, t, { n: 50 }) });
        glow.push(fireGlow(170, GY + 30, 50, t, 0.6, 3), flash(0.2 * Math.exp(-Math.pow((t - 2.45) / 0.08, 2))));
        cam = { x: keyed([[0, 124], [4, 128]], t), y: keyed([[0, 44], [4, 42]], t), zoom: keyed([[0, 1.3], [4, 1.38]], t) };
      }
      return { cam, layers, glow, light: FIRE_SKY, grade: { exposure: 1.05, contrast: 1.12, sat: 1.05, vignette: 0.62, bloom: 0.35 } };
    },
  };
}

export function herb(args) {
  const GY = 12;
  const R = rng(4);
  const crowd = [[-34, 0, 'm'], [-22, 1, 'f'], [-10, 2, 'm'], [12, 3, 'f'], [24, 4, 'm'], [36, 5, 'f'], [48, 6, 'm']];
  return {
    frame(t) {
      const reveal = smooth(2.2, 3.4, t);          // 药烟逼出鹿角
      const grab = smoother(4.0, 5.0, t);
      const back = smoother(2.8, 4.0, t);
      const fx = 118;
      const layers = [
        { d: 0.45, par: 0.5, alpha: 1, draw: (c) => { for (let k = 0; k < 6; k++) house(c, -10 + k * 48, GY + 6, 34, 20, { col: [110, 90, 70], lit: k % 2 === 0 }); for (let k = 0; k < 6; k++) hangLantern(c, 14 + k * 48, GY + 30, 0.7, t); } },
        { d: 0.1, draw: (c) => ground(c, GY, -80, 330, 'stone', [110, 100, 90], 6) },
        // 人群：先看着烟，鹿角显出来以后往两边退
        { d: 0, draw: (c) => {
          for (const [dx, k, sex] of crowd) {
            if (k % 2) continue;
            const away = Math.sign(dx) * back * 10;
            put(c, VILLAGER(k, sex), POSE.stand({ head: back > 0.3 ? 0.1 : 0, lean: -0.08 * back, aF: back * 0.6, eF: back * 1.2 }), { x: fx + dx + away, y: GY, s: 0.4, face: dx < 0 ? 1 : -1, t });
          }
          // 被逼出原形的女人：低着头，鹿角慢慢显出来，抬手想捂
          put(c, { ...VILLAGER(1, 'f'), horns: 'antler', hornCol: L.ochre }, POSE.stand({ head: lerp(0.25, -0.1, reveal), lean: 0.05 + 0.1 * grab, aF: lerp(0.4, 2.7, reveal), eF: lerp(1.0, 1.6, reveal), aB: lerp(0.2, 2.5, reveal), eB: 1.6 }), { x: fx - grab * 6, y: GY, s: 0.42, face: 1, t, fade: 1 - reveal });
          // 摇香炉的士兵（从左走进）与扑上来的两个
          const w = walking(-30, 14, Math.min(t, 4.2), { stride: 0.34 });
          put(c, HUMAN_SOLDIER(0), { ...w.pose, aF: 1.2 + 0.25 * Math.sin(t * 2.6), eF: 0.2 }, { x: 40 + w.x, y: GY, s: 0.42, face: 1, t, hold: { F: { kind: 'lanternPole', abs: 1.5 } } });
          for (const sd of [-1, 1]) { const run = smoother(3.6, 4.6, t); put(c, HUMAN_SOLDIER(sd > 0 ? 1 : 2), run < 1 ? { ...running(0, 20, t).pose, aF: 1.8 } : POSE.stand({ lean: 0.3, aF: 1.6, eF: 0.3 }), { x: fx + sd * lerp(70, 9, run), y: GY, s: 0.43, face: -sd, t }); }
        } },
        { d: 0.22, draw: (c) => { for (const [dx, k, sex] of crowd) { if (!(k % 2)) continue; const away = Math.sign(dx) * back * 14; put(c, VILLAGER(k, sex), POSE.stand({ lean: -0.1 * back, aF: back * 1.8, eF: back * 1.4 }), { x: fx + dx * 1.3 + away + 6, y: GY + 3, s: 0.32, face: dx < 0 ? 1 : -1, t }); } } },
        // 绿色的药烟：幕前飘着的一层虚影
        { d: 0.65, noTexture: true, draw: (c) => smoke(c, 70 + 14 * Math.min(t, 4.2), GY + 18, t, { n: 22, spread: 50, rise: 1.2, size: 16, col: [70, 120, 70], a: 0.45 * smooth(0.5, 1.8, t), wind: 5, life: 5 }) },
      ];
      return {
        cam: { x: keyed([[0, 108], [6.5, 118]], t), y: keyed([[0, 40], [6.5, 36]], t), zoom: keyed([[0, 1.45], [6.5, 1.7]], t) },
        layers,
        glow: [lampGlow(62, GY + 26, 26, [255, 170, 80], 0.6), lampGlow(158, GY + 26, 26, [255, 170, 80], 0.6), lampGlow(fx, GY + 30, 40, [150, 255, 160], 0.35 * reveal)],
        light: { sky: [[14, 20, 30], [34, 44, 52], [56, 70, 66], [30, 34, 34]], lamps: [{ x: 120, y: 40, r: 100, col: [180, 230, 170], k: 0.25 }], flicker: 0.04 },
        grade: { exposure: 1.15, contrast: 1.1, sat: 0.95, vignette: 0.6, bloom: 0.3 },
      };
    },
  };
}

export function banner(args) {
  const part = args.part || 'a';
  const GY = 12;
  return {
    frame(t) {
      if (part === 'a') {
        // 黎明的土坡：她站在龙旗下，两个大人站在她身后；坡下的残部举起矛
        const top = GY + 18;
        const layers = [
          { d: 0.55, par: 0.4, alpha: 1, draw: (c) => mountains(c, -60, 330, GY + 8, 30, { col: [140, 110, 100], seed: 30 }) },
          { d: 0.05, draw: (c) => {
            ground(c, GY, -80, 330, 'plain', [150, 110, 80], 8);
            c.beginPath(); c.moveTo(70, GY); c.quadraticCurveTo(120, top + 6, 170, GY); c.closePath(); c.fillStyle = 'rgba(150,110,80,0.95)'; c.fill(); c.lineWidth = 0.5; c.strokeStyle = 'rgba(40,22,10,0.9)'; c.stroke();
            flag(c, 112, top - 1, 46, t, { col: L.yellow, w: 26, fh: 16, droop: 0.15 });
            put(c, LORD(0), POSE.folded(), { x: 104, y: top - 1, s: 0.36, face: 1, t });
            put(c, LORD(1), POSE.folded(), { x: 134, y: top - 2, s: 0.36, face: -1, t });
            put(c, ZFY_TEEN, POSE.stand({ head: 0.12, aF: 0.2, eF: 0.4 }), { x: 120, y: top, s: 0.36, face: 1, t });
          } },
          { d: 0, draw: (c) => {
            for (let k = 0; k < 14; k++) {
              const raise = smoother(1.4 + (k % 4) * 0.1, 2.3 + (k % 4) * 0.1, t) * (0.75 + 0.25 * Math.sin(t * 3 + k));
              put(c, DEMI_GUARD(k), POSE.stand({ aF: lerp(0.6, 3.0, raise), eF: 0.2, head: -0.2 }), { x: 20 + k * 15 + (k % 2) * 4, y: GY - 6 - (k % 2) * 2, s: 0.4, face: k < 7 ? 1 : -1, t, hold: { F: { kind: 'spear', abs: lerp(1.7, 3.1, raise), len: 60 } } });
            }
          } },
        ];
        return {
          cam: { x: keyed([[0, 120], [4.5, 120]], t), y: keyed([[0, 40], [4.5, 44]], t), zoom: keyed([[0, 1.3], [4.5, 1.45]], t) },
          layers, glow: [sunGlow(40, 34, 6, [255, 190, 120], 0.8)],
          light: { sky: [[90, 70, 90], [200, 120, 90], [240, 160, 100], [150, 90, 60]], lamps: [{ x: 40, y: 34, r: 120, col: [255, 180, 110], k: 0.4 }] },
          grade: { exposure: 1.0, contrast: 1.08, sat: 1.0, vignette: 0.55 },
        };
      }
      // b：夜里的帐篷，帐里两个大人在交易（推过一袋钱，1.9 秒），她站在帐外的暗处听着
      const push = smoother(1.2, 1.9, t);
      return {
        cam: { x: keyed([[0, 118], [4.5, 122]], t), y: 40, zoom: keyed([[0, 1.6], [4.5, 1.75]], t) },
        layers: [
          { d: 0.1, draw: (c) => ground(c, GY, -80, 330, 'plain', [70, 60, 60], 9) },
          { d: 0.02, draw: (c) => {
            tent(c, 138, GY, 74, 52, { col: [150, 110, 70], open: true });
            table(c, 138, GY, 26, 13, L.brown);
            put(c, LORD(0), POSE.stand({ lean: 0.2, aF: lerp(0.8, 1.5, push), eF: 0.4, head: 0.25 }), { x: 122, y: GY, s: 0.38, face: 1, t, hold: push < 0.95 ? { F: { kind: 'bag', abs: 0 } } : {} });
            if (push >= 0.95) { c.save(); c.translate(136, GY + 15.6); c.scale(0.5, 0.5); c.rotate(Math.PI); prop(c, 'bag'); c.restore(); }
            put(c, LORD(1), POSE.stand({ lean: 0.15, aF: lerp(0.6, 1.2, smooth(2.4, 3.2, t)), eF: 0.3, head: 0.2 }), { x: 154, y: GY, s: 0.38, face: -1, t });
            hangLantern(c, 138, GY + 40, 0.8, t);
          } },
          { d: 0, draw: (c) => put(c, ZFY_TEEN, POSE.stand({ head: 0.05, aF: 0.2, eF: 0.5 }), { x: 78, y: GY, s: 0.44, face: 1, t }) },
        ],
        glow: [lampGlow(138, GY + 32, 36, [255, 170, 80], 0.9), lampGlow(84, GY + 24, 30, [120, 130, 190], 0.35)],
        light: { sky: [[8, 10, 22], [24, 28, 50], [40, 42, 64], [20, 20, 32]], lamps: [{ x: 138, y: 30, r: 60, col: [255, 170, 90], k: 0.35 }] },
        grade: { exposure: 1.15, contrast: 1.12, sat: 0.95, vignette: 0.65, bloom: 0.3 },
      };
    },
  };
}

export function escape(args) {
  const part = args.part || 'a';
  const GY = 10;
  return {
    frame(t) {
      const layers = [
        { d: 0.6, par: 0.45, alpha: 1, draw: (c) => { for (let k = 0; k < 16; k++) bamboo(c, -40 + k * 22, GY + 4, 90, t, { col: [80, 110, 90], seed: 40 + k }); } },
        { d: 0.08, draw: (c) => ground(c, GY, -80, 330, 'plain', [60, 70, 70], 10) },
      ];
      const glow = [];
      if (part === 'a') {
        // 她从右往左跑，追兵在后；2.55 秒一刀，她踉跄
        const hit = 2.55;
        const her = running(220, -30, t);
        const stagger = smooth(hit, hit + 0.25, t) * (1 - smooth(hit + 0.6, hit + 1.1, t));
        const pur = running(260, -31, t);
        layers.push({ d: 0, draw: (c) => {
          put(c, ZFY_RUN, { ...her.pose, lean: her.pose.lean + 0.25 * stagger, head: -0.2 * stagger, aB: lerp(her.pose.aB, 2.3, stagger), eB: lerp(her.pose.eB, 1.8, stagger) }, { x: her.x, y: GY, s: 0.42, face: -1, t });
          const near = smoother(hit - 0.5, hit, t) * (1 - smooth(hit + 0.3, hit + 0.9, t));
          const atk = clamp((t - (hit - 0.35)) / 0.45);
          const pp = atk > 0 && atk < 1 ? blend(POSE.raise(), POSE.cut(), smoother(0.4, 0.75, atk)) : { ...pur.pose, aF: 1.6, eF: 0.3 };
          put(c, HUMAN_SOLDIER(1), pp, { x: lerp(pur.x + 20, her.x + 18, near), y: GY, s: 0.44, face: -1, t, hold: { F: { kind: 'sword', abs: atk > 0 && atk < 1 ? lerp(3.5, 1.2, smoother(0.4, 0.75, atk)) : 1.4, len: 30 } } });
          for (let k = 0; k < 6; k++) bamboo(c, 10 + k * 46, GY - 2, 100, t, { col: [60, 90, 70], seed: 70 + k });
        } });
        glow.push(slashArc(her.x + 12, GY + 32, 14, 2.6, 0.5, Math.max(0, 1 - Math.abs(t - hit) / 0.15)), flash(0.22 * Math.exp(-Math.pow((t - 2.65) / 0.1, 2)) + 0.12 * Math.exp(-Math.pow((t - 0.75) / 0.08, 2))));
        layers.push({ d: 0.12, mode: 'screen', noTexture: true, draw: (c) => rain(c, -40, 330, 0, 110, t, { n: 520, speed: 140, slant: 0.2, len: 6, col: [150, 170, 210], a: 0.5 }) });
        return { cam: { x: keyed([[0, 196], [3.8, 140]], t), y: 40, zoom: 1.55 }, layers, glow, light: { sky: [[10, 14, 26], [26, 34, 54], [44, 54, 76], [20, 24, 36]], lamps: [{ x: 120, y: 70, r: 120, col: [170, 190, 230], k: 0.3 }] }, grade: { exposure: 1.2, contrast: 1.12, sat: 0.9, vignette: 0.6 } };
      }
      // b：她跪在雨里，按着肩上的伤，然后站起来继续跑
      const rise = smoother(1.4, 2.4, t);
      layers.push({ d: 0, draw: (c) => {
        put(c, ZFY_RUN, blend(POSE.kneel(1, { head: 0.35, lean: 0.35, aB: 2.4, eB: 2.0, aF: 2.6, eF: 2.0 }), { ...running(0, -24, t).pose, aB: 2.4, eB: 2.0 }, rise), { x: 118 - rise * 30 * (t - 1.4), y: GY, s: 0.62, face: -1, t });
      } });
      layers.push({ d: 0.12, mode: 'screen', noTexture: true, draw: (c) => rain(c, -40, 330, 0, 110, t, { n: 520, speed: 140, slant: 0.2, len: 6, col: [150, 170, 210], a: 0.5, seed: 9 }) });
      return { cam: { x: keyed([[0, 116], [2.7, 106]], t), y: 34, zoom: 2.1 }, layers, glow: [], light: { sky: [[10, 14, 26], [26, 34, 54], [44, 54, 76], [20, 24, 36]], lamps: [{ x: 110, y: 60, r: 100, col: [170, 190, 230], k: 0.3 }] }, grade: { exposure: 1.2, contrast: 1.12, sat: 0.9, vignette: 0.6 } };
    },
  };
}
