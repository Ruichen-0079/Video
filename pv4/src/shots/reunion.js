// 重逢：北美的一条街，黄昏，路灯。她走着，停下，转身——街对面站着他。（设定 9.1：两人在美国重逢）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, cylinder } from '../mesh.js';
import { lantern } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY } from '../math.js';
import { stand, walking, loc } from '../poses.js';
import { ZFY_OFFICER, MBC, SKIN } from '../cast.js';

export default function reunion(R, args) {
  const R0 = rng(101);
  const g = new Geo();
  g.add(grid(200, 200, 40, 40, () => 0, (x, z) => { const n = fbm2(x * 0.5, z * 0.5); return [0.2 + 0.03 * n, 0.19 + 0.03 * n, 0.18, 0.4]; }, null, -100, -100));
  // 两排砖房（山墙、白窗框）
  const lamps = [];
  for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) {
    const x = sx * 6.5, z = 6 - k * 6, hh = 7 + R0() * 3;
    g.add(box(4, hh, 5.6, [0.34, 0.16, 0.12, 0.9]), translate([x + sx * 2, hh / 2, z]));
    for (let f = 0; f < 3; f++) for (let w = 0; w < 3; w++) g.add(box(0.05, 1.1, 0.7, [0.85, 0.82, 0.75, 0.6], (k + f + w) % 3 === 0 ? [1.2, 0, 0, 1] : undefined), translate([x - sx * 0.02, 1.4 + f * 2.2, z - 1.7 + w * 1.7]));
    if (k % 2 === 0) { lamps.push([x - sx * 1.6, 3.2, z]); g.add(cylinder(0.05, 0.05, 3.1, 6, [0.08, 0.08, 0.08, 0.6]), translate([x - sx * 1.6, 0, z])); }
  }
  const sceneM = g.upload();
  const lampM = lantern({ glow: 5, col: [1, 0.75, 0.45] }).upload();
  const her = new Actor({ ...ZFY_OFFICER, hat: null }, { skirt: { len: 0.95, flare: 1.8, color: [0.14, 0.16, 0.24], color2: [0.6, 0.55, 0.45] } });
  const MBC_COAT = { ...MBC, sleeve: 'narrow', hair: 'short', colors: { ...MBC.colors, robe: [0.08, 0.08, 0.09], robe2: [0.2, 0.2, 0.22] } };
  const him = new Actor(MBC_COAT, { skirt: { len: 0.7, flare: 1.6, color: [0.08, 0.08, 0.09], color2: [0.12, 0.12, 0.13] } });
  const snow = new Particles(900, 'snow', 103);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const items = [{ mesh: sceneM }];
      const stop = smooth(2.2, 2.8, t);
      const walkD = 0.55 * Math.min(t, 2.5);
      const p = walking(her.T.body.J, [-1.0, 0, 3], Math.PI, walkD, {});
      const o = [p.pos[0], 0, p.pos[2]];
      const turn = smoother(2.6, 3.8, t);
      if (stop > 0.5) { const s = stand(her.T.body.J, o, Math.PI + turn * 1.9, { head: [0.0, turn * 0.25, 0] }); her.update(s, dt, { t }); }
      else her.update(p, dt, { t });
      him.update(stand(him.T.body.J, [3.4, 0, -1.4], -Math.PI / 2 - 0.2, { head: [0.05, 0, 0] }), dt, { t });
      snow.spawn(h, 120, (q, r) => { q.p = [(r() - 0.5) * 14, 6, (r() - 0.5) * 14]; q.v = [0.1, -0.7, 0]; q.life = 9; q.size = 0.014; q.col = [1, 1, 1, 0.7]; });
      snow.step(h, (pp, q) => [Math.sin(t + q.seed * 10) * 0.2, 0, 0]);
      const lights = lamps.slice(0, 6).map((lp) => ({ pos: lp, col: [1.6, 1.0, 0.5], radius: 3.5 }));
      lamps.forEach((lp) => items.push({ mesh: lampM, model: translate(lp) }));
      items.push(...her.items(), ...him.items());
      return {
        cam: { pos: keyed([[0, [-3.4, 1.4, 4.6]], [4.5, [-3.2, 1.4, 3.9]]], t), target: [0.8, 1.2, -0.4], fov: 34, dof: { focus: Math.hypot(...sub([-3.3, 1.4, 4.2], her.W.pelvis)), aperture: 0.05 } },
        sun: { dir: norm([0.3, 0.2, -0.9]), col: [0.35, 0.3, 0.4] }, amb: { sky: [0.06, 0.07, 0.1], gnd: [0.03, 0.03, 0.035] }, rim: [0.1, 0.1, 0.14],
        sky: { top: [0.04, 0.05, 0.1], hor: [0.35, 0.25, 0.3], gnd: [0.05, 0.05, 0.05], clouds: 0.5, cloudCol: [0.12, 0.1, 0.13] },
        fog: { density: 0.03, falloff: 0.1, max: 0.8, col: [0.12, 0.11, 0.14], sunCol: [0.1, 0.06, 0.06] },
        lights, items, figures: figureGroups([her, him]), particles: [snow],
        grade: { exposure: 1.15, sat: 0.8, contrast: 1.1, gain: [1.02, 0.99, 0.95], vignette: 0.55, grain: 0.045, bloom: 0.6 },
      };
    },
  };
}
