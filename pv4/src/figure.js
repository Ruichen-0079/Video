// 人物：骨架、有向距离场雕出来的身体（含脸、发、衣）、蒙皮权重、IK 姿态
//
// 坐标：y 向上，人物面向 +z，左手在 +x。
import { Geo, sdfMesh, sdCapsule, sdEllipsoid, sdSphere, sdBox, smin, smax } from './mesh.js';
import { add, sub, mul, norm, cross, dot, len, lerp, clamp, mix3, qrot, qaxis, qmul, xform } from './math.js';

export const BONES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'uarmL', 'farmL', 'handL', 'uarmR', 'farmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
export const NB = BONES.length;
const B = Object.fromEntries(BONES.map((b, i) => [b, i]));

// 静止姿态的关节位置（A 字形）
export function restJoints(P) {
  const H = P.height || 1.7, s = H / 1.7;
  const f = P.sex === 'f', child = P.age === 'child';
  const k = child ? 1.0 : 1.0;
  const shW = (f ? 0.165 : 0.185) * (P.build || 1) * (child ? 0.85 : 1);
  const hipW = f ? 0.098 : 0.092;
  // 孩子：头大、腿短
  const legF = child ? 0.9 : 1.0;
  const J = {
    pelvis: [0, 0.96 * legF, 0], spine: [0, 1.10, 0], chest: [0, 1.30, 0], neck: [0, 1.465, 0], head: [0, 1.555, 0.005], headTop: [0, 1.73, 0.0],
    shoulderL: [shW, 1.425, -0.005], elbowL: [shW + 0.07, 1.16, -0.02], wristL: [shW + 0.11, 0.915, 0.0], handEndL: [shW + 0.12, 0.82, 0.015],
    hipL: [hipW, 0.93 * legF, 0], kneeL: [hipW + 0.005, 0.5 * legF, 0.01], ankleL: [hipW + 0.005, 0.085, -0.01], toeL: [hipW + 0.01, 0.02, 0.14],
  };
  if (child) {
    // 孩子：躯干与四肢按 0.62 缩放，头只缩到 0.8
    for (const key in J) J[key] = J[key].map((v, i) => (i === 1 ? v : v));
  }
  for (const side of ['shoulder', 'elbow', 'wrist', 'handEnd', 'hip', 'knee', 'ankle', 'toe']) { const L = J[side + 'L']; J[side + 'R'] = [-L[0], L[1], L[2]]; }
  // 整体缩放
  const out = {};
  for (const key in J) out[key] = J[key].map((v) => v * s * k);
  out._s = s;
  return out;
}

export function boneEnds(J) {
  return [
    ['pelvis', 'spine'], ['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['head', 'headTop'],
    ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['wristL', 'handEndL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR'], ['wristR', 'handEndR'],
    ['hipL', 'kneeL'], ['kneeL', 'ankleL'], ['ankleL', 'toeL'], ['hipR', 'kneeR'], ['kneeR', 'ankleR'], ['ankleR', 'toeR'],
  ].map(([a, b]) => [J[a], J[b]]);
}
// 骨骼参考「前方」：手臂与躯干朝前，腿的膝盖朝前，脚的参考是上方
const REST_HINT = [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0]];

// 由起点、终点、参考方向构造骨骼坐标系（列主序 mat4）：y 沿骨骼，z 为参考方向正交化
export function frame(a, b, hint) {
  const y = norm(sub(b, a));
  let z = sub(hint, mul(y, dot(hint, y)));
  if (len(z) < 1e-5) z = sub([0, 1, 0], mul(y, y[1])), z = len(z) < 1e-5 ? [1, 0, 0] : z;
  z = norm(z); const x = cross(y, z);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, a[0], a[1], a[2], 1];
}
function invRigid(m) {
  // 刚体变换求逆
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  const t = [m[12], m[13], m[14]];
  r[12] = -(r[0] * t[0] + r[4] * t[1] + r[8] * t[2]); r[13] = -(r[1] * t[0] + r[5] * t[1] + r[9] * t[2]); r[14] = -(r[2] * t[0] + r[6] * t[1] + r[10] * t[2]);
  return r;
}

