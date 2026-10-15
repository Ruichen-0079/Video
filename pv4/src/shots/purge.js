// 清洗：夜，负伤流派的武馆在燃烧。地上散着剑与书卷，明布川从火光里走出来，剑垂着。（设定 5.5：他联合关系网清洗了这一流派，成为一生的悔恨）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { hall, wall } from '../env.js';
import { jian } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, rotZ, rotX, clamp } from '../math.js';
import { walking, loc } from '../poses.js';
import { MBC } from '../cast.js';
import { frameModel } from './siege.js';

export default function purge(R, args) {
  const R0 = rng(71);
  const g = new Geo();
  g.add(grid(80, 80, 40, 40, () => 0, (x, z) => { const k = (Math.floor(x) + Math.floor(z)) & 1; return [0.2 + 0.02 * k, 0.19 + 0.02 * k, 0.18, 0.8]; }, null, -40, -40));
  g.add(hall(14, 6, 4.2, { bays: 5, base: 0.5, col: [0.15, 0.12, 0.1], wall: [0.3, 0.28, 0.26], roofCol: [0.08, 0.08, 0.09] }), translate([0, 0, -8]));
  g.add(wall(24, 3, { col: [0.3, 0.29, 0.28] }), translate([0, 1.5, -5.2 + 30]));
  // 地上的剑与书卷
  for (let k = 0; k < 14; k++) {
    const x = (R0() - 0.5) * 8, z = -1 - R0() * 5;
    if (R0() < 0.5) g.add(jian({ steel: [0.4, 0.4, 0.42] }), mmul(translate([x, 0.02, z]), mmul(rotY(R0() * 6.28), rotZ(Math.PI / 2))));
    else g.add(box(0.25, 0.02, 0.08 + R0() * 0.1, [0.62, 0.56, 0.44, 0.9]), mmul(translate([x, 0.01, z]), rotY(R0() * 6.28)));
  }
  const sceneM = g.upload();
  const swordM = jian().upload();
  const mbc = new Actor(MBC, { skirt: { len: 0.95, flare: 1.9, color: MBC.colors.robe, color2: MBC.colors.robe2 }, sleeves: { width: 0.12, color: MBC.colors.robe, color2: MBC.colors.robe2 } });
  const fire = new Particles(1500, 'fire', 21), smoke = new Particles(500, 'smoke', 22), embers = new Particles(500, 'ember', 23);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0, 0, 0.3], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const pose = walking(mbc.T.body.J, [0.3, 0, -3.6], 0, 0.55 * t, { stride: 0.5, lean: [0.12, 0, 0], head: [0.25, 0, 0] });
      pose.handR = loc(pose.pos, 0, [-0.24, -0.3, 0.05]); pose.handL = null;
      mbc.update(pose, dt, env);
      items.push({ mesh: swordM, model: frameModel(mbc.W.wristR, norm([-0.05, -1, 0.15])) });
      fire.spawn(h, 220, (q, r) => { q.p = [(r() - 0.5) * 14, 0.6 + r() * 6, -8 + (r() - 0.5) * 5]; q.v = [(r() - 0.5) * 0.6, 1.6 + r() * 1.6, 0.3]; q.life = 0.9 + r() * 0.5; q.size = 0.5 + r() * 0.5; q.grow = 0.3; q.col = [1, 1, 1, 0.55]; });
      smoke.spawn(h, 30, (q, r) => { q.p = [(r() - 0.5) * 12, 6 + r() * 2, -8]; q.v = [0.3, 1.5 + r(), 0.3]; q.life = 6; q.size = 2; q.grow = 1.5; q.col = [0.08, 0.07, 0.07, 0.7]; });
      embers.spawn(h, 60, (q, r) => { q.p = [(r() - 0.5) * 12, 1 + r() * 5, -7]; q.v = [(r() - 0.5) * 1.5, 1.5 + r() * 2, 1.5 + r()]; q.life = 3.5; q.size = 0.02; q.col = [1, 0.6, 0.2, 1]; q.drag = 0.3; });
      fire.step(h, () => [0, 0.5, 0.2]); smoke.step(h, () => [0.3, 0.1, 0.2]); embers.step(h, (p, q) => [Math.sin(q.seed * 30 + t) * 1.2, -0.3, 0.2]);
      const ff = (k) => 0.8 + 0.2 * Math.sin(t * 8.7 + k * 2) * Math.sin(t * 5.1 + k);
      const lights = [-4, 0, 4].map((x, k) => ({ pos: [x, 2.5, -5.5], col: [2.6 * ff(k), 1.0 * ff(k), 0.28], radius: 7 }));
      items.push(...mbc.items());
      return {
        cam: { pos: keyed([[0, [-1.4, 1.2, 3.4]], [6, [-1.2, 1.15, 3.6]]], t), target: add(mbc.W.chest, [0.3, -0.1, -1.5]), fov: 32, dof: { focus: Math.hypot(...sub([-1.3, 1.2, 3.5], mbc.W.chest)), aperture: 0.06 } },
        sun: { dir: norm([0.2, 0.6, -0.8]), col: [0.06, 0.07, 0.12] },
        amb: { sky: [0.02, 0.022, 0.035], gnd: [0.02, 0.012, 0.008] }, rim: [0.1, 0.04, 0.02],
        sky: { top: [0.004, 0.005, 0.01], hor: [0.1, 0.035, 0.015], gnd: [0.02, 0.01, 0.01], stars: 0.2 },
        fog: { density: 0.025, falloff: 0.1, max: 0.8, col: [0.06, 0.025, 0.015], sunCol: [0, 0, 0] },
        lights, items, figures: figureGroups([mbc]), particles: [smoke, fire, embers],
        grade: { exposure: 1.05, sat: 0.9, contrast: 1.15, gain: [1.03, 0.97, 0.92], vignette: 0.6, grain: 0.05, bloom: 0.75, bloomThresh: 0.9 },
      };
    },
  };
}
