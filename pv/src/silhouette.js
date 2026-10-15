// 剪影
//
// 人物不画脸、不画立绘，只画剪影：一具二维骨架，加上衣袍、袖、发与随身之物。
// 同一个剪影有两种呈现，与全片的两种物质一致：
//   纸上 → 墨影（ink）：像水墨里一团人形的墨，边缘被纸吸开；
//   夜里 → 逆光（night）：一块挡住光的暗影，边缘一圈光（衬托出轮廓）。
//
// 坐标：pose.x, pose.y 为髋部在屏幕上的位置；pose.s 为一个身高单位对应的像素；
// pose.dir = 1 面朝右，-1 面朝左。局部坐标 y 向上，前方为 +x。
// 肢体角度从「竖直向下」量起，正值为向前转。

import { clamp, lerp } from './noise.js';

let MASK = null, MCTX = null;
export function maskCanvas(W, H) {
  if (!MASK || MASK.width !== W || MASK.height !== H) {
    MASK = document.createElement('canvas');
    MASK.width = W; MASK.height = H;
    MCTX = MASK.getContext('2d');
  }
  return MCTX;
}
export function beginMask(W, H) {
  const c = maskCanvas(W, H);
  MASK.width = W;   // 清空
  c.fillStyle = '#000';
  c.strokeStyle = '#000';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  return c;
}
export const maskImage = () => MASK;

const D = (a) => [Math.sin(a), -Math.cos(a)];   // 从竖直向下转过 a 的单位向量

// 默认姿势（站立）
export const STAND = {
  torso: 0.02, head: 0.0,
  armB: [0.08, 0.12], armF: [-0.05, 0.15],    // 后臂、前臂：[上臂角, 肘弯]
  legB: [-0.04, 0.02], legF: [0.06, -0.04],   // 后腿、前腿：[大腿角, 膝弯]
  crouch: 0,
};

export function mixPose(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k] ?? va;
    o[k] = Array.isArray(va) ? va.map((x, i) => lerp(x, vb[i], t)) : (typeof va === 'number' ? lerp(va, vb, t) : (t < 0.5 ? va : vb));
  }
  for (const k of Object.keys(b)) if (!(k in o)) o[k] = b[k];
  return o;
}

// 走路循环：ph 为相位（弧度）
export function walk(ph, stride = 1, base = STAND) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    ...base,
    legF: [0.38 * s * stride, -0.35 * Math.max(0, -c) * stride - 0.05],
    legB: [-0.38 * s * stride, -0.35 * Math.max(0, c) * stride - 0.05],
    armF: [-0.25 * s * stride, 0.2],
    armB: [0.25 * s * stride, 0.2],
    bob: Math.abs(c) * 0.012 * stride,
  };
}
export function run(ph, base = STAND) {
  const p = walk(ph, 1.6, base);
  p.torso = 0.35; p.armF = [-0.7 * Math.sin(ph) + 0.2, 1.3]; p.armB = [0.7 * Math.sin(ph) + 0.2, 1.3];
  return p;
}

/**
 * 画一个人形到 ctx（不透明填充，用作遮罩）
 * o: { x, y, s, dir, pose, kind, wind, t, props:[...], robe, sleeve, hair }
 *   kind: 'man' | 'woman' | 'child' | 'old' | 'soldier'
 */