// ───────────────────────── 身体：有向距离场
// P: { height, sex:'m'|'f', age:'adult'|'child'|'old', build, robe:{len:0..1, flare}, sleeve:'wide'|'narrow'|'none',
//      hair:'bun'|'topknot'|'long'|'short'|'none', horns:null|'antler'|'ox'|'dragon', ears:null|'fox'|'cat', armor:false,
//      colors:{skin, robe, robe2, inner, hair, belt, shoe, horn}, cell }
export function bodySDF(P, J) {
  const s = J._s, f = P.sex === 'f', child = P.age === 'child', old = P.age === 'old';
  const C = P.colors;
  const hs = child ? 1.18 : 1.0;                  // 孩子头大一些
  const headC = add(J.head, [0, 0.06 * s * hs, 0]);
  const hr = [0.083 * s * hs, 0.105 * s * hs, 0.097 * s * hs];
  const prims = [];
  const P_ = (fn, mat, bound) => prims.push({ fn, mat, bound });
  const k = 0.035 * s;
  // 躯干（外衣）
  const chestR = [(f ? 0.138 : 0.158) * s * (P.build || 1), 0.15 * s, (f ? 0.1 : 0.105) * s];
  const waistR = [(f ? 0.115 : 0.135) * s, 0.12 * s, 0.095 * s];
  const robeT = P.armor ? 0.018 * s : 0.01 * s;
  P_((p) => smin(smin(sdEllipsoid(p, add(J.chest, [0, 0.02 * s, 0.0]), chestR), sdEllipsoid(p, add(J.spine, [0, -0.02 * s, 0]), waistR), k * 1.6),
    sdEllipsoid(p, add(J.pelvis, [0, 0, 0]), [(f ? 0.16 : 0.15) * s, 0.11 * s, 0.115 * s]), k * 1.4) - robeT, 'torso', [J.spine, 0.42 * s]);
  // 肩
  for (const side of ['L', 'R']) P_((p) => sdCapsule(p, add(J.chest, [0, 0.13 * s, -0.005 * s]), add(J['shoulder' + side], [0, -0.012 * s, 0]), (f ? 0.042 : 0.048) * s, (f ? 0.046 : 0.052) * s) - robeT, 'torso', [J['shoulder' + side], 0.2 * s]);
  // 颈
  P_((p) => sdCapsule(p, add(J.neck, [0, -0.05 * s, 0]), add(J.head, [0, 0.03 * s, 0]), 0.047 * s * (f ? 0.9 : 1)), 'skin', [J.neck, 0.15 * s]);
  // 头：颅、下颌、鼻、眉弓、眼窝、耳
  const head = (p) => {
    let d = sdEllipsoid(p, headC, hr);
    d = smin(d, sdEllipsoid(p, add(headC, [0, -0.055 * s * hs, 0.028 * s]), [0.062 * s * hs, 0.05 * s * hs, 0.068 * s * hs]), 0.03 * s);
    d = smin(d, sdCapsule(p, add(headC, [0, 0.005 * s, 0.088 * s * hs]), add(headC, [0, -0.033 * s, 0.104 * s * hs]), 0.0115 * s), 0.012 * s);
    for (const sx of [1, -1]) {
      d = smin(d, sdCapsule(p, add(headC, [sx * 0.012 * s, 0.03 * s, 0.087 * s * hs]), add(headC, [sx * 0.048 * s, 0.028 * s, 0.075 * s * hs]), 0.011 * s), 0.012 * s);
      d = smax(d, -sdSphere(p, add(headC, [sx * 0.033 * s * hs, 0.012 * s * hs, 0.104 * s * hs]), 0.012 * s * hs), 0.01 * s);
      d = smin(d, sdEllipsoid(p, add(headC, [sx * 0.083 * s * hs, -0.005 * s, -0.005 * s]), [0.011 * s, 0.028 * s, 0.019 * s]), 0.01 * s);
    }
    return d;
  };
  P_(head, 'skin', [headC, 0.16 * s * hs]);
  // 发
  if (P.hair !== 'none') {
    const hairCap = (p) => {
      let d = sdEllipsoid(p, add(headC, [0, 0.012 * s, -0.012 * s]), [hr[0] + 0.011 * s, hr[1] + 0.008 * s, hr[2] + 0.012 * s]);
      // 发际线：去掉脸前方、发际线以下的部分
      const q = sub(p, headC);
      const yh = (P.sex === 'f' ? 0.05 : 0.062) * s * hs + 0.18 * q[2];
      const region = smax(0.022 * s - q[2], q[1] - yh, 0.012 * s);
      d = smax(d, -region, 0.01 * s);
      d = smax(d, -(q[1] + 0.05 * s + Math.max(0, -q[2]) * 0.25), 0.02 * s);   // 下缘：后脑低一些
      if (P.hair === 'long' || P.hair === 'loose') d = smin(d, sdEllipsoid(p, add(headC, [0, -0.07 * s, -0.06 * s]), [0.085 * s, 0.11 * s, 0.05 * s]), 0.03 * s);
      return d;
    };
    P_(hairCap, 'hair', [headC, 0.2 * s]);
    if (P.hair === 'bun') P_((p) => sdSphere(p, add(headC, [0, 0.085 * s, -0.075 * s]), 0.042 * s), 'hair', [headC, 0.22 * s]);
    if (P.hair === 'topknot') P_((p) => smin(sdSphere(p, add(headC, [0, 0.115 * s, -0.01 * s]), 0.032 * s), sdCapsule(p, add(headC, [0, 0.1 * s, -0.01 * s]), add(headC, [0, 0.13 * s, -0.01 * s]), 0.022 * s), 0.01 * s), 'hair', [headC, 0.25 * s]);
    if (P.hair === 'twin') for (const sx of [1, -1]) P_((p) => sdSphere(p, add(headC, [sx * 0.07 * s, 0.07 * s, -0.04 * s]), 0.035 * s), 'hair', [headC, 0.22 * s]);
  }
  // 硬质下摆（人群用）：从腰到膝/踝的一圈布，跟着骨盆走
  if (P.tunic) {
    const top = add(J.spine, [0, -0.08 * s, 0]);
    const L = (J.spine[1] - 0.08 * s - J.ankleL[1]) * P.tunic;
    const r0 = [0.16 * s, 0.125 * s], r1 = [(0.2 + 0.1 * P.tunic) * s, (0.16 + 0.06 * P.tunic) * s];
    P_((p) => {
      const q = sub(p, top);
      const u = clamp(-q[1] / L, 0, 1);
      const rx = lerp(r0[0], r1[0], u), rz = lerp(r0[1], r1[1], u);
      const d = (Math.hypot(q[0] / rx, q[2] / rz) - 1) * Math.min(rx, rz);
      return Math.max(d, Math.max(q[1], -q[1] - L));
    }, 'tunic', [add(top, [0, -L / 2, 0]), L * 0.6 + 0.3 * s]);
  }
  // 帽：三角帽（十八世纪）、斗笠
  if (P.hat === 'tricorn') {
    const hc = add(headC, [0, 0.075 * s, -0.005 * s]);
    P_((p) => {
      const q = sub(p, hc);
      // 三角形的帽檐：到三条边的距离
      const a = Math.atan2(q[0], q[2]);
      const k = Math.cos(3 * (a + Math.PI / 3)) * 0.022 * s;
      const brim = Math.max(Math.hypot(q[0], q[2]) - 0.16 * s - k, Math.abs(q[1] + 0.012 * s - Math.max(0, Math.hypot(q[0], q[2]) - 0.1 * s) * 0.6) - 0.012 * s);
      const crown = sdEllipsoid(p, add(hc, [0, 0.02 * s, 0]), [0.095 * s, 0.06 * s, 0.1 * s]);
      return smin(brim, crown, 0.02 * s);
    }, 'hat', [hc, 0.22 * s]);
  }
  if (P.hat === 'straw') P_((p) => { const q = sub(p, add(headC, [0, 0.09 * s, 0])); return Math.max(Math.hypot(q[0], q[2]) - 0.24 * s, Math.abs(q[1] + Math.hypot(q[0], q[2]) * 0.35 - 0.06 * s) - 0.01 * s); }, 'hat', [headC, 0.3 * s]);
  // 胡须（老人）
  if (P.beard) P_((p) => smin(sdEllipsoid(p, add(headC, [0, -0.1 * s, 0.065 * s]), [0.045 * s, 0.075 * s, 0.035 * s]), sdCapsule(p, add(headC, [0, -0.07 * s, 0.07 * s]), add(headC, [0, -0.2 * s * P.beard, 0.06 * s]), 0.02 * s, 0.005 * s), 0.02 * s), 'hair', [headC, 0.3 * s]);
  // 角、耳（亚人特征）
  if (P.horns) {
    for (const sx of [1, -1]) {
      const base = add(headC, [sx * 0.045 * s, 0.085 * s, 0.01 * s]);
      if (P.horns === 'antler') {
        const a1 = add(base, [sx * 0.05 * s, 0.12 * s, -0.04 * s]), a2 = add(a1, [sx * 0.06 * s, 0.1 * s, -0.05 * s]);
        P_((p) => smin(smin(sdCapsule(p, base, a1, 0.013 * s, 0.009 * s), sdCapsule(p, a1, a2, 0.009 * s, 0.004 * s), 0.008 * s),
          sdCapsule(p, a1, add(a1, [sx * 0.0, 0.08 * s, 0.05 * s]), 0.007 * s, 0.003 * s), 0.006 * s), 'horn', [a1, 0.18 * s]);
      } else if (P.horns === 'ox') {
        const a1 = add(base, [sx * 0.09 * s, 0.02 * s, 0.0]), a2 = add(a1, [sx * 0.03 * s, 0.07 * s, 0.03 * s]);
        P_((p) => smin(sdCapsule(p, base, a1, 0.022 * s, 0.014 * s), sdCapsule(p, a1, a2, 0.014 * s, 0.003 * s), 0.01 * s), 'horn', [a1, 0.14 * s]);
      } else if (P.horns === 'dragon') {
        const a1 = add(base, [sx * 0.025 * s, 0.07 * s, -0.06 * s]), a2 = add(a1, [sx * 0.02 * s, 0.03 * s, -0.08 * s]);
        P_((p) => smin(sdCapsule(p, base, a1, 0.011 * s, 0.008 * s), sdCapsule(p, a1, a2, 0.008 * s, 0.002 * s), 0.008 * s), 'horn', [a1, 0.14 * s]);
      }
    }
  }
  if (P.ears) {
    for (const sx of [1, -1]) {
      const b0 = add(headC, [sx * 0.055 * s, 0.085 * s, -0.01 * s]), tip = add(b0, [sx * 0.035 * s, 0.075 * s, -0.005 * s]);
      P_((p) => sdCapsule(p, b0, tip, 0.026 * s, 0.004 * s), 'ear', [b0, 0.12 * s]);
    }
  }
  // 手臂：皮肤 + 袖
  for (const side of ['L', 'R']) {
    const sh = J['shoulder' + side], el = J['elbow' + side], wr = J['wrist' + side], he = J['handEnd' + side];
    P_((p) => smin(sdCapsule(p, sh, el, 0.048 * s, 0.04 * s), sdCapsule(p, el, wr, 0.04 * s, 0.031 * s), 0.02 * s), 'skin', [el, 0.3 * s]);
    if (P.sleeve !== 'none') {
      // 内袖（贴身）；宽大的外袖用布料模拟
      const mouth = add(wr, mul(norm(sub(wr, el)), -0.015 * s));
      P_((p) => {
        let d = smin(sdCapsule(p, sh, el, 0.052 * s, 0.046 * s), sdCapsule(p, el, mouth, 0.046 * s, 0.042 * s), 0.02 * s);
        const ax = norm(sub(mouth, el));
        d = smax(d, dot(sub(p, mouth), ax), 0.006 * s);
        return d;
      }, 'sleeve', [el, 0.34 * s]);
    }
    // 手：掌 + 拇指
    P_((p) => {
      const ax = norm(sub(he, wr));
      let d = sdCapsule(p, add(wr, mul(ax, 0.02 * s)), add(he, mul(ax, -0.005 * s)), 0.026 * s, 0.02 * s);
      d = smin(d, sdCapsule(p, add(wr, [side === 'L' ? -0.005 * s : 0.005 * s, -0.01 * s, 0.022 * s]), add(wr, [side === 'L' ? -0.01 * s : 0.01 * s, -0.055 * s, 0.035 * s]), 0.011 * s, 0.009 * s), 0.01 * s);
      return d;
    }, 'skin', [wr, 0.14 * s]);
  }
  // 腿：裤 + 鞋
  for (const side of ['L', 'R']) {
    const hp = J['hip' + side], kn = J['knee' + side], an = J['ankle' + side], to = J['toe' + side];
    P_((p) => smin(sdCapsule(p, hp, kn, 0.075 * s, 0.055 * s), sdCapsule(p, kn, an, 0.052 * s, 0.04 * s), 0.02 * s), 'inner', [kn, 0.5 * s]);
    P_((p) => sdCapsule(p, add(an, [0, -0.03 * s, -0.03 * s]), add(to, [0, 0.0, -0.02 * s]), 0.04 * s, 0.032 * s), 'shoe', [an, 0.22 * s]);
  }
  // 包围球加速
  const pre = prims.map((q) => ({ ...q, c: q.bound[0], r: q.bound[1] }));
  const K = 0.025 * s;
  const sdf = (x, y, z) => {
    const p = [x, y, z];
    let d = 1e9;
    for (const q of pre) {
      const lb = Math.hypot(x - q.c[0], y - q.c[1], z - q.c[2]) - q.r;
      if (lb > d + K) continue;
      d = smin(d, q.fn(p), K);
    }
    return d;
  };
  const matFn = (x, y, z) => {
    const p = [x, y, z];
    let best = 1e9, mat = 'torso';
    for (const q of pre) {
      const lb = Math.hypot(x - q.c[0], y - q.c[1], z - q.c[2]) - q.r;
      if (lb > best + 0.02) continue;
      const d = q.fn(p);
      // 优先：发与角盖过皮肤
      const bias = q.mat === 'hair' || q.mat === 'horn' || q.mat === 'ear' || q.mat === 'hat' ? -0.006 * s : q.mat === 'sleeve' || q.mat === 'tunic' ? -0.002 * s : 0;
      if (d + bias < best) { best = d + bias; mat = q.mat; }
    }
    return paint(mat, p, P, J, headC);
  };
  return { sdf, matFn, headC };
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// 材质着色：颜色(rgb)+粗糙度，m = [自发光, 次表面, 布料光泽, 遮蔽]
function paint(mat, p, P, J, headC) {
  const C = P.colors, s = J._s;
  let c, m = [0, 0, 0, 1];
  if (mat === 'skin') { c = [...C.skin, 0.55]; m = [0, 0.6, 0, 1]; }
  else if (mat === 'hair') { c = [...C.hair, 0.45]; m = [0, 0, 0.25, 1]; }
  else if (mat === 'horn') { c = [...(C.horn || [0.75, 0.68, 0.55]), 0.35]; m = [-1, 0.1, 0, 1]; }
  else if (mat === 'ear') { c = [...(C.ear || C.hair), 0.6]; m = [-1, 0.3, 0.25, 1]; }
  else if (mat === 'hat') { c = [...(C.hat || [0.05, 0.05, 0.06]), 0.7]; m = [0, 0, 0.5, 1]; }
  else if (mat === 'shoe') { c = [...(C.shoe || [0.08, 0.07, 0.06]), 0.6]; }
  else if (mat === 'inner') { c = [...(C.legs || C.robe.map((v) => v * 0.45)), 0.85]; m = [0, 0, 0.5, 1]; }
  else if (mat === 'tunic') {
    const hemY = J.spine[1] - 0.08 * s - (J.spine[1] - 0.08 * s - J.ankleL[1]) * P.tunic;
    c = p[1] - hemY < 0.04 * s ? [...(C.robe2 || C.robe), 0.8] : [...C.robe, 0.85]; m = [0, 0, 0.7, 1];
    return { c, m, extra: { tun: [1] } };
  }
  else {
    // 外衣：交领、腰带、袖缘
    c = [...C.robe, 0.85]; m = [0, 0, 0.7, 1];
    const y = p[1] / s, x = p[0] / s, zf = p[2] / s;
    if (mat === 'torso' || mat === 'sleeve') {
      const beltY = J.spine[1] / s - 0.075;
      if (mat === 'torso' && Math.abs(y - beltY) < 0.028) { c = [...(C.belt || C.robe2), 0.6]; m = [0, 0, 0.4, 1]; }
      // 交领：从左颈侧斜到右腋下（右衽）
      if (mat === 'torso' && zf > 0.02 && y > beltY + 0.02) {
        const e = Math.abs((x + 0.035) + (y - 1.44) * 0.62 * (P.sex === 'f' ? 1.1 : 1));
        if (e < 0.022) c = [...(C.robe2 || C.robe.map((v) => v * 1.3)), 0.75];
        else if (x + 0.035 + (y - 1.44) * 0.62 > 0 && y > 1.38 && Math.abs(x) < 0.04) c = [...(C.inner || [0.8, 0.78, 0.72]), 0.8];
      }
      if (mat === 'sleeve') {
        // 袖缘
        for (const side of ['L', 'R']) {
          const wr = J['wrist' + side], el = J['elbow' + side];
          const ax = norm(sub(wr, el)); const q = sub(p, wr); const along = dot(q, ax) / s;
          if (along > -0.06 && along < 0.02 && Math.abs(p[0] - wr[0]) < 0.2 * s) c = [...(C.robe2 || C.robe.map((v) => v * 1.3)), 0.75];
        }
      }
    }
  }
  return { c, m, extra: { tun: [0] } };
}

// 生成身体网格 + 蒙皮权重
export function buildBody(P) {
  const J = restJoints(P);
  const { sdf, matFn, headC } = bodySDF(P, J);
  const s = J._s;
  const pad = 0.12 * s;
  const geo = sdfMesh(sdf, matFn, [-0.5 * s - (P.horns ? 0.1 : 0), -0.02, -0.3 * s], [0.5 * s, J.headTop[1] + pad + (P.horns ? 0.15 * s : 0), 0.3 * s], P.cell || 0.009 * s);
  // 环境遮蔽：沿法线往外采样距离场，凹处变暗
  for (let v = 0; v < geo.count; v++) {
    const p = [geo.p[v * 3], geo.p[v * 3 + 1], geo.p[v * 3 + 2]], n = [geo.n[v * 3], geo.n[v * 3 + 1], geo.n[v * 3 + 2]];
    let occ = 0;
    for (const dd of [0.015, 0.035, 0.07, 0.12]) { const q = add(p, mul(n, dd * s)); occ += Math.max(0, dd * s - sdf(q[0], q[1], q[2])) / (dd * s); }
    geo.m[v * 4 + 3] = Math.max(0.25, 1 - occ * 0.32);
  }
  // 蒙皮：到每根骨骼线段的距离 → 权重
  const ends = boneEnds(J);
  const n = geo.count, bi = new Uint8Array(n * 4), bw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const p = [geo.p[v * 3], geo.p[v * 3 + 1], geo.p[v * 3 + 2]];
    const ds = ends.map(([a, b]) => segDist(p, a, b));
    // 头部区域（含发、角）只跟头
    const toHead = len(sub(p, headC)) < 0.13 * s * (P.age === 'child' ? 1.2 : 1) || (p[1] > J.neck[1] + 0.06 * s && Math.abs(p[0]) < 0.25 * s);
    let cand = ds.map((d, i) => [d, i]);
    if (toHead) cand = [[0, B.head]];
    if (geo.extra.tun && geo.extra.tun[v]) cand = [[0, B.pelvis]];
    cand.sort((a, b) => a[0] - b[0]);
    const d0 = cand[0][0];
    const sig = 0.022 * s;
    let ws = cand.slice(0, 3).map(([d, i]) => [Math.exp(-(d - d0) / sig), i]);
    // 不同肢体之间不混合（左手不跟右腿）
    ws = ws.filter(([, i]) => compatible(cand[0][1], i));
    const tot = ws.reduce((a, w) => a + w[0], 0);
    for (let k = 0; k < 4; k++) { bi[v * 4 + k] = ws[k] ? ws[k][1] : 0; bw[v * 4 + k] = ws[k] ? ws[k][0] / tot : 0; }
  }
  // 静止坐标系
  const rest = ends.map(([a, b], i) => frame(a, b, REST_HINT[i]));
  const restInv = rest.map(invRigid);
  return { geo, bi, bw, J, rest, restInv, headC, P };
}
const GROUP = { pelvis: 'c', spine: 'c', chest: 'c', neck: 'c', head: 'c', uarmL: 'L', farmL: 'L', handL: 'L', uarmR: 'R', farmR: 'R', handR: 'R', thighL: 'l', shinL: 'l', footL: 'l', thighR: 'r', shinR: 'r', footR: 'r' };
function compatible(a, b) {
  const ga = GROUP[BONES[a]], gb = GROUP[BONES[b]];
  if (ga === gb) return true;
  // 躯干可以和上臂、大腿混合
  if (ga === 'c' && (BONES[b] === 'uarmL' || BONES[b] === 'uarmR' || BONES[b] === 'thighL' || BONES[b] === 'thighR')) return true;
  if (gb === 'c' && (BONES[a] === 'uarmL' || BONES[a] === 'uarmR' || BONES[a] === 'thighL' || BONES[a] === 'thighR')) return true;
  return false;
}
function segDist(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const t = clamp(dot(ap, ab) / (dot(ab, ab) || 1));
  return len(sub(ap, mul(ab, t)));
}

