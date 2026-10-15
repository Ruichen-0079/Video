// 黄泉：一条黑色的、静止的河；远处两道光柱是门，门前立着守门人。他沿着河走过去（a）；然后在河边躺下，沉睡（b）。（设定 8.2 / 9.2）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, cylinder } from '../mesh.js';
import { waterGrid } from '../renderer.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, translate, qaxis, qmul } from '../math.js';
import { walking, stand, loc } from '../poses.js';
import { MBC } from '../cast.js';

export default function huangquan(R, args) {
  const part = args.part || 'a';
  const g = new Geo();
  g.add(grid(300, 300, 80, 80, (x, z) => (x < -1.5 ? 0.12 + 0.05 * fbm2(x * 0.3, z * 0.3) : -0.4), () => [0.06, 0.055, 0.05, 0.6], null, -150, -150));
  // 门：两道光柱
  for (const sx of [-1, 1]) g.add(cylinder(0.35, 0.35, 40, 16, [0.9, 0.85, 0.75, 0.5], [12, 0, 0, 1], false), translate([6 + sx * 3.2, -1, -60]));
  const sceneM = g.upload();
  const water = waterGrid(400, 400, 160, 160, -200, -200);
  const mbc = new Actor(MBC, { skirt: { len: 0.95, flare: 1.9, color: MBC.colors.robe, color2: MBC.colors.robe2 }, sleeves: { width: 0.12, color: MBC.colors.robe, color2: MBC.colors.robe2 } });
  const keeper = new Actor({ height: 6.5, sex: 'm', hair: 'none', sleeve: 'wide', cell: 0.06, face: false, tunic: 0.95, colors: { skin: [0.02, 0.02, 0.025], robe: [0.015, 0.015, 0.02], robe2: [0.02, 0.02, 0.025], inner: [0.02, 0.02, 0.02], hair: [0.02, 0.02, 0.02], belt: [0.03, 0.03, 0.03], shoe: [0.02, 0.02, 0.02] } }, {});
  const motes = new Particles(400, 'dust', 61);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0, 0, 0], t, ground: 0.12 };
      const items = [{ mesh: sceneM }];
      const kJ = keeper.T.body.J;
      keeper.update(stand(kJ, [6, -0.4, -52], 0, { head: [0.1, 0, 0] }), dt, env);
      let cam;
      if (part === 'a') {
        const pose = walking(mbc.T.body.J, [-2.2, 0.12, -2], Math.PI * 0.96, 0.5 * t, { lean: [0.05, 0, 0] });
        mbc.update(pose, dt, env);
        cam = { pos: keyed([[0, [-0.6, 1.2, 4.5]], [5, [-0.8, 1.15, 3.6]]], t), target: [1.5, 1.6, -30], fov: 34, dof: { focus: 6.5, aperture: 0.03 } };
      } else {
        // 躺下：身体沿 z，头朝 -z
        const lie = smoother(0.3, 2.4, t);
        const o = [-2.4, 0.12, -1.5];
        const J = mbc.T.body.J;
        if (lie < 0.5) {
          const k = lie * 2;
          mbc.update({ pos: add(o, [0, J.pelvis[1] - 0.02 - k * 0.45, 0]), yaw: Math.PI * 0.5, lean: [0.2 + k * 0.4, 0, 0], head: [0.3, 0, 0], footL: loc(o, Math.PI * 0.5, [0.12, J.ankleL[1], 0.3 * k]), footR: loc(o, Math.PI * 0.5, [-0.12, J.ankleL[1], 0.3 * k]), handL: loc(o, Math.PI * 0.5, [0.25, 0.5, 0.25]), handR: loc(o, Math.PI * 0.5, [-0.25, 0.5, 0.25]) }, dt, env);
        } else {
          const k = (lie - 0.5) * 2;
          const q = qmul(qaxis([1, 0, 0], -Math.PI / 2 * k), qaxis([0, 1, 0], Math.PI * 0.5));
          const pel = add(o, [0, lerp(J.pelvis[1] - 0.47, 0.11, k), 0]);
          mbc.update({ pos: pel, rootQ: q, lean: [0.6 * (1 - k), 0, 0], head: [0, 0, 0], handL: add(pel, [0.15, 0.1, -0.05]), handR: add(pel, [-0.15, 0.1, -0.05]), footL: add(pel, [0.85, -0.05, 0.08]), footR: add(pel, [0.85, -0.05, -0.08]), kneeL: [0, 1, 0], kneeR: [0, 1, 0] }, dt, env);
        }
        cam = { pos: keyed([[0, [-0.2, 1.6, 2.4]], [5, [-0.4, 2.0, 2.2]]], t), target: [-2.4, 0.3, -1.6], fov: 34, dof: { focus: 4, aperture: 0.04 } };
      }
      motes.spawn(h, 25, (q, r) => { q.p = [(r() - 0.5) * 20, r() * 6, -r() * 30]; q.v = [0, 0.03, 0]; q.life = 8; q.size = 0.01; q.col = [0.8, 0.8, 0.9, 0.4]; });
      motes.step(h);
      const dim = part === 'b' ? 1 - 0.5 * smooth(2, 5, t) : 1;
      items.push(...mbc.items());
      return {
        cam, sun: { dir: norm([0.2, 0.3, -1]), col: mul([0.5, 0.48, 0.45], dim), shadow: { center: [-2, 0.5, -2], radius: 4, soft: 3 } },
        amb: { sky: [0.02, 0.022, 0.03], gnd: [0.01, 0.01, 0.012] }, rim: mul([0.25, 0.24, 0.22], dim),
        sky: { top: [0.0, 0.0, 0.005], hor: [0.02, 0.02, 0.025], gnd: [0, 0, 0] },
        fog: { density: 0.015, falloff: 0.05, max: 0.9, col: [0.015, 0.015, 0.02], sunCol: mul([0.3, 0.28, 0.24], dim) },
        water: { mesh: water, y: 0, waves: [[0.2, 1, 0.004, 4], [0.7, 1, 0.002, 2]], deep: [0.0, 0.0, 0.005], shallow: [0.01, 0.01, 0.015], shore: [-5, 0, 1, 0], foam: 0 },
        items, figures: figureGroups([mbc, keeper]), particles: [motes],
        shafts: { strength: 0.4 * dim, pos: [6, 8, -60], col: [1, 0.95, 0.85] },
        grade: { exposure: 1.2, sat: 0.4, contrast: 1.15, gain: [1.0, 1.0, 1.02], vignette: 0.6, grain: 0.05, bloom: 0.8, bloomThresh: 0.8 },
      };
    },
  };
}