export function figure(ctx, o) {
  const p = { ...STAND, ...(o.pose || {}) };
  const s = o.s, dir = o.dir || 1;
  const kind = o.kind || 'man';
  const child = kind === 'child';
  const sc = child ? 0.62 : 1;               // 孩子：整体更小，头更大
  const wind = o.wind ?? 0.5;
  const t = o.t || 0;
  const X = (lx) => o.x + dir * lx * s;
  const Y = (ly) => o.y - (ly + (p.bob || 0) - p.crouch * 0.12) * s;
  const P = (q) => [X(q[0]), Y(q[1])];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (v, k) => [v[0] * k, v[1] * k];

  // 骨架
  const thigh = 0.245 * sc, shin = 0.235 * sc, upper = 0.15 * sc, fore = 0.145 * sc, torsoL = 0.30 * sc;
  const up = [Math.sin(p.torso), Math.cos(p.torso)];
  const hip = [0, 0];
  const chest = mul(up, torsoL);
  const neck = mul(up, torsoL + 0.035 * sc);
  const hr = child ? 0.072 : 0.062;
  const hd = [Math.sin(p.torso + p.head), Math.cos(p.torso + p.head)];
  const head = add(neck, mul(hd, hr * 1.05));
  const limb = (from, a1, a2, l1, l2) => { const j = add(from, mul(D(a1), l1)); const e = add(j, mul(D(a1 + a2), l2)); return [j, e]; };
  const sh = add(chest, mul(up, -0.02));
  const [elB, wrB] = limb(sh, p.armB[0], p.armB[1], upper, fore);
  const [elF, wrF] = limb(sh, p.armF[0], p.armF[1], upper, fore);
  const [knB, anB] = limb(hip, p.legB[0], p.legB[1], thigh, shin);
  const [knF, anF] = limb(hip, p.legF[0], p.legF[1], thigh, shin);

  const caps = (a, b, w0, w1 = w0) => {
    const A = P(a), B = P(b);
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(A[0] + nx * w0 * s, A[1] + ny * w0 * s);
    ctx.lineTo(B[0] + nx * w1 * s, B[1] + ny * w1 * s);
    ctx.lineTo(B[0] - nx * w1 * s, B[1] - ny * w1 * s);
    ctx.lineTo(A[0] - nx * w0 * s, A[1] - ny * w0 * s);
    ctx.fill();
    ctx.beginPath(); ctx.arc(A[0], A[1], w0 * s, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(B[0], B[1], w1 * s, 0, 6.283); ctx.fill();
  };
  const poly = (pts) => { ctx.beginPath(); pts.forEach((q, i) => { const r = P(q); i ? ctx.lineTo(r[0], r[1]) : ctx.moveTo(r[0], r[1]); }); ctx.closePath(); ctx.fill(); };
  const flut = (k, amp) => Math.sin(t * 3.1 + k * 2.3) * amp * wind + Math.sin(t * 5.3 + k * 4.1) * amp * 0.4 * wind;

  // 腿（长袍会盖住大部分）
  const foot = (an, kn) => add(an, [0.055 * sc, -0.005]);
  caps(hip, knB, 0.045 * sc, 0.034 * sc); caps(knB, anB, 0.034 * sc, 0.022 * sc); caps(anB, foot(anB), 0.02 * sc, 0.016 * sc);
  caps(hip, knF, 0.045 * sc, 0.034 * sc); caps(knF, anF, 0.034 * sc, 0.022 * sc); caps(anF, foot(anF), 0.02 * sc, 0.016 * sc);

  // 躯干
  const back = [-up[1], up[0]];   // 指向身后的法线（局部）
  const tw0 = 0.058 * sc, tw1 = 0.068 * sc;
  {
    // 躯干：胸前、背后都是弧线；肩是圆的
    const fH = add(hip, mul(back, -tw0)), fC = add(chest, mul(back, -tw1 * 0.85)), fN = add(neck, mul(back, -0.022 * sc));
    const bN = add(neck, mul(back, 0.026 * sc)), bC = add(chest, mul(back, tw1 * 1.05)), bH = add(hip, mul(back, tw0 * 0.95));
    const mid = (a, b, k, n) => add(mul(add(a, b), 0.5), mul(n, k));
    ctx.beginPath();
    let q = P(fH); ctx.moveTo(q[0], q[1]);
    let c = P(mid(fH, fC, -0.012 * sc, back)); q = P(fC); ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    q = P(fN); ctx.lineTo(q[0], q[1]);
    q = P(bN); ctx.lineTo(q[0], q[1]);
    c = P(add(bC, mul(up, 0.06 * sc))); q = P(bC); ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    c = P(mid(bC, bH, 0.01 * sc, back)); q = P(bH); ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    ctx.closePath(); ctx.fill();
    // 肩
    caps(add(sh, mul(back, -0.03 * sc)), add(sh, mul(back, 0.035 * sc)), 0.038 * sc);
    // 颈
    caps(neck, add(neck, mul(hd, 0.04 * sc)), 0.022 * sc, 0.024 * sc);
  }

  // 长袍：从腰到脚踝，下摆随风
  const robe = o.robe ?? (kind === 'soldier' ? 0.55 : 1);
  if (robe > 0) {
    const waist = mul(up, 0.06 * sc);
    const ankY = Math.min(anB[1], anF[1]);
    const hemY = lerp(Math.min(knB[1], knF[1]) - 0.02, ankY + 0.02, robe);
    const fx = Math.max(anF[0], anB[0], knF[0], knB[0]) + 0.05 * robe;
    const bx = Math.min(anF[0], anB[0], knF[0], knB[0]) - 0.07 * robe;
    const pts = [add(waist, mul(back, -0.075 * sc)), [lerp(0.07, fx, 0.6), lerp(0, hemY, 0.55)], [fx + flut(1, 0.02), hemY + flut(2, 0.01)]];
    const n = 5;
    for (let i = 1; i < n; i++) { const u = i / n; pts.push([lerp(fx, bx, u) - wind * 0.03 * u, hemY + Math.sin(u * 9 + t * 4) * 0.012 * wind]); }
    pts.push([bx - wind * 0.06 + flut(3, 0.03), hemY + 0.01], [lerp(bx, -0.08, 0.5) - wind * 0.03, lerp(0, hemY, 0.5)], add(waist, mul(back, 0.08 * sc)));
    poly(pts);
  }

  // 手臂与宽袖
  const sleeve = o.sleeve ?? (kind === 'soldier' ? 0.2 : 1);
  const arm = (el, wr, k) => {
    caps(sh, el, 0.032 * sc, 0.027 * sc); caps(el, wr, 0.027 * sc, 0.02 * sc);
    ctx.beginPath(); const h = P(add(wr, mul(D(0), -0.0))); ctx.arc(h[0], h[1], 0.024 * sc * s, 0, 6.283); ctx.fill();
    if (sleeve > 0) {
      const drop = 0.11 * sleeve * sc;
      const sw = add(wr, mul(sub(el, wr), 0.15));
      poly([el, sw, add(sw, [-wind * 0.03 + flut(k, 0.02), -drop]), add(el, [-wind * 0.05 + flut(k + 1, 0.02), -drop * 0.55])]);
    }
  };
  if (o.noArmB) caps(sh, add(sh, mul(D(0.3), 0.05 * sc)), 0.034 * sc, 0.03 * sc);   // 断臂：只剩一截
  else arm(elB, wrB, 5);

  // 头
  {
    // 头：略呈卵形，后脑更饱满，面部向前收
    const h = P(add(head, mul([-hd[1], hd[0]], 0.006)));
    const ang = Math.atan2(-(hd[0]) * dir, hd[1]);
    ctx.beginPath(); ctx.ellipse(h[0], h[1], hr * 0.92 * s, hr * 1.08 * s, -ang * dir * 0 + (dir > 0 ? 1 : -1) * (p.torso + p.head) * 0, 0, 6.283); ctx.fill();
    const jaw = P(add(head, add(mul(hd, -hr * 0.55), [hr * 0.38, 0])));
    ctx.beginPath(); ctx.ellipse(jaw[0], jaw[1], hr * 0.5 * s, hr * 0.45 * s, 0, 0, 6.283); ctx.fill();
  }

  // 发
  const hair = o.hair || (kind === 'woman' ? 'long' : kind === 'child' ? 'buns' : kind === 'old' ? 'old' : kind === 'soldier' ? 'helm' : 'knot');
  const hb = add(head, mul(hd, 0.0));
  if (hair === 'long') {
    // 长发：盖住后脑，沿背垂下，发梢随风向后散开
    const crown = add(hb, mul(hd, hr * 1.02));
    const nape = add(hb, add(mul(hd, -hr * 0.5), mul(back, hr * 0.95)));
    const L = 0.36 * (o.hairLen ?? 1);
    const n = 10;
    const cen = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const down = mul(up, -u * L * (1 - wind * 0.35));
      const blow = mul(back, u * u * (0.03 + wind * 0.2));
      const sway = mul(back, Math.sin(u * 4 - t * 2.6) * 0.018 * wind * u);
      cen.push(add(add(add(nape, down), blow), sway));
    }
    const w = (u) => (0.05 + 0.012 * Math.sin(u * 3)) * (1 - u * 0.55) * sc;
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const j0 = Math.max(0, i - 1), j1 = Math.min(n, i + 1);
      const tx = cen[j1][0] - cen[j0][0], ty = cen[j1][1] - cen[j0][1], tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl;
      left.push(add(cen[i], [nx * w(u), ny * w(u)]));
      right.push(add(cen[i], [-nx * w(u), -ny * w(u)]));
    }
    // 头顶的发
    const hp = P(add(hb, add(mul(back, hr * 0.12), mul(hd, hr * 0.12))));
    ctx.beginPath(); ctx.ellipse(hp[0], hp[1], hr * 1.0 * s, hr * 1.05 * s, 0, 0, 6.283); ctx.fill();
    // 发束（曲线闭合）
    ctx.beginPath();
    let q = P(add(crown, mul(back, hr * 0.3))); ctx.moveTo(q[0], q[1]);
    for (let i = 0; i <= n; i++) { q = P(left[i]); ctx.lineTo(q[0], q[1]); }
    // 发梢：分成三缕
    const tip = cen[n];
    for (let k = 0; k < 3; k++) {
      const a = add(tip, add(mul(up, -0.03 - 0.02 * k), mul(back, 0.02 + wind * 0.05 + 0.015 * k)));
      q = P(a); ctx.lineTo(q[0], q[1]);
      q = P(add(tip, mul(up, 0.01 * k))); ctx.lineTo(q[0], q[1]);
    }
    for (let i = n; i >= 0; i--) { q = P(right[i]); ctx.lineTo(q[0], q[1]); }
    ctx.closePath(); ctx.fill();
  } else if (hair === 'knot' || hair === 'old') {
    const top = add(hb, mul(hd, hr * 1.05));
    const tp = P(top); ctx.beginPath(); ctx.arc(tp[0], tp[1], hr * 0.42 * s, 0, 6.283); ctx.fill();
    // 发带
    const r0 = add(top, [-0.01, 0]);
    poly([r0, add(r0, [-0.07 - wind * 0.08, -0.02 + flut(9, 0.02)]), add(r0, [-0.08 - wind * 0.1, -0.05 + flut(10, 0.02)]), add(r0, [0, -0.02])]);
    if (hair === 'old') {
      // 胡须
      const chin = add(head, [hr * 0.55, -hr * 0.75]);
      poly([add(chin, [-0.02, 0.02]), add(chin, [0.03, 0.01]), add(chin, [-0.01 - wind * 0.04, -0.13 + flut(11, 0.01)])]);
    }
  } else if (hair === 'buns') {
    // 孩子：脑后一个发髻，垂一根发带
    const b = P(add(hb, [-hr * 0.75, hr * 0.55])); ctx.beginPath(); ctx.arc(b[0], b[1], hr * 0.45 * s, 0, 6.283); ctx.fill();
    const r0 = add(hb, [-hr * 1.05, hr * 0.45]);
    poly([r0, add(r0, [-0.03 - wind * 0.05, -0.09 + flut(14, 0.015)]), add(r0, [-0.015 - wind * 0.05, -0.1 + flut(15, 0.015)]), add(r0, [0.01, -0.01])]);
  } else if (hair === 'helm') {
    poly([add(hb, [-hr * 1.1, hr * 0.2]), add(hb, [0, hr * 1.6]), add(hb, [hr * 1.1, hr * 0.2])]);
  } else if (hair === 'tricorn') {
    // 三角帽 + 系在脑后的发
    poly([add(hb, [-hr * 1.9, hr * 0.55]), add(hb, [-hr * 0.4, hr * 1.55]), add(hb, [hr * 0.6, hr * 1.5]), add(hb, [hr * 1.7, hr * 0.7]), add(hb, [0, hr * 0.85])]);
    const q = add(hb, [-hr * 0.9, -hr * 0.1]);
    poly([q, add(q, [-0.04 - wind * 0.06, -0.12]), add(q, [-0.01, -0.13]), add(q, [0.02, 0])]);
  }

  // 前臂在最前
  arm(elF, wrF, 7);

  // 随身之物
  const out = { head: P(head), hand: P(wrF), handB: P(wrB), tips: [] };
  for (const pr of o.props || []) {
    const hand = pr.hand === 'B' ? wrB : wrF;
    if (pr.type === 'sword' || pr.type === 'spear') {
      const L = pr.len ?? (pr.type === 'sword' ? 0.42 : 1.3);
      const a = pr.angle ?? 0;                          // 绝对角：0 指向下，π 指向上
      const d = D(a);
      const tip = add(hand, mul(d, L)), butt = add(hand, mul(d, pr.type === 'spear' ? -0.25 : -0.06));
      out.tips.push(P(tip));
      caps(butt, tip, pr.type === 'spear' ? 0.008 : 0.011, 0.004);
      if (pr.type === 'sword') { const n = [-d[1], d[0]]; caps(add(hand, mul(n, 0.04)), add(hand, mul(n, -0.04)), 0.01); }
      else { const n = [-d[1], d[0]]; poly([tip, add(add(tip, mul(d, -0.08)), mul(n, 0.02)), add(tip, mul(d, 0.04)), add(add(tip, mul(d, -0.08)), mul(n, -0.02))]); }
      if (pr.broken) {/* 断剑：短 */}
    } else if (pr.type === 'banner') {
      const top = add(hand, [0.02, pr.len ?? 1.1]);
      caps(add(hand, [0, -0.25]), top, 0.009, 0.007);
      const fw = pr.w ?? 0.42, fh = pr.h ?? 0.3;
      const pts = [top];
      const n = 10;
      for (let i = 0; i <= n; i++) { const u = i / n; pts.push(add(top, [-u * fw * (0.7 + 0.3 * wind), Math.sin(u * 5 - t * 4 + (pr.ph || 0)) * 0.03 * u - (pr.tattered ? (i % 3 === 0 ? 0.03 : 0) : 0)])); }
      for (let i = n; i >= 0; i--) { const u = i / n; pts.push(add(top, [-u * fw * (0.7 + 0.3 * wind), -fh * (1 - (pr.tattered ? u * 0.4 : 0)) + Math.sin(u * 5 - t * 4 + 1 + (pr.ph || 0)) * 0.03 * u])); }
      poly(pts);
    } else if (pr.type === 'bundle') {
      const st = add(sh, [0.02, 0.03]);
      const end = add(st, [-0.28, 0.12]);
      caps(add(st, [0.08, -0.04]), end, 0.007);
      const e = P(end); ctx.beginPath(); ctx.ellipse(e[0], e[1] + 0.04 * s, 0.07 * s, 0.06 * s, 0, 0, 6.283); ctx.fill();
    } else if (pr.type === 'coat') {
      // 长外套的燕尾与肩章
      poly([add(hip, [0.06, 0.1]), add(hip, [0.08 + flut(12, 0.01), -0.32]), add(hip, [-0.02, -0.28]), add(hip, [-0.12 - wind * 0.06, -0.36 + flut(13, 0.02)]), add(hip, [-0.07, 0.1])]);
      const ep = add(sh, [0.0, 0.015]);
      const e = P(ep); ctx.beginPath(); ctx.ellipse(e[0], e[1], 0.05 * s, 0.022 * s, -dir * 0.2, 0, 6.283); ctx.fill();
      for (let k = 0; k < 6; k++) { const q = add(ep, [-0.04 + k * 0.016, -0.01]); caps(q, add(q, [0, -0.045]), 0.0035); }
    }
  }
  return out;
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }

