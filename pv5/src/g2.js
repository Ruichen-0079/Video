// 二维小工具：矩阵、平滑路径、确定性随机、缓动
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const TAU = Math.PI * 2;

// 关键帧：[[t, v], ...]，v 可以是数或数组；段间用 smoother
export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (t <= t1) {
      const f = smoother(t0, t1, t);
      return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], f)) : lerp(a, b, f);
    }
  }
  return keys[keys.length - 1][1];
}

// 确定性随机
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function noise1(x) { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }

// 2×3 仿射矩阵 [a b c d e f]：x' = a x + c y + e, y' = b x + d y + f
export const M = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  tr: (x, y) => [1, 0, 0, 1, x, y],
  rot: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; },
  sc: (x, y = x) => [x, 0, 0, y, 0, 0],
  ap: (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]],
  angle: (m) => Math.atan2(m[1], m[0]),
};
export const chain = (...ms) => ms.reduce((a, b) => M.mul(a, b));

// 过一串点的平滑曲线（Catmull-Rom → 三次贝塞尔）。closed 时首尾相接。
export function curve(ctx, pts, closed = false, tension = 0.5, move = true) {
  const n = pts.length;
  if (n < 2) return;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  if (move) ctx.moveTo(pts[0][0], pts[0][1]); else ctx.lineTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
// 折线（尖角）与曲线混合：点可以带第三个值 1 表示尖角
export function shape(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
export const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

// 两段 IK：从 a 出发，长度 l1、l2，够到 t；bend = ±1 决定弯曲方向。返回两段的绝对角（0 = 指向下方，逆时针为正）
export function ik2(a, t, l1, l2, bend = 1) {
  const dx = t[0] - a[0], dy = t[1] - a[1];
  let d = Math.hypot(dx, dy);
  d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, d));
  const base = Math.atan2(dx, -dy);          // 相对「向下」的角
  const c1 = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a1 = base + bend * Math.acos(clamp(c1, -1, 1));
  const ex = a[0] + Math.sin(a1) * l1, ey = a[1] - Math.cos(a1) * l1;
  const a2 = Math.atan2(t[0] - ex, -(t[1] - ey));
  return [a1, a2];
}
