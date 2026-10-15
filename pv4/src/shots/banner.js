// 复国：少女皇女站在大旗下，阶下是亚人的残部；夜里，营帐中人在桌上摊开地图、推过钱袋，她在帐外听着。（设定 9.1）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, cylinder, sphere } from '../mesh.js';
import { tent, desk, wallTent } from '../env.js';
import { spear, pole, rock, lantern, jian } from '../props.js';
import { Cloth } from '../cloth.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, rotZ, clamp } from '../math.js';
import { ZFY_TEEN, DEMI_GUARD, NOBLE, SKIN } from '../cast.js';
import { frameModel } from './siege.js';

export default function banner(R, args) {
  const part = args.part || 'a';
  const R0 = rng(51);
  const H = (x, z) => 0.8 * fbm2(x * 0.05, z * 0.05) + Math.max(0, -z) * 0.12;
  const g = new Geo();
  g.add(grid(200, 200, 80, 80, H, (x, z) => { const n = fbm2(x * 0.1, z * 0.1); return [0.24 + 0.04 * n, 0.25 + 0.04 * n, 0.16, 0.95]; }, null, -100, -100));
  g.add(rock(1.2, 3, [0.3, 0.29, 0.27]), translate([0, H(0, -3) - 0.2, -3]));
  if (part === 'b') {
    g.add(wallTent(4.4, 3.6, 2.0, 1.0, [0.25, 0.2, 0.15], 1.8), translate([0, H(0, -5.4), -5.4]));
    g.add(desk(1.6, 0.9, 0.8), translate([0, H(0, -6), -5.2]));
    g.add(box(1.2, 0.01, 0.7, [0.6, 0.52, 0.38, 0.9]), translate([0, H(0, -6) + 0.83, -5.2]));     // 地图
    g.add(sphere(0.08, 8, [0.4, 0.3, 0.15, 0.5], undefined, 0.8), translate([0.35, H(0, -6) + 0.88, -5.0]));   // 钱袋
    for (let k = 0; k < 4; k++) g.add(tent(3, 3, 2.6, [0.34, 0.3, 0.24]), translate([-9 + k * 6, H(-9 + k * 6, -14), -14 - (k % 2) * 3]));
  }
  const sceneM = g.upload();
  const spearM = spear().upload(), poleM = pole(8, 0.05).upload(), lanternM = lantern({ glow: 5 }).upload(), swordM = jian().upload();
  const zfy = new Actor(ZFY_TEEN, { skirt: { len: 0.92, flare: 1.8, color: ZFY_TEEN.colors.robe, color2: ZFY_TEEN.colors.robe2 }, sleeves: { width: 0.12, color: ZFY_TEEN.colors.robe, color2: ZFY_TEEN.colors.robe2 }, hair: { len: 0.45, color: ZFY_TEEN.colors.hair, nx: 4, ny: 8 } });
  // 阶下的残部：有角的、有狐耳的、看起来像人的
  const troops = [];
  for (let k = 0; k < 18; k++) {
    const kind = k % 4;
    const P = kind === 0 ? DEMI_GUARD('ox') : kind === 1 ? { ...DEMI_GUARD(null), ears: 'fox' } : kind === 2 ? DEMI_GUARD('dragon') : DEMI_GUARD(null);
    troops.push({ a: new Actor(P, {}), x: (k % 6 - 2.5) * 1.1 + (R0() - 0.5) * 0.3, z: 2.2 + Math.floor(k / 6) * 1.2, ph: R0() * 6 });
  }
  const lords = [0, 1].map((k) => new Actor(NOBLE(k ? 'ox' : null, null, [0.2, 0.18, 0.16], [0.5, 0.4, 0.2]), { skirt: { len: 0.95, flare: 1.8, color: [0.2, 0.18, 0.16], color2: [0.5, 0.4, 0.2] } }));
  let flag = null;
  const sunDir = part === 'a' ? norm([0.85, 0.16, -0.5]) : norm([0.3, 0.6, 0.5]);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.8, 0, 0.2], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const lights = [];
      const actors = [];
      if (part === 'a') {
        const top = [0, H(0, -3) + 0.9, -3];
        const J = zfy.T.body.J;
        zfy.update({ pos: add(top, [0, J.pelvis[1] - 0.02, 0]), yaw: 0, lean: [-0.04, 0, 0], head: [-0.05, 0, 0], handR: add(top, [-0.2, 1.05, 0.1]), elbowR: [-1, -0.3, 0], handL: add(top, [0.22, 0.85, 0.05]), footL: add(top, [0.12, 0.085, 0.05]), footR: add(top, [-0.14, 0.085, -0.05]) }, dt, { ...env, ground: top[1] });
        items.push({ mesh: swordM, model: frameModel(zfy.W.wristR, [-0.15, -1, 0.1]) });
        actors.push(zfy);
        // 旗：竖在她身后
        const bp = add(top, [-0.6, 0, -0.4]);
        items.push({ mesh: poleM, model: translate(bp) });
        if (!flag) flag = new Cloth(16, 11, (i, j) => add(bp, [0.05 + i * 0.22, 7.8 - j * 0.3, 0]), { colorFn: (u, v) => { const d = Math.hypot((u - 0.45) * 1.4, v - 0.5); return d < 0.24 && d > 0.17 ? [0.7, 0.55, 0.22, 0.8] : d < 0.12 ? [0.7, 0.55, 0.22, 0.8] : [0.3, 0.03, 0.03, 0.9]; }, damping: 0.975 });
        for (let j = 0; j < 11; j++) flag.setPin(0, j, add(bp, [0.05, 7.8 - j * 0.3, 0]));
        const wf = (p) => [3.2 + 1.5 * Math.sin(t * 1.7 + p[1]), 0.3 * Math.sin(t * 5 + p[0] * 3), 0.8 * Math.sin(t * 2.3 + p[0])];
        if (dt > 0) flag.step(h, { force: wf, gravity: -5, iters: 6 }); else for (let k = 0; k < 60; k++) flag.step(1 / 30, { force: wf, gravity: -5, iters: 6 });
        flag.upload(); items.push({ mesh: flag.mesh, twoSided: true });
        // 两个大人站在她身后
        lords.forEach((L, k) => { const p = add(top, [k ? 1.0 : -1.3, 0, -0.9]); const JJ = L.T.body.J; L.update({ pos: add(p, [0, JJ.pelvis[1] - 0.02, 0]), yaw: k ? -0.3 : 0.3, handL: add(p, [0.05, 0.95, 0.2]), handR: add(p, [-0.05, 0.95, 0.2]), footL: add(p, [0.1, 0.085, 0]), footR: add(p, [-0.1, 0.085, 0]) }, dt, { ...env, ground: top[1] }); actors.push(L); });
        // 残部：举矛
        for (const tr of troops) {
          const gy = H(tr.x, tr.z);
          const p = [tr.x, gy, tr.z];
          const JJ = tr.a.T.body.J;
          const raise = smoother(1.5 + tr.ph * 0.1, 2.4 + tr.ph * 0.1, t) * (0.7 + 0.3 * Math.sin(t * 3 + tr.ph));
          const hand = add(p, [-0.22, JJ.pelvis[1] + 0.15 + raise * 0.95, -0.05]);
          tr.a.update({ pos: add(p, [0, JJ.pelvis[1] - 0.02, 0]), yaw: Math.PI + tr.x * 0.04, head: [-0.25, 0, 0], handR: hand, elbowR: [0, -1, 0.3], footL: add(p, [0.12, 0.085, 0]), footR: add(p, [-0.12, 0.085, 0.06]) }, dt, { ...env, ground: gy });
          items.push({ mesh: spearM, model: translate(add(hand, [0, -0.2, 0])) });
          actors.push(tr.a);
        }
      } else {
        // 夜：帐里的人推过钱袋，指着地图；她在帐外暗处
        const tz = -6, gy0 = H(0, tz);
        const lp = [0, gy0 + 1.7, -5.2];
        items.push({ mesh: lanternM, model: translate(lp) });
        lights.push({ pos: lp, col: [2.6, 1.4, 0.6], radius: 1.7 }, { pos: [0, gy0 + 1.5, -3.6], col: [0.45, 0.24, 0.09], radius: 1.8 });
        lords.forEach((L, k) => {
          const p = [k ? 0.75 : -0.75, gy0, -5.2];
          const JJ = L.T.body.J;
          const reach = k ? smoother(1.2, 2.2, t) : smoother(3.2, 4.0, t);
          L.update({ pos: add(p, [0, JJ.pelvis[1] - 0.02, 0]), yaw: k ? -Math.PI / 2 : Math.PI / 2, lean: [0.3 + reach * 0.15, 0, 0], head: [0.3, 0, 0],
            handR: add([0, gy0 + 0.86, -5.2], [k ? 0.35 - reach * 0.3 : -0.2, 0, k ? 0.15 : -0.1 + reach * 0.15]), handL: add(p, [k ? -0.25 : 0.25, JJ.pelvis[1] + 0.0, 0.0]),
            footL: add(p, [0, 0.085, 0.1]), footR: add(p, [0, 0.085, -0.1]) }, dt, { ...env, ground: gy0 });
          actors.push(L);
        });
        const zp = [-0.9, H(-0.9, -1.6), -1.6];
        const J = zfy.T.body.J;
        zfy.update({ pos: add(zp, [0, J.pelvis[1] - 0.02, 0]), yaw: Math.PI * 0.94, lean: [0.06, 0, 0], head: [0.05, 0.15, 0], handL: add(zp, [0.2, 0.86, 0.02]), handR: add(zp, [-0.22, 0.86, 0.05]), footL: add(zp, [0.1, 0.085, 0]), footR: add(zp, [-0.1, 0.085, 0.05]) }, dt, { ...env, ground: zp[1] });
        actors.push(zfy);
      }
      for (const a of actors) items.push(...a.items());
      let cam;
      if (part === 'a') cam = { pos: keyed([[0, [args.bx ?? -1.2, args.by ?? 1.6, args.bz ?? 7.6]], [5.5, [(args.bx ?? -1.2) + 0.25, (args.by ?? 1.6) + 0.05, (args.bz ?? 7.6) - 0.8]]], t), target: [0.2, 3.3, -3.2], fov: 36, dof: { focus: 10.5, aperture: 0.04 } };
      else cam = { pos: keyed([[0, [1.9, 1.45, 1.4]], [5.5, [1.75, 1.42, 0.9]]], t), target: [0.0, 1.15, -5.0], fov: 34, dof: { focus: 5.6, aperture: 0.05 } };
      const A = part === 'a';
      return {
        cam,
        sun: { dir: sunDir, col: A ? [1.6, 0.95, 0.55] : [0.08, 0.1, 0.18], shadow: A ? { center: [0, 1.5, -1], radius: 7, soft: 2 } : null },
        amb: A ? { sky: [0.16, 0.16, 0.22], gnd: [0.1, 0.08, 0.07] } : { sky: [0.025, 0.03, 0.05], gnd: [0.015, 0.012, 0.01] }, rim: A ? [0.5, 0.3, 0.16] : [0.03, 0.03, 0.05],
        sky: A ? { top: [0.12, 0.16, 0.3], hor: [0.95, 0.5, 0.28], gnd: [0.2, 0.16, 0.14], sunDisc: [0.9996, 20, 1.2, 9], clouds: 0.6, cloudCol: [0.45, 0.25, 0.2] } : { top: [0.0, 0.004, 0.012], hor: [0.02, 0.025, 0.04], gnd: [0.01, 0.01, 0.01], stars: 0.6 },
        fog: A ? { density: 0.01, falloff: 0.1, base: 0, max: 0.8, col: [0.5, 0.35, 0.3], sunCol: [1.0, 0.5, 0.25] } : { density: 0.03, falloff: 0.1, base: 0, max: 0.8, col: [0.01, 0.012, 0.02], sunCol: [0, 0, 0] },
        lights, items, figures: figureGroups(actors),
        shafts: A ? { strength: 0.3, col: [1, 0.6, 0.35] } : null,
        grade: { exposure: A ? 0.95 : 1.1, sat: 0.9, contrast: 1.1, gain: [1.03, 0.98, 0.94], lift: [0.0, 0.0, 0.01], vignette: 0.5, grain: 0.04, bloom: 0.6 },
      };
    },
  };
}
