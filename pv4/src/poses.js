// 常用姿态：站、走、剑式、跪、倒地
import { add, sub, mul, norm, lerp, smooth, smoother, qaxis, qrot, keyed, clamp } from './math.js';
import { walkCycle } from './figure.js';

const dirOf = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
const leftOf = (yaw) => [Math.cos(yaw), 0, -Math.sin(yaw)];
// 局部坐标（右手 x 为负）→ 世界：o = 原点（地面上的脚底中点），yaw 朝向
export const loc = (o, yaw, v) => add(o, add(add(mul(leftOf(yaw), v[0]), [0, v[1], 0]), mul(dirOf(yaw), v[2])));

// 站立
export function stand(J, o, yaw, { lean = [0, 0, 0], head = [0, 0, 0], handL = null, handR = null, width = 1, crouch = 0, footFwd = 0 } = {}) {
  return {
    pos: loc(o, yaw, [0, J.pelvis[1] - 0.02 - crouch, 0]), yaw, lean, head,
    footL: loc(o, yaw, [J.hipL[0] * width + 0.01, J.ankleL[1], footFwd]), footR: loc(o, yaw, [-J.hipL[0] * width - 0.01, J.ankleL[1], -footFwd * 0.5]),
    handL: handL ? loc(o, yaw, handL) : null, handR: handR ? loc(o, yaw, handR) : null,
  };
}
// 走：沿 yaw 方向，从 o 走 dist；手臂随步摆动
export function walking(J, o, yaw, dist, { stride = 0.5, lift = 0.05, bob = 0.02, swing = 0.18, lean = [0.04, 0, 0], head = [0, 0, 0], hands = true } = {}) {
  const wc = walkCycle(J, o, dirOf(yaw), dist, { stride, lift, bob });
  const s = wc.swing;
  const p = wc.pelvis;
  return {
    pos: p, yaw, lean, head, footL: wc.footL, footR: wc.footR,
    handL: hands ? loc(p, yaw, [0.2, -0.42, s * swing]) : null, handR: hands ? loc(p, yaw, [-0.2, -0.42, -s * swing]) : null,
    elbowL: loc([0, 0, 0], yaw, [0.4, -0.3, -1]), elbowR: loc([0, 0, 0], yaw, [-0.4, -0.3, -1]),
  };
}
// 剑式：u ∈ [0,1]。起势（剑垂于右下）→ 自右下向左上的一道弧 → 回身前刺。返回姿态与剑的方向
export function swordForm(J, o, yaw, u, { scale = 1 } = {}) {
  const K = [
    [0.0, { hand: [-0.28, 0.82, 0.12], dir: [-0.3, -0.9, 0.3], lean: [0.05, 0, 0], step: 0, crouch: 0.0, tw: 0 }],
    [0.3, { hand: [-0.42, 0.95, 0.35], dir: [-0.6, -0.2, 0.75], lean: [0.12, 0, -0.25], step: 0.25, crouch: 0.08, tw: -0.4 }],
    [0.55, { hand: [0.15, 1.55, 0.4], dir: [0.7, 0.55, 0.45], lean: [-0.05, 0.1, 0.35], step: 0.3, crouch: 0.03, tw: 0.5 }],
    [0.75, { hand: [0.05, 1.3, 0.2], dir: [0.2, 0.9, -0.1], lean: [0.0, 0.0, 0.1], step: 0.15, crouch: 0.0, tw: 0.1 }],
    [1.0, { hand: [-0.08, 1.2, 0.7], dir: [0.0, 0.05, 1], lean: [0.22, 0, 0], step: 0.55, crouch: 0.15, tw: 0 }],
  ];
  let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
  const [u0, A] = K[i], [u1, B] = K[i + 1];
  const f = smoother(u0, u1, u);
  const L = (a, b) => (Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], f)) : lerp(a, b, f));
  const hand = L(A.hand, B.hand), dir = L(A.dir, B.dir), lean = L(A.lean, B.lean), step = L(A.step, B.step), crouch = L(A.crouch, B.crouch), tw = L(A.tw, B.tw);
  const pose = {
    pos: loc(o, yaw, [0, J.pelvis[1] - 0.02 - crouch, step * 0.4]), yaw, lean: [lean[0], lean[1], tw], head: [0.05, tw * 0.3, 0],
    footL: loc(o, yaw, [0.12, J.ankleL[1], step * 0.9]), footR: loc(o, yaw, [-0.14, J.ankleL[1], -0.15]),
    handR: loc(o, yaw, [hand[0] * scale, hand[1], hand[2]]), elbowR: loc([0, 0, 0], yaw, [-1, -0.4, -0.2]),
    handL: loc(o, yaw, [0.32, 1.15 - crouch, -0.05]), elbowL: loc([0, 0, 0], yaw, [1, -0.2, -0.5]),
  };
  return { pose, swordDir: norm(loc([0, 0, 0], yaw, dir)) };
}
// 跪：一膝着地
export function kneel(J, o, yaw, k = 1, { lean = [0.3, 0, 0], head = [0.3, 0, 0], handL = null, handR = null } = {}) {
  return {
    pos: loc(o, yaw, [0, J.pelvis[1] - 0.02 - k * 0.42, -k * 0.05]), yaw, lean, head,
    footL: loc(o, yaw, [0.12, J.ankleL[1], 0.32 * k]), footR: loc(o, yaw, [-0.12, J.ankleL[1] + 0.02 * k, -0.42 * k]),
    kneeL: loc([0, 0, 0], yaw, [0, 0.4, 1]), kneeR: loc([0, 0, 0], yaw, [0, -1, 0.6]),
    handL: handL ? loc(o, yaw, handL) : null, handR: handR ? loc(o, yaw, handR) : null,
  };
}
export { dirOf, leftOf };
