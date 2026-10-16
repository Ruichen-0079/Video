// 四 · 漫长历史中的个体命运
// xia a：夏，他和爱的人坐在门前，她一年年老去，他不变。xia b：火把下，他被赶走。
// hq a/b：黄泉；然后他沉睡。ming：明，烟囱与街市，她一个人走过。chains：镣铐落地。war：北美的枪阵。reunion：重逢。
import { put, POSE, walking, running, rest, blend, reachTo, toStage, fk } from '../act.js';
import { ground, house, wall, plumTree, sea, mountains, lampGlow, sunGlow, factory, chimney, brickBuilding, streetLamp, hangLantern, cloudBank } from '../set.js';
import { flame, fireGlow, smoke, drift, flash, embers } from '../fx.js';
import { keyed, smooth, smoother, lerp, rng, clamp } from '../g2.js';
import { MBC, MBC_XIA, VILLAGER, MIKO, ZFY_MING, ZFY_OFFICER, CONTINENTAL, SLAVE, DEMI_GUARD } from '../cast.js';
import { L, prop } from '../puppet.js';

const XIA_W = (k) => ({ sex: 'f', head: k < 2 ? 'dan' : 'lao', hat: 'bun', hairCol: [L.black, [120, 116, 110], L.white][k], robe: [L.rose, L.ochre, L.gray][k], trim: L.cream, pattern: 'flower', sleeve: 'narrow', lower: 'skirt', skirtCol: [L.crimson, L.brown, L.ink][k] });

export function xia(args) {
  const part = args.part || 'a';
  const GY = 12;
  return {
    frame(t) {
      if (part === 'a') {
        // 三个季节：春（年轻）→ 秋（中年）→ 冬（老）。1.6 秒、3.2 秒各换一次
        const st = t < 1.6 ? 0 : t < 3.2 ? 1 : 2;
        const dip = Math.max(Math.exp(-Math.pow((t - 1.6) / 0.12, 2)), Math.exp(-Math.pow((t - 3.2) / 0.12, 2)));
        const skies = [
          [[150, 160, 130], [220, 214, 170], [236, 226, 180], [190, 180, 140]],
          [[140, 90, 60], [220, 150, 90], [236, 170, 100], [170, 110, 60]],
          [[120, 126, 140], [196, 200, 210], [220, 222, 230], [170, 174, 184]],
        ];
        const her = XIA_W(st);
        return {
          cam: { x: keyed([[0, 118], [4.5, 120]], t), y: 36, zoom: keyed([[0, 1.75], [4.5, 1.9]], t) },
          layers: [
            { d: 0.3, par: 0.7, draw: (c) => { house(c, 118, GY, 70, 34, { col: [180, 150, 110] }); plumTree(c, 70, GY, 1.5, { bare: st === 2, fcol: st === 1 ? L.orange : L.rose, seed: 9 }); } },
            { d: 0.05, draw: (c) => { ground(c, GY, -80, 330, 'plain', st === 2 ? [230, 232, 238] : [170, 150, 110], 19); c.beginPath(); c.rect(100, GY, 40, 8); c.fillStyle = 'rgba(120,80,50,0.95)'; c.fill(); c.lineWidth = 0.5; c.strokeStyle = 'rgba(40,22,10,0.9)'; c.stroke(); } },
            { d: 0, draw: (c) => {
              put(c, her, POSE.sitBench({ lean: [0.05, 0.15, 0.35][st], head: [0.0, 0.15, 0.35][st], aF: 0.25, eF: 1.25, aB: 0.2, eB: 1.2 }), { x: 108, y: GY - 0.8, s: 0.42, face: 1, t });
              put(c, MBC_XIA, POSE.sitBench({ head: st === 2 ? 0.25 : 0.0, aF: 0.25, eF: 1.25, aB: 0.2, eB: 1.2 }), { x: 130, y: GY - 0.8, s: 0.44, face: -1, t });
            } },
            ...(st === 2 ? [{ d: 0.15, mode: 'screen', noTexture: true, draw: (c) => drift(c, -40, 280, 0, 100, t, { n: 80, kind: 'snow', col: [255, 255, 255], speed: 4, size: 0.45 }) }] : st === 1 ? [{ d: 0.3, draw: (c) => drift(c, -40, 280, 0, 100, t, { n: 30, kind: 'petal', col: L.orange, speed: 4, size: 0.9 }) }] : []),
          ],
          light: { sky: skies[st], lamps: [{ x: 160, y: 60, r: 120, col: [255, 230, 190], k: 0.25 }] },
          grade: { exposure: 1.0 - 0.6 * dip, contrast: 1.06, sat: st === 2 ? 0.6 : 0.95, vignette: 0.55 },
        };
      }
      // b：夜，村民举着火把指着他；他背过身，往左走开
      const w = walking(118, -9, t, { stride: 0.32, lean: 0.12 });
      const torches = [[146, 0], [162, 1], [178, 2], [194, 3], [154, 4], [186, 5]];
      return {
        cam: { x: keyed([[0, 136], [3, 128]], t), y: 38, zoom: 1.6 },
        layers: [
          { d: 0.4, par: 0.6, alpha: 1, draw: (c) => { house(c, 170, GY + 4, 60, 28, { col: [90, 70, 60] }); house(c, 60, GY + 4, 50, 24, { col: [90, 70, 60] }); } },
          { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'plain', [80, 60, 50], 20) },
          { d: 0, draw: (c) => {
            torches.forEach(([x, k], i) => put(c, VILLAGER(k, k % 3 ? 'm' : 'f'), POSE.stand({ aF: i % 2 ? 2.4 : 1.7, eF: 0.4, lean: 0.05 }), { x, y: GY + (i > 3 ? 2 : 0), s: i > 3 ? 0.36 : 0.42, face: -1, t, hold: i % 2 ? { F: { kind: 'torch', abs: 3.0 } } : {} }));
            put(c, MBC_XIA, { ...w.pose, head: 0.3 }, { x: w.x, y: GY, s: 0.44, face: -1, t });
          } },
        ],
        glow: torches.filter((_, i) => i % 2).map(([x], i) => fireGlow(x - 8, GY + 34, 22, t, 0.9, i)),
        light: { sky: [[10, 8, 14], [34, 22, 24], [56, 34, 28], [24, 16, 14]], lamps: [{ x: 170, y: 40, r: 80, col: [255, 140, 60], k: 0.25 }], flicker: 0.08 },
        grade: { exposure: 1.15, contrast: 1.12, sat: 0.95, vignette: 0.62, bloom: 0.3 },
      };
    },
  };
}

