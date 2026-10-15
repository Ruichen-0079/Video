// 现代（序）：夜。床的另一半空着；他站在窗前，楼下车灯流过；写字桌上，是她留下的信纸和一杯冒着热气的水。
// part a：从屋里看他的背影与窗外；part b：桌上的信
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, cylinder } from '../mesh.js';
import { desk } from '../env.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY } from '../math.js';
import { stand, loc } from '../poses.js';
import { MBC_MODERN } from '../cast.js';

export default function modern(R, args) {
  const part = args.part || 'a';
  const R0 = rng(111);
  const g = new Geo();
  g.add(grid(12, 12, 6, 6, () => 0, () => [0.12, 0.1, 0.09, 0.4], null, -6, -6));
  // 墙与大窗：窗外是城市（远处的楼与亮着的窗）
  g.add(box(8, 0.8, 0.2, [0.2, 0.2, 0.21, 0.8]), translate([0, 0.4, -2.5]));
  g.add(box(8, 0.5, 0.2, [0.2, 0.2, 0.21, 0.8]), translate([0, 2.75, -2.5]));
  for (const x of [-3.5, -1.2, 1.2, 3.5]) g.add(box(0.12, 2.2, 0.16, [0.15, 0.15, 0.16, 0.6]), translate([x, 1.6, -2.5]));
  g.add(box(0.2, 3, 6, [0.2, 0.19, 0.19, 0.9]), translate([-3.6, 1.5, 0.5]));
  // 远处的楼（自发光窗点）
  for (let k = 0; k < 40; k++) {
    const x = (R0() - 0.5) * 120, z = -25 - R0() * 80, w = 6 + R0() * 10, hh = 15 + R0() * 50;
    g.add(box(w, hh, 6, [0.04, 0.045, 0.06, 0.6]), translate([x, hh / 2 - 12, z]));
    for (let q = 0; q < 14; q++) if (R0() < 0.6) g.add(box(0.8, 0.5, 0.1, [1, 0.8, 0.55, 0.9], [2.5 + R0() * 3, 0, 0, 1]), translate([x + (R0() - 0.5) * w * 0.8, -10 + R0() * hh * 0.95, z + 3.05]));
  }
  // 床、书桌、信、杯子
  g.add(box(1.8, 0.45, 2.1, [0.5, 0.5, 0.52, 0.9]), translate([-2.3, 0.22, 0.8]));
  g.add(box(0.75, 0.12, 0.5, [0.7, 0.7, 0.72, 0.9]), translate([-2.75, 0.5, -0.05]));
  g.add(desk(1.3, 0.6, 0.75, [0.16, 0.12, 0.1]), translate([1.9, 0, -1.6]));
  g.add(box(0.21, 0.004, 0.29, [0.85, 0.83, 0.78, 0.9]), mmul(translate([1.75, 0.783, -1.55]), rotY(0.25)));
  g.add(box(0.21, 0.004, 0.29, [0.82, 0.8, 0.75, 0.9]), mmul(translate([1.8, 0.786, -1.6]), rotY(-0.1)));
  g.add(cylinder(0.035, 0.03, 0.11, 14, [0.6, 0.65, 0.7, 0.05]), translate([2.15, 0.78, -1.5]));
  const sceneM = g.upload();
  const him = new Actor(MBC_MODERN, {});
  const steam = new Particles(200, 'smoke', 113);
  const cars = new Particles(300, 'ember', 114);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const items = [{ mesh: sceneM }];
      him.update(stand(him.T.body.J, [-0.2, 0, -1.8], Math.PI, { head: [0.12, 0.05, 0], handL: [0.12, 0.85, 0.05], handR: [-0.2, 0.9, 0.0] }), dt, { t });
      steam.spawn(h, 12, (q, r) => { q.p = [2.15 + (r() - 0.5) * 0.04, 0.9, -1.5]; q.v = [(r() - 0.5) * 0.02, 0.06, 0]; q.life = 3; q.size = 0.015; q.grow = 1.8; q.col = [0.8, 0.8, 0.82, 0.06]; q.drag = 0.5; });
      steam.step(h, (p, q) => [Math.sin(t * 2 + q.seed * 9) * 0.03, 0.01, 0]);
      // 楼下的车灯：从街的这边驶来，那一边逝去
      cars.spawn(h, 6, (q, r) => { const dir = r() < 0.5 ? 1 : -1; q.p = [-60 * dir, -12, -18 - r() * 3]; q.v = [14 * dir, 0, 0]; q.life = 9; q.size = 0.25; q.col = dir > 0 ? [1, 0.75, 0.45, 1] : [1, 0.12, 0.08, 1]; });
      cars.step(h);
      items.push(...him.items());
      const cam = part === 'a' ? { pos: keyed([[0, [1.2, 1.5, 2.6]], [6, [0.9, 1.5, 2.2]]], t), target: [-0.3, 1.2, -3], fov: 38, dof: { focus: 4.3, aperture: 0.04 } }
        : { pos: keyed([[0, [2.6, 1.2, -0.9]], [5, [2.45, 1.15, -1.0]]], t), target: [1.85, 0.8, -1.55], fov: 30, dof: { focus: 1.1, aperture: 0.12, maxR: 9 } };
      return {
        cam, sun: { dir: norm([0.2, 0.3, 1]), col: [0.05, 0.06, 0.09] }, amb: { sky: [0.03, 0.035, 0.05], gnd: [0.02, 0.02, 0.025] }, rim: [0.1, 0.09, 0.08],
        lights: [{ pos: [0, 0.5, -4], col: [0.8, 0.55, 0.35], radius: 4.5 }, { pos: [1.6, 1.4, -1.0], col: [0.25, 0.22, 0.2], radius: 1.6 }],
        sky: { top: [0.01, 0.012, 0.03], hor: [0.12, 0.08, 0.08], gnd: [0.02, 0.02, 0.02] },
        fog: { density: 0.006, falloff: 0.0, max: 0.6, col: [0.08, 0.06, 0.06], sunCol: [0, 0, 0] },
        items, figures: figureGroups([him]), particles: [steam, cars],
        grade: { exposure: 1.25, sat: 0.75, contrast: 1.12, gain: [1.0, 0.98, 0.95], lift: [0.0, 0.004, 0.012], vignette: 0.55, grain: 0.05, bloom: 0.8, bloomThresh: 0.7 },
      };
    },
  };
}
