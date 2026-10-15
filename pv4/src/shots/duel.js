// 周：黄昏的荒原。年轻的明布川与一个天才相向而立，交错而过——那人的左臂落下，他跪倒。（设定 5.5）
import { Actor, figureGroups } from '../actor.js';
import { Geo, grid, sdfMesh, sdCapsule, smin } from '../mesh.js';
import { grassField } from '../renderer.js';
import { jian } from '../props.js';
import { Particles } from '../particles.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, rotX, clamp, qaxis, qmul, qrot, compose } from '../math.js';
import { walkCycle as walk } from '../figure.js';
import { stand, kneel, loc } from '../poses.js';
import { MBC, SKIN } from '../cast.js';
import { frameModel } from './siege.js';

export const GENIUS = { height: 1.75, sex: 'm', hair: 'topknot', sleeve: 'wide', colors: { skin: SKIN.warm, robe: [0.62, 0.58, 0.5], robe2: [0.3, 0.26, 0.2], inner: [0.75, 0.72, 0.66], hair: [0.04, 0.04, 0.04], belt: [0.35, 0.12, 0.1], shoe: [0.08, 0.06, 0.05] } };

export default function duel(R, args) {
  const R0 = rng(61);
  const H = (x, z) => 0.25 * fbm2(x * 0.04, z * 0.04);
  const terrain = grid(400, 400, 80, 80, H, (x, z) => { const n = fbm2(x * 0.1, z * 0.1); return [0.36 + 0.05 * n, 0.3 + 0.04 * n, 0.18, 0.95]; }, null, -200, -200).upload();
  const grass = grassField(70000, () => { const x = (R0() - 0.5) * 30, z = (R0() - 0.5) * 18 - 2; return { a: [x, z, 0.35 + 0.35 * R0(), R0()], b: [0.5 + 0.1 * R0(), 0.42 + 0.06 * R0(), 0.22, 0.012] }; });
  const swordM = jian().upload();
  const mbc = new Actor(MBC, { skirt: { len: 0.95, flare: 1.9, color: MBC.colors.robe, color2: MBC.colors.robe2 } });
  const gen = new Actor(GENIUS, { skirt: { len: 0.95, flare: 1.9, color: GENIUS.colors.robe, color2: GENIUS.colors.robe2 } });
  // 落下的手臂（另做一个网格）
  const J = gen.T.body.J;
  const armGeo = sdfMesh((x, y, z) => smin(sdCapsule([x, y, z], [0, 0, 0], [0, -0.25, 0], 0.05, 0.042), sdCapsule([x, y, z], [0, -0.25, 0], [0, -0.36, 0.01], 0.03, 0.022), 0.02),
    (x, y, z) => ({ c: y > -0.22 ? [...GENIUS.colors.robe, 0.85] : [...SKIN.warm, 0.55], m: [0, y > -0.22 ? 0 : 0.6, y > -0.22 ? 0.7 : 0, 1] }), [-0.08, -0.42, -0.08], [0.08, 0.06, 0.08], 0.01);
  const armM = armGeo.upload();
  const blood = new Particles(200, 'blood', 3);
  const cutT = args.cutT ?? 2.15;
  let armState = null;
  return {
    frame(t, dt) {
      const h = dt || 1 / 30;
      const env = { wind: [0.6, 0, 0.1], t, ground: 0 };
      const items = [{ mesh: terrain }];
      // 两人从 x = ∓3 冲向对方，在 x = 0 交错
      const run = { stride: 1.2, lift: 0.14, bob: 0.03 };
      const go = smoother(cutT - 1.55, cutT, t);   // 先对峙，再冲刺
      const after = smooth(cutT, cutT + 0.5, t);
      // 明布川：自左向右
      {
        const d = go * 4.6 + after * 0.4;
        const wc = walk(mbc.T.body.J, [-3.0, 0, 0.25], [1, 0, 0], d, run);
        const swing = smoother(cutT - 0.18, cutT + 0.05, t);
        const hand = swing > 0 ? loc(wc.pelvis, Math.PI / 2, [-0.25 - swing * 0.15, 0.25 - swing * 0.35, 0.3 + swing * 0.25]) : loc(wc.pelvis, Math.PI / 2, [-0.25, -0.1, 0.1]);
        const sdir = swing > 0 ? norm(lerp3([0.3, 0.9, 0.2], [1, -0.3, -0.4], swing)) : norm([0.5, -0.8, 0.2]);
        const stopped = t > cutT + 0.4;
        mbc.update({ pos: add(wc.pelvis, [0, -0.08 * (1 - after), 0]), yaw: Math.PI / 2, lean: [0.35 * (1 - after) + 0.05, 0, 0], head: [0.05, stopped ? 0.0 : 0, 0], handR: hand, elbowR: [0, -1, -0.5], handL: loc(wc.pelvis, Math.PI / 2, [0.25, -0.15, -0.1]), footL: wc.footL, footR: wc.footR }, dt, env);
        items.push({ mesh: swordM, model: frameModel(mbc.W.wristR, sdir) });
      }
      // 天才：自右向左，交错之后左臂落下，跪倒
      {
        const d = go * 4.4 + after * 0.3;
        const wc = walk(gen.T.body.J, [3.0, 0, -0.25], [-1, 0, 0], d, run);
        const k = smoother(cutT + 0.3, cutT + 1.4, t);
        let pose;
        if (t < cutT + 0.3) {
          pose = { pos: add(wc.pelvis, [0, -0.08, 0]), yaw: -Math.PI / 2, lean: [0.35, 0, 0], handR: loc(wc.pelvis, -Math.PI / 2, [-0.25, 0.2, 0.35]), elbowR: [0, -1, 0], handL: loc(wc.pelvis, -Math.PI / 2, [0.25, -0.1, 0.1]), footL: wc.footL, footR: wc.footR };
        } else {
          const o = [wc.pelvis[0], 0, wc.pelvis[2]];
          pose = kneel(gen.T.body.J, o, -Math.PI / 2, k, { lean: [0.25 + 0.3 * k, 0, 0.15], head: [0.4 * k, 0, 0], handR: [0.18, 1.0 - 0.35 * k, 0.15] });
          pose.handL = loc(o, -Math.PI / 2, [0.3, 0.9 - 0.3 * k, -0.15]);
        }
        gen.update(pose, dt, env);
        if (t < cutT + 0.6) items.push({ mesh: swordM, model: frameModel(gen.W.wristR, norm(t < cutT + 0.3 ? [-0.6, 0.5, 0.2] : [0, -1, 0.2])) });
        // 断臂：左小臂与手的骨骼缩成一点，另一个网格落下
        if (t >= cutT) {
          const g = gen.mats;
          for (const b of [6, 7]) { for (let q = 0; q < 12; q++) g[b * 16 + q] *= 0.0001; const e = gen.W.elbowL; g[b * 16 + 12] = e[0]; g[b * 16 + 13] = e[1]; g[b * 16 + 14] = e[2]; }
          if (!armState) armState = { p: gen.W.elbowL.slice(), v: [-1.2, 1.2, 0.4], a: 0, w: 7 };
          armState.v[1] -= 9.8 * h; armState.p = add(armState.p, mul(armState.v, h)); armState.a += armState.w * h;
          if (armState.p[1] < 0.06) { armState.p[1] = 0.06; armState.v = [armState.v[0] * 0.3, 0, armState.v[2] * 0.3]; armState.w *= 0.3; }
          items.push({ mesh: armM, model: mmul(translate(armState.p), mmul(rotY(0.3), rotX(armState.a))) });
          if (t < cutT + 0.5) blood.spawn(h, 120, (q, r) => { q.p = gen.W.elbowL; q.v = [(r() - 0.7) * 2, r() * 1.5, (r() - 0.5) * 1]; q.grav = -9.8; q.life = 0.8; q.size = 0.012; q.col = [0.25, 0.02, 0.02, 0.9]; q.floor = 0.02; q.stick = true; });
        }
        blood.step(h);
      }
      items.push(...mbc.items(), ...gen.items());
      const flash = Math.exp(-Math.pow((t - cutT) / 0.04, 2));
      let cam = { pos: keyed([[0, [0.6, 0.95, 9.5]], [cutT + 2.9, [0.2, 0.9, 8.6]]], t), target: [0, 1.15, 0], fov: 30, dof: { focus: 9, aperture: 0.03 } };
      if (args.part === 'b' && armState) {
        // 特写：断臂落在草里，后面跪着的人虚了
        const ap = armState.p;
        cam = { pos: add(ap, [-0.55, 0.22, 0.75]), target: add(ap, [0.1, 0.05, -0.3]), fov: 32, dof: { focus: 0.95, aperture: 0.14, maxR: 9 } };
      }
      return {
        cam,
        sun: { dir: norm([0.62, 0.07, -0.78]), col: [1.6, 0.75, 0.35], shadow: { center: [0, 1, 0], radius: 5, soft: 2 } },
        amb: { sky: [0.1 + flash, 0.08 + flash, 0.1 + flash], gnd: [0.06, 0.04, 0.03] }, rim: [0.8, 0.4, 0.15],
        sky: { top: [0.08, 0.08, 0.18], hor: [1.0, 0.42, 0.16], gnd: [0.2, 0.12, 0.08], sunDisc: [0.99945, 26, 1.4, 7], clouds: 0.5, cloudCol: [0.5, 0.2, 0.12], cloudY: 1.1 },
        fog: { density: 0.012, falloff: 0.15, max: 0.8, col: [0.5, 0.26, 0.15], sunCol: [1.0, 0.45, 0.15] },
        items, figures: figureGroups([mbc, gen]), grass: { mesh: grass.mesh, n: grass.n, wind: [0.7, 0.1], gust: 0.6 }, particles: [blood],
        grade: { exposure: 0.95, sat: 0.95, contrast: 1.15, gain: [1.04, 0.98, 0.92], lift: [0.01, 0.0, 0.0], vignette: 0.55, grain: 0.04, bloom: 0.7 },
      };
    },
  };
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
