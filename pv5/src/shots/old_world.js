// 一 · 旧时代的世界
// procA：宫城前的御道，亚人的仪仗。procB：人类奴隶抬着轿子。procC：狐耳的贵女走着，把耳朵与尾巴藏了起来。
// corridor：夜里的长廊，小皇女望着红盖头的姐姐被宫人引着远去。seaside：海边，一个老人摸了摸她的头。
import { put, POSE, walking, rest, blend, reachTo, toStage, fk } from '../act.js';
import { ground, palace, colonnade, hangLantern, lampGlow, flag, palanquin, sea, cloudBank, mountains, wall, sunGlow, stairs } from '../set.js';
import { drift } from '../fx.js';
import { keyed, smooth, smoother, lerp, rng } from '../g2.js';
import { NOBLE, DEMI_GUARD, SLAVE, ZFY_CHILD, BRIDE, MAID, OLD } from '../cast.js';
import { L } from '../puppet.js';

const DAWN = { sky: [[150, 140, 132], [226, 196, 156], [246, 220, 170], [210, 176, 130]], lamps: [{ x: 120, y: 64, r: 150, col: [255, 226, 180], k: 0.35 }] };

export function procession(args) {
  const part = args.part || 'a';
  const GY = 14;
  return {
    frame(t) {
      const layers = [];
      let cam;
      // 远景：宫城
      layers.push({ d: 0.5, par: 0.4, alpha: 1, draw: (c) => {
        mountains(c, -60, 300, GY + 10, 30, { col: [150, 140, 130], seed: 12 });
        wall(c, -60, 300, GY + 6, 10, { col: L.gray });
        palace(c, 117, GY + 6, 70, 46, { col: L.crimson, roof: L.ink });
        palace(c, 40, GY + 8, 36, 26, { col: L.crimson, roof: L.ink, steps: false });
        palace(c, 196, GY + 8, 36, 26, { col: L.crimson, roof: L.ink, steps: false });
      } });
      layers.push({ d: 0.1, draw: (c) => ground(c, GY, -80, 320, 'stone', [200, 186, 160], 3) });
      if (part === 'a') {
        // 御道两侧的旗与守卫；仪仗从左往右缓缓走过
        layers.push({ d: 0.25, par: 0.8, draw: (c) => {
          for (let k = 0; k < 9; k++) { const x = -20 + k * 32; flag(c, x, GY + 2, 34, t + k * 0.7, { col: k % 2 ? L.yellow : L.crimson, w: 9, fh: 16, mark: k % 2 ? 'dragon' : null, droop: 0.6 }); }
        } });
        layers.push({ d: 0, draw: (c) => {
          for (let k = 0; k < 7; k++) {
            const x = -10 + k * 18 + 6 * t;
            const P = k === 3 ? NOBLE(0) : DEMI_GUARD(k);
            const w = walking(0, 6, t + k * 0.3, { stride: 0.32 });
            put(c, P, w.pose, { x, y: GY, s: 0.26, face: 1, t, hold: P.armor ? { F: { kind: 'spear', abs: 3.1, len: 60 } } : {} });
          }
        } });
        cam = { x: keyed([[0, 112], [3.5, 120]], t), y: keyed([[0, 52], [3.5, 46]], t), zoom: keyed([[0, 1.0], [3.5, 1.12]], t) };
      } else if (part === 'b') {
        // 轿子：四个人类奴隶弯着腰抬；轿里坐着龙角的贵人
        const x0 = 70 + 7 * t;
        layers.push({ d: 0, draw: (c) => {
          const bob = Math.sin(t * 7) * 0.4;
          palanquin(c, x0, GY + 22 + bob, 1.05, L.crimson);
          // 轿窗里的龙角
          put(c, NOBLE(0), POSE.sitBench({ head: -0.05 }), { x: x0 - 3, y: GY + 18 + bob, s: 0.22, face: 1, t });
          for (const [dx, k] of [[-28, 0], [-20, 1], [20, 2], [28, 0]]) {
            const w = walking(0, 7, t + k * 0.21 + dx * 0.01, { stride: 0.3, lean: 0.35 });
            put(c, SLAVE(k), { ...w.pose, head: -0.2, aF: 2.6, eF: 0.9, aB: 2.4, eB: 1.0 }, { x: x0 + dx, y: GY, s: 0.3, face: 1, t });
          }
          // 后面跟着的守卫
          const g = walking(0, 7, t + 0.4, { stride: 0.32 });
          put(c, DEMI_GUARD(1), g.pose, { x: x0 - 46, y: GY, s: 0.32, face: 1, t, hold: { F: { kind: 'spear', abs: 3.1, len: 60 } } });
        } });
        cam = { x: keyed([[0, 84], [3.5, 106]], t), y: 40, zoom: 1.6 };
      } else {
        // 狐耳的贵女：走着走着，耳朵和尾巴淡了下去
        const fade = smoother(1.4, 3.4, t);
        const w = walking(0, 6, t, { stride: 0.32 });
        layers.push({ d: 0.35, draw: (c) => {
          const x0 = 60 + 7 * t;
          palanquin(c, x0 + 20, GY + 22, 1.05, L.crimson);
          for (const [dx, k] of [[-8, 0], [48, 2]]) { const ww = walking(0, 7, t + k * 0.21, { stride: 0.3, lean: 0.35 }); put(c, SLAVE(k), { ...ww.pose, aF: 2.6, eF: 0.9, aB: 2.4, eB: 1.0 }, { x: x0 + dx, y: GY, s: 0.3, face: 1, t }); }
        } });
        layers.push({ d: 0, draw: (c) => {
          put(c, NOBLE(1), { ...w.pose, aF: 0.6, eF: 1.4, head: lerp(0, 0.18, fade) }, { x: 118 + 6 * t, y: GY, s: 0.5, face: 1, t, fade });
        } });
        cam = { x: keyed([[0, 126], [4.5, 146]], t), y: keyed([[0, 50], [4.5, 52]], t), zoom: keyed([[0, 1.9], [4.5, 2.15]], t) };
      }
      return {
        cam, layers, glow: [sunGlow(60, 60, 5, [255, 230, 190], 0.5)],
        light: DAWN,
        grade: { exposure: 1.0, contrast: 1.05, sat: 0.95, vignette: 0.5 },
      };
    },
  };
}