// ───────────────────────── 姿态
// 双骨 IK：根 a，目标 t，两段长 l1 l2，pole 为肘/膝指向的方向；返回中间关节位置
export function ik2(a, t, l1, l2, pole) {
  let d = sub(t, a); let dl = len(d);
  const maxL = (l1 + l2) * 0.999;
  if (dl > maxL) { d = mul(d, maxL / dl); dl = maxL; t = add(a, d); }
  if (dl < 1e-4) dl = 1e-4;
  const dir = mul(d, 1 / dl);
  const x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let pp = sub(pole, mul(dir, dot(pole, dir)));
  if (len(pp) < 1e-5) pp = Math.abs(dir[1]) < 0.9 ? cross(dir, [0, 1, 0]) : cross(dir, [1, 0, 0]);
  pp = norm(pp);
  return { mid: add(add(a, mul(dir, x)), mul(pp, h)), end: t };
}

// 由姿态参数求出关节世界坐标与骨骼矩阵
// pose: { pos:[x,y,z] 骨盆位置, yaw, lean:[前倾, 侧倾, 扭转] (脊柱), head:[俯仰, 转, 歪],
//         handL/handR: 世界坐标目标或 null, elbowL/elbowR: 肘的方向(世界), footL/footR: 世界坐标, kneeL/kneeR,
//         handDirR: 手掌朝向(世界)，用于握剑 }
export function solvePose(body, pose) {
  const J = body.J, s = J._s;
  const yaw = pose.yaw || 0;
  // rootQ：整个身体的朝向（躺、跪、倒下时用）；否则只有偏航
  const qy = pose.rootQ || qaxis([0, 1, 0], yaw);
  const lean = pose.lean || [0, 0, 0];
  const R = (v) => qrot(qy, v);
  const fwd = R([0, 0, 1]), left = R([1, 0, 0]), up = R([0, 1, 0]);
  const root = pose.pos || [0, J.pelvis[1], 0];
  const tilt = pose.hipTilt || 0;
  // 脊柱：每节平均分担前倾/侧倾/扭转
  const qLean = (fr) => qmul(qaxis(fwd, -lean[1] * fr), qaxis(left, lean[0] * fr));
  const qTwist = (fr) => qaxis(up, (lean[2] || 0) * fr);
  const W = {};
  W.pelvis = root;
  const off = (a, b) => sub(J[b], J[a]);
  const qPel = qmul(qaxis(fwd, tilt), qy);
  const q1 = qmul(qmul(qLean(0.35), qTwist(0.3)), qPel);
  W.spine = add(W.pelvis, qrot(q1, off('pelvis', 'spine')));
  const q2 = qmul(qmul(qLean(0.7), qTwist(0.7)), qPel);
  W.chest = add(W.spine, qrot(q2, off('spine', 'chest')));
  const q3 = qmul(qmul(qLean(1.0), qTwist(1.0)), qPel);
  W.neck = add(W.chest, qrot(q3, off('chest', 'neck')));
  const hd = pose.head || [0, 0, 0];
  const qh = qmul(qmul(qaxis(qrot(q3, [0, 1, 0]), hd[1]), qaxis(qrot(q3, [1, 0, 0]), hd[0])), qmul(qaxis(qrot(q3, [0, 0, 1]), hd[2] || 0), q3));
  W.head = add(W.neck, qrot(qmul(qaxis(qrot(q3, [1, 0, 0]), hd[0] * 0.4), q3), off('neck', 'head')));
  W.headTop = add(W.head, qrot(qh, off('head', 'headTop')));
  const headFwd = qrot(qh, [0, 0, 1]);
  const chestFwd = qrot(q3, [0, 0, 1]);
  const shrug = pose.shrug || 0;
  for (const side of ['L', 'R']) {
    W['shoulder' + side] = add(add(W.chest, qrot(q3, off('chest', 'shoulder' + side))), [0, shrug * 0.03 * s, 0]);
    W['hip' + side] = add(W.pelvis, qrot(qPel, off('pelvis', 'hip' + side)));
  }
  // 手臂
  const l1a = len(off('shoulderL', 'elbowL')), l2a = len(off('elbowL', 'wristL')), lh = len(off('wristL', 'handEndL'));
  for (const side of ['L', 'R']) {
    const sh = W['shoulder' + side];
    const sx = side === 'L' ? 1 : -1;
    const def = add(sh, add(mul(qrot(q3, [sx, 0, 0]), 0.07 * s), add(mul(up, -0.5 * s), mul(chestFwd, 0.03 * s))));
    const tgt = pose['hand' + side] || def;
    const pole = pose['elbow' + side] || add(mul(chestFwd, -1), add(mul(qrot(q3, [sx, 0, 0]), 0.6), [0, -0.3, 0]));
    const r = ik2(sh, tgt, l1a, l2a, pole);
    W['elbow' + side] = r.mid; W['wrist' + side] = r.end;
    const hdir = pose['handDir' + side] || norm(sub(r.end, r.mid));
    W['handEnd' + side] = add(r.end, mul(norm(hdir), lh));
    W['pole' + side] = pole;
  }
  // 腿
  const l1l = len(off('hipL', 'kneeL')), l2l = len(off('kneeL', 'ankleL')), lf = len(off('ankleL', 'toeL'));
  for (const side of ['L', 'R']) {
    const hp = W['hip' + side];
    const def = add(hp, mul(up, -(J.hipL[1] - J.ankleL[1])));
    const tgt = pose['foot' + side] || (pose.rootQ ? def : [def[0], J.ankleL[1], def[2]]);
    const kp = pose['knee' + side] || fwd;
    const r = ik2(hp, tgt, l1l, l2l, kp);
    W['knee' + side] = r.mid; W['ankle' + side] = r.end;
    const fdir = pose['footDir' + side] || fwd;
    const toe = pose.rootQ ? add(r.end, add(mul(fwd, lf * 0.97), mul(up, -(J.ankleL[1] - J.toeL[1])))) : add(r.end, add(mul(norm([fdir[0], 0, fdir[2]]), lf * 0.97), [0, -(J.ankleL[1] - J.toeL[1]), 0]));
    W['toe' + side] = toe;
    W['kp' + side] = kp;
  }
  // 骨骼矩阵
  const ends = boneEnds(W);
  const hints = [
    fwd, chestFwd, chestFwd, headFwd, headFwd,
    mul(W.poleL, -1), mul(W.poleL, -1), pose.palmL || mul(W.poleL, -1),
    mul(W.poleR, -1), mul(W.poleR, -1), pose.palmR || mul(W.poleR, -1),
    W.kpL, W.kpL, up, W.kpR, W.kpR, up,
  ];
  const cur = ends.map(([a, b], i) => frame(a, b, hints[i]));
  return { W, cur, headQ: qh };
}
// 蒙皮矩阵（列主序，NB 个 mat4 拼起来）
export function skinMatrices(body, cur, out = new Float32Array(NB * 16)) {
  for (let i = 0; i < NB; i++) {
    const a = cur[i], b = body.restInv[i];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[i * 16 + c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

// ───────────────────────── 程序动作
// 走路：给定沿路径前进的距离 dist、步长 stride，返回骨盆起伏与两脚的位置
export function walkCycle(J, base, dir, dist, { stride = 0.62, lift = 0.09, bob = 0.025, width = 1 } = {}) {
  const s = J._s;
  const ph = dist / stride;                         // 每个周期两步
  const left = norm(cross([0, 1, 0], dir));
  const foot = (phase, side) => {
    const c = ((phase % 1) + 1) % 1;                // 0..1：0–0.5 支撑，0.5–1 摆动
    let fwdOff, y;
    if (c < 0.5) { fwdOff = lerp(0.5, -0.5, c / 0.5); y = 0; }
    else { const u = (c - 0.5) / 0.5; fwdOff = lerp(-0.5, 0.5, u * u * (3 - 2 * u)); y = Math.sin(u * Math.PI) * lift * s; }
    const center = add(base, mul(dir, dist));
    return add(add(center, mul(dir, fwdOff * stride)), add(mul(left, side * J.hipL[0] * width), [0, J.ankleL[1] + y, 0]));
  };
  const fl = foot(ph, 1), fr = foot(ph + 0.5, -1);
  const bobY = -Math.abs(Math.sin(ph * Math.PI * 2)) * bob * s + bob * s * 0.5;
  const pelvis = add(add(base, mul(dir, dist)), [0, J.pelvis[1] - 0.02 * s + bobY, 0]);
  return { pelvis, footL: fl, footR: fr, swing: Math.sin(ph * Math.PI * 2) };
}