/** 平滑：模糊后重新阈值化，让关节与衣褶融成有机的轮廓（metaball 的办法） */
export function smoothMask(W, H, r = 3, S = 1) {
  if (!MASK) return;
  if (!TMP2 || TMP2.width !== W) { TMP2 = document.createElement('canvas'); TMP2.width = W; TMP2.height = H; }
  TMP2.width = W;
  const c2 = TMP2.getContext('2d');
  c2.filter = `blur(${r * S}px)`;
  c2.drawImage(MASK, 0, 0);
  const img = c2.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    if (a === 0) continue;
    // smoothstep(0.4, 0.6)
    let x = (a / 255 - 0.42) / 0.16;
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    d[i] = Math.round(255 * x * x * (3 - 2 * x));
    d[i - 3] = d[i - 2] = d[i - 1] = 0;
  }
  MASK.width = W;
  MCTX.putImageData(img, 0, 0);
}
let TMP2 = null;

/** 把遮罩作为墨影画到纸上（墨层）。color: 在白纸上看起来的颜色 */
export function maskToInk(f, color = 'rgb(18,15,12)', alpha = 0.9, blur = 1.5) {
  const ctx = f.ink;
  ctx.save();
  // 先用遮罩上色：在临时画布上把黑色换成墨色
  const tmp = tintCanvas(f.W, f.H, color);
  ctx.globalAlpha = alpha;
  ctx.filter = blur > 0 ? `blur(${blur * f.S}px)` : 'none';
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}
let TINT = null, RIM = null;
function tintCanvas(W, H, color) {
  if (!TINT || TINT.width !== W) { TINT = document.createElement('canvas'); TINT.width = W; TINT.height = H; }
  TINT.width = W;
  const c = TINT.getContext('2d');
  c.drawImage(MASK, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, W, H);
  return TINT;
}

