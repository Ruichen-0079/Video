// 断裂：夜，宫殿台阶。那个老人独自站在阶下，阶上是持矛的亚人卫兵，身后是人类军队的火把。
// part a：老人与两边的人；part b：他拾级而上，卫兵在他身边倒下；part c：大殿起火，龙旗倒下，人类的开国皇帝举剑
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { hall, terrace } from '../env.js';
import { jian, spear, torch, segModel, unitCyl, pole } from '../props.js';
import { Cloth } from '../cloth.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, rotX, rotZ, qaxis, qmul, clamp } from '../math.js';
import { walkCycle as walk, frame } from '../figure.js';
import { OLD, DEMI_GUARD, HUMAN_SOLDIER, SKIN } from '../cast.js';

export default function siege(R, args) {
  const part = args.part || 'a';
  const R0 = rng(31);
  const stepH = 0.18, stepD = 0.4, nSteps = 18;
  // 台阶在 z = 0 处开始向 -z 上升
  const scene = new Geo();
  scene.add(grid(200, 200, 40, 40, (x, z) => 0, (x, z) => { const n = fbm2(x * 0.2, z * 0.2); return [0.2 + 0.03 * n, 0.19 + 0.03 * n, 0.17, 0.9]; }, null, -100, -40));
  for (let i = 0; i < nSteps; i++) scene.add(box(12, stepH, stepD + 0.02, [0.34, 0.32, 0.3, 0.85]), translate([0, stepH * (i + 0.5), -i * stepD - stepD / 2]));
  scene.add(box(40, stepH * nSteps, 30, [0.33, 0.31, 0.29, 0.85]), translate([0, stepH * nSteps / 2, -nSteps * stepD - 15]));
  for (const sx of [-1, 1]) scene.add(box(0.5, 0.9, nSteps * stepD, [0.42, 0.4, 0.37, 0.8]), mmul(translate([sx * 6.2, stepH * nSteps / 2 + 0.3, -nSteps * stepD / 2]), rotX(-Math.atan(stepH / stepD))));
  const topY = stepH * nSteps;
  scene.add(hall(26, 12, 7.5, { bays: 7, base: 0.6 }), translate([0, topY, -nSteps * stepD - 9]));
  const sceneM = scene.upload();
  const swordM = jian().upload(), spearM = spear().upload(), torchM = torch().upload(), poleM = pole(9, 0.06).upload();
  // 人物
  const old = new Actor(OLD, { skirt: { len: 0.95, flare: 1.9, color: OLD.colors.robe, color2: OLD.colors.robe2 }, sleeves: { width: 0.13, color: OLD.colors.robe, color2: OLD.colors.robe2 } });
  const guards = [];
  const gpos = [[-2.2, 6], [-0.8, 7], [0.8, 7], [2.2, 6], [-3.2, 9], [3.2, 9], [0, 10]];
  for (const [x, i] of gpos) guards.push({ a: new Actor(DEMI_GUARD(i % 2 ? 'ox' : 'dragon'), {}), x, i });
  const soldiers = [];
  for (let k = 0; k < 26; k++) soldiers.push({ a: new Actor(HUMAN_SOLDIER(k), {}), x: (R0() - 0.5) * 11, z: 3 + R0() * 7, ph: R0() * 6, torch: R0() < 0.55 });
  const emperor = new Actor({ height: 1.8, sex: 'm', hair: 'topknot', sleeve: 'narrow', armor: true, colors: { skin: SKIN.warm, robe: [0.42, 0.3, 0.12], robe2: [0.6, 0.45, 0.2], inner: [0.35, 0.05, 0.04], hair: [0.05, 0.04, 0.04], belt: [0.6, 0.45, 0.2], shoe: [0.1, 0.08, 0.06] } }, { skirt: { len: 0.6, flare: 1.6, color: [0.4, 0.06, 0.05], color2: [0.6, 0.45, 0.2] } });
  // 火与烟
  const fire = new Particles(1400, 'fire', 5), smoke = new Particles(500, 'smoke', 6), embers = new Particles(500, 'ember', 7);
  const torchFire = new Particles(800, 'fire', 8);
  // 龙旗（part c）
  let banner = null;
  const sunDir = norm([0.3, 0.5, 0.6]);
  return {
    frame(t, dt) {
      const env = { wind: [0.3, 0, 0.6], t, ground: 0 };
      const h = dt || 1 / 30;
      const stepY = (z) => clamp(Math.floor(-z / stepD + 1e-3), 0, nSteps) * stepH;   // 台阶上某个 z 的高度
      const items = [{ mesh: sceneM }];
      const lights = [];
      // 老人
      let op, oyaw = Math.PI, swordDir = norm([0.2, -1, 0.35]), handR, lean = [0.05, 0, 0];
      if (part === 'a') {
        op = [0, 0, 1.2];
        const wc = { pelvis: [op[0], old.T.body.J.pelvis[1] - 0.02, op[2]], footL: [0.1, 0.085, 1.2], footR: [-0.12, 0.085, 1.28] };
        handR = add(wc.pelvis, [-0.24, -0.08, -0.05]);
        old.update({ pos: wc.pelvis, yaw: oyaw, lean, head: [0.05, 0, 0], handR, handL: add(wc.pelvis, [0.2, -0.15, 0.02]), footL: wc.footL, footR: wc.footR, palmR: [1, 0, 0] }, dt, env);
      } else if (part === 'b') {
        // 阶下的空地：卫兵冲下来，他一步不停地走过去，剑锋所至，卫兵倒下
        const dist = 0.5 * t;
        const wc = walk(old.T.body.J, [0, 0, 3.0], [0, 0, -1], dist, { stride: 0.5, lift: 0.05 });
        const cut = Math.sin(t * 2.2);
        handR = add(wc.pelvis, [-0.25 - 0.25 * cut, 0.15 + 0.1 * Math.abs(cut), -0.25]);
        swordDir = norm([-0.9 * cut - 0.2, -0.15, -0.6]);
        old.update({ pos: wc.pelvis, yaw: oyaw, lean: [0.12, 0, cut * 0.35], head: [-0.02, 0, 0], handR, handL: add(wc.pelvis, [0.28, -0.05, 0.05]), footL: wc.footL, footR: wc.footR, palmR: [1, 0, 0] }, dt, env);
        op = old.W.pelvis;
      } else {
        op = [-3.4, topY, -nSteps * stepD - 2.2];
        handR = add(op, [-0.22, old.T.body.J.pelvis[1] - 0.1, 0.05]);
        old.update({ pos: add(op, [0, old.T.body.J.pelvis[1] - 0.02, 0]), yaw: 0.5, lean: [0.05, 0, 0], head: [0.1, -0.4, 0], handR, handL: add(op, [0.2, 0.8, 0.05]), footL: add(op, [0.1, 0.085, 0.05]), footR: add(op, [-0.12, 0.085, -0.05]) }, dt, env);
      }
      const hR = old.W.wristR;
      items.push({ mesh: swordM, model: frameModel(hR, swordDir) });
      // 卫兵
      for (const g of guards) {
        let z = -g.i * stepD - stepD / 2, y = stepY(z + 0.01);
        let fall = 0;
        if (part === 'b') { z = 2.4 - (g.i - 6) * 0.55; y = 0; const passT = (3.0 - z) / 0.5; fall = smoother(passT - 0.3, passT + 0.5, t); }
        if (part === 'c') fall = 1;
        const p = [g.x, y, z];
        const J = g.a.T.body.J;
        if (fall > 0.95 && part === 'c') continue;
        const knee = fall;
        const rq = qmul(qaxis([1, 0, 0], -fall * 1.2 * (g.x > 0 ? 1 : 1)), qaxis([0, 1, 0], 0));
        g.a.update({ pos: add(p, [g.x * 0.08 * fall, J.pelvis[1] - knee * 0.55, -knee * 0.1 + 0.2 * fall]), yaw: 0, lean: [-0.05 + fall * 0.9, 0, (g.x > 0 ? 1 : -1) * fall * 0.3], head: [fall * 0.4, 0, 0],
          handR: add(p, [-0.28, J.pelvis[1] + 0.12 - knee * 0.5, 0.08 + fall * 0.3]), elbowR: [0, -1, 0.3], handL: add(p, [0.25, J.pelvis[1] - knee * 0.5, 0.1 + fall * 0.4]),
          footL: add(p, [0.12, 0.085, 0.0]), footR: add(p, [-0.14, 0.085 + knee * 0.0, 0.05 + knee * 0.35]), kneeL: [0, 0.3, 1], kneeR: [0, 0.3, 1] }, dt, env);
        if (fall < 0.6) items.push({ mesh: spearM, model: translate(add(g.a.W.wristR, [0, -0.15, 0])) });
      }
      // 士兵与火把（老人身后）
      for (const s of soldiers) {
        if (part === 'c') continue;
        const p = [s.x, 0, s.z + (part === 'b' ? -0.3 * t : 0)];
        const J = s.a.T.body.J;
        const bob = Math.sin(t * 2 + s.ph) * 0.01;
        const hand = add(p, [-0.2, J.pelvis[1] + 0.55 + bob, -0.05]);
        s.a.update({ pos: add(p, [0, J.pelvis[1] - 0.02 + bob, 0]), yaw: Math.PI + (s.x * -0.03), handR: s.torch ? hand : null, elbowR: [0, -1, 0], footL: add(p, [0.1, 0.085, 0]), footR: add(p, [-0.12, 0.085, 0.06]) }, dt, env);
        if (s.torch) { items.push({ mesh: torchM, model: translate(hand) }); const fp = add(hand, [0, 0.32, 0]); torchFire.spawn(h, 18, (q, r) => { q.p = add(fp, [(r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06]); q.v = [(r() - 0.5) * 0.2, 0.9 + r() * 0.4, (r() - 0.5) * 0.2]; q.life = 0.4 + r() * 0.2; q.size = 0.07; q.grow = -0.4; q.col = [1, 1, 1, 0.6]; }); }
      }
      // 只给最近的几个火把打灯
      const torches = soldiers.filter((s) => s.torch && part !== 'c').map((s) => add(s.a.W.wristR, [0, 0.4, 0])).sort((a, b) => a[2] - b[2]).slice(0, 4);
      torches.forEach((p, k) => lights.push({ pos: p, col: [2.4 * (0.85 + 0.15 * Math.sin(t * 13 + k)), 1.1, 0.35], radius: 3.2 }));
      torchFire.step(h, (p) => [0.3, 0.6, 0]);
      // 大殿起火
      const fireAmt = part === 'a' ? 0.25 : part === 'b' ? 0.5 + 0.5 * smooth(1, 4, t) : 1;
      const hallZ = -nSteps * stepD - 9;
      fire.spawn(h, 120 * fireAmt, (q, r) => { q.p = [(r() - 0.5) * 24, topY + 6 + r() * 4, hallZ + (r() - 0.5) * 6]; q.v = [(r() - 0.5) * 0.6, 1.8 + r() * 1.8, (r() - 0.5) * 0.6]; q.life = 0.8 + r() * 0.6; q.size = 0.6 + r() * 0.6; q.grow = 0.2; q.col = [1, 1, 1, 0.55]; });
      smoke.spawn(h, 40 * fireAmt, (q, r) => { q.p = [(r() - 0.5) * 22, topY + 6 + r() * 4, hallZ + 5]; q.v = [0.6 + (r() - 0.5) * 0.4, 1.4 + r(), 0.2]; q.life = 6; q.size = 2.2; q.grow = 1.5; q.col = [0.1, 0.09, 0.09, 0.7]; });
      embers.spawn(h, 60 * fireAmt, (q, r) => { q.p = [(r() - 0.5) * 22, topY + 2 + r() * 6, hallZ + 6]; q.v = [(r() - 0.5) * 1.5, 2 + r() * 2, 1 + r()]; q.life = 3; q.size = 0.025; q.col = [1, 0.6, 0.2, 1]; q.drag = 0.4; });
      fire.step(h, () => [0.4, 0.5, 0]); smoke.step(h, () => [0.5, 0.1, 0]); embers.step(h, (p, q) => [Math.sin(q.seed * 30 + t) * 1.5, -0.3, 0.3]);
      const ff = (k) => 0.75 + 0.25 * Math.sin(t * 9 + k * 2) * Math.sin(t * 5.7 + k);
      for (let k = 0; k < 3; k++) lights.push({ pos: [(k - 1) * 9, topY + 6, hallZ + 4], col: [2.2 * fireAmt * ff(k), 0.8 * fireAmt * ff(k), 0.2 * fireAmt], radius: 8 + 4 * fireAmt });
      // part c：龙旗与皇帝
      const figs = [old, ...guards.map((g) => g.a).filter((a) => a.W && !(part === 'c'))];
      if (part === 'c') {
        const bp = [3.6, topY, -nSteps * stepD - 3.0];
        const fallA = smoother(1.2, 3.6, t) * 1.45;
        // 旗杆向左倒下，横穿画面（不再朝镜头砸过来）
        const poleRot = mmul(translate(bp), rotZ(fallA));
        items.push({ mesh: poleM, model: poleRot });
        if (!banner) banner = new Cloth(10, 14, (i, j) => add(bp, [0.05, 8.8 - j * 0.32, 0.12 + i * 0.25]), { colorFn: (u, v) => { const d = Math.hypot(u - 0.55, v - 0.45); return d < 0.18 ? [0.75, 0.6, 0.25, 0.8] : [0.32, 0.04, 0.04, 0.85]; }, damping: 0.97 });
        for (let i = 0; i < 10; i++) banner.setPin(i, 0, add(bp, [-Math.sin(fallA) * 8.8, Math.cos(fallA) * 8.8, 0.12 + i * 0.25]));
        const burn = smooth(0.3, 4.5, t);
        banner.step(h, { force: (p) => [0.6, 1.5 * burn, 1.2], gravity: -7, iters: 6, ground: topY });
        banner.upload();
        items.push({ mesh: banner.mesh, twoSided: true });
        // 旗上的火
        for (let k = 0; k < 4; k++) { const pp = banner.get(Math.floor(R0() * 10), Math.floor(R0() * 14)); fire.emit((q, r) => { q.p = pp; q.v = [0, 1.2, 0]; q.life = 0.45; q.size = 0.14; q.col = [1, 1, 1, 0.5 * burn]; }); }
        const ep = [-0.6, topY, -nSteps * stepD - 1.4];
        emperor.update({ pos: add(ep, [0, emperor.T.body.J.pelvis[1] - 0.02, 0]), yaw: 0.2, lean: [-0.05, 0, 0], head: [-0.25, 0, 0], handR: add(ep, [-0.15, 2.05, 0.15]), elbowR: [-1, 0, 0.3], handL: add(ep, [0.2, 0.85, 0.1]), footL: add(ep, [0.12, 0.085, 0.02]), footR: add(ep, [-0.15, 0.085, -0.1]) }, dt, env);
        items.push({ mesh: swordM, model: frameModel(emperor.W.wristR, [0.05, 1, 0.1]) });
        figs.push(emperor);
        // 皇帝身后的士兵
        soldiers.slice(0, 10).forEach((s, k) => {
          const p = [-4 + k * 0.9, topY, -nSteps * stepD - 0.2 + (k % 2) * 0.7];
          const J = s.a.T.body.J;
          const arm = 0.5 + 0.5 * Math.sin(t * 3 + k);
          s.a.update({ pos: add(p, [0, J.pelvis[1] - 0.02, 0]), yaw: Math.PI * 0.9, handR: add(p, [-0.2, J.pelvis[1] + 0.6 + arm * 0.5, -0.1]), elbowR: [0, -1, 0], footL: add(p, [0.1, 0.085, 0]), footR: add(p, [-0.12, 0.085, 0.06]) }, dt, env);
          items.push({ mesh: spearM, model: translate(add(s.a.W.wristR, [0, -0.3, 0])) });
          figs.push(s.a);
        });
      } else figs.push(...soldiers.map((s) => s.a));
      for (const a of figs) items.push(...a.items());
      // 镜头
      let cam;
      if (part === 'a') cam = { pos: keyed([[0, [1.2, topY + 1.9, -8.6]], [6, [1.0, topY + 1.7, -8.0]]], t), target: [0, 0.6, 2.0], fov: 30, dof: { focus: 11, aperture: 0.04 } };
      else if (part === 'b') cam = { pos: keyed([[0, [4.6, 1.3, 3.4]], [5, [4.4, 1.25, 1.6]]], t), target: add([0, 0.9, op[2] - 0.4], [0, 0, 0]), fov: 34, dof: { focus: 4.8, aperture: 0.05 } };
      else cam = { pos: keyed([[0, [6.5, topY + 1.4, -nSteps * stepD + 7]], [5, [5.8, topY + 1.6, -nSteps * stepD + 6]]], t), target: [0.8, topY + 3.6, -nSteps * stepD - 4], fov: 38, dof: { focus: 9, aperture: 0.03 } };
      return {
        cam,
        sun: { dir: sunDir, col: [0.16, 0.2, 0.32], shadow: { center: [0, topY * 0.5, -3], radius: 9, soft: 2.5 } },
        amb: { sky: [0.03, 0.035, 0.06], gnd: [0.02, 0.015, 0.012] }, rim: [0.12, 0.06, 0.03],
        sky: { top: [0.005, 0.008, 0.02], hor: [0.12, 0.05, 0.03], gnd: [0.02, 0.015, 0.012], stars: 0.4, moon: [-0.3, 0.4, -0.8, 0] },
        fog: { density: 0.02, falloff: 0.08, base: 0, max: 0.8, col: [0.06, 0.03, 0.025], sunCol: [0, 0, 0] },
        lights, items, figures: figureGroups(figs), particles: [smoke, fire, torchFire, embers],
        grade: { exposure: 0.95, sat: 0.92, contrast: 1.12, gain: [1.03, 0.98, 0.93], lift: [0.0, 0.0, 0.01], vignette: 0.55, grain: 0.045, bloom: 0.7, bloomThresh: 0.9 },
      };
    },
  };
}
// 剑的模型矩阵：剑格在 p，剑身沿 dir
function frameModel(p, dir) {
  const y = norm(dir); const up = Math.abs(y[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const x = norm([up[1] * y[2] - up[2] * y[1], up[2] * y[0] - up[0] * y[2], up[0] * y[1] - up[1] * y[0]]);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1];
}
export { frameModel };