export function corridor(args) {
  const GY = 12;
  return {
    frame(t) {
      // 新娘与两个宫人从左往右走，往深处去（越来越小、越来越虚）
      const u = smooth(0, 6.5, t);
      const depth = lerp(0.0, 0.55, u);
      const sc = lerp(0.42, 0.24, u);
      const bx = lerp(118, 196, u);
      const by = lerp(GY, GY + 14, u);
      const w = walking(0, 5, t, { stride: 0.28 });
      const lamps = [];
      const layers = [
        // 远处的廊
        { d: 0.6, par: 0.5, alpha: 1, draw: (c) => { colonnade(c, 120, 330, GY + 14, 30, 14, { col: L.crimson }); for (let x = 127; x < 330; x += 28) hangLantern(c, x, GY + 42, 0.6, t); } },
        { d: 0.1, draw: (c) => ground(c, GY, -60, 320, 'floor', [130, 90, 70], 4) },
        // 新娘一行
        { d: depth, draw: (c) => {
          const o = { x: bx, y: by, s: sc, face: 1, t };
          put(c, MAID(0), { ...w.pose, aF: 1.3, eF: 0.8 }, { ...o, x: bx + 16 * sc / 0.42, t: t + 0.2, hold: { F: { kind: 'lanternPole', abs: 1.4 } } });
          put(c, BRIDE, { ...walking(0, 5, t + 0.15, { stride: 0.26 }).pose, aF: 0.7, eF: 1.5, aB: 0.6, eB: 1.5, head: 0.2 }, o);
          put(c, MAID(1), { ...walking(0, 5, t + 0.4, { stride: 0.28 }).pose, aF: 1.3, eF: 0.8 }, { ...o, x: bx - 16 * sc / 0.42, hold: { F: { kind: 'lanternPole', abs: 1.4 } } });
        } },
        // 近处：柱子与小皇女
        { d: 0, draw: (c) => {
          colonnade(c, 40, 100, GY, 64, 60, { col: L.crimson });
          const look = smoother(0.8, 2.4, t);
          put(c, ZFY_CHILD, POSE.stand({ head: lerp(-0.1, 0.12, look), aF: lerp(0.3, 1.1, smooth(3.5, 4.5, t)), eF: 1.2, aB: 0.1 }), { x: 60, y: GY, s: 0.5, face: 1, t });
          hangLantern(c, 70, GY + 58, 1.0, t);
        } },
      ];
      const lx = bx + 16 * sc / 0.42 + 9 * sc / 0.42 * 0.6;
      return {
        cam: { x: keyed([[0, 104], [6.5, 116]], t), y: keyed([[0, 42], [6.5, 44]], t), zoom: keyed([[0, 1.35], [6.5, 1.25]], t) },
        layers,
        glow: [lampGlow(70, GY + 52, 22, [255, 160, 70], 0.8), lampGlow(bx + 22 * sc / 0.42, by + 40 * sc, 14, [255, 160, 70], 0.7 * (1 - u * 0.4)), lampGlow(bx - 10 * sc / 0.42, by + 40 * sc, 14, [255, 160, 70], 0.7 * (1 - u * 0.4))],
        light: { sky: [[16, 12, 14], [42, 26, 22], [70, 40, 28], [40, 24, 18]], lamps: [{ x: 160, y: 40, r: 120, col: [255, 150, 70], k: 0.25 }], flicker: 0.05 },
        grade: { exposure: 1.1, contrast: 1.1, sat: 1.0, vignette: 0.6, bloom: 0.35 },
      };
    },
  };
}