export function huangquan(args) {
  const part = args.part || 'a';
  const GY = 14;
  return {
    frame(t) {
      const layers = [
        { d: 0.2, par: 0.8, draw: (c) => sea(c, -80, 330, GY - 10, GY + 2, t * 0.4, { col: [40, 40, 44], foam: [150, 150, 150], rows: 4 }) },
        { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'plain', [70, 70, 72], 21) },
      ];
      const glow = [];
      if (part === 'a') {
        // 他走向一道光的门；门口站着守门人，门后是巫女淡淡的影子
        const w = walking(40, 12, Math.min(t, 3.6), { stride: 0.34 });
        layers.push({ d: 0.55, alpha: 0.7, draw: (c) => put(c, MIKO, POSE.stand({ head: 0.1, aF: 0.3, eF: 0.6 }), { x: 196, y: GY + 2, s: 0.34, face: -1, t }) });
        layers.push({ d: 0, draw: (c) => {
          put(c, { ...DEMI_GUARD(2), robe: L.black, trim: L.gray }, POSE.stand({ aF: 0.2, eF: 0.1 }), { x: 170, y: GY, s: 0.78, face: -1, t, hold: { F: { kind: 'spear', abs: 3.1, len: 70 } } });
          put(c, MBC, { ...w.pose, head: -0.05 }, { x: Math.min(w.x, 118), y: GY, s: 0.42, face: 1, t, hold: { F: { kind: 'sword', abs: 0.8 } } });
        } });
        glow.push((ctx) => { const g = ctx.createLinearGradient(178, 0, 214, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(178, GY, 36, 90); });
      } else {
        // 他躺下，光慢慢暗下去
        const lie = smoother(0.4, 1.6, t);
        layers.push({ d: 0, draw: (c) => put(c, MBC, lie < 0.5 ? POSE.kneel(lie * 2, { head: 0.4, lean: 0.3 }) : { ...rest(), ground: false, aF: -0.2, eF: 0.4, aB: -0.1, head: 0.1 }, lie < 0.5 ? { x: 120, y: GY, s: 0.46, face: 1, t } : { x: 140, y: GY + 3.6, s: 0.46, face: 1, rot: Math.PI / 2 * smoother(0.5, 1, lie), t }) });
      }
      const dim = part === 'b' ? 1 - 0.75 * smooth(1.5, 4.0, t) : 1;
      return {
        cam: part === 'a' ? { x: keyed([[0, 110], [4, 128]], t), y: 42, zoom: keyed([[0, 1.3], [4, 1.45]], t) } : { x: keyed([[0, 126], [4, 124]], t), y: 32, zoom: keyed([[0, 1.9], [4, 2.2]], t) },
        layers, glow,
        light: { sky: [[30, 30, 30], [90, 90, 90].map((v) => v * dim), [120, 120, 120].map((v) => v * dim), [50, 50, 50].map((v) => v * dim)], lamps: [{ x: 196, y: 50, r: 120, col: [240, 240, 240], k: 0.35 * dim }] },
        grade: { exposure: 1.1, contrast: 1.15, sat: 0.0, vignette: 0.65 },
      };
    },
  };
}