/** 把遮罩作为夜里的逆光剪影：遮挡层 + 边缘一圈光 */
export function maskToNight(f, { rim = [0.8, 0.85, 1.0], rimK = 0.35, rimW = 2, body = 'rgb(3,4,7)', alpha = 1, blur = 1.2, halo = 0.08, dir = null } = {}) {
  if (alpha <= 0) return;
  // 遮挡
  const o = f.occ;
  o.save();
  o.globalAlpha = alpha;
  o.filter = blur > 0 ? `blur(${blur * f.S}px)` : 'none';
  o.drawImage(tintCanvas(f.W, f.H, body), 0, 0);
  o.restore();
  // 边缘光：模糊的遮罩，减去遮罩本身，剩下轮廓外的一圈
  const L = f.light;
  const rc = `rgb(${Math.round(rim[0] * 255)},${Math.round(rim[1] * 255)},${Math.round(rim[2] * 255)})`;
  // 在临时画布上：模糊的轮廓光，再挖掉剪影本身（光只在轮廓外侧）
  const tint = tintCanvas(f.W, f.H, rc);
  if (!RIM || RIM.width !== f.W) { RIM = document.createElement('canvas'); RIM.width = f.W; RIM.height = f.H; }
  RIM.width = f.W;
  const r = RIM.getContext('2d');
  r.globalAlpha = rimK;
  r.filter = `blur(${rimW * f.S}px)`;
  if (dir) {
    // 有方向的逆光：只在朝向光源的一侧亮（把遮罩朝光的方向挪一点，再减去原形）
    const k = rimW * 1.6 * f.S;
    r.drawImage(tint, dir[0] * k, dir[1] * k);
  } else r.drawImage(tint, 0, 0);
  if (halo > 0) { r.globalAlpha = halo; r.filter = `blur(${rimW * 6 * f.S}px)`; r.drawImage(tint, 0, 0); }
  r.globalAlpha = 1; r.filter = 'none';
  r.globalCompositeOperation = 'destination-out';
  r.drawImage(MASK, 0, 0);
  L.save();
  L.globalCompositeOperation = 'lighter';
  L.globalAlpha = alpha;
  L.drawImage(RIM, 0, 0);
  L.restore();
}

