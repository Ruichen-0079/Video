// 表演：常用姿态与「把手伸到舞台上某一点」
import { drawPuppet, rest, walkPose, reach, blend, toStage, toLocal, fk, rods } from './puppet.js';
import { keyed, lerp, smooth, smoother, clamp, TAU } from './g2.js';
export { rest, walkPose, blend, toStage, toLocal, fk };

// 画一个偶。o = { x, y, s, face, rot, t, fade, hold, hand, rods }
export function put(ctx, P, pose, o) {
  const J = drawPuppet(ctx, P, pose, o);
  if (o.rods) rods(ctx, J, o, { len: o.rodLen || 70 });
  return J;
}
// 让手够到舞台坐标 q（会改 pose）
export function reachTo(P, pose, o, side, q, bend = 1) {
  return { ...pose, ...reach(P, pose, side, toLocal(o, q), bend) };
}
// 常用姿态
export const POSE = {
  stand: (v = {}) => ({ ...rest(), ...v }),
  // 双手拢在身前（行礼、恭立）
  folded: (v = {}) => ({ ...rest(), aF: 0.55, eF: 1.3, aB: 0.45, eB: 1.35, head: 0.1, ...v }),
  // 双手背在身后
  behind: (v = {}) => ({ ...rest(), aF: -0.35, eF: -0.6, aB: -0.3, eB: -0.6, ...v }),
  // 跪：一膝着地
  kneel: (k = 1, v = {}) => ({ ...rest(), legF: [lerp(0.05, 1.45, k), lerp(0.02, 1.5, k)], legB: [lerp(-0.03, -0.15, k), lerp(0.02, 2.5, k)], lean: 0.12 * k, ...v }),
  // 坐在地上（屈膝）
  sitGround: (v = {}) => ({ ...rest(), legF: [1.35, 1.9], legB: [1.2, 1.7], seat: true, lean: 0.12, ...v }),
  // 坐凳
  sitBench: (v = {}) => ({ ...rest(), legF: [1.5, 1.5], legB: [1.45, 1.55], ...v }),
  // 握剑在身侧（剑尖斜指地面）
  guard: (v = {}) => ({ ...rest(), aF: 0.35, eF: 0.6, legF: [0.28, 0.1], legB: [-0.3, 0.15], lean: 0.08, ...v }),
  // 举剑过顶
  raise: (v = {}) => ({ ...rest(), aF: 2.9, eF: 0.15, legF: [0.3, 0.1], legB: [-0.32, 0.1], lean: -0.06, head: -0.1, ...v }),
  // 劈下 / 横斩后的收势
  cut: (v = {}) => ({ ...rest(), aF: 1.0, eF: 0.1, legF: [0.6, 0.5], legB: [-0.55, 0.2], lean: 0.32, ...v }),
  // 前刺
  thrust: (v = {}) => ({ ...rest(), aF: 1.55, eF: 0.0, aB: -0.6, eB: 0.4, legF: [0.65, 0.45], legB: [-0.55, 0.15], lean: 0.25, ...v }),
};
// 走：x 从 x0 以 speed 前进，返回 { x, pose }
export function walking(x0, speed, t, { stride = 0.42, cadence = null, ...rest_ } = {}) {
  const x = x0 + speed * t;
  const cad = cadence || Math.abs(speed) / 16;            // 每秒几个完整步态周期
  return { x, pose: walkPose(t * cad, { stride, ...rest_ }) };
}
// 跑
export function running(x0, speed, t, o = {}) {
  return walking(x0, speed, t, { stride: 0.7, lift: 1.1, swing: 0.8, lean: 0.22, cadence: Math.abs(speed) / 26, ...o });
}
// 剑式：同一套招式的五个关键姿态，u ∈ [0, 1]
export function swordForm(u) {
  const K = [
    [0.0, { ...POSE.guard(), hold: 0.9 }],
    [0.25, { ...rest(), aF: 0.6, eF: 1.2, aB: 0.3, eB: 0.6, legF: [0.45, 0.25], legB: [-0.35, 0.1], lean: 0.1, hold: 2.3 }],
    [0.5, { ...POSE.raise(), aB: 1.6, eB: 0.6, hold: 3.5 }],
    [0.72, { ...POSE.cut(), aB: -0.5, eB: 0.3, hold: 1.25 }],
    [1.0, { ...POSE.thrust(), hold: 1.57 }],
  ];
  let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
  const f = smoother(K[i][0], K[i + 1][0], u);
  const p = blend(K[i][1], K[i + 1][1], f);
  return { pose: p, swordAng: p.hold };
}
