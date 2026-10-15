// 剑圣堂：一排牌位，烛火。镜头沿着牌位走到尽头——站在暗处的，是同一个人。（设定 4.3 / 9.2：借历代剑圣的传承隐藏身份）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { tablets, corridor } from '../env.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, translate, mmul, rotY } from '../math.js';
import { stand } from '../poses.js';
import { MBC } from '../cast.js';

export default function tabletsShot(R, args) {
  const n = 9, sp = 0.62;
  const g = new Geo();
  g.add(grid(30, 30, 10, 10, () => 0, () => [0.08, 0.06, 0.05, 0.3], null, -15, -15));
  const tb = tablets(n, sp);
  g.add(tb.geo, translate([-((n - 1) * sp) / 2, 0, -1.2]));
  g.add(box(12, 4, 0.2, [0.12, 0.06, 0.05, 0.8]), translate([0, 2, -1.8]));
  const sceneM = g.upload();
  const mbc = new Actor(MBC, { skirt: { len: 0.95, flare: 1.9, color: MBC.colors.robe, color2: MBC.colors.robe2 }, sleeves: { width: 0.12, color: MBC.colors.robe, color2: MBC.colors.robe2 } });
  const flames = new Particles(400, 'fire', 41);
  const fl = tb.flames.map((p) => add(p, [-((n - 1) * sp) / 2, 0, -1.2]));
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0, 0, 0], t, ground: 0 };
      const end = [((n - 1) * sp) / 2 + 1.1, 0, -0.3];
      mbc.update(stand(mbc.T.body.J, add(end, [0.5, 0, -0.4]), -Math.PI * 0.62, { head: [0.15, 0.1, 0], handL: [0.06, 0.95, 0.18], handR: [-0.06, 0.95, 0.18] }), dt, env);
      for (const p of fl) flames.spawn(h, 6, (q, r) => { q.p = add(p, [0, 0.01, 0]); q.v = [(r() - 0.5) * 0.02, 0.12, 0]; q.life = 0.35; q.size = 0.018; q.grow = -0.3; q.col = [1, 1, 1, 0.9]; });
      flames.step(h);
      const lights = fl.filter((_, k) => k % 2 === 0).map((p, k) => ({ pos: add(p, [0, 0.06, 0]), col: [0.9 * (0.9 + 0.1 * Math.sin(t * 9 + k)), 0.5, 0.18], radius: 0.9 }));
      lights.push({ pos: add(end, [-0.4, 1.4, 0.6]), col: [0.35, 0.2, 0.08], radius: 1.6 });
      const cx = keyed([[0, [-((n - 1) * sp) / 2 - 0.4]], [6, [((n - 1) * sp) / 2 + 0.2]]], t)[0];
      return {
        cam: { pos: [cx, 1.2, 1.05], target: [cx + 0.9, 1.08, -1.1], fov: 34, dof: { focus: 1.9, aperture: 0.08 } },
        sun: { dir: [0, 1, 0], col: [0, 0, 0] },
        amb: { sky: [0.012, 0.01, 0.01], gnd: [0.008, 0.006, 0.005] }, rim: [0.02, 0.012, 0.006],
        sky: { top: [0, 0, 0], hor: [0, 0, 0], gnd: [0, 0, 0] },
        fog: { density: 0.05, falloff: 0, max: 0.8, col: [0.01, 0.006, 0.004], sunCol: [0, 0, 0] },
        lights, items: [{ mesh: sceneM }, ...mbc.items()], figures: figureGroups([mbc]), particles: [flames],
        grade: { exposure: 1.4, sat: 0.9, contrast: 1.12, gain: [1.04, 0.98, 0.9], vignette: 0.6, grain: 0.05, bloom: 0.7, bloomThresh: 0.5 },
      };
    },
  };
}
