// 她的几百年（明布川沉睡期间）：
// ming：明朝发展出资本主义——烟囱与厂房，工业渐渐盖过了武学；她换了装束走在街上
// study：夜里，她伏案写作（以才女闻名）
// chains：广场上，亚人奴隶的镣铐被一一打开（推动废除亚人奴隶制）
// war：北美，独立战争。烟里的一排三角帽，她举剑指挥（担任军官）
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid, cylinder, sphere } from '../mesh.js';
import { house, desk, wall, hall } from '../env.js';
import { lantern, jian, segModel, unitCyl, pole } from '../props.js';
import { Cloth } from '../cloth.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, rotZ, rotX, clamp } from '../math.js';
import { stand, walking, loc, kneel } from '../poses.js';
import { ZFY, ZFY_MING, ZFY_OFFICER, CONTINENTAL, VILLAGER, NOBLE, SLAVE, SKIN } from '../cast.js';
import { frameModel } from './siege.js';

export default function montage(R, args) {
  const which = args.which || 'ming';
  const R0 = rng(91 + which.length);
  const g = new Geo();
  const actors = [];
  let fr;
  if (which === 'ming') {
    g.add(grid(400, 400, 60, 60, () => 0, (x, z) => [0.3, 0.28, 0.25, 0.9], null, -200, -200));
    // 街两边的砖房与远处的厂房、烟囱
    for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) g.add(house(4.5, 4, 3 + R0(), { wall: [0.36, 0.26, 0.2], roofCol: [0.14, 0.13, 0.13] }), mmul(translate([sx * 5, 0, 4 - k * 5]), rotY(sx > 0 ? -Math.PI / 2 : Math.PI / 2)));
    const stacks = [];
    for (let k = 0; k < 9; k++) {
      const x = (R0() - 0.5) * 70, z = -45 - R0() * 40, hh = 14 + R0() * 12;
      g.add(box(10 + R0() * 6, 7, 8, [0.3, 0.22, 0.18, 0.9]), translate([x, 3.5, z]));
      g.add(cylinder(0.9, 0.7, hh, 10, [0.32, 0.2, 0.16, 0.9]), translate([x + 3, 0, z]));
      stacks.push([x + 3, hh, z]);
    }
    const smoke = new Particles(900, 'smoke', 93);
    const her = new Actor(ZFY_MING, { skirt: { len: 0.95, flare: 1.8, color: ZFY_MING.colors.robe, color2: ZFY_MING.colors.robe2 }, sleeves: { width: 0.12, color: ZFY_MING.colors.robe, color2: ZFY_MING.colors.robe2 } });
    const crowd = []; for (let k = 0; k < 12; k++) crowd.push({ a: new Actor(VILLAGER(k, k % 3 ? 'm' : 'f'), {}), x: (R0() - 0.5) * 6, z: -2 - R0() * 14, sp: 0.5 + R0() * 0.4, dir: R0() < 0.5 ? 1 : -1 });
    fr = (t, h, items) => {
      for (const s of stacks) smoke.spawn(h, 9, (q, r) => { q.p = add(s, [(r() - 0.5) * 0.4, 0, 0]); q.v = [1.2 + r() * 0.4, 1.2 + r() * 0.6, 0.2]; q.life = 12; q.size = 1.4; q.grow = 3; q.col = [0.22, 0.2, 0.19, 0.55]; });
      smoke.step(h, () => [0.15, 0.02, 0]);
      const pose = walking(her.T.body.J, [0.4, 0, -6], 0, 0.6 * t, { lean: [0.02, 0, 0] });
      her.update(pose, 1 / 30, { t, wind: [0.2, 0, 0] });
      const acts = [her];
      for (const c of crowd) { const p = walking(c.a.T.body.J, [c.x, 0, c.z], c.dir > 0 ? 0 : Math.PI, c.sp * t); c.a.update(p, 1 / 30, { t }); acts.push(c.a); }
      for (const a of acts) items.push(...a.items());
      return {
        acts, particles: [smoke],
        cam: { pos: keyed([[0, [1.6, 1.6, 2.4]], [6.5, [1.2, 1.55, 0.6]]], t), target: keyed([[0, [0, 3.5, -30]], [6.5, [0.2, 2.4, -30]]], t), fov: 40, dof: { focus: 7, aperture: 0.03 } },
        sun: { dir: norm([0.6, 0.25, -0.75]), col: [1.4, 0.95, 0.6] }, amb: { sky: [0.16, 0.14, 0.13], gnd: [0.1, 0.08, 0.06] }, rim: [0.3, 0.2, 0.12],
        sky: { top: [0.35, 0.32, 0.3], hor: [0.85, 0.62, 0.42], gnd: [0.3, 0.25, 0.2], clouds: 0.6, cloudCol: [0.45, 0.38, 0.32], sunDisc: [0.9996, 10, 0.6, 8] },
        fog: { density: 0.02, falloff: 0.04, max: 0.85, col: [0.5, 0.42, 0.34], sunCol: [0.8, 0.5, 0.25] },
        grade: { exposure: 0.95, sat: 0.7, contrast: 1.1, gain: [1.04, 0.99, 0.92] },
      };
    };
  } else if (which === 'study') {
    g.add(grid(10, 10, 4, 4, () => 0, () => [0.12, 0.09, 0.07, 0.5], null, -5, -5));
    g.add(desk(1.4, 0.65, 0.76), translate([0, 0, 0]));
    for (let k = 0; k < 7; k++) g.add(box(0.22, 0.04 + R0() * 0.02, 0.3, [0.6 + R0() * 0.1, 0.55, 0.42, 0.9]), translate([-0.5 + (k % 2) * 0.05, 0.79 + k * 0.045, -0.12]));
    g.add(box(0.5, 0.005, 0.36, [0.82, 0.78, 0.68, 0.9]), translate([0.15, 0.785, 0.02]));
    g.add(box(4, 3, 0.2, [0.2, 0.15, 0.12, 0.8]), translate([0, 1.5, -1.0]));
    // 书架
    for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) g.add(box(0.06 + R0() * 0.03, 0.28, 0.22, [0.25 + R0() * 0.3, 0.15 + R0() * 0.1, 0.1, 0.8]), translate([-1.8 + k * 0.1 + (r % 2) * 0.03, 0.3 + r * 0.4, -0.85]));
    const lamp = lantern({ glow: 1.6 }).upload();
    const her = new Actor(ZFY_MING, { skirt: { len: 0.95, flare: 1.7, color: ZFY_MING.colors.robe, color2: ZFY_MING.colors.robe2 }, sleeves: { width: 0.11, color: ZFY_MING.colors.robe, color2: ZFY_MING.colors.robe2 } });
    fr = (t, h, items) => {
      const o = [0.1, 0, 0.62];
      const J = her.T.body.J;
      const wri = Math.sin(t * 5) * 0.02;
      her.update({ pos: add(o, [0, 0.46, -0.02]), yaw: Math.PI, lean: [0.35, 0, 0], head: [0.35, 0, 0],
        footL: add(o, [0.1, 0.085, -0.35]), footR: add(o, [-0.1, 0.085, -0.32]), kneeL: [0, 1, -0.5], kneeR: [0, 1, -0.5],
        handR: add([0.12 + wri, 0.8, 0.05], [0, 0, 0]), handL: [-0.12, 0.79, 0.16] }, 1 / 30, { t });
      items.push({ mesh: lamp, model: translate([0.55, 0.95, -0.1]) });
      items.push(...her.items());
      return {
        acts: [her], particles: [],
        cam: { pos: keyed([[0, [args.sx ?? -2.3, args.sy ?? 1.45, args.sz ?? 2.9]], [3.5, [(args.sx ?? -2.3) + 0.15, (args.sy ?? 1.45) - 0.02, (args.sz ?? 2.9) - 0.3]]], t), target: [0.1, 0.92, 0.1], fov: 30, dof: { focus: 3.5, aperture: 0.05 } },
        sun: { dir: [0, 1, 0], col: [0, 0, 0] }, amb: { sky: [0.02, 0.02, 0.03], gnd: [0.01, 0.008, 0.006] }, rim: [0.02, 0.015, 0.01],
        lights: [{ pos: [0.55, 0.95, -0.1], col: [1.4 * (0.95 + 0.05 * Math.sin(t * 9)), 0.75, 0.3], radius: 1.5 }],
        sky: { top: [0, 0, 0], hor: [0, 0, 0] }, fog: { density: 0.02, falloff: 0, max: 0.6, col: [0.01, 0.008, 0.005] },
        grade: { exposure: 1.15, sat: 0.85, contrast: 1.1, gain: [1.04, 0.98, 0.9] },
      };
    };
  } else if (which === 'chains') {
    g.add(grid(200, 200, 40, 40, () => 0, (x, z) => { const k = (Math.floor(x / 1.2) + Math.floor(z / 1.2)) & 1; return [0.44 + 0.03 * k, 0.42 + 0.03 * k, 0.38, 0.85]; }, null, -100, -100));
    const iron = unitCyl([0.2, 0.19, 0.18, 0.4]).upload();
    const slaves = [];
    const kinds = [{ horns: 'ox' }, { ears: 'fox' }, { horns: 'antler' }, {}, { ears: 'cat' }, { horns: 'dragon' }];
    for (let k = 0; k < 6; k++) slaves.push({ a: new Actor({ ...SLAVE(k), ...kinds[k], height: 1.68 }, {}), x: (k - 2.5) * 1.15, z: 0 });
    const officials = [0, 1].map((k) => new Actor({ ...VILLAGER(k + 2, 'm'), colors: { ...VILLAGER(k + 2, 'm').colors, robe: [0.18, 0.2, 0.35], robe2: [0.6, 0.5, 0.3] } }, {}));
    const her = new Actor(ZFY_MING, { skirt: { len: 0.95, flare: 1.8, color: ZFY_MING.colors.robe, color2: ZFY_MING.colors.robe2 }, sleeves: { width: 0.12, color: ZFY_MING.colors.robe, color2: ZFY_MING.colors.robe2 } });
    const crowd = []; for (let k = 0; k < 9; k++) crowd.push({ a: new Actor(VILLAGER(k, k % 2 ? 'm' : 'f'), {}), x: -6 + (R0() - 0.5) * 6, z: -3.5 - R0() * 3 });
    fr = (t, h, items) => {
      const acts = [];
      slaves.forEach((s, k) => {
        const J = s.a.T.body.J; const o = [s.x, 0, s.z];
        const tf = 0.3 + k * 0.42;
        const freed = smooth(tf, tf + 0.5, t);
        // 镣铐打开：两手垂到身侧，抬起头
        const hands = [loc(o, 0, [lerp(0.04, 0.22, freed), lerp(0.95, 0.78, freed), lerp(0.22, 0.04, freed)]), loc(o, 0, [lerp(-0.04, -0.22, freed), lerp(0.95, 0.78, freed), lerp(0.22, 0.04, freed)])];
        s.a.update({ ...stand(J, o, 0, { lean: [0.25 * (1 - freed), 0, 0], head: [0.3 * (1 - freed) - 0.18 * freed, 0, 0] }), handL: hands[0], handR: hands[1] }, 1 / 30, { t });
        if (t < tf) { s.w = [s.a.W.wristL.slice(), s.a.W.wristR.slice()]; const [a, b] = s.w; items.push({ mesh: iron, model: segModel(a, b, 0.012) }, { mesh: iron, model: segModel(add(a, [0, -0.02, 0]), add(a, [0, 0.03, 0]), 0.045) }, { mesh: iron, model: segModel(add(b, [0, -0.02, 0]), add(b, [0, 0.03, 0]), 0.045) }); }
        else if (s.w) {
          // 铁链落地
          const dy = Math.min(s.w[0][1] - 0.03, 4.9 * (t - tf) * (t - tf));
          const a = add(s.w[0], [0, -dy, 0.05]), b = add(s.w[1], [0, -dy, -0.03]);
          items.push({ mesh: iron, model: segModel(a, b, 0.012) }, { mesh: iron, model: segModel(add(a, [0, -0.02, 0]), add(a, [0, 0.03, 0]), 0.045) }, { mesh: iron, model: segModel(add(b, [0, -0.02, 0]), add(b, [0, 0.03, 0]), 0.045) });
        }
        acts.push(s.a);
      });
      officials.forEach((o, k) => { const p = walking(o.T.body.J, [-3.2 + k * 0.3, 0, 0.75 + k * 0.5], Math.PI / 2, 0.7 * t * (k ? 0.95 : 1)); o.update(p, 1 / 30, { t }); acts.push(o); });
      her.update(stand(her.T.body.J, [-4.3, 0, 1.0], 1.9, { head: [0.05, -0.3, 0], handL: [0.05, 0.95, 0.18], handR: [-0.05, 0.95, 0.18] }), 1 / 30, { t }); acts.push(her);
      for (const c of crowd) { c.a.update(stand(c.a.T.body.J, [c.x, 0, c.z], 0, {}), 1 / 30, { t }); acts.push(c.a); }
      for (const a of acts) items.push(...a.items());
      return {
        acts, particles: [],
        // 沿着队列的斜角低机位：远处的人先被解开，最近的一个最后
        // 逆光：落日在队列身后，角与耳朵的轮廓清清楚楚
        cam: { pos: keyed([[0, [4.9, 0.9, 2.9]], [3.5, [4.6, 0.92, 2.6]]], t), target: [0.6, 1.15, -0.3], fov: 28, dof: { focus: 3.6, aperture: 0.06, maxR: 7 } },
        sun: { dir: norm([0.35, 0.09, -1]), col: [1.7, 1.0, 0.5] }, amb: { sky: [0.035, 0.035, 0.055], gnd: [0.03, 0.022, 0.018] }, rim: [1.1, 0.55, 0.22],
        sky: { top: [0.16, 0.18, 0.3], hor: [1.0, 0.55, 0.25], gnd: [0.25, 0.2, 0.16], sunDisc: [0.9995, 22, 1.4, 8], clouds: 0.45, cloudCol: [0.75, 0.38, 0.22], cloudY: 1.2 },
        fog: { density: 0.007, falloff: 0.1, max: 0.6, col: [0.5, 0.3, 0.18], sunCol: [1.0, 0.55, 0.22] },
        grade: { exposure: 0.95, sat: 0.9, contrast: 1.15, gain: [1.04, 0.99, 0.92], lift: [0.006, 0.003, 0.004], bloom: 0.7 },
      };
    };
  } else if (which === 'war') {
    g.add(grid(400, 400, 60, 60, (x, z) => 0.6 * fbm2(x * 0.03, z * 0.03), (x, z) => { const n = fbm2(x * 0.1, z * 0.1); return [0.3 + 0.04 * n, 0.32 + 0.04 * n, 0.2, 0.95]; }, null, -200, -200));
    const muskM = cylinder(0.012, 0.012, 1.45, 6, [0.22, 0.16, 0.1, 0.6]).upload();
    const swordM = jian({ blade: 0.8, steel: [0.7, 0.7, 0.72] }).upload();
    const line = []; for (let k = 0; k < 14; k++) line.push({ a: new Actor(CONTINENTAL(k), {}), x: (k - 6.5) * 0.85, z: 0, fire: 0.8 + (k % 5) * 0.12 + R0() * 0.2 });
    const her = new Actor(ZFY_OFFICER, { skirt: { len: 0.62, flare: 1.7, color: ZFY_OFFICER.colors.robe, color2: ZFY_OFFICER.colors.robe2 } });
    const smoke = new Particles(900, 'smoke', 97), flash = new Particles(200, 'fire', 98);
    let flag = null;
    fr = (t, h, items) => {
      const acts = [];
      for (const s of line) {
        const J = s.a.T.body.J; const o = [s.x, 0.6 * fbm2(s.x * 0.03, 0), s.z];
        const aim = smooth(0.2, 0.6, t);
        const hR = loc(o, Math.PI, [-0.12, 1.42 * aim + 1.0 * (1 - aim), 0.3 * aim + 0.1]), hL = loc(o, Math.PI, [0.08, 1.38 * aim + 0.95 * (1 - aim), 0.6 * aim + 0.2]);
        s.a.update({ ...stand(J, o, Math.PI, { lean: [0.08, 0, 0], head: [0.1, 0, 0], width: 1.4, footFwd: 0.25 }), handR: hR, handL: hL, elbowR: [1, -0.5, 0], elbowL: [0, -1, 0] }, 1 / 30, { t });
        const md = norm(sub(hL, hR));
        items.push({ mesh: muskM, model: frameModel(add(hR, mul(md, -0.3)), md) });
        acts.push(s.a);
        if (Math.abs(t - s.fire) < 1 / 60) {
          const tip = add(hR, mul(md, 1.2));
          for (let q = 0; q < 14; q++) smoke.emit((p, r) => { p.p = tip.slice(); p.v = add(mul(md, 2 + r() * 2), [(r() - 0.5) * 0.4, r() * 0.4, (r() - 0.5) * 0.4]); p.life = 6; p.size = 0.3; p.grow = 6; p.drag = 1.2; p.col = [0.75, 0.75, 0.73, 0.6]; });
          for (let q = 0; q < 8; q++) flash.emit((p, r) => { p.p = tip.slice(); p.v = mul(md, 3 + r() * 3); p.life = 0.12; p.size = 0.15; p.col = [1, 1, 1, 1]; });
        }
      }
      smoke.step(h, () => [0.3, 0.05, 0]); flash.step(h);
      // 她：在队列侧前方，举剑
      const o = [6.6, 0.6 * fbm2(6.6 * 0.03, 0) , 1.2];
      const raise = smooth(0.1, 0.5, t);
      her.update({ ...stand(her.T.body.J, o, Math.PI * 0.85, { head: [-0.1, 0.2, 0] }), handR: loc(o, Math.PI * 0.85, [-0.25, 1.1 + raise * 0.9, 0.2 + raise * 0.2]), elbowR: [1, 0, 0] }, 1 / 30, { t, wind: [0.4, 0, 0] });
      items.push({ mesh: swordM, model: frameModel(her.W.wristR, norm([-0.2, 1, -0.6 * raise])) });
      acts.push(her);
      for (const a of acts) items.push(...a.items());
      return {
        acts, particles: [smoke, flash],
        cam: { pos: keyed([[0, [10.5, 1.5, 5.5]], [3.5, [10.0, 1.5, 4.8]]], t), target: [2.0, 1.4, -0.5], fov: 36, dof: { focus: 6.5, aperture: 0.04 } },
        sun: { dir: norm([-0.7, 0.22, -0.6]), col: [1.3, 1.0, 0.7] }, amb: { sky: [0.08, 0.085, 0.1], gnd: [0.05, 0.05, 0.045] }, rim: [0.35, 0.28, 0.2],
        sky: { top: [0.2, 0.22, 0.26], hor: [0.62, 0.58, 0.52], gnd: [0.25, 0.24, 0.22], clouds: 0.85, cloudCol: [0.4, 0.4, 0.42], cloudY: 1.3 },
        fog: { density: 0.022, falloff: 0.1, max: 0.75, col: [0.42, 0.41, 0.4], sunCol: [0.7, 0.55, 0.35] },
        grade: { exposure: 0.92, sat: 0.7, contrast: 1.2, gain: [1.02, 1.0, 0.96], lift: [0.004, 0.004, 0.006] },
      };
    };
  }
  const sceneM = g.upload();
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const items = [{ mesh: sceneM }];
      const r = fr(t, h, items);
      return {
        cam: r.cam, sun: { ...r.sun, shadow: r.sun.col[0] > 0.1 ? { center: r.cam.target.map((v, i) => (i === 1 ? 1 : v * 0.3)), radius: 8, soft: 2.5 } : null }, amb: r.amb, rim: r.rim, sky: r.sky, fog: r.fog, lights: r.lights || [],
        items, figures: figureGroups(r.acts), particles: r.particles,
        grade: { vignette: 0.5, grain: 0.04, bloom: 0.5, ...r.grade },
      };
    },
  };
}
