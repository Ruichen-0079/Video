// 夏：他生在史书所称的夏朝。门前，他和一个女人并肩坐着；岁月流过，她老了，他没有。（设定 9.2：因不老被驱逐）
// part a：时间流逝（跳切 + 光的变化）；part b：黄昏，村人举着火把，他独自离开
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { house } from '../env.js';
import { torch } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, clamp } from '../math.js';
import { stand, walking, loc } from '../poses.js';
import { XIA_WOMAN, MBC_XIA, VILLAGER } from '../cast.js';

export default function xia(R, args) {
  const part = args.part || 'a';
  const R0 = rng(81);
  const g = new Geo();
  g.add(grid(200, 200, 60, 60, (x, z) => 0.4 * fbm2(x * 0.03, z * 0.03) * (Math.abs(x) > 6 ? 1 : 0.2), (x, z) => { const n = fbm2(x * 0.2, z * 0.2); return [0.38 + 0.05 * n, 0.33 + 0.04 * n, 0.22, 0.95]; }, null, -100, -100));
  g.add(house(4.2, 3.6, 2.4, { wall: [0.46, 0.38, 0.28], roofCol: [0.3, 0.26, 0.16] }), translate([0, 0, -2.6]));
  g.add(house(3.6, 3.2, 2.2, { wall: [0.44, 0.37, 0.27], roofCol: [0.3, 0.26, 0.16] }), mmul(translate([-6, 0, -1]), rotY(0.5)));
  g.add(house(3.6, 3.2, 2.2, { wall: [0.44, 0.37, 0.27], roofCol: [0.3, 0.26, 0.16] }), mmul(translate([6.5, 0, -2]), rotY(-0.4)));
  g.add(box(2.2, 0.3, 0.5, [0.36, 0.3, 0.22, 0.9]), translate([0, 0.15, -0.6]));
  const sceneM = g.upload();
  const torchM = torch().upload();
  const women = [0, 1, 2].map((k) => new Actor(XIA_WOMAN(k), {}));
  const him = new Actor(MBC_XIA, { skirt: { len: 0.95, flare: 1.9, color: MBC_XIA.colors.robe, color2: MBC_XIA.colors.robe2 } });
  const crowd = [];
  for (let k = 0; k < 7; k++) crowd.push({ a: new Actor(VILLAGER(k, k % 3 ? 'm' : 'f'), {}), x: -1.8 + k * 0.6 + (R0() - 0.5) * 0.3, z: 1.6 + (k % 2) * 0.6, torch: k % 2 === 0 });
  const fire = new Particles(500, 'fire', 51);
  // 三个时刻：夏日正午、秋天的傍晚、冬天的清晨
  const ST = [
    { sun: [0.55, 0.5, 0.45], col: [1.7, 1.45, 1.1], sky: [[0.3, 0.45, 0.7], [0.75, 0.78, 0.8]], amb: [0.12, 0.13, 0.16], fog: [0.62, 0.64, 0.68] },
    { sun: [-0.7, 0.25, 0.4], col: [1.5, 0.9, 0.5], sky: [[0.2, 0.25, 0.4], [0.9, 0.6, 0.4]], amb: [0.15, 0.13, 0.13], fog: [0.6, 0.45, 0.35] },
    { sun: [0.6, 0.3, 0.6], col: [0.8, 0.85, 0.95], sky: [[0.3, 0.34, 0.4], [0.58, 0.6, 0.64]], amb: [0.13, 0.14, 0.17], fog: [0.5, 0.52, 0.56] },
  ];
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.2, 0, 0], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const actors = [];
      const lights = [];
      let st, cam;
      if (part === 'a') {
        const stage = t < 1.6 ? 0 : t < 3.2 ? 1 : 2;
        st = ST[stage];
        const w = women[stage];
        const J = w.T.body.J;
        const o = [-0.55, 0, -0.5];
        // 坐在门前的条凳上；老了以后背更驼
        const seat = (A, o, yaw, extraLean) => {
          const JJ = A.T.body.J;
          return { pos: add(o, [0, 0.3 + JJ.pelvis[1] * 0.2, 0]), yaw, lean: [0.12 + extraLean, 0, 0], head: [0.1 + extraLean * 0.6, 0, 0],
            footL: loc(o, yaw, [0.1, JJ.ankleL[1], 0.45]), footR: loc(o, yaw, [-0.1, JJ.ankleL[1], 0.42]), kneeL: loc([0, 0, 0], yaw, [0, 1, 0.5]), kneeR: loc([0, 0, 0], yaw, [0, 1, 0.5]),
            handL: loc(o, yaw, [0.1, 0.5 + 0.05, 0.3]), handR: loc(o, yaw, [-0.1, 0.5 + 0.05, 0.3]) };
        };
        w.update(seat(w, o, 0.15, stage * 0.22), dt, env); actors.push(w);
        him.update(seat(him, [0.45, 0, -0.5], -0.1, 0.0), dt, env); actors.push(him);
        cam = { pos: keyed([[0, [1.6, 1.0, 3.4]], [4.8, [1.3, 1.0, 3.1]]], t), target: [-0.05, 0.8, -0.5], fov: 32, dof: { focus: 3.8, aperture: 0.06 } };
      } else {
        st = { sun: [-0.8, 0.12, 0.3], col: [1.2, 0.55, 0.28], sky: [[0.1, 0.1, 0.2], [0.75, 0.35, 0.2]], amb: [0.08, 0.07, 0.09], fog: [0.35, 0.22, 0.18] };
        // 他背着包袱沿路走远（-z → 远处）
        const pose = walking(him.T.body.J, [0.3, 0, -0.4], Math.PI * 0.92, 0.55 * t, { lean: [0.08, 0, 0], head: [0.1, 0, 0] });
        him.update(pose, dt, env); actors.push(him);
        for (const c of crowd) {
          const J = c.a.T.body.J; const o = [c.x, 0, c.z];
          const hand = loc(o, Math.PI, [-0.22, J.pelvis[1] + 0.55, 0.05]);
          c.a.update(stand(J, o, Math.PI + (c.x - 0.3) * -0.1, { head: [0.05, 0, 0] }), dt, env);
          if (c.torch) { c.a.update({ ...stand(J, o, Math.PI, {}), handR: hand, elbowR: [0, -1, 0] }, 0, env); items.push({ mesh: torchM, model: translate(hand) }); const fp = add(hand, [0, 0.32, 0]); fire.spawn(h, 16, (q, r) => { q.p = add(fp, [(r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05]); q.v = [(r() - 0.5) * 0.2, 0.9 + r() * 0.3, 0]; q.life = 0.4; q.size = 0.07; q.grow = -0.4; q.col = [1, 1, 1, 0.6]; }); lights.push({ pos: fp, col: [1.8, 0.8, 0.28], radius: 2.5 }); }
          actors.push(c.a);
        }
        fire.step(h, () => [0, 0.5, 0]);
        cam = { pos: keyed([[0, [-0.4, 2.6, 5.4]], [4, [-0.5, 2.5, 5.0]]], t), target: add(him.W.pelvis, [0, 0.2, -1.5]), fov: 34, dof: { focus: 6, aperture: 0.03 } };
      }
      for (const a of actors) items.push(...a.items());
      return {
        cam, sun: { dir: norm(st.sun), col: st.col, shadow: { center: [0, 1, -0.5], radius: 5, soft: 2.5 } },
        amb: { sky: st.amb, gnd: mul(st.amb, 0.6) }, rim: mul(st.col, 0.15),
        sky: { top: st.sky[0], hor: st.sky[1], gnd: [0.3, 0.25, 0.2], clouds: 0.5, cloudCol: mul(st.sky[1], 0.8), sunDisc: [0.9996, 14, 0.7, 10] },
        fog: { density: 0.01, falloff: 0.1, max: 0.6, col: st.fog, sunCol: mul(st.col, 0.4) },
        lights, items, figures: figureGroups(actors), particles: [fire],
        grade: { exposure: 0.95, sat: 0.85, contrast: 1.15, vignette: 0.55, grain: 0.04, bloom: 0.5 },
      };
    },
  };
}