// ───────────────────────────── 侧脸：一根光线勾出的轮廓
// 局部单位：额顶 y=1，下巴 y=0；+x 为脸朝向。smile ∈ [0,1]：嘴角上扬、眼睑垂下。
const FACE = [
  [-0.32, 1.12], [-0.12, 1.16], [0.0, 1.1], [0.06, 0.98], [0.085, 0.84], [0.105, 0.72], [0.085, 0.645], [0.13, 0.57], [0.205, 0.47],
  [0.19, 0.44], [0.13, 0.42], [0.125, 0.375], [0.165, 0.335], [0.13, 0.31], 'M', [0.15, 0.285], [0.155, 0.255],
  [0.11, 0.205], [0.135, 0.13], [0.11, 0.06], [0.05, 0.02], [-0.04, -0.02], [-0.1, -0.3],
];
function catmull(pts, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/**
 * L: 光线批次；(x,y) 为下巴位置；h 为脸高（像素）；reveal ∈ [0,1] 一笔画出的进度
 */
export function profile(L, x, y, h, dir, { smile = 0, reveal = 1, color = [0.5, 0.95, 0.88], alpha = 1, w = 2, t = 0, hair = 1 } = {}) {
  const pts = FACE.map((q) => (q === 'M' ? q : [...q]));
  // 嘴角：上扬并略向后收
  const mi = pts.indexOf('M');
  pts.splice(mi, 1, [0.118 - 0.012 * smile, 0.298 + 0.03 * smile]);
  const curve = catmull(pts, 10);
  const n = curve.length;
  const m = Math.floor(n * Math.min(1, reveal));
  const X = (q) => x + dir * q[0] * h, Y = (q) => y - q[1] * h;
  for (let i = 0; i < m; i++) {
    const q = curve[i];
    const tip = i > m - 6 ? 2.5 : 1;
    L.p(X(q), Y(q), w, color[0], color[1], color[2], alpha * tip);
  }
  L.end();
  if (reveal < 1) return;
  // 法令纹的一点（笑时出现）
  if (smile > 0.05) {
    const c = catmull([[0.09, 0.44], [0.075, 0.37], [0.085, 0.31]], 8);
    c.forEach((q, i) => L.p(X(q), Y(q), w * 0.8, color[0], color[1], color[2], alpha * smile * 0.55 * Math.sin((i / (c.length - 1)) * Math.PI)));
    L.end();
  }
  // 眼：一道弧，笑时下垂（目光落下）
  const ey = 0.635, ex = 0.04;
  const e = catmull([[ex - 0.06, ey + 0.01], [ex - 0.02, ey - 0.012 - 0.012 * smile], [ex + 0.02, ey - 0.004 - 0.01 * smile]], 8);
  e.forEach((q) => L.p(X(q), Y(q), w * 0.9, color[0], color[1], color[2], alpha * 0.8));
  L.end();
  // 发：从头顶向后、沿后脑垂到肩后，几缕随风
  for (let k = 0; k < 8 * hair; k++) {
    const sp = k / 7;
    const base = [
      [-0.05 - 0.04 * sp, 1.13 - 0.02 * sp],
      [-0.32 - 0.05 * sp, 1.1 - 0.04 * sp],
      [-0.5 - 0.06 * sp, 0.85 - 0.05 * sp],
      [-0.56 - 0.1 * sp, 0.45 - 0.1 * sp],
      [-0.62 - 0.22 * sp, 0.0 - 0.15 * sp],
      [-0.7 - 0.4 * sp, -0.35 - 0.1 * sp],
    ];
    const a = catmull(base, 6).map((q, i, arr) => { const u = i / (arr.length - 1); return [q[0] - Math.sin(u * 4 + t * 1.2 + k) * 0.035 * u * u, q[1] + Math.sin(u * 5 - t * 1.5 + k * 1.7) * 0.025 * u]; });
    a.forEach((q, i) => L.p(X(q), Y(q), w * 0.7, color[0], color[1], color[2], alpha * (0.6 - sp * 0.3) * Math.min(1, i / 4) * (1 - i / a.length * 0.8)));
    L.end();
  }
}

// ───────────────────────────── 景物剪影（同样画进遮罩）
/** 宫殿：庑殿顶，翘起的檐角；x,y 为台基中心底部，w 为宽（像素） */
export function palace(ctx, x, y, w, { tiers = 2, flagFall = 0, t = 0 } = {}) {
  const h = w * 0.28;
  ctx.beginPath();
  // 台基
  ctx.rect(x - w * 0.5, y - h * 0.18, w, h * 0.18);
  ctx.fill();
  let base = y - h * 0.18;
  for (let k = 0; k < tiers; k++) {
    const ww = w * (0.78 - k * 0.22), hh = h * (0.42 - k * 0.05);
    // 柱身
    ctx.fillRect(x - ww * 0.42, base - hh * 0.55, ww * 0.84, hh * 0.55);
    // 屋顶：两端上翘的曲线
    const ry = base - hh * 0.55, rw = ww * 0.62, rh = hh * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - rw - ww * 0.08, ry - rh * 0.25);
    ctx.quadraticCurveTo(x - rw * 0.7, ry + rh * 0.08, x - rw * 0.45, ry - rh * 0.1);
    ctx.lineTo(x - rw * 0.25, ry - rh * 0.95);
    ctx.lineTo(x + rw * 0.25, ry - rh * 0.95);
    ctx.lineTo(x + rw * 0.45, ry - rh * 0.1);
    ctx.quadraticCurveTo(x + rw * 0.7, ry + rh * 0.08, x + rw + ww * 0.08, ry - rh * 0.25);
    ctx.lineTo(x + rw * 0.4, ry + rh * 0.12);
    ctx.lineTo(x - rw * 0.4, ry + rh * 0.12);
    ctx.closePath();
    ctx.fill();
    // 正脊两端的鸱吻
    ctx.fillRect(x - rw * 0.27, ry - rh * 1.15, rw * 0.06, rh * 0.25);
    ctx.fillRect(x + rw * 0.21, ry - rh * 1.15, rw * 0.06, rh * 0.25);
    base = ry - rh * 0.9;
  }
  // 顶上的龙旗：倒下
  const px = x + w * 0.05, py = base - h * 0.05;
  const a = flagFall * 1.45;
  const L = h * 0.9;
  const tx = px + Math.sin(a) * L, ty = py - Math.cos(a) * L;
  ctx.save(); ctx.lineWidth = w * 0.006; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const fx = tx + (-Math.cos(a)) * 0 - u * w * 0.16 * Math.cos(a) + Math.sin(u * 6 + t * 5) * h * 0.02;
    const fy = ty + u * w * 0.16 * Math.sin(a) * 0 + Math.sin(u * 6 + t * 5) * h * 0.02 + u * Math.sin(a) * h * 0.1;
    i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy);
  }
  for (let i = 10; i >= 0; i--) {
    const u = i / 10;
    const fx = tx + Math.sin(a) * h * 0.25 - u * w * 0.16 * Math.cos(a) + Math.sin(u * 6 + t * 5 + 1) * h * 0.02;
    const fy = ty + Math.cos(a) * h * 0.25 + Math.sin(u * 6 + t * 5 + 1) * h * 0.02 + u * Math.sin(a) * h * 0.1;
    ctx.lineTo(fx, fy);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** 民居与门：x,y 为地面中点，w 为宽 */
export function house(ctx, x, y, w) {
  const h = w * 0.62;
  ctx.beginPath();
  // 墙（门洞留空）
  ctx.rect(x - w * 0.5, y - h, w * 0.32, h);
  ctx.rect(x + w * 0.02, y - h, w * 0.48, h);
  ctx.rect(x - w * 0.5, y - h, w, h * 0.22);
  ctx.fill();
  // 屋顶
  ctx.beginPath();
  ctx.moveTo(x - w * 0.62, y - h * 0.95);
  ctx.quadraticCurveTo(x - w * 0.3, y - h * 1.05, x - w * 0.1, y - h * 1.45);
  ctx.lineTo(x + w * 0.1, y - h * 1.45);
  ctx.quadraticCurveTo(x + w * 0.3, y - h * 1.05, x + w * 0.62, y - h * 0.95);
  ctx.closePath();
  ctx.fill();
}

/** 书案：x,y 地面，w 宽；书堆与悬挂的卷轴 */
export function study(ctx, x, y, w, t = 0) {
  const h = w * 0.3;
  ctx.fillRect(x - w * 0.5, y - h, w, h * 0.1);                    // 案面
  ctx.fillRect(x - w * 0.46, y - h, w * 0.04, h);                  // 案腿
  ctx.fillRect(x + w * 0.42, y - h, w * 0.04, h);
  // 书堆
  let by = y - h;
  for (let k = 0; k < 6; k++) { const bw = w * (0.2 - (k % 3) * 0.02); ctx.fillRect(x + w * 0.18 + (k % 2) * w * 0.02, by - w * 0.03, bw, w * 0.026); by -= w * 0.032; }
  // 砚与笔架
  ctx.fillRect(x - w * 0.3, y - h - w * 0.025, w * 0.1, w * 0.025);
  for (let k = 0; k < 4; k++) ctx.fillRect(x - w * 0.12 + k * w * 0.025, y - h - w * 0.16, w * 0.006, w * 0.14);
  // 窗与梅枝（窗框线）
  ctx.save();
  ctx.lineWidth = w * 0.006;
  ctx.strokeRect(x - w * 0.15, y - h - w * 0.95, w * 0.5, w * 0.6);
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y - h - w * 0.95); ctx.lineTo(x + w * 0.1, y - h - w * 0.35); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.15, y - h - w * 0.5);
  ctx.quadraticCurveTo(x + w * 0.0, y - h - w * 0.62, x + w * 0.2, y - h - w * 0.8);
  ctx.stroke();
  for (let k = 0; k < 7; k++) { const u = k / 6; ctx.beginPath(); ctx.arc(x - w * 0.12 + u * w * 0.3, y - h - w * (0.52 + u * 0.27) + Math.sin(k * 3) * w * 0.02, w * 0.012, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

/** 帆船：桅杆与帆的剪影 */
export function ship(ctx, x, y, w, t = 0) {
  const h = w * 0.18;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h); ctx.quadraticCurveTo(x - w * 0.3, y + h * 0.3, x + w * 0.35, y);
  ctx.lineTo(x + w * 0.5, y - h * 1.1); ctx.closePath(); ctx.fill();
  for (const [mx, mh] of [[-0.25, 1.2], [0.02, 1.45], [0.27, 1.05]]) {
    ctx.fillRect(x + mx * w - w * 0.006, y - h - mh * w * 0.6, w * 0.012, mh * w * 0.6);
    for (let k = 0; k < 2; k++) {
      const sy = y - h - mh * w * 0.6 * (0.88 - k * 0.42), sw = w * (0.15 - k * 0.01), sh = mh * w * 0.17;
      ctx.beginPath();
      ctx.moveTo(x + mx * w - sw * 0.5, sy);
      ctx.quadraticCurveTo(x + mx * w, sy + sh * 0.2 + Math.sin(t + k) * 2, x + mx * w + sw * 0.5, sy);
      ctx.lineTo(x + mx * w + sw * 0.45, sy + sh);
      ctx.quadraticCurveTo(x + mx * w + sw * 0.1, sy + sh * 1.25, x + mx * w - sw * 0.45, sy + sh);
      ctx.closePath(); ctx.fill();
    }
  }
}
