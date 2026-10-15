// 宫中，夜。年幼的皇女坐在廊柱下；红盖头的姐姐被宫人提灯引着，沿长廊远去。（设定 9.1：受排挤；目睹姐姐不幸的婚姻）
import { Actor, figureGroups } from '../actor.js';
import { corridor } from '../env.js';
import { lantern } from '../props.js';
import { Cloth } from '../cloth.js';
import { Geo, box } from '../mesh.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, translate, qaxis } from '../math.js';
import { walkCycle as walk } from '../figure.js';
import { ZFY_CHILD, SKIN } from '../cast.js';
import { stand } from '../poses.js';

export default function corridorShot(R, args) {
  const corr = corridor(36, 3.2, 3.6, { n: 12, col: [0.26, 0.04, 0.03], floor: [0.07, 0.06, 0.055], ceil: [0.04, 0.03, 0.025], wallCol: [0.05, 0.04, 0.035], panel: [0.1, 0.025, 0.02] }).upload();
  const lanternM = lantern({ glow: 7 }).upload();
  const stepM = box(1.4, 0.32, 1.2, [0.3, 0.28, 0.25, 0.8]).upload();
  const BRIDE = { height: 1.6, sex: 'f', hair: 'bun', sleeve: 'wide', colors: { skin: SKIN.fair, robe: [0.55, 0.05, 0.04], robe2: [0.62, 0.46, 0.18], inner: [0.8, 0.7, 0.6], hair: [0.04, 0.03, 0.03], belt: [0.62, 0.46, 0.18], shoe: [0.4, 0.05, 0.04] } };
  const MAID = (k) => ({ height: 1.55, sex: 'f', hair: 'bun', sleeve: 'wide', colors: { skin: SKIN.fair, robe: [0.22, 0.24, 0.28], robe2: [0.5, 0.48, 0.44], inner: [0.7, 0.68, 0.64], hair: [0.04, 0.03, 0.03], belt: [0.3, 0.28, 0.25], shoe: [0.1, 0.08, 0.07] } });
  const bride = new Actor(BRIDE, { skirt: { len: 0.97, flare: 2.0, color: BRIDE.colors.robe, color2: BRIDE.colors.robe2 }, sleeves: { width: 0.15, color: BRIDE.colors.robe, color2: BRIDE.colors.robe2 } });
  const maids = [0, 1].map((k) => new Actor(MAID(k), { skirt: { len: 0.95, flare: 1.8, color: MAID(k).colors.robe, color2: MAID(k).colors.robe2 } }));
  const girl = new Actor(ZFY_CHILD, { skirt: { len: 0.95, flare: 1.6, color: ZFY_CHILD.colors.robe, color2: ZFY_CHILD.colors.robe2, rx: 0.13, rz: 0.11 }, sleeves: { width: 0.12, color: ZFY_CHILD.colors.robe, color2: ZFY_CHILD.colors.robe2 } });
  // 盖头：一块红布，钉在头顶
  let veil = null;
  const HANG = [[-1.35, 2.5, -9], [1.35, 2.5, -15], [-1.35, 2.5, -21], [1.35, 2.5, -27]];
  const dust = new Particles(300, 'dust', 4);
  return {
    frame(t, dt) {
      const env = { wind: [0, 0, 0.05], t, ground: 0 };
      // 新娘与宫人：从近处向长廊深处走（-z）
      const sp = 0.42;
      const z0 = -3.0;
      const bw = walk(bride.T.body.J, [0, 0, z0], [0, 0, -1], sp * t, { stride: 0.36, lift: 0.03, bob: 0.012 });
      bride.update({ pos: bw.pelvis, yaw: Math.PI, lean: [0.08, 0, 0], head: [0.2, 0, 0], footL: bw.footL, footR: bw.footR,
        handL: add(bw.pelvis, [0.05, 0.12, -0.2]), handR: add(bw.pelvis, [-0.05, 0.14, -0.2]), elbowL: [1, -0.4, 0.2], elbowR: [-1, -0.4, 0.2] }, dt, env);
      const W = bride.W;
      const top = add(W.headTop, [0, 0.02, 0]);
      if (!veil) {
        veil = new Cloth(11, 11, (i, j) => add(top, [(i - 5) * 0.07, 0.02, (j - 5) * 0.07]), { color: [0.62, 0.04, 0.03, 0.8], colorFn: (u, v) => (v > 0.88 ? [0.62, 0.46, 0.18, 0.7] : [0.6, 0.04, 0.035, 0.8]), mat: [0, 0, 0.7, 1], damping: 0.97, bend: 0.15 });
      }
      for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) { const di = i - 5, dj = j - 5; if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) veil.setPin(i, j, add(top, [di * 0.035, 0, dj * 0.035])); }
      const vcol = [{ c: add(W.head, [0, 0.07, 0.01]), r: 0.125 }, { a: W.neck, b: W.chest, r: 0.16 }, { c: W.shoulderL, r: 0.09 }, { c: W.shoulderR, r: 0.09 }];
      if (dt > 0) veil.step(dt, { colliders: vcol, iters: 8, sub: 2 }); else for (let k = 0; k < 60; k++) veil.step(1 / 60, { colliders: vcol, iters: 6, sub: 1 });
      veil.upload();
      const lamps = [];
      maids.forEach((m, k) => {
        const sx = k ? -0.75 : 0.75;
        const mw = walk(m.T.body.J, [sx, 0, z0 - 0.7], [0, 0, -1], sp * t + k * 0.2, { stride: 0.36, lift: 0.03 });
        const hand = add(mw.pelvis, [sx > 0 ? -0.1 : 0.1, 0.38, -0.32]);
        m.update({ pos: mw.pelvis, yaw: Math.PI, lean: [0.05, 0, 0], footL: mw.footL, footR: mw.footR, handR: sx > 0 ? hand : null, handL: sx < 0 ? hand : null, elbowR: [0, -1, 0], elbowL: [0, -1, 0] }, dt, env);
        lamps.push(add(hand, [0, -0.3, 0]));
      });
      // 女孩：站在近处廊柱旁，一只手扶着柱子，望着姐姐远去
      const gp = [-0.98, 0, -0.1];
      const look = smooth(0.8, 2.6, t);
      const gy = Math.PI + 0.25;
      girl.update(stand(girl.T.body.J, gp, gy, { lean: [0.04, 0, 0], head: [0.05, 0.25 - 0.35 * look, 0], handL: [0.2, 0.62, 0.08], handR: [-0.08, 0.78, 0.16] }), dt, env);
      const flick = (k) => 0.9 + 0.1 * Math.sin(t * 11 + k * 3) * Math.sin(t * 7.3 + k);
      const lights = [
        ...lamps.map((p, k) => ({ pos: p, col: [2.2 * flick(k), 1.15 * flick(k), 0.45], radius: 2.2 })),
        ...HANG.map((p, k) => ({ pos: p, col: [0.9 * flick(k + 3), 0.42 * flick(k + 3), 0.14], radius: 1.6 })),
      ];
      const items = [{ mesh: corr }];
      lamps.forEach((p) => items.push({ mesh: lanternM, model: translate(p) }));
      HANG.forEach((p) => items.push({ mesh: lanternM, model: translate(p) }));
      items.push({ mesh: veil.mesh, twoSided: true });
      const actors = [bride, ...maids, girl];
      for (const a of actors) items.push(...a.items());
      // 空气里的尘
      dust.spawn(dt || 1 / 30, 40, (p, R) => { p.p = [lerp(-1.5, 1.5, R()), lerp(0.3, 3, R()), lerp(-8, 0, R())]; p.v = [0, 0.02, 0]; p.life = 6; p.size = 0.006; p.col = [1, 0.8, 0.6, 0.5]; });
      dust.step(dt || 1 / 30);
      const cx = args.cx ?? 0.35, cy = args.cy ?? 0.95, cz = args.cz ?? 3.4;
      const cp = keyed([[0, [cx, cy, cz]], [7, [cx - 0.05, cy + 0.03, cz - 0.6]]], t);
      if (args.debugCam) { const hp = bride.W.head; const off = args.debugCam === 1 ? [0.5, 0.25, 1.4] : [0.4, 0.2, -1.4]; return { cam: { pos: add(hp, off), target: hp, fov: 30 }, sun: { dir: [0.3, 0.9, 0.5], col: [1.2, 1.2, 1.2] }, amb: { sky: [0.3, 0.3, 0.3], gnd: [0.1, 0.1, 0.1] }, sky: { top: [0.2, 0.2, 0.2], hor: [0.2, 0.2, 0.2] }, items, figures: figureGroups(actors), grade: { exposure: 1 } }; }
      return {
        cam: { pos: cp, target: keyed([[0, [-0.1, 1.15, -6.0]], [7, [-0.1, 1.2, -7.0]]], t), fov: args.fov ?? 32, dof: { focus: 6.5, aperture: 0.06 } },
        sun: { dir: [0.3, 0.9, 0.2], col: [0.0, 0.0, 0.0] },
        amb: { sky: [0.02, 0.022, 0.035], gnd: [0.01, 0.008, 0.007] }, rim: [0.03, 0.02, 0.015],
        sky: { top: [0, 0, 0], hor: [0, 0, 0], gnd: [0, 0, 0] },
        fog: { density: 0.06, falloff: 0.0, base: 0, max: 0.85, col: [0.02, 0.012, 0.008], sunCol: [0, 0, 0] },
        lights, items, figures: figureGroups(actors), particles: [dust],
        grade: { exposure: args.exp ?? 1.0, sat: 0.95, contrast: 1.1, gain: [1.02, 0.98, 0.92], lift: [0.0, 0.0, 0.005], vignette: 0.55, grain: 0.04, bloom: 0.7, bloomThresh: 0.6 },
      };
    },
  };
}
