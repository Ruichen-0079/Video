// 负伤流派：断了左臂的那个人站在台上，左袖空着；下面一排排弟子把左手缚在背后，单手出剑。（设定 5.5）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { wall, hall } from '../env.js';
import { jian } from '../props.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, clamp } from '../math.js';
import { swordForm, stand, loc } from '../poses.js';
import { VILLAGER } from '../cast.js';
import { GENIUS } from './duel.js';
import { frameModel } from './siege.js';

export default function school(R, args) {
  const g = new Geo();
  g.add(grid(80, 80, 40, 40, () => 0, (x, z) => { const k = (Math.floor(x / 1.0) + Math.floor(z / 1.0)) & 1; return [0.38 + 0.03 * k, 0.35 + 0.03 * k, 0.31, 0.85]; }, null, -40, -40));
  g.add(box(5, 0.5, 2.4, [0.4, 0.39, 0.37, 0.85]), translate([0, 0.25, -4.2]));
  const wc = { col: [0.46, 0.42, 0.36] };
  g.add(wall(24, 3, wc), translate([0, 1.5, -7])); g.add(wall(18, 3, wc), mmul(translate([-10, 1.5, 0]), rotY(Math.PI / 2))); g.add(wall(18, 3, wc), mmul(translate([10, 1.5, 0]), rotY(Math.PI / 2)));
  g.add(hall(14, 6, 4.2, { bays: 5, base: 0.5, col: [0.22, 0.2, 0.19], wall: [0.45, 0.44, 0.42], roofCol: [0.12, 0.12, 0.13] }), translate([0, 0, -10.5]));
  const sceneM = g.upload();
  const swordM = jian().upload();
  const master = new Actor({ ...GENIUS, tunic: 0.92 }, { amputateL: true, sleeves: { width: 0.13, color: GENIUS.colors.robe, color2: GENIUS.colors.robe2 } });
  const students = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) students.push({ a: new Actor({ ...VILLAGER(c + r, 'm'), colors: { ...VILLAGER(0, 'm').colors, robe: [0.3, 0.3, 0.31], robe2: [0.2, 0.2, 0.21] } }, {}), o: [(c - 2) * 1.5, 0, -1.2 + r * 1.5], d: (c + r) * 0.04 });
  return {
    frame(t, dt) {
      const env = { wind: [0.2, 0, 0], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const u = (t * 0.42) % 1.0;
      // 师父：台上，左袖空垂，右手持剑做示范
      {
        const o = [0, 0.5, -4.2];
        const { pose, swordDir } = swordForm(master.T.body.J, o, 0, clamp(u * 1.1), {});
        pose.handL = null;
        master.update(pose, dt, { ...env, ground: 0.5 });
        items.push({ mesh: swordM, model: frameModel(master.W.wristR, swordDir) });
      }
      // 弟子：左手缚在背后，单手出剑，整齐划一
      for (const s of students) {
        const { pose, swordDir } = swordForm(s.a.T.body.J, s.o, Math.PI, clamp(u * 1.1 - 0.06 - s.d));
        pose.handL = loc(s.o, Math.PI, [0.02, 0.98, -0.2]); pose.elbowL = loc([0, 0, 0], Math.PI, [1, 0, -1]);
        pose.yaw = Math.PI; pose.pos = loc(s.o, Math.PI, [0, s.a.T.body.J.pelvis[1] - 0.02, 0]);
        s.a.update(pose, dt, env);
        items.push({ mesh: swordM, model: frameModel(s.a.W.wristR, swordDir) });
      }
      for (const a of [master, ...students.map((s) => s.a)]) items.push(...a.items());
      // 高机位，在台子的侧后方：近处是断臂的师父，下面一排排弟子迎着斜阳，影子拖得很长
      const C = args.c || [4.3, 3.7, -6.65, -0.6, 0.55, -0.4, 32];
      return {
        cam: { pos: keyed([[0, [C[0], C[1], C[2]]], [5, [C[0] - 0.5, C[1] - 0.1, C[2] + 0.05]]], t), target: [C[3], C[4], C[5]], fov: C[6], dof: { focus: 6.5, aperture: 0.035 } },
        sun: { dir: norm([0.75, 0.22, -0.55]), col: [1.7, 1.12, 0.66], shadow: { center: [0, 1, -1.5], radius: 8, soft: 2.5 } },
        amb: { sky: [0.13, 0.13, 0.16], gnd: [0.07, 0.06, 0.05] }, rim: [0.45, 0.28, 0.14],
        sky: { top: [0.22, 0.26, 0.38], hor: [0.9, 0.62, 0.4], gnd: [0.3, 0.26, 0.22], clouds: 0.5, cloudCol: [0.7, 0.5, 0.38] },
        fog: { density: 0.014, falloff: 0.12, max: 0.6, col: [0.55, 0.42, 0.32], sunCol: [0.9, 0.55, 0.25] },
        items, figures: figureGroups([master, ...students.map((s) => s.a)]),
        grade: { exposure: 0.95, sat: 0.75, contrast: 1.12, gain: [1.03, 1.0, 0.95], lift: [0.005, 0.004, 0.006], vignette: 0.5, grain: 0.04, bloom: 0.5 },
      };
    },
  };
}
