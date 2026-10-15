// 王朝覆灭之后：街口，人类士兵摇着香炉，绿色的药烟漫过人群。一个女人藏起来的狐耳和尾巴被逼了出来，周围的人退开，士兵扑上去。（设定 3.6 / 7.3）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, sphere } from '../mesh.js';
import { house, wall } from '../env.js';
import { lantern, segModel, unitCyl } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, clamp } from '../math.js';
import { walkCycle as walk } from '../figure.js';
import { VILLAGER, HUMAN_SOLDIER } from '../cast.js';

export default function herb(R, args) {
  const R0 = rng(41);
  const g = new Geo();
  g.add(grid(80, 80, 40, 40, () => 0, (x, z) => { const n = fbm2(x * 0.3, z * 0.3); return [0.26 + 0.04 * n, 0.24 + 0.04 * n, 0.21, 0.95]; }, null, -40, -40));
  // 两排房子
  for (let k = 0; k < 7; k++) for (const sx of [-1, 1]) {
    const w = 4 + R0() * 1.5, d = 4, hh = 2.6 + R0() * 0.6;
    g.add(house(w, d, hh, { wall: [0.22 + R0() * 0.04, 0.19, 0.16] }), mmul(translate([sx * 5.2, 0, 6 - k * 5.2]), rotY(sx > 0 ? -Math.PI / 2 : Math.PI / 2)));
  }
  const sceneM = g.upload();
  const lanternM = lantern({ glow: 6, col: [1, 0.6, 0.3] }).upload();
  const censerM = sphere(0.09, 10, [0.3, 0.25, 0.15, 0.4], [0.6, 0, 0, 1]).upload();
  const chain = unitCyl([0.2, 0.18, 0.15, 0.5]).upload();
  const crowd = [];
  const spots = [[-1.0, 0.9], [1.25, 0.7], [-1.7, -0.3], [1.9, -0.4], [-0.6, -1.1], [0.9, -1.3], [-2.6, 0.6], [2.7, 0.3], [-0.2, -2.2], [1.6, -2.4]];
  spots.forEach(([x, z], k) => {
    const sex = k % 3 === 1 ? 'f' : 'm';
    const P = VILLAGER(k, sex);
    crowd.push({ a: new Actor(P, {}), x, z, k });
  });
  const FOXW = { ...VILLAGER(5, 'f'), ears: 'fox', tunic: 0 };
  const foxw = new Actor(FOXW, { skirt: { len: 0.95, flare: 1.7, color: FOXW.colors.robe, color2: FOXW.colors.robe2 }, tail: { len: 0.85, w: 0.06, color: [0.55, 0.3, 0.14], tip: [0.9, 0.88, 0.84] } });
  const soldiers = [0, 1, 2].map((k) => ({ a: new Actor(HUMAN_SOLDIER(k + 3), {}) }));
  const smoke = new Particles(1400, 'smoke', 9);
  const sunDir = norm([-0.4, 0.25, -0.88]);
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.2, 0, 0.1], t, ground: 0 };
      const items = [{ mesh: sceneM }];
      const fp = [0.1, 0, 0.2];
      const reveal = smooth(2.2, 3.6, t);             // 药烟逼出原形
      const grab = smoother(4.4, 5.6, t);
          // 人群：先看着烟，女人现形后往外退
      for (const c of crowd) {
        const away = norm(sub([c.x, 0, c.z], fp));
        const back = smoother(3.2, 4.6, t) * 0.7 * Math.exp(-Math.hypot(c.x - fp[0], c.z - fp[2]) * 0.3);
        const p = add([c.x, 0, c.z], mul(away, back));
        const J = c.a.T.body.J;
        const lookAt = reveal > 0.3 ? fp : [-3, 0, 1];
        const yaw = Math.atan2(lookAt[0] - p[0], lookAt[2] - p[2]);
        c.a.update({ pos: add(p, [0, J.pelvis[1] - 0.02, 0]), yaw, lean: [-0.08 * back, 0, 0], head: [0.05, 0, 0],
          handL: back > 0.2 && c.k % 2 ? add(p, [0.1, J.pelvis[1] + 0.45, 0.1]) : null,
          footL: add(p, [0.1 * Math.cos(yaw), 0.085, -0.1 * Math.sin(yaw)]), footR: add(p, [-0.1 * Math.cos(yaw), 0.085, 0.1 * Math.sin(yaw)]) }, dt, env);
      }
      // 女人：低着头，耳朵与尾巴慢慢显出来，然后被抓住
      foxw.featureFade = 1 - reveal;
      {
        const J = foxw.T.body.J;
        const p = add(fp, [-grab * 0.25, 0, -grab * 0.2]);
        foxw.update({ pos: add(p, [0, J.pelvis[1] - 0.03 - reveal * 0.04, 0]), yaw: 0.25 - reveal * 0.2, lean: [0.3 * reveal, 0, 0], head: [0.3 + 0.2 * reveal, 0, 0],
          handL: add(p, [0.08, J.pelvis[1] + 0.38 * reveal + 0.05, 0.14]), handR: add(p, [-0.06, J.pelvis[1] + 0.42 * reveal + 0.05, 0.16]),
          footL: add(p, [0.1, 0.085, 0]), footR: add(p, [-0.1, 0.085, 0.05]) }, dt, env);
      }
      // 士兵：一个摇香炉走过，两个扑上去
      const lights = [];
      soldiers.forEach((s, k) => {
        const J = s.a.T.body.J;
        let p, yaw, handR = null, handL = null, fl, fr;
        if (k === 0) {
          const wc = walk(J, [-3.4, 0, -1.6], [1, 0, 0.1], 0.5 * Math.min(t, 4.6), { stride: 0.5 });
          p = wc.pelvis; yaw = Math.atan2(1, 0.1); fl = wc.footL; fr = wc.footR;
          const sw = Math.sin(t * 2.6) * 0.5;
          handR = add(p, [-0.25, 0.25, 0.25]);
          const cz = add(handR, [Math.sin(sw) * 0.35, -0.55 + Math.abs(sw) * 0.1, Math.cos(sw) * 0.08]);
          items.push({ mesh: chain, model: segModel(handR, cz, 0.004) }, { mesh: censerM, model: translate(cz) });
          lights.push({ pos: cz, col: [0.12, 0.3, 0.14], radius: 1.0 });
          smoke.spawn(h, 150, (q, r) => { q.p = add(cz, [(r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1]); q.v = [0.35 + (r() - 0.5) * 0.5, 0.05 + r() * 0.15, 0.1 + (r() - 0.5) * 0.5]; q.life = 7; q.size = 0.12; q.grow = 4.0; q.col = [0.26, 0.33, 0.26, 0.12]; q.drag = 0.4; });
        } else {
          const from = [k === 1 ? 3.4 : -3.2, 0, -0.6];
          const to = add(fp, [k === 1 ? 0.45 : -0.45, 0, -0.2]);
          const u = smoother(3.8, 5.0, t);
          const q = add(mul(from, 1 - u), mul(to, u));
          p = add(q, [0, J.pelvis[1] - 0.02, 0]); yaw = Math.atan2(fp[0] - q[0], fp[2] - q[2]);
          const wc = walk(J, from, norm(sub(to, from)), u * Math.hypot(...sub(to, from)), { stride: 0.7 });
          fl = wc.footL; fr = wc.footR; p = wc.pelvis;
          if (grab > 0.05) { const arm = add(foxw.W[k === 1 ? 'elbowR' : 'elbowL'], [0, 0, 0]); handL = arm; handR = add(arm, [0, -0.1, 0]); }
        }
        s.a.update({ pos: p, yaw, lean: [k ? 0.15 : 0, 0, 0], handR, handL, footL: fl, footR: fr }, dt, env);
      });
      smoke.step(h, (p, q) => [0.15 + 0.1 * Math.sin(q.seed * 20 + t * 0.5), -0.02, 0.25]);
      // 门口的灯笼
      const lp = [[-2.4, 2.3, 1.8], [2.6, 2.3, -0.8], [-2.8, 2.3, -4]];
      lp.forEach((p, k) => { items.push({ mesh: lanternM, model: translate(p) }); lights.push({ pos: p, col: [1.8, 0.85, 0.3], radius: 1.0 }); });
      // 她头顶上方（画外）一盏灯，把她从人群里挑出来
      lights.push({ pos: [0.5, 2.2, 0.9], col: [1.8, 1.0, 0.45], radius: 1.2 });
      const actors = [...crowd.map((c) => c.a), foxw, ...soldiers.map((s) => s.a)];
      for (const a of actors) items.push(...a.items());
      const groups = figureGroups(actors);
      const fg = groups.find((x) => x.mesh === foxw.T.mesh); if (fg) fg.dissolve = foxw.featureFade;
      return {
        cam: { pos: keyed([[0, [1.3, 1.4, 4.4]], [7.5, [0.9, 1.38, 3.3]]], t), target: keyed([[0, [-0.2, 1.15, 0.0]], [7.5, [-0.05, 1.2, 0.1]]], t), fov: 32, dof: { focus: 4.0, aperture: 0.12 } },
        sun: { dir: sunDir, col: [0.14, 0.17, 0.28], shadow: { center: [0, 1, 0], radius: 6, soft: 3 } },
        amb: { sky: [0.03, 0.035, 0.06], gnd: [0.015, 0.013, 0.012] }, rim: [0.1, 0.12, 0.18],
        sky: { top: [0.01, 0.015, 0.035], hor: [0.06, 0.055, 0.07], gnd: [0.03, 0.03, 0.03], clouds: 0.4, cloudCol: [0.04, 0.04, 0.05] },
        fog: { density: 0.04, falloff: 0.2, base: 0, max: 0.75, col: [0.03, 0.04, 0.035], sunCol: [0.02, 0.02, 0.03] },
        lights, items, figures: groups, particles: [smoke],
        grade: { exposure: 0.95, sat: 0.9, contrast: 1.18, gain: [0.98, 1.02, 0.96], lift: [0.0, 0.006, 0.006], vignette: 0.55, grain: 0.045, bloom: 0.6 },
      };
    },
  };
}
