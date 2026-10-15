// 出逃：夜雨里的竹林。她在跑，身后有人追；一道刀光，她踉跄了一下，按着背，继续跑。（设定 9.1：出逃时被复国势力砍伤）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { bamboo } from '../env.js';
import { jian } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, clamp } from '../math.js';
import { walkCycle as walk } from '../figure.js';
import { ZFY_TEEN, DEMI_GUARD } from '../cast.js';
import { frameModel } from './siege.js';

export default function escape(R, args) {
  const part = args.part || 'a';
  const g = new Geo();
  g.add(grid(80, 80, 60, 60, (x, z) => 0.15 * fbm2(x * 0.2, z * 0.2), (x, z) => { const n = fbm2(x * 0.5, z * 0.5); return [0.08 + 0.02 * n, 0.09 + 0.02 * n, 0.06, 0.35]; }, null, -40, -40));
  g.add(bamboo(260, 0, -6, 18, 7, { h: 9 }));
  const sceneM = g.upload();
  const swordM = jian().upload();
  const ZR = { ...ZFY_TEEN, hair: 'long' };
  const zfy = new Actor(ZR, { skirt: { len: 0.9, flare: 1.8, color: ZR.colors.robe, color2: ZR.colors.robe2 }, sleeves: { width: 0.11, color: ZR.colors.robe, color2: ZR.colors.robe2 }, hair: { len: 0.55, color: ZR.colors.hair, nx: 5, ny: 9 } });
  const chasers = [0, 1].map((k) => new Actor({ ...DEMI_GUARD(k ? 'ox' : null), colors: { ...DEMI_GUARD(null).colors, robe: [0.08, 0.07, 0.07] } }, {}));
  const rain = new Particles(2500, 'rain', 11);
  const splash = new Particles(400, 'mist', 12);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.2, -0.5, 0.6], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const run = { stride: 1.25, lift: 0.16, bob: 0.04 };
      // 她：朝镜头跑来（+z）
      const speed = 3.2;
      const cut = part === 'a' ? 2.6 : -1;
      const stumble = part === 'a' ? Math.exp(-Math.pow((t - cut - 0.25) / 0.22, 2)) : 0;
      const hurt = part === 'a' ? smooth(cut, cut + 0.4, t) : 1;
      const d = speed * t - stumble * 0.3;
      const wc = walk(zfy.T.body.J, [0.3, 0, -9], [0, 0, 1], d, run);
      const sw = wc.swing;
      const p = wc.pelvis;
      zfy.update({ pos: add(p, [0, -0.06 - stumble * 0.12, 0]), yaw: 0, lean: [0.32 + stumble * 0.35, 0, sw * 0.12], head: [0.1, sw * 0.1, 0],
        handL: hurt > 0.5 ? add(p, [0.18, 0.15, -0.16]) : add(p, [0.24, 0.12, sw * 0.35]), elbowL: [1, -0.3, -0.5],
        handR: add(p, [-0.24, 0.12, -sw * 0.35]), elbowR: [-1, -0.3, -0.5], footL: wc.footL, footR: wc.footR }, dt, env);
      // 追兵：举刀
      chasers.forEach((c, k) => {
        const lag = k ? 3.2 : 1.4 + (part === 'a' ? -smooth(1.6, cut, t) * 0.9 + smooth(cut + 0.2, cut + 1.0, t) * 1.2 : 2);
        const cw = walk(c.T.body.J, [k ? -0.8 : 0.7, 0, -9 - lag], [0, 0, 1], speed * t * (k ? 0.97 : 1.0), run);
        const swing = part === 'a' && !k ? smoother(cut - 0.35, cut, t) - smooth(cut + 0.1, cut + 0.6, t) : 0;
        const hand = add(cw.pelvis, [-0.2, 0.75 - swing * 0.85, 0.15 + swing * 0.55]);
        c.update({ pos: cw.pelvis, yaw: 0, lean: [0.3, 0, -swing * 0.3], handR: hand, elbowR: [-1, 0, -0.3], footL: cw.footL, footR: cw.footR }, dt, env);
        items.push({ mesh: swordM, model: frameModel(c.W.wristR, norm([0.1, 1 - swing * 2.2, 0.2 + swing * 1.6])) });
      });
      // 雨
      const cp = add(zfy.W.pelvis, [1.6, 0.6, 3.4]);
      rain.spawn(h, 2500 / 0.9 * 1.0, (q, r) => { q.p = add(cp, [(r() - 0.5) * 9, 4 + r() * 2, (r() - 0.6) * 12]); q.v = [0.8, -9 - r() * 2, 1.2]; q.life = 0.9; q.size = 0.006; q.col = [0.55, 0.6, 0.7, 0.35]; });
      rain.step(h);
      // 闪电
      const flash = Math.max(0, Math.exp(-Math.pow((t - (part === 'a' ? cut + 0.05 : 1.2)) / 0.06, 2)) * 1.0, Math.exp(-Math.pow((t - (part === 'a' ? 0.7 : 2.6)) / 0.08, 2)) * 0.6);
      for (const a of [zfy, ...chasers]) items.push(...a.items());
      let cam;
      if (part === 'a') cam = { pos: add(zfy.W.pelvis, [1.5, 0.45, 4.2]), target: add(zfy.W.pelvis, [0.1, 0.25, -1.5]), fov: 40, dof: { focus: 4.5, aperture: 0.06 } };
      else cam = { pos: add(zfy.W.pelvis, [-1.1, 0.55, 1.9]), target: add(zfy.W.pelvis, [0.0, 0.35, 0.0]), fov: 38, dof: { focus: 2.2, aperture: 0.09 } };
      return {
        cam,
        sun: { dir: norm([0.3, 0.8, -0.5]), col: [0.25 + 3.5 * flash, 0.3 + 3.6 * flash, 0.45 + 4 * flash], shadow: { center: zfy.W.pelvis, radius: 6, soft: 1.5 } },
        amb: { sky: [0.025 + 0.2 * flash, 0.03 + 0.22 * flash, 0.05 + 0.3 * flash], gnd: [0.01, 0.012, 0.012] }, rim: [0.06, 0.07, 0.1],
        sky: { top: [0.01 + 0.4 * flash, 0.012 + 0.42 * flash, 0.02 + 0.5 * flash], hor: [0.02, 0.025, 0.03], gnd: [0.01, 0.01, 0.01] },
        fog: { density: 0.07, falloff: 0.05, base: 0, max: 0.85, col: [0.02 + 0.2 * flash, 0.025 + 0.22 * flash, 0.035 + 0.28 * flash], sunCol: [0, 0, 0] },
        lights: [], items, figures: figureGroups([zfy, ...chasers]), particles: [rain],
        grade: { exposure: 1.3, sat: 0.6, contrast: 1.15, gain: [0.95, 1.0, 1.06], lift: [0.0, 0.005, 0.015], vignette: 0.55, grain: 0.05, bloom: 0.5 },
      };
    },
  };
}
