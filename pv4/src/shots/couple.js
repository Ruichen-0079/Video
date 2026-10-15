// 老人与妻子：雪后的院子，一树梅花。两人对练同一套武学，一攻一守，彼此护住。（设定 9.3：武学与妻子共同发展，重保护）
// part b：多年以后，雪还在下，他一个人练同一套。
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { wall, house, plumTree } from '../env.js';
import { jian } from '../props.js';
import { flowerField } from '../renderer.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, clamp } from '../math.js';
import { swordForm, loc } from '../poses.js';
import { OLD, OLD_MID, WIFE } from '../cast.js';
import { frameModel } from './siege.js';

export default function couple(R, args) {
  const part = args.part || 'a';
  const g = new Geo();
  g.add(grid(60, 60, 60, 60, (x, z) => 0.02 * fbm2(x, z), (x, z) => { const n = fbm2(x * 0.5, z * 0.5); return part === 'a' ? [0.4 + 0.04 * n, 0.37 + 0.04 * n, 0.32, 0.85] : [0.82 + 0.05 * n, 0.83 + 0.05 * n, 0.86, 0.6]; }, null, -30, -30));
  const wcol = { col: part === 'a' ? [0.44, 0.39, 0.33] : [0.58, 0.54, 0.48] };
  g.add(wall(14, 2.4, wcol), translate([0, 1.2, -4.5]));
  g.add(wall(10, 2.4, wcol), mmul(translate([-6, 1.2, 0]), rotY(Math.PI / 2)));
  g.add(house(6, 3.6, 2.8, { wall: [0.5, 0.46, 0.4], roofCol: [0.2, 0.2, 0.22] }), mmul(translate([5.2, 0, -1.5]), rotY(-Math.PI / 2)));
  const tree = plumTree(9, { h: 3.2 });
  g.add(tree.geo, translate([-2.6, 0, -2.6]));
  const sceneM = g.upload();
  const blossoms = flowerField(tree.blossoms.length, (i) => ({ a: [tree.blossoms[i].p[0] - 2.6, tree.blossoms[i].p[1], tree.blossoms[i].p[2] - 2.6, tree.blossoms[i].s * 2.4], b: [0.85, 0.1, 0.14, i / 100] }));
  const swordM = jian().upload();
  const P1 = part === 'a' ? OLD_MID : OLD;
  const him = new Actor(P1, { skirt: { len: 0.95, flare: 1.9, color: P1.colors.robe, color2: P1.colors.robe2 }, sleeves: { width: 0.13, color: P1.colors.robe, color2: P1.colors.robe2 } });
  const her = new Actor(WIFE, { skirt: { len: 0.95, flare: 1.9, color: WIFE.colors.robe, color2: WIFE.colors.robe2 }, sleeves: { width: 0.13, color: WIFE.colors.robe, color2: WIFE.colors.robe2 } });
  const snow = new Particles(1500, part === 'a' ? 'petal' : 'snow', 31);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.1, 0, 0.05], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const u = clamp((t - 0.3) / 3.6);
      const actors = [him];
      // 他：同一套剑式
      const oy = part === 'a' ? 0.6 : Math.PI / 2 + 0.3;
      const ohim = part === 'a' ? [-0.18, 0, 0.12] : [0, 0, 0.1];
      { const { pose, swordDir } = swordForm(him.T.body.J, ohim, oy, u); if (part === 'b') pose.lean[0] += 0.08; him.update(pose, dt, env); items.push({ mesh: swordM, model: frameModel(him.W.wristR, swordDir) }); }
      // 她：镜像的一式，护在他身侧
      if (part === 'a') {
        const { pose, swordDir } = swordForm(her.T.body.J, [0.18, 0, -0.12], 0.6 + Math.PI, clamp(u));
        her.update(pose, dt, env); items.push({ mesh: swordM, model: frameModel(her.W.wristR, swordDir) }); actors.push(her);
      }
      if (part === 'a') snow.spawn(h, 14, (q, r) => { q.p = [-2.6 + (r() - 0.5) * 3, 2.4 + r(), -2.6 + (r() - 0.5) * 3]; q.v = [0.35, -0.35 - r() * 0.2, 0.25]; q.life = 8; q.size = 0.018; q.col = [0.95, 0.55, 0.6, 0.9]; });
      else snow.spawn(h, 260, (q, r) => { q.p = [(r() - 0.5) * 10, 4, (r() - 0.5) * 8]; q.v = [0.15, -0.6 - r() * 0.3, 0]; q.life = 7; q.size = 0.012 + r() * 0.01; q.col = [1, 1, 1, 0.8]; });
      snow.step(h, (p, q) => [Math.sin(t * 0.7 + q.seed * 20) * 0.2, 0, Math.cos(t * 0.5 + q.seed * 13) * 0.15]);
      for (const a of actors) items.push(...a.items());
      const A = part === 'a';
      return {
        cam: A ? { pos: keyed([[0, [3.6, 1.25, 3.4]], [4.5, [3.2, 1.25, 2.8]]], t), target: [-0.3, 1.15, -0.3], fov: 34, dof: { focus: 4.6, aperture: 0.05 } } : { pos: keyed([[0, [2.4, 1.2, 5.4]], [4.5, [2.1, 1.25, 4.9]]], t), target: [-0.6, 1.2, -0.6], fov: 32, dof: { focus: 5.3, aperture: 0.05 } },
        // a：暖的春日午后，两个人；b：同一个院子，雪，一个人（冷）
        sun: A ? { dir: norm([0.75, 0.28, 0.45]), col: [1.65, 1.15, 0.7], shadow: { center: [0, 1, 0], radius: 5, soft: 2.5 } } : { dir: norm([0.4, 0.6, 0.5]), col: [0.35, 0.4, 0.55], shadow: { center: [0, 1, 0], radius: 5, soft: 4 } },
        amb: A ? { sky: [0.12, 0.12, 0.15], gnd: [0.08, 0.07, 0.06] } : { sky: [0.1, 0.11, 0.15], gnd: [0.14, 0.15, 0.18] }, rim: A ? [0.45, 0.3, 0.16] : [0.08, 0.09, 0.12],
        sky: A ? { top: [0.28, 0.36, 0.52], hor: [0.95, 0.74, 0.52], gnd: [0.3, 0.27, 0.23], clouds: 0.45, cloudCol: [0.85, 0.65, 0.5] } : { top: [0.12, 0.15, 0.22], hor: [0.34, 0.37, 0.44], gnd: [0.4, 0.42, 0.46], clouds: 0.9, cloudCol: [0.3, 0.32, 0.37] },
        fog: A ? { density: 0.02, falloff: 0.1, max: 0.6, col: [0.7, 0.58, 0.46], sunCol: [1.0, 0.7, 0.35] } : { density: 0.055, falloff: 0.1, max: 0.8, col: [0.3, 0.33, 0.4], sunCol: [0, 0, 0] },
        items, figures: figureGroups(actors), flowers: blossoms, particles: [snow],
        grade: A ? { exposure: 0.95, sat: 0.9, contrast: 1.12, gain: [1.04, 1.0, 0.94], lift: [0.006, 0.004, 0.004], vignette: 0.5, grain: 0.035, bloom: 0.55 } : { exposure: 0.95, sat: 0.45, contrast: 1.12, gain: [0.96, 1.0, 1.05], lift: [0.0, 0.006, 0.016], vignette: 0.55, grain: 0.04, bloom: 0.4 },
      };
    },
  };
}