export function seaside(args) {
  const GY = 16;
  return {
    frame(t) {
      // 老人从左边慢慢走来（0–3.6 秒），停下，俯身，伸手放到她头上
      const girlO = { x: 140, y: GY, s: 0.4, face: 1, t };
      const look = smoother(4.1, 5.0, t);
      const girlPose = POSE.stand({ head: lerp(0.0, -0.45, look), aF: 0.15, eF: 0.5, aB: 0.1 });
      const walkT = Math.min(t, 3.6);
      const ox = lerp(60, 124, smoother(0, 3.7, t));
      const w = walking(0, 16, walkT, { stride: 0.34, lean: 0.12 });
      const stop = smooth(3.3, 3.8, t);
      const reachK = smoother(3.8, 4.7, t);
      const oldO = { x: ox, y: GY, s: 0.56, face: 1, t };
      let oldPose = blend(w.pose, POSE.stand({ lean: 0.15, head: 0.2, aF: -0.1, eF: 0.3 }), stop);
      oldPose = { ...oldPose, lean: lerp(oldPose.lean, 0.32, reachK), head: lerp(oldPose.head, 0.45, reachK) };
      return {
        cam: { x: keyed([[0, 104], [7, 124]], t), y: keyed([[0, 44], [7, 38]], t), zoom: keyed([[0, 1.4], [7, 1.9]], t) },
        layers: [
          { d: 0.55, par: 0.4, alpha: 1, draw: (c) => { mountains(c, 150, 330, GY + 14, 18, { col: [120, 130, 140], seed: 22 }); cloudBank(c, 70, 80, 1.6, [240, 230, 220]); cloudBank(c, 180, 74, 1.2, [240, 230, 220]); } },
          { d: 0.2, par: 0.7, draw: (c) => sea(c, -60, 320, GY + 3, GY + 17, t, { col: [110, 150, 190], rows: 5 }) },
          { d: 0.05, draw: (c) => ground(c, GY + 2, -60, 320, 'sand', [226, 200, 160], 7) },
          { d: 0, draw: (c) => {
            // 先算她的头顶，再画老人（用远侧的手），最后画她——他的袖子在她身后
            const Jg = fk(ZFY_CHILD, girlPose);
            const top = toStage(girlO, Jg.headTop);
            let p = oldPose;
            if (reachK > 0.001) { const tgt = [lerp(ox + 8, top[0] + 1 + Math.sin(t * 2.2) * 0.5 * smooth(4.7, 5.2, t), reachK), lerp(GY + 22, top[1] + 0.5, reachK)]; p = reachTo(OLD, p, oldO, 'B', tgt, 1); }
            put(c, OLD, p, oldO);
            put(c, ZFY_CHILD, girlPose, girlO);
          } },
        ],
        glow: [sunGlow(205, 62, 6, [255, 222, 180], 0.7)],
        light: { sky: [[150, 160, 176], [216, 206, 196], [244, 222, 196], [200, 186, 170]], lamps: [{ x: 200, y: 60, r: 130, col: [255, 220, 180], k: 0.35 }] },
        grade: { exposure: 1.0, contrast: 1.04, sat: 0.9, vignette: 0.5 },
      };
    },
  };
}