export function montage(args) {
  const which = args.which || 'ming';
  const GY = 12;
  return {
    frame(t) {
      if (which === 'ming') {
        // 明：街的尽头是厂房和冒烟的烟囱；她穿过人群走着，手里拿着书卷
        const w = walking(60, 10, t, { stride: 0.32 });
        const R = rng(3);
        const people = Array.from({ length: 9 }, (_, k) => [R() * 260 - 20, k, R() < 0.5 ? 1 : -1, 6 + R() * 6]);
        return {
          cam: { x: keyed([[0, 96], [6.5, 128]], t), y: keyed([[0, 46], [6.5, 40]], t), zoom: keyed([[0, 1.25], [6.5, 1.6]], t) },
          layers: [
            { d: 0.6, par: 0.35, alpha: 1, draw: (c) => { for (let k = 0; k < 6; k++) { factory(c, -20 + k * 50, GY + 10, 40, 16, { col: [120, 90, 70] }); chimney(c, -6 + k * 50, GY + 26, 32, 4, [110, 80, 60]); } } },
            { d: 0.8, par: 0.3, noTexture: true, draw: (c) => { for (let k = 0; k < 6; k++) smoke(c, -6 + k * 50, GY + 58, t, { n: 10, spread: 6, rise: 3, size: 10, col: [50, 40, 34], a: 0.55, wind: 4, life: 5, seed: k }); } },
            { d: 0.25, par: 0.8, draw: (c) => { for (let k = 0; k < 7; k++) house(c, -20 + k * 42, GY + 3, 34, 22, { col: [170, 130, 100], lit: true }); } },
            { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'stone', [150, 130, 110], 22) },
            { d: 0, draw: (c) => {
              for (const [x0, k, dir, sp] of people) { const pw = walking(x0, dir * sp, t, { stride: 0.32 }); put(c, VILLAGER(k, k % 3 ? 'm' : 'f'), pw.pose, { x: pw.x, y: GY, s: 0.36, face: dir, t }); }
              put(c, ZFY_MING, { ...w.pose, aF: 1.1, eF: 1.4 }, { x: w.x + 40, y: GY, s: 0.42, face: 1, t, hold: { F: { kind: 'scroll', abs: 1.6 } } });
            } },
          ],
          light: { sky: [[110, 90, 80], [190, 150, 110], [214, 170, 120], [150, 116, 84]], lamps: [{ x: 120, y: 60, r: 130, col: [255, 210, 160], k: 0.25 }] },
          grade: { exposure: 1.0, contrast: 1.08, sat: 0.8, vignette: 0.55 },
        };
      }
      if (which === 'chains') {
        // 一排亚人奴隶，镣铐一个接一个打开、落地；她站在一旁看着
        const kinds = [{ horns: 'ox' }, { ears: 'fox' }, { horns: 'antler' }, { ears: 'cat' }, { horns: 'dragon' }, { horns: 'ox' }];
        return {
          cam: { x: keyed([[0, 122], [3, 126]], t), y: 38, zoom: keyed([[0, 1.55], [3, 1.65]], t) },
          layers: [
            { d: 0.5, par: 0.5, alpha: 1, draw: (c) => wall(c, -60, 330, GY + 4, 18, { col: [170, 120, 90] }) },
            { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'stone', [170, 140, 110], 23) },
            { d: 0, draw: (c) => {
              put(c, ZFY_MING, POSE.folded({ head: 0.05 }), { x: 62, y: GY, s: 0.44, face: 1, t });
              kinds.forEach((kd, j) => {
                const tf = 0.3 + j * 0.42, free = smooth(tf, tf + 0.35, t);
                const o = { x: 92 + j * 20, y: GY, s: 0.4, face: -1, t };
                const P = { ...SLAVE(j), ...kd, face: 'hollow' };
                const pose = POSE.stand({ head: lerp(0.35, -0.12, free), lean: lerp(0.15, 0, free), aF: lerp(0.75, 0.1, free), eF: lerp(1.15, 0.2, free), aB: lerp(0.7, 0.05, free), eB: lerp(1.2, 0.2, free) });
                const J = put(c, P, pose, o);
                const hp = toStage(o, J.handF);
                const drop = t < tf ? 0 : Math.min(hp[1] - GY - 1, 50 * (t - tf) * (t - tf));
                c.save(); c.translate(hp[0], hp[1] - drop); c.rotate(t > tf ? Math.min(1.4, (t - tf) * 4) : 0);
                c.beginPath(); c.rect(-3, -0.8, 6, 1.6); c.fillStyle = 'rgba(60,60,64,0.95)'; c.fill(); c.lineWidth = 0.4; c.strokeStyle = 'rgba(30,20,12,0.9)'; c.stroke();
                for (const sx of [-2.4, 2.4]) { c.beginPath(); c.arc(sx, 0, 1.3, 0, Math.PI * 2); c.lineWidth = 0.7; c.stroke(); }
                c.restore();
              });
            } },
          ],
          glow: [sunGlow(210, 60, 5, [255, 200, 140], 0.6)],
          light: { sky: [[120, 100, 90], [216, 170, 120], [236, 190, 130], [170, 130, 90]], lamps: [{ x: 200, y: 60, r: 120, col: [255, 200, 140], k: 0.3 }] },
          grade: { exposure: 1.0, contrast: 1.06, sat: 0.95, vignette: 0.55 },
        };
      }
      if (which === 'war') {
        // 北美：一排三角帽举枪齐射，她在队列旁举剑指挥；1.9 秒一声炮
        const R = rng(5);
        const fires = Array.from({ length: 10 }, (_, j) => 0.8 + (j % 5) * 0.12 + R() * 0.2);
        return {
          cam: { x: keyed([[0, 118], [3.5, 124]], t), y: 40, zoom: keyed([[0, 1.4], [3.5, 1.5]], t) },
          layers: [
            { d: 0.55, par: 0.4, alpha: 1, draw: (c) => mountains(c, -60, 330, GY + 6, 14, { col: [110, 120, 110], seed: 70 }) },
            { d: 0.05, draw: (c) => ground(c, GY, -80, 330, 'plain', [120, 130, 100], 24) },
            { d: 0, draw: (c) => {
              const raise = smooth(0.1, 0.5, t);
              put(c, ZFY_OFFICER, POSE.stand({ aF: lerp(0.5, 2.8, raise), eF: 0.2, head: -0.05 }), { x: 66, y: GY, s: 0.46, face: 1, t, hold: { F: { kind: 'sword', abs: lerp(1.0, 2.6, raise) } } });
              fires.forEach((ft, j) => put(c, CONTINENTAL(j), POSE.stand({ aF: 0.55, eF: 1.75, aB: 1.35, eB: 0.2, legF: [0.25, 0.1], legB: [-0.25, 0.1], lean: 0.08, head: 0.1 }), { x: 92 + j * 14, y: GY + (j % 2) * 1.5, s: 0.4 - (j % 2) * 0.03, face: 1, t, hold: { F: { kind: 'musket', abs: 1.55 + (t > ft && t < ft + 0.12 ? -0.08 : 0) } } }));
            } },
            { d: 0.5, noTexture: true, draw: (c) => { fires.forEach((ft, j) => { if (t > ft) smoke(c, 108 + j * 14, GY + 26, t - ft, { n: 6, spread: 6, rise: 1.2, size: 7, col: [200, 200, 200].map((v) => v * 0.45), a: 0.4, wind: 6, life: 3, seed: j }); }); if (t > 1.9) smoke(c, 230, GY + 10, t - 1.9, { n: 12, spread: 14, rise: 3, size: 16, col: [80, 80, 80], a: 0.6, wind: -3, life: 3, seed: 40 }); } },
          ],
          glow: [...fires.map((ft, j) => (ctx) => { const k = Math.max(0, 1 - (t - ft) / 0.1) * (t > ft ? 1 : 0); if (k > 0) lampGlow(108 + j * 14, GY + 23, 6, [255, 230, 170], k)(ctx); }), flash(0.25 * Math.exp(-Math.pow((t - 1.9) / 0.07, 2)))],
          light: { sky: [[96, 100, 104], [170, 170, 160], [190, 186, 172], [140, 136, 124]], lamps: [{ x: 120, y: 60, r: 120, col: [255, 236, 210], k: 0.15 }] },
          grade: { exposure: 1.0, contrast: 1.1, sat: 0.75, vignette: 0.55 },
        };
      }
      return { layers: [] };
    },
  };
}

