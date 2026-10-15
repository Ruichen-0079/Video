// 武学的传承：同一个招式，三个时代。
// era 0：黄昏的荒地，一个人拿木棍比划这一式；era 1：院子里，师父做，三个弟子跟着做；
// era 2：雨夜，后世的剑客做这一式——剑弧扫过之处，雨被分开。（设定 5.1：招式经明悟、想象与传承成为真实）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, cylinder } from '../mesh.js';
import { wall, house } from '../env.js';
import { jian, lantern } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, clamp, cross, dot, len } from '../math.js';
import { swordForm, stand, loc } from '../poses.js';
import { SKIN, VILLAGER } from '../cast.js';
import { frameModel } from './siege.js';

export default function lineage(R, args) {
  const era = args.era ?? 0;
  const g = new Geo();
  if (era === 0) g.add(grid(200, 200, 60, 60, (x, z) => 0.3 * fbm2(x * 0.05, z * 0.05), (x, z) => [0.3, 0.27, 0.18, 0.95], null, -100, -100));
  else {
    g.add(grid(60, 60, 30, 30, () => 0, (x, z) => { const k = (Math.floor(x / 0.8) + Math.floor(z / 0.8)) & 1; return era === 2 ? [0.1 + 0.02 * k, 0.1 + 0.02 * k, 0.11, 0.25] : [0.42 + 0.03 * k, 0.4 + 0.03 * k, 0.36, 0.85]; }, null, -30, -30));
    const wc = era === 2 ? { col: [0.14, 0.13, 0.12] } : { col: [0.5, 0.45, 0.38] };
    g.add(wall(16, 2.6, wc), translate([0, 1.3, -5]));
    g.add(wall(12, 2.6, wc), mmul(translate([-7, 1.3, 0]), rotY(Math.PI / 2)));
    g.add(wall(12, 2.6, wc), mmul(translate([7, 1.3, 0]), rotY(Math.PI / 2)));
    g.add(house(8, 4, 3.2, { wall: era === 2 ? [0.12, 0.11, 0.1] : [0.45, 0.4, 0.33] }), translate([0, 0, -7.5]));
  }
  const sceneM = g.upload();
  const swordM = jian().upload();
  const stickM = cylinder(0.014, 0.012, 0.9, 6, [0.32, 0.22, 0.12, 0.8]).upload();
  const P0 = { height: 1.7, sex: 'm', hair: 'short', sleeve: 'narrow', tunic: 0.55, colors: { skin: SKIN.tan, robe: [0.34, 0.3, 0.24], robe2: [0.26, 0.22, 0.18], inner: [0.3, 0.26, 0.2], hair: [0.05, 0.04, 0.04], belt: [0.2, 0.16, 0.12], shoe: [0.2, 0.16, 0.12] } };
  const MASTER = { height: 1.72, sex: 'm', hair: 'topknot', sleeve: 'wide', beard: 0.5, colors: { skin: SKIN.warm, robe: [0.3, 0.28, 0.24], robe2: [0.6, 0.56, 0.48], inner: [0.75, 0.72, 0.66], hair: [0.25, 0.24, 0.22], belt: [0.2, 0.16, 0.12], shoe: [0.08, 0.06, 0.05] } };
  const LATER = { height: 1.76, sex: 'm', hair: 'topknot', sleeve: 'wide', colors: { skin: SKIN.warm, robe: [0.12, 0.16, 0.2], robe2: [0.55, 0.58, 0.6], inner: [0.75, 0.74, 0.72], hair: [0.04, 0.04, 0.04], belt: [0.08, 0.08, 0.1], shoe: [0.05, 0.05, 0.05] } };
  const actors = [];
  if (era === 0) actors.push({ a: new Actor(P0, {}), o: [0, 0, 0], yaw: 0.4, d: 0 });
  if (era === 1) {
    actors.push({ a: new Actor(MASTER, { skirt: { len: 0.95, flare: 1.9, color: MASTER.colors.robe, color2: MASTER.colors.robe2 }, sleeves: { width: 0.13, color: MASTER.colors.robe, color2: MASTER.colors.robe2 } }), o: [0, 0, -1.6], yaw: 0, d: 0 });
    for (let k = 0; k < 3; k++) { const P = VILLAGER(k, 'm'); actors.push({ a: new Actor(P, {}), o: [(k - 1) * 1.6, 0, 1.2], yaw: Math.PI, d: 0.35 + k * 0.08 }); }
  }
  if (era === 2) actors.push({ a: new Actor(LATER, { skirt: { len: 0.95, flare: 1.9, color: LATER.colors.robe, color2: LATER.colors.robe2 }, sleeves: { width: 0.14, color: LATER.colors.robe, color2: LATER.colors.robe2 } }), o: [0, 0, 0], yaw: 0.5, d: 0 });
  const rain = new Particles(2500, 'rain', 13);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.2, 0, 0.1], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const dur = 3.0;
      let arc = null;
      for (const ac of actors) {
        const u = clamp((t - 0.25 - ac.d) / (dur - 0.6));
        const { pose, swordDir } = swordForm(ac.a.T.body.J, add(ac.o, [0, era === 0 ? 0.3 * fbm2(ac.o[0] * 0.05, ac.o[2] * 0.05) : 0, 0]), ac.yaw, u);
        ac.a.update(pose, dt, env);
        items.push({ mesh: era === 0 ? stickM : swordM, model: frameModel(ac.a.W.wristR, swordDir) });
        if (!arc) arc = { p: ac.a.W.wristR, d: swordDir, u };
      }
      // era 2：雨。剑尖扫过的地方，雨滴被推开
      if (era === 2) {
        const cp = [2.2, 1.6, 4.0];
        rain.spawn(h, 2600, (q, r) => { q.p = [(r() - 0.5) * 5, 4 + r() * 2, -1.8 + (r() - 0.5) * 3.4]; q.v = [0.2, -8.5 - r(), 0.2]; q.life = 0.9; q.size = 0.0025; q.col = [0.55, 0.6, 0.7, 0.4]; });
        const tip = add(arc.p, mul(arc.d, 0.75));
        rain.step(h, (p, q) => {
          // 沿剑身（握点→剑尖）的一段距离：近了就被推开
          const a = arc.p, b = tip; const ab = sub(b, a), tt = clamp(dot(sub(p, a), ab) / dot(ab, ab)); const c = add(a, mul(ab, tt));
          const d = sub(p, c), dl = len(d);
          const on = smooth(0.3, 0.45, arc.u) * (1 - smooth(0.85, 0.95, arc.u));
          if (dl < 1.0 && on > 0) return mul(d, (on * 900) / Math.max(dl, 0.05));
          return [0, 0, 0];
        });
      }
      for (const ac of actors) items.push(...ac.a.items());
      const A = actors[0].a;
      let cam, look;
      if (era === 0) cam = { pos: [2.6, 1.0, 3.6], target: [0, 1.1, 0], fov: 32, dof: { focus: 4.4, aperture: 0.05 } };
      else if (era === 1) cam = { pos: keyed([[0, [5.8, 1.2, 4.2]], [3, [5.4, 1.2, 3.7]]], t), target: [-0.3, 1.1, -0.4], fov: 32, dof: { focus: 6.8, aperture: 0.04 } };
      else cam = { pos: [3.4, 1.1, 5.2], target: [0.0, 1.35, -0.3], fov: 30, dof: { focus: 6.2, aperture: 0.03 } };
      const S = [
        { sun: { dir: norm([-0.8, 0.12, -0.5]), col: [1.6, 0.85, 0.45] }, amb: { sky: [0.14, 0.12, 0.16], gnd: [0.1, 0.07, 0.05] }, rim: [0.5, 0.25, 0.12], sky: { top: [0.12, 0.12, 0.25], hor: [0.95, 0.45, 0.22], gnd: [0.2, 0.15, 0.1], sunDisc: [0.9996, 20, 1.0, 8], clouds: 0.5, cloudCol: [0.45, 0.22, 0.15] }, fog: { density: 0.01, falloff: 0.1, max: 0.8, col: [0.45, 0.3, 0.25], sunCol: [1, 0.5, 0.2] }, grade: { exposure: 1.0, sat: 0.9 } },
        { sun: { dir: norm([-0.55, 0.2, -0.8]), col: [1.7, 1.1, 0.6] }, amb: { sky: [0.08, 0.085, 0.11], gnd: [0.05, 0.04, 0.035] }, rim: [0.6, 0.38, 0.18], sky: { top: [0.25, 0.3, 0.45], hor: [0.95, 0.7, 0.45], gnd: [0.3, 0.26, 0.22], clouds: 0.5, cloudCol: [0.8, 0.6, 0.45] }, fog: { density: 0.025, falloff: 0.12, max: 0.6, col: [0.6, 0.48, 0.36], sunCol: [1.0, 0.65, 0.3] }, grade: { exposure: 1.0, sat: 0.85 } },
        { sun: { dir: norm([-0.3, 0.7, -0.6]), col: [0.25, 0.3, 0.42] }, amb: { sky: [0.03, 0.035, 0.05], gnd: [0.015, 0.015, 0.02] }, rim: [0.12, 0.14, 0.2], sky: { top: [0.01, 0.012, 0.02], hor: [0.04, 0.045, 0.06], gnd: [0.01, 0.01, 0.01] }, fog: { density: 0.07, falloff: 0.1, max: 0.85, col: [0.02, 0.024, 0.035], sunCol: [0, 0, 0] }, grade: { exposure: 1.1, sat: 0.65 } },
      ][era];
      const lights = era === 2 ? [{ pos: [-0.6, 2.4, -2.2], col: [1.5, 0.8, 0.32], radius: 2.6 }, { pos: [1.5, 1.8, 1.0], col: [0.12, 0.14, 0.2], radius: 3 }] : [];
      return {
        cam, sun: { ...S.sun, shadow: { center: [0, 1, 0], radius: 4, soft: 2 } }, amb: S.amb, rim: S.rim, sky: S.sky, fog: S.fog, lights,
        items, figures: figureGroups(actors.map((a) => a.a)), particles: era === 2 ? [rain] : [],
        grade: { contrast: 1.08, vignette: 0.5, grain: 0.04, bloom: 0.55, gain: [1.02, 1.0, 0.97], ...S.grade },
      };
    },
  };
}