const ZFY_DRESS = { sex: 'f', head: 'dan', hat: 'long', robe: L.teal, trim: L.cream, inner: L.white, pattern: 'flower', sleeve: 'narrow', lower: 'skirt', skirtCol: L.teal, shoeCol: L.black };
const MBC_COAT = { sex: 'm', head: 'sheng', hat: 'short', robe: L.ink, trim: L.gray, inner: L.white, pattern: 'plain', sleeve: 'narrow', lower: 'coat', trousers: L.ink, boots: L.black };

export function reunion(args) {
  const GY = 12;
  return {
    frame(t) {
      // 傍晚的砖楼街口：她站着等；他从右边走来，停在她面前
      const w = walking(210, -14, Math.min(t, 4.0), { stride: 0.34 });
      const stop = smooth(3.6, 4.2, t);
      const hx = Math.max(w.x, 146);
      const turn = smooth(1.6, 2.4, t);
      return {
        cam: { x: keyed([[0, 130], [4.5, 128]], t), y: 40, zoom: keyed([[0, 1.45], [4.5, 1.7]], t) },
        layers: [
          { d: 0.4, par: 0.6, alpha: 1, draw: (c) => { for (let k = 0; k < 5; k++) brickBuilding(c, 20 + k * 52, GY + 2, 44, 50 + (k % 2) * 10, t, { col: [170, 90, 70], lit: 0.5 }); } },
          { d: 0.05, draw: (c) => { ground(c, GY, -80, 330, 'stone', [120, 110, 110], 25); streetLamp(c, 94, GY, 30); streetLamp(c, 190, GY, 30); } },
          { d: 0, draw: (c) => {
            put(c, ZFY_DRESS, POSE.folded({ head: lerp(0.1, -0.05, turn) }), { x: 124, y: GY, s: 0.46, face: turn > 0.5 ? 1 : -1, t });
            put(c, MBC_COAT, blend(w.pose, POSE.stand({ head: 0.05 }), stop), { x: hx, y: GY, s: 0.48, face: -1, t });
          } },
        ],
        glow: [lampGlow(94, GY + 34, 24, [255, 200, 130], 0.8), lampGlow(190, GY + 34, 24, [255, 200, 130], 0.8)],
        light: { sky: [[50, 50, 80], [140, 110, 120], [190, 140, 120], [100, 80, 80]], lamps: [{ x: 140, y: 40, r: 110, col: [255, 190, 140], k: 0.25 }] },
        grade: { exposure: 1.05, contrast: 1.08, sat: 0.9, vignette: 0.58, bloom: 0.3 },
      };
    },
  };
}
