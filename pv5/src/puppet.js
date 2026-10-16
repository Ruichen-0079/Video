// 皮影偶：一套二维关节偶。偶身高 100 个单位，面朝 +x，脚底在 y = 0。
// 每个部件是一块「刻好的皮子」：半透明的染色皮面、深色刻线、镂空的花纹（透出幕后的灯光）。
// 部件之间用铆钉连接；姿态只是一组角度（0 = 自然下垂，逆时针为正）。
import { M, chain, curve, rgba, clamp, lerp, ik2, TAU } from './g2.js';

// 皮子的颜色（透光后的颜色由幕布乘出来）
export const L = {
  red: [214, 72, 52], crimson: [176, 42, 38], rose: [226, 120, 120], orange: [226, 132, 60],
  yellow: [232, 186, 74], gold: [214, 160, 60], ochre: [186, 128, 64], brown: [140, 88, 52],
  green: [96, 156, 96], jade: [92, 168, 150], teal: [60, 128, 132], olive: [130, 140, 70],
  blue: [84, 120, 186], indigo: [60, 78, 140], ink: [44, 50, 78], purple: [126, 80, 140],
  black: [34, 26, 22], gray: [130, 126, 118], white: [246, 238, 220], cream: [240, 224, 190],
  skin: [244, 226, 196], pink: [236, 160, 160],
};
const OUT = 'rgba(40,22,10,0.97)';      // 刻线（没刻掉的皮子）
const HOLE = 'rgba(255,250,238,1)';     // 镂空处透出的光
const LW = 0.55;                         // 刻线粗细（偶的单位）

// 骨架
const SK = { hip: 46, neck: [1.4, 26.6], shB: [-2.4, 24.6], shF: [1.6, 24.2], up: 15, fore: 13.5, thigh: 23, shin: 21.5 };

// ── 基本画法
function piece(ctx, build, fill, { outline = true, alpha = 0.93, lw = LW } = {}) {
  ctx.beginPath(); build(ctx);
  if (fill) { ctx.fillStyle = rgba(fill, alpha); ctx.fill(); }
  if (outline) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function holeDot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = HOLE; ctx.fill(); }
function rivet(ctx, x, y, r = 0.75) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = OUT; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fillStyle = 'rgba(255,240,210,0.9)'; ctx.fill();
}
// 祥云纹（一个小卷云）
function cloud(ctx, x, y, s, col = HOLE) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, 0, 1, Math.PI * 0.1, Math.PI * 1.9, false);
  ctx.arc(1.6, -0.2, 0.75, Math.PI * 1.2, Math.PI * 2.6, false);
  ctx.arc(-1.5, -0.3, 0.65, Math.PI * 0.5, Math.PI * 1.9, false);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, TAU); ctx.fillStyle = 'rgba(30,20,12,0.85)'; ctx.fill();
  ctx.restore();
}
// 四瓣小花
function flower(ctx, x, y, s, col = HOLE) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(Math.cos(k * TAU / 4) * 0.9, Math.sin(k * TAU / 4) * 0.9, 0.75, 0.42, k * TAU / 4, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, 0.36, 0, TAU); ctx.fillStyle = 'rgba(30,20,12,0.85)'; ctx.fill();
  ctx.restore();
}
// 一列/一行的小孔（沿边刻的刀口）
function edgeDots(ctx, x0, y0, x1, y1, r = 0.4) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (r * 3.2)));
  for (let i = 0; i <= n; i++) holeDot(ctx, lerp(x0, x1, i / n), lerp(y0, y1, i / n), r);
}
// 在当前裁剪区域里铺花纹
function pattern(ctx, kind, x0, y0, x1, y1, s = 1, seed = 0) {
  if (!kind || kind === 'plain') return;
  s *= 0.72;
  if (kind === 'cloud') { let r = 0; for (let y = y0; y < y1; y += 6.5 * s, r++) for (let x = x0 + (r % 2) * 3.2 * s; x < x1; x += 7 * s) cloud(ctx, x, y, 0.9 * s); }
  else if (kind === 'flower') { let r = 0; for (let y = y0; y < y1; y += 5 * s, r++) for (let x = x0 + (r % 2) * 2.5 * s; x < x1; x += 5 * s) flower(ctx, x, y, 0.8 * s); }
  else if (kind === 'dots') { let r = 0; for (let y = y0; y < y1; y += 2.6 * s, r++) for (let x = x0 + (r % 2) * 1.3 * s; x < x1; x += 2.6 * s) holeDot(ctx, x, y, 0.55 * s); }
  else if (kind === 'scale') { // 鱼鳞甲
    let r = 0; ctx.strokeStyle = OUT; ctx.lineWidth = LW * 0.8;
    for (let y = y1; y > y0; y -= 2 * s, r++) for (let x = x0 + (r % 2) * 1.5 * s; x < x1; x += 3 * s) { ctx.beginPath(); ctx.arc(x, y, 1.5 * s, Math.PI, TAU); ctx.fillStyle = HOLE; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
  } else if (kind === 'lattice') { // 回纹格
    ctx.strokeStyle = HOLE; ctx.lineWidth = 0.7 * s;
    for (let y = y0; y < y1; y += 3.4 * s) for (let x = x0; x < x1; x += 3.4 * s) { ctx.strokeRect(x + 0.5 * s, y + 0.5 * s, 2.4 * s, 2.4 * s); }
  } else if (kind === 'stripe') {
    ctx.fillStyle = HOLE; for (let y = y0; y < y1; y += 2.8 * s) ctx.fillRect(x0, y, x1 - x0, 0.7 * s);
  }
}

// ── 头：原点在颈根，面朝 +x
function head(ctx, P, fade) {
  const ht = P.head || 'sheng';
  const old = ht === 'lao', child = ht === 'child', dan = ht === 'dan' || ht === 'child' && P.sex === 'f' || P.sex === 'f' && ht !== 'jing';
  const hair = P.hairCol || (old ? L.white : L.black);
  // 镂空的脸：侧脸轮廓（下巴→唇→鼻→额）+ 发际线 + 颈
  const prof = P.profile || (dan ? [[4.1, 5.4], [4.6, 6.3], [5.15, 6.9], [4.9, 7.25], [5.3, 7.6], [5.2, 8.3], [6.0, 9.05], [5.2, 10.9], [5.25, 11.8], [4.9, 13.4], [4.0, 14.5]]
    : [[4.4, 5.0], [5.0, 6.0], [5.55, 6.75], [5.2, 7.15], [5.65, 7.55], [5.55, 8.3], [6.55, 9.15], [5.6, 11.0], [5.7, 11.9], [5.3, 13.5], [4.4, 14.6]]);
  const face = (c) => {
    c.moveTo(1.6, -0.5); c.lineTo(1.9, 3.2); curve(c, prof, false, 0.5, false);
    c.lineTo(2.2, 13.6); c.quadraticCurveTo(0.6, 11.4, 0.9, 8.4); c.quadraticCurveTo(0.2, 6.8, -1.6, 4.6); c.lineTo(-1.9, -0.5); c.closePath();
  };
  // 实脸（粗人、兵卒）：整块皮子
  const solid = P.face === 'solid';
  piece(ctx, face, solid ? (P.faceCol || L.ochre) : L.white, { alpha: solid ? 0.95 : 0.25 });
  // 眉、眼：细长的刻线（凤眼，眼尾上挑）
  ctx.fillStyle = OUT;
  ctx.beginPath(); curve(ctx, [[4.75, 10.32], [3.4, 10.62], [1.75, 11.35]], false); curve(ctx, [[2.45, 10.86], [3.5, 10.47], [4.75, 10.28]], false, 0.5, false); ctx.closePath(); ctx.fill();
  ctx.beginPath(); curve(ctx, [[5.0, 11.75], [3.4, 12.35], [1.4, 12.55]], false); curve(ctx, [[1.6, 12.3], [3.4, 12.05], [5.0, 11.62]], false, 0.5, false); ctx.closePath();
  ctx.fillStyle = old ? rgba(L.white, 0.95) : OUT; ctx.fill(); if (old) { ctx.lineWidth = 0.2; ctx.strokeStyle = OUT; ctx.stroke(); }
  // 唇
  if (!solid) { ctx.beginPath(); ctx.ellipse(dan ? 4.95 : 5.25, 7.2, 0.42, 0.22, 0.2, 0, TAU); ctx.fillStyle = rgba(L.crimson, 0.95); ctx.fill(); }
  // 头发：后脑的一整块黑皮，发丝是细的镂空线
  const back = (c) => {
    c.moveTo(4.0, 14.5);
    curve(c, [[4.0, 14.5], [2.6, 16.5], [-1.0, 17.2], [-4.4, 15.4], [-5.5, 11.6], [-4.8, 8.0], [-2.6, 5.4], [-1.6, 4.6]], false, 0.5, false);
    c.quadraticCurveTo(0.2, 6.8, 0.9, 8.4); c.quadraticCurveTo(0.6, 11.4, 2.2, 13.6); c.closePath();
  };
  piece(ctx, back, hair, { alpha: 0.96 });
  ctx.save(); ctx.beginPath(); back(ctx); ctx.clip();
  ctx.strokeStyle = old ? 'rgba(40,30,20,0.35)' : 'rgba(255,245,225,0.35)'; ctx.lineWidth = 0.18;
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(3 - k * 0.4, 15.8 - k * 0.2); ctx.quadraticCurveTo(-3.5 + k * 0.2, 14 - k * 0.5, -3.2 + k * 0.5, 6.5 + k * 0.3); ctx.stroke(); }
  ctx.restore();
  // 发髻与头饰
  const hat = P.hat || (dan ? 'bun' : child ? 'twin' : old ? 'knotOld' : 'crown');
  if (hat === 'bun' || hat === 'bunHigh') {
    const hy = hat === 'bunHigh' ? 20.5 : 18.6;
    piece(ctx, (c) => { c.ellipse(-2.4, hy, 3.6, 2.6, -0.35, 0, TAU); }, hair, { alpha: 0.96 });
    piece(ctx, (c) => { c.ellipse(-5.2, hy - 1.8, 1.9, 2.4, 0.4, 0, TAU); }, hair, { alpha: 0.96 });
    // 金钗与步摇
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.35;
    piece(ctx, (c) => { c.moveTo(2.4, hy + 1.6); c.lineTo(-6.6, hy - 0.4); c.lineTo(-6.5, hy - 1.0); c.lineTo(2.5, hy + 1.1); c.closePath(); }, L.gold);
    for (let k = 0; k < 3; k++) { const x = -5.6 + k * 0.9; ctx.beginPath(); ctx.moveTo(x, hy - 0.6); ctx.lineTo(x - 0.3, hy - 3.6 - k * 0.6); ctx.stroke(); piece(ctx, (c) => c.arc(x - 0.3, hy - 4.1 - k * 0.6, 0.55, 0, TAU), L.red); }
    flower(ctx, 0.2, hy + 1.8, 0.9, rgba(L.rose, 0.95));
    flower(ctx, -3.3, hy + 2.4, 0.75, rgba(L.yellow, 0.95));
  } else if (hat === 'twin') {
    piece(ctx, (c) => c.arc(-0.4, 17.6, 2.2, 0, TAU), hair, { alpha: 0.96 });
    piece(ctx, (c) => c.arc(-4.4, 16.4, 2.1, 0, TAU), hair, { alpha: 0.96 });
    piece(ctx, (c) => { c.rect(-1.6, 16.0, 2.4, 0.7); }, L.red); piece(ctx, (c) => { c.rect(-5.6, 14.9, 2.4, 0.7); }, L.red);
  } else if (hat === 'crown') {
    piece(ctx, (c) => c.ellipse(-0.6, 17.6, 2.4, 1.7, 0, 0, TAU), hair, { alpha: 0.96 });
    piece(ctx, (c) => { c.moveTo(-3.0, 16.4); c.lineTo(-3.4, 19.4); c.lineTo(-1.8, 18.6); c.lineTo(-0.6, 20.6); c.lineTo(0.6, 18.6); c.lineTo(2.0, 19.4); c.lineTo(1.7, 16.4); c.closePath(); }, P.crownCol || L.gold);
    holeDot(ctx, -0.6, 17.7, 0.5);
    piece(ctx, (c) => { c.moveTo(3.8, 18.3); c.lineTo(-5.0, 17.0); c.lineTo(-5.0, 16.6); c.lineTo(3.8, 17.9); c.closePath(); }, L.gold);
  } else if (hat === 'knotOld') {
    piece(ctx, (c) => c.ellipse(-0.8, 17.6, 2.2, 1.6, 0, 0, TAU), hair, { alpha: 0.96 });
    piece(ctx, (c) => { c.moveTo(3.2, 18.0); c.lineTo(-4.4, 17.0); c.lineTo(-4.4, 16.7); c.lineTo(3.2, 17.7); c.closePath(); }, L.brown);
  } else if (hat === 'band') {
    piece(ctx, (c) => c.ellipse(-0.8, 17.4, 2.1, 1.5, 0, 0, TAU), hair, { alpha: 0.96 });
    piece(ctx, (c) => { c.moveTo(4.2, 14.6); c.lineTo(-5.0, 14.2); c.lineTo(-5.2, 13.2); c.lineTo(4.4, 13.7); c.closePath(); }, P.bandCol || L.ink);
    piece(ctx, (c) => { c.moveTo(-4.8, 14.0); c.quadraticCurveTo(-7.5, 12, -8.4, 8.4); c.lineTo(-7.8, 8.2); c.quadraticCurveTo(-7, 11.5, -4.8, 13.2); c.closePath(); }, P.bandCol || L.ink);
  } else if (hat === 'helmet') {
    piece(ctx, (c) => { c.moveTo(5.2, 13.8); c.quadraticCurveTo(4.6, 19.2, -0.6, 19.4); c.quadraticCurveTo(-5.8, 19.0, -6.0, 13.2); c.lineTo(-6.4, 8.6); c.lineTo(-3.4, 9.6); c.lineTo(-2.6, 13.0); c.lineTo(5.4, 13.2); c.closePath(); }, P.helmCol || L.gray);
    ctx.save(); ctx.beginPath(); ctx.rect(-7, 13, 13, 7); ctx.clip(); pattern(ctx, 'stripe', -7, 14, 6, 20, 0.6); ctx.restore();
    piece(ctx, (c) => { c.moveTo(-0.8, 19.2); c.quadraticCurveTo(-1.6, 22.5, -4.8, 24.4); c.quadraticCurveTo(-2.4, 22.6, 0.4, 19.2); c.closePath(); }, P.plume || L.red);
  } else if (hat === 'veil') {
    piece(ctx, (c) => { c.moveTo(6.8, 13.0); c.quadraticCurveTo(6.6, 19.8, -0.8, 20.6); c.quadraticCurveTo(-7.4, 19.4, -8.2, 10); c.lineTo(-8.8, -4); c.lineTo(8.4, -3.2); c.closePath(); }, L.red, { alpha: 0.95 });
    ctx.save(); ctx.beginPath(); ctx.moveTo(6.8, 13.0); ctx.quadraticCurveTo(6.6, 19.8, -0.8, 20.6); ctx.quadraticCurveTo(-7.4, 19.4, -8.2, 10); ctx.lineTo(-8.8, -4); ctx.lineTo(8.4, -3.2); ctx.closePath(); ctx.clip();
    pattern(ctx, 'flower', -8, -3, 8, 20, 1.1); ctx.restore();
    piece(ctx, (c) => { c.moveTo(-8.8, -3.4); c.lineTo(8.4, -2.6); c.lineTo(8.4, -4.4); c.lineTo(-8.8, -5.2); c.closePath(); }, L.gold);
    for (let k = 0; k < 7; k++) { const x = -8 + k * 2.6; piece(ctx, (c) => { c.moveTo(x - 0.4, -4.6); c.lineTo(x + 0.4, -4.5); c.lineTo(x, -7.2); c.closePath(); }, L.gold); }
  } else if (hat === 'tricorn') {
    piece(ctx, (c) => { c.moveTo(7.6, 15.0); c.quadraticCurveTo(1.0, 23.4, -7.6, 16.0); c.quadraticCurveTo(-1.0, 17.8, 7.6, 15.0); c.closePath(); }, L.black);
    piece(ctx, (c) => { c.moveTo(4.4, 15.8); c.quadraticCurveTo(0, 21, -4.8, 16.4); c.closePath(); }, L.black);
    piece(ctx, (c) => { c.moveTo(7.4, 15.1); c.quadraticCurveTo(1.0, 22.7, -7.4, 16.1); c.lineTo(-7.0, 16.6); c.quadraticCurveTo(1.0, 23.6, 7.6, 15.6); c.closePath(); }, L.gold, { outline: false });
  } else if (hat === 'short') {
    // 现代短发：只用后脑那一块
  } else if (hat === 'long') {
    piece(ctx, (c) => { c.moveTo(-2.0, 16.6); c.quadraticCurveTo(-7.4, 12.0, -6.6, -1.5); c.lineTo(-3.0, -1.0); c.quadraticCurveTo(-3.6, 8.0, -1.0, 14.6); c.closePath(); }, hair, { alpha: 0.96 });
  }
  // 胡须：一束一束的细线
  if (P.beard) {
    const bc = P.beardCol || (old ? 'rgba(250,246,236,0.95)' : 'rgba(30,22,16,0.95)');
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.55;
    const len = P.beard === 'long' ? 15 : 6;
    for (let k = 0; k < 9; k++) {
      const x0 = 1.2 + k * 0.42, y0 = 6.4 - Math.abs(k - 4) * 0.12;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + 0.8, y0 - len * 0.35, x0 - 0.6 + k * 0.1, y0 - len * 0.7, x0 - 1.4 + k * 0.25, y0 - len);
      ctx.lineWidth = 0.75; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 0.42; ctx.strokeStyle = bc; ctx.stroke();
    }
    // 八字胡
    ctx.beginPath(); ctx.moveTo(5.6, 7.9); ctx.quadraticCurveTo(4.6, 7.0, 3.0, 5.6); ctx.lineWidth = 0.9; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 0.5; ctx.strokeStyle = bc; ctx.stroke();
  }
  // 亚人的特征：角、兽耳（会淡出）
  const fa = 1 - (fade || 0);
  if (fa > 0.01 && (P.horns || P.ears)) {
    ctx.save(); ctx.globalAlpha *= fa;
    if (P.horns === 'antler') {
      for (const s of [1, 0.75]) {
        ctx.save(); ctx.translate(s === 1 ? 0.6 : -1.6, 16.6); ctx.scale(s, s);
        piece(ctx, (c) => { c.moveTo(0, 0); c.quadraticCurveTo(-1.5, 5, -1.0, 9.5); c.lineTo(-0.2, 9.5); c.quadraticCurveTo(-0.4, 5, 1.2, 0.2); c.closePath(); c.moveTo(-0.8, 4.0); c.quadraticCurveTo(1.6, 5.8, 2.8, 8.4); c.lineTo(3.3, 8.0); c.quadraticCurveTo(2.0, 5.4, -0.6, 3.2); c.closePath(); c.moveTo(-1.0, 7.0); c.quadraticCurveTo(-3.6, 8.2, -4.4, 10.6); c.lineTo(-3.8, 10.8); c.quadraticCurveTo(-3.0, 8.8, -0.8, 7.9); c.closePath(); }, P.hornCol || L.ochre);
        ctx.restore();
      }
    } else if (P.horns === 'ox') {
      piece(ctx, (c) => { c.moveTo(1.0, 16.2); c.quadraticCurveTo(6.6, 17.6, 7.4, 22.6); c.quadraticCurveTo(5.4, 19.2, 0.4, 17.6); c.closePath(); }, P.hornCol || L.cream);
      piece(ctx, (c) => { c.moveTo(-3.0, 16.2); c.quadraticCurveTo(-8.0, 17.6, -8.4, 22.2); c.quadraticCurveTo(-6.6, 19.2, -2.4, 17.6); c.closePath(); }, P.hornCol || L.cream);
    } else if (P.horns === 'dragon') {
      for (const [x, s] of [[0.2, 1], [-2.2, 0.85]]) {
        ctx.save(); ctx.translate(x, 16.8); ctx.scale(s, s);
        piece(ctx, (c) => { c.moveTo(0, 0); c.bezierCurveTo(-2, 3.6, -6, 5, -9.4, 5.2); c.bezierCurveTo(-5.4, 3.8, -2.6, 2.4, 1.0, 0.4); c.closePath(); c.moveTo(-4.4, 3.4); c.quadraticCurveTo(-4.6, 5.8, -3.6, 7.6); c.lineTo(-3.0, 7.3); c.quadraticCurveTo(-3.6, 5.6, -3.4, 3.4); c.closePath(); }, P.hornCol || L.gold);
        ctx.restore();
      }
    }
    if (P.ears === 'fox' || P.ears === 'cat') {
      const h = P.ears === 'fox' ? 6.4 : 4.4;
      for (const [x, s] of [[-0.6, 1], [-3.6, 0.85]]) {
        ctx.save(); ctx.translate(x, 16.4); ctx.scale(s, s);
        piece(ctx, (c) => { c.moveTo(-2.0, 0); c.quadraticCurveTo(-1.2, h * 0.7, 0.4, h); c.quadraticCurveTo(1.6, h * 0.5, 2.0, 0); c.closePath(); }, P.earCol || L.orange);
        piece(ctx, (c) => { c.moveTo(-1.0, 0.6); c.quadraticCurveTo(-0.4, h * 0.55, 0.4, h * 0.75); c.quadraticCurveTo(1.0, h * 0.4, 1.0, 0.6); c.closePath(); }, L.white, { outline: false, alpha: 0.6 });
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

// ── 躯干：原点在髋，+y 向上
function torsoPath(c, P) {
  const f = P.sex === 'f', w = P.bodyW || 1;
  const pts = f
    ? [[4.6, -1.5], [4.3, 4], [4.6, 9.5], [6.0, 14.5], [6.2, 18.5], [5.0, 22.4], [3.0, 25.6], [1.4, 27.4], [-0.6, 27.8], [-2.2, 26.8], [-4.4, 25.2], [-5.6, 22.0], [-5.6, 17], [-4.8, 11], [-4.6, 5.5], [-5.6, 1.0], [-6.2, -1.5]]
    : [[5.2, -1.5], [5.3, 4], [5.8, 10], [6.8, 15.5], [6.8, 19.5], [5.6, 22.8], [3.4, 25.8], [1.8, 27.4], [-0.6, 27.8], [-2.6, 27.0], [-5.0, 25.6], [-6.6, 22.4], [-6.8, 17], [-6.0, 10], [-5.6, 5], [-6.0, 1.0], [-6.4, -1.5]];
  curve(c, pts.map(([x, y]) => [x * w, y]), true, 0.45);
}
function torso(ctx, P) {
  const robe = P.robe || L.red, trim = P.trim || L.yellow, inner = P.inner || L.white;
  piece(ctx, (c) => torsoPath(c, P), robe);
  ctx.save(); ctx.beginPath(); torsoPath(ctx, P); ctx.clip();
  pattern(ctx, P.pattern || 'cloud', -7, 6, 8, 25, P.patS || 1, 1);
  edgeDots(ctx, -4.6, 6, -5.0, 22, 0.42);
  if (P.armor) { pattern(ctx, 'scale', -7, 4, 8, 22, 0.9); }
  // 交领：内衣的白领 + 外衣的镶边
  ctx.beginPath(); ctx.moveTo(-0.8, 28); ctx.quadraticCurveTo(1.6, 24.4, 5.6, 14.6); ctx.lineTo(7.4, 14.6); ctx.lineTo(7.4, 28.5); ctx.closePath(); ctx.fillStyle = rgba(inner, 0.93); ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1.6, 28); ctx.quadraticCurveTo(0.8, 23.6, 4.4, 14.4); ctx.lineTo(6.2, 14.4); ctx.quadraticCurveTo(2.6, 23.8, 0.6, 28.2); ctx.closePath(); ctx.fillStyle = rgba(trim, 0.95); ctx.fill(); ctx.stroke();
  // 腰带
  if (P.lower !== 'coat') {
    ctx.beginPath(); ctx.rect(-8, 1.2, 16, 3.2); ctx.fillStyle = rgba(P.belt || trim, 0.95); ctx.fill(); ctx.stroke();
    for (let x = -5; x < 6; x += 2.2) holeDot(ctx, x, 2.8, 0.42);
  } else {
    // 外套：一排扣子与翻领
    for (let y = 4; y < 22; y += 3.2) { ctx.beginPath(); ctx.arc(5.0, y, 0.55, 0, TAU); ctx.fillStyle = rgba(L.gold, 1); ctx.fill(); ctx.lineWidth = 0.2; ctx.stroke(); }
  }
  ctx.restore();
  piece(ctx, (c) => torsoPath(c, P), null);
}

// ── 下装：由腰、膝、踝的位置算出来的一整块裙片（凸包），站、走、跪、坐、躺都成立
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function lower(ctx, P, J) {
  const kind = P.lower || 'robe';
  if (kind === 'trousers') return;
  const w = (P.bodyW || 1) * (P.sex === 'f' ? 0.92 : 1);
  const fl = P.flare ?? (kind === 'skirt' ? 1.3 : 1.0);
  const H = J.hip, ty = M.ap(J.torsoM, [0, 1.0]);
  const pts = [], hem = [];
  pts.push(M.ap(J.torsoM, [5.4 * w, 1.0]), M.ap(J.torsoM, [-6.2 * w, 1.0]));
  // 臀（坐、跪时裙子盖住）
  pts.push([H[0] - 6.0 * w, H[1] - 4], [H[0] + 5.0 * w, H[1] - 4]);
  const long = kind === 'robe' || kind === 'skirt';
  for (const side of ['F', 'B']) {
    const kn = M.ap(J['kn' + side], [0, 0]);
    const thighDir = [kn[0] - H[0], kn[1] - H[1]];
    if (long) {
      // 踝附近的下摆：往两侧张开（顺着小腿方向的垂直方向）
      const m = J['kn' + side];
      const a0 = M.ap(m, [0, -SK.shin + 1.0]);
      const fwd = M.ap(m, [1, 0]), org = M.ap(m, [0, 0]); const ux = fwd[0] - org[0], uy = fwd[1] - org[1];
      const f1 = [a0[0] + ux * 4.2 * fl, a0[1] + uy * 4.2 * fl], b1 = [a0[0] - ux * (kind === 'skirt' ? 6.5 : 4.4) * fl, a0[1] - uy * (kind === 'skirt' ? 6.5 : 4.4) * fl];
      pts.push(f1, b1); hem.push(f1, b1);
      pts.push(M.ap(m, [3.0, 0]), M.ap(m, [-3.0, 0]));
    } else {
      const m = J['kn' + side];
      const k1 = M.ap(m, [3.6, -(kind === 'coat' ? 3.5 : 2.0)]), k2 = M.ap(m, [-3.6, -(kind === 'coat' ? 3.5 : 2.0)]);
      pts.push(k1, k2); hem.push(k1, k2);
    }
  }
  const hp = hull(pts);
  const build = (c) => curve(c, hp, true, 0.18);
  const col = P.skirtCol || P.robe || L.red;
  piece(ctx, build, col);
  ctx.save(); ctx.beginPath(); build(ctx); ctx.clip();
  const xs = hp.map((p) => p[0]), ys = hp.map((p) => p[1]);
  const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, y0 = Math.min(...ys) - 2, y1 = Math.max(...ys);
  pattern(ctx, P.skirtPattern || P.pattern || 'cloud', x0, y0 + 5, x1, y1, P.patS || 1, 2);
  // 衣褶：从腰往下摆的几道淡刻线
  ctx.strokeStyle = 'rgba(28,18,12,0.28)'; ctx.lineWidth = LW * 0.7;
  const hc = hem.reduce((a, p) => [a[0] + p[0] / hem.length, a[1] + p[1] / hem.length], [0, 0]);
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(ty[0] + k * 3, ty[1]); ctx.quadraticCurveTo(lerp(ty[0], hc[0], 0.5) + k * 4, lerp(ty[1], hc[1], 0.5), hc[0] + k * 5, hc[1]); ctx.stroke(); }
  // 下摆的镶边：沿着凸包上两端都是下摆点的边
  const trim = P.trim || L.yellow;
  const isHem = (p) => hem.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6);
  for (let i = 0; i < hp.length; i++) {
    const a = hp[i], b2 = hp[(i + 1) % hp.length];
    if (isHem(a) && isHem(b2)) {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineWidth = 4.4; ctx.strokeStyle = rgba(trim, 0.95); ctx.stroke();
      const n = Math.max(2, Math.round(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / 2.4));
      const ux = (b2[0] - a[0]) / Math.hypot(b2[0] - a[0], b2[1] - a[1]), uy = (b2[1] - a[1]) / Math.hypot(b2[0] - a[0], b2[1] - a[1]);
      for (let j = 0; j <= n; j++) holeDot(ctx, lerp(a[0], b2[0], j / n) - uy * 0.8, lerp(a[1], b2[1], j / n) + ux * 0.8, 0.55);
    }
  }
  ctx.restore();
  piece(ctx, build, null);
}

// ── 腿：大腿、小腿、靴
function thigh(ctx, P) {
  piece(ctx, (c) => { c.moveTo(-3.4, 1.5); c.lineTo(3.4, 1.5); c.quadraticCurveTo(3.0, -12, 2.4, -SK.thigh - 0.8); c.lineTo(-2.4, -SK.thigh - 0.8); c.quadraticCurveTo(-3.4, -12, -3.4, 1.5); c.closePath(); }, P.trousers || P.robe2 || L.ink);
}
function shin(ctx, P) {
  const f = P.sex === 'f' && P.lower === 'skirt';
  piece(ctx, (c) => { c.moveTo(-2.4, 0.8); c.lineTo(2.4, 0.8); c.quadraticCurveTo(2.0, -10, 1.7, -SK.shin + 3); c.lineTo(-1.8, -SK.shin + 3); c.quadraticCurveTo(-2.4, -10, -2.4, 0.8); c.closePath(); }, P.trousers || P.robe2 || L.ink);
  // 靴
  const bc = P.boots || L.black;
  ctx.save(); ctx.translate(0, -SK.shin);
  if (f) piece(ctx, (c) => { c.moveTo(-1.8, 3.4); c.lineTo(1.8, 3.4); c.lineTo(2.2, 1.2); c.quadraticCurveTo(5.2, 1.0, 6.6, 0.4); c.quadraticCurveTo(4.4, -0.4, -2.0, -0.2); c.closePath(); }, P.shoeCol || L.red);
  else piece(ctx, (c) => { c.moveTo(-2.1, 7.0); c.lineTo(2.1, 7.0); c.lineTo(2.3, 1.6); c.quadraticCurveTo(5.8, 1.6, 7.4, 2.8); c.quadraticCurveTo(7.0, 0.2, 5.0, -0.2); c.lineTo(-2.4, -0.2); c.closePath(); }, bc);
  if (!f) { ctx.beginPath(); ctx.rect(-2.3, -0.2, 9.0, 0.9); ctx.fillStyle = rgba(L.white, 0.9); ctx.fill(); }
  ctx.restore();
}

// ── 手臂：上臂、小臂（宽袖时挂一只垂袖）、手
function upperArm(ctx, P) {
  const b = (c) => { c.moveTo(-2.1, 2.0); c.quadraticCurveTo(0, 3.4, 2.1, 1.8); c.quadraticCurveTo(2.0, -8, 1.6, -SK.up - 0.6); c.lineTo(-1.6, -SK.up - 0.6); c.quadraticCurveTo(-2.2, -8, -2.1, 2.0); c.closePath(); };
  piece(ctx, b, P.robe || L.red);
  ctx.save(); ctx.beginPath(); b(ctx); ctx.clip(); edgeDots(ctx, -1.2, -SK.up + 1, 1.2, 1, 0.6); ctx.restore();
}
function foreArm(ctx, P, g) {
  const col = P.robe || L.red, trim = P.trim || L.yellow;
  piece(ctx, (c) => { c.moveTo(-1.6, 0.6); c.lineTo(1.6, 0.6); c.quadraticCurveTo(1.5, -7, 1.3, -SK.fore); c.lineTo(-1.3, -SK.fore); c.quadraticCurveTo(-1.6, -7, -1.6, 0.6); c.closePath(); }, col);
  if (P.sleeve === 'wide') {
    // 垂袖：从小臂中段挂下去，袖口朝着重力方向张开，露出里衬
    const L1 = (P.sleeveLen || 15) * 1.15;
    const gx = g[0], gy = g[1], nx = -gy, ny = gx;             // 重力方向与它的法向
    const top0 = [-2.0, -SK.fore * 0.35], top1 = [2.0, -SK.fore * 0.55];
    const tip = [-1.0 + gx * L1, -SK.fore + gy * L1];          // 袖底
    const lip = [2.2 + gx * L1 * 0.62, -SK.fore + 0.6 + gy * L1 * 0.62];
    const build = (c) => {
      c.moveTo(top0[0], top0[1]);
      c.bezierCurveTo(top0[0] - 3.6 + gx * 4, top0[1] + gy * 4, tip[0] - nx * 3.2 - gx * 3, tip[1] - ny * 3.2 - gy * 3, tip[0], tip[1]);
      c.quadraticCurveTo(tip[0] + nx * 3 + gx * 1.5, tip[1] + ny * 3 + gy * 1.5, lip[0], lip[1]);
      c.quadraticCurveTo(top1[0] + 2.2, top1[1] - 1.5, top1[0], top1[1]);
      c.closePath();
    };
    piece(ctx, build, col);
    ctx.save(); ctx.beginPath(); build(ctx); ctx.clip(); pattern(ctx, P.pattern || 'cloud', -20, -40, 20, 4, (P.patS || 1) * 0.8, 4);
    // 袖口镶边与里衬
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.quadraticCurveTo(tip[0] + nx * 3 + gx * 1.5, tip[1] + ny * 3 + gy * 1.5, lip[0], lip[1]);
    ctx.lineWidth = 2.4; ctx.strokeStyle = rgba(trim, 0.96); ctx.stroke();
    ctx.restore(); piece(ctx, build, null);
    piece(ctx, (c) => { c.moveTo(tip[0], tip[1]); c.quadraticCurveTo(tip[0] + nx * 1.2 - gx * 1.2, tip[1] + ny * 1.2 - gy * 1.2, lip[0], lip[1]); c.quadraticCurveTo(tip[0] + nx * 3 + gx * 1.5, tip[1] + ny * 3 + gy * 1.5, tip[0], tip[1]); c.closePath(); }, P.inner || L.white, { lw: LW * 0.8 });
  }
  // 袖口
  piece(ctx, (c) => { c.rect(-1.5, -SK.fore - 0.2, 3.0, 1.4); }, P.cuff || trim);
}
function hand(ctx, P, kind = 'open') {
  const sk = P.skinCol || L.skin;
  if (kind === 'fist') piece(ctx, (c) => { c.moveTo(-1.3, 0.4); c.lineTo(1.3, 0.4); c.quadraticCurveTo(2.0, -1.6, 1.4, -3.0); c.quadraticCurveTo(0, -3.8, -1.4, -3.0); c.quadraticCurveTo(-1.9, -1.6, -1.3, 0.4); c.closePath(); }, sk);
  else piece(ctx, (c) => { c.moveTo(-1.2, 0.4); c.lineTo(1.2, 0.4); c.quadraticCurveTo(2.6, -1.4, 2.9, -2.6); c.quadraticCurveTo(1.9, -2.4, 1.3, -1.9); c.quadraticCurveTo(1.4, -3.6, 0.8, -5.0); c.quadraticCurveTo(-0.4, -5.4, -1.0, -4.2); c.quadraticCurveTo(-1.6, -2.0, -1.2, 0.4); c.closePath(); }, sk);
}
// 空袖：断臂的人，袖子从肩头垂下
function emptySleeve(ctx, P, g) {
  const col = P.robe || L.red;
  const L1 = 26;
  piece(ctx, (c) => { c.moveTo(-2.6, 2.0); c.quadraticCurveTo(0, 3.6, 2.6, 1.8); c.quadraticCurveTo(2.4 + g[0] * 8, g[1] * 10, 1.4 + g[0] * L1, g[1] * L1); c.lineTo(-1.4 + g[0] * L1 - 1, g[1] * L1 + 0.6); c.quadraticCurveTo(-2.8 + g[0] * 8, g[1] * 10, -2.6, 2.0); c.closePath(); }, col);
  piece(ctx, (c) => { c.moveTo(1.4 + g[0] * L1, g[1] * L1); c.lineTo(-2.4 + g[0] * L1, g[1] * L1 + 0.6); c.lineTo(-2.2 + g[0] * (L1 - 1.6), g[1] * (L1 - 1.6) + 0.6); c.lineTo(1.6 + g[0] * (L1 - 1.6), g[1] * (L1 - 1.6)); c.closePath(); }, P.trim || L.yellow);
}

// 尾巴（狐尾）：从髋后方伸出
function tail(ctx, P, t = 0) {
  const sway = Math.sin(t * 2.1) * 0.12;
  ctx.save(); ctx.rotate(sway);
  piece(ctx, (c) => { c.moveTo(-4.5, 4); c.bezierCurveTo(-14, 2, -20, -10, -15, -24); c.bezierCurveTo(-12, -28, -7, -26, -9, -20); c.bezierCurveTo(-12, -10, -8, -2, -3.5, 0.5); c.closePath(); }, P.tailCol || L.orange);
  piece(ctx, (c) => { c.moveTo(-15, -24); c.bezierCurveTo(-12, -28, -7, -26, -9, -20); c.quadraticCurveTo(-12, -21, -15, -24); c.closePath(); }, L.white);
  ctx.restore();
}

// ── 道具（画在手的坐标里，手指向 -y）
export function prop(ctx, kind, opt = {}) {
  ctx.save(); ctx.rotate(opt.ang || 0);
  if (kind === 'sword') {
    const len = opt.len || 30;
    piece(ctx, (c) => { c.rect(-0.5, 1.5, 1.0, 5.5); }, L.brown);                   // 柄
    piece(ctx, (c) => { c.moveTo(-2.2, -0.4); c.lineTo(2.2, -0.4); c.lineTo(1.6, -1.4); c.lineTo(-1.6, -1.4); c.closePath(); }, L.gold);   // 剑格
    piece(ctx, (c) => { c.moveTo(-0.62, -1.4); c.lineTo(0.62, -1.4); c.lineTo(0.5, -len + 1.4); c.lineTo(0, -len); c.lineTo(-0.5, -len + 1.4); c.closePath(); }, L.white, { alpha: 0.5 });
    ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.lineTo(0, -len + 1.6); ctx.lineWidth = 0.2; ctx.strokeStyle = OUT; ctx.stroke();
    if (opt.tassel !== false) { ctx.beginPath(); ctx.moveTo(0, 7); ctx.quadraticCurveTo(1.5, 10, 0.4, 13); ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(L.red, 0.95); ctx.stroke(); }
  } else if (kind === 'stick') {
    piece(ctx, (c) => { c.moveTo(-0.4, 6); c.lineTo(0.4, 6); c.lineTo(0.3, -opt.len || -28); c.lineTo(-0.3, -opt.len || -28); c.closePath(); }, L.brown);
  } else if (kind === 'spear') {
    const len = opt.len || 70;
    piece(ctx, (c) => { c.rect(-0.45, -len * 0.25, 0.9, len); }, L.brown);
    piece(ctx, (c) => { c.moveTo(-1.2, len * 0.75); c.lineTo(1.2, len * 0.75); c.lineTo(0, len * 0.75 + 7); c.closePath(); }, L.white, { alpha: 0.6 });
    piece(ctx, (c) => { c.moveTo(-1.4, len * 0.75 - 0.4); c.quadraticCurveTo(-2.6, len * 0.75 - 4, -1.0, len * 0.75 - 6); c.lineTo(1.0, len * 0.75 - 6); c.quadraticCurveTo(2.6, len * 0.75 - 4, 1.4, len * 0.75 - 0.4); c.closePath(); }, L.red);
  } else if (kind === 'torch') {
    piece(ctx, (c) => { c.rect(-0.6, -6, 1.2, 24); }, L.brown);
    piece(ctx, (c) => { c.moveTo(-1.6, 17); c.lineTo(1.6, 17); c.lineTo(1.2, 19.5); c.lineTo(-1.2, 19.5); c.closePath(); }, L.black);
  } else if (kind === 'lanternPole') {
    // 提灯：一根短杆，灯笼在杆头垂着（始终朝下）
    piece(ctx, (c) => { c.rect(-0.35, -12, 0.7, 14); }, L.brown);
    ctx.save(); ctx.translate(0, -12); ctx.rotate(-(opt.world || 0) + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -2.4); ctx.lineWidth = 0.4; ctx.strokeStyle = OUT; ctx.stroke();
    piece(ctx, (c) => { c.ellipse(0, -5.6, 2.8, 3.4, 0, 0, TAU); }, L.yellow, { alpha: 0.5 });
    piece(ctx, (c) => { c.rect(-1.7, -2.6, 3.4, 0.9); c.rect(-1.7, -9.4, 3.4, 0.9); }, L.red);
    ctx.restore();
  } else if (kind === 'fan') {
    piece(ctx, (c) => { c.moveTo(0, 0); c.arc(0, 0, 9, -Math.PI * 0.85, -Math.PI * 0.15); c.closePath(); }, L.cream);
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.25; for (let k = 0; k <= 8; k++) { const a = -Math.PI * 0.85 + k * Math.PI * 0.7 / 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
  } else if (kind === 'scroll') {
    piece(ctx, (c) => { c.rect(-1.2, -9, 2.4, 10); }, L.cream);
    piece(ctx, (c) => { c.rect(-1.6, -9.6, 3.2, 1.2); c.rect(-1.6, 0.2, 3.2, 1.2); }, L.brown);
  } else if (kind === 'bag') {
    piece(ctx, (c) => { c.moveTo(-1, -0.5); c.quadraticCurveTo(-4.2, -3.5, -2.6, -6.6); c.lineTo(2.6, -6.6); c.quadraticCurveTo(4.2, -3.5, 1, -0.5); c.closePath(); }, L.gold);
    holeDot(ctx, 0, -4.2, 0.8);
  } else if (kind === 'musket') {
    piece(ctx, (c) => { c.moveTo(-0.6, 8); c.lineTo(0.6, 8); c.lineTo(0.4, -36); c.lineTo(-0.4, -36); c.closePath(); }, L.black);
    piece(ctx, (c) => { c.moveTo(-1.2, 8); c.lineTo(1.4, 8); c.lineTo(2.4, 15); c.lineTo(-0.6, 15.6); c.closePath(); }, L.brown);
  }
  ctx.restore();
}

// ── 姿态与正运动学
export function rest() {
  return { lean: 0, head: 0, aB: 0.08, eB: 0.15, hB: 0, aF: -0.05, eF: 0.15, hF: 0, legB: [-0.03, 0.02], legF: [0.05, 0.02], drop: 0, ground: true };
}
// 走路：phase 是步态相位（每一步 0.5）
export function walkPose(phase, { stride = 0.42, lift = 0.5, swing = 0.32, lean = 0.04 } = {}) {
  const s = Math.sin(phase * TAU), c = Math.cos(phase * TAU);
  return {
    ...rest(), lean, head: -lean * 0.5,
    legF: [stride * s, Math.max(0, -c) * lift + 0.04], legB: [-stride * s, Math.max(0, c) * lift + 0.04],
    aF: -swing * s, eF: 0.25 + 0.15 * Math.max(0, -s), aB: swing * s, eB: 0.25 + 0.15 * Math.max(0, s),
  };
}
export function fk(P, pose) {
  const p = { ...rest(), ...pose };
  const hs = (P.child ? 1.3 : 1.18) * (P.headS || 1);
  const root = M.tr(0, SK.hip - p.drop);
  const torsoM = M.mul(root, M.rot(-p.lean));
  const headM = chain(torsoM, M.tr(...SK.neck), M.rot(-p.head), M.sc(hs), M.tr(0, -1.8));
  const shB = chain(torsoM, M.tr(...SK.shB), M.rot(p.aB));
  const elB = chain(shB, M.tr(0, -SK.up), M.rot(p.eB));
  const wrB = chain(elB, M.tr(0, -SK.fore), M.rot(p.hB));
  const shF = chain(torsoM, M.tr(...SK.shF), M.rot(p.aF));
  const elF = chain(shF, M.tr(0, -SK.up), M.rot(p.eF));
  const wrF = chain(elF, M.tr(0, -SK.fore), M.rot(p.hF));
  const thB = M.mul(root, M.rot(p.legB[0]));
  const knB = chain(thB, M.tr(0, -SK.thigh), M.rot(-p.legB[1]));
  const thF = M.mul(root, M.rot(p.legF[0]));
  const knF = chain(thF, M.tr(0, -SK.thigh), M.rot(-p.legF[1]));
  let J = { root, torsoM, headM, shB, elB, wrB, shF, elF, wrF, thB, knB, thF, knF };
  if (p.ground) {
    const ys = [];
    for (const k of [knB, knF]) { ys.push(M.ap(k, [0, -SK.shin])[1], M.ap(k, [6, -SK.shin])[1]); }
    if (p.legB[1] > 1.0) ys.push(M.ap(knB, [0, 0])[1] - 2.4);
    if (p.legF[1] > 1.0) ys.push(M.ap(knF, [0, 0])[1] - 2.4);
    if (p.seat) ys.push(M.ap(root, [0, 0])[1] - 4.5);
    const dy = -Math.min(...ys);
    const T = M.tr(0, dy);
    for (const k in J) J[k] = M.mul(T, J[k]);
  }
  J.hip = M.ap(J.root, [0, 0]);
  J.kneeB = M.ap(J.knB, [0, 0]); J.kneeF = M.ap(J.knF, [0, 0]);
  J.ankleB = M.ap(J.knB, [0, -SK.shin]); J.ankleF = M.ap(J.knF, [0, -SK.shin]);
  J.handF = M.ap(J.wrF, [0, -3]); J.handB = M.ap(J.wrB, [0, -3]);
  J.headTop = M.ap(J.headM, [0, 18]);
  J.pose = p;
  return J;
}
// 让手够到偶坐标里的某一点（返回 aF/eF 或 aB/eB）
export function reach(P, pose, side, target, bend = 1) {
  const p = { ...rest(), ...pose };
  const J = fk(P, p);
  const sh = M.ap(side === 'F' ? J.shF : J.shB, [0, 0]);
  const [a1, a2] = ik2(sh, target, SK.up, SK.fore + 2.5, bend);
  // ik2 给的是绝对角；换成相对躯干/上臂
  return { ['a' + side]: a1 + p.lean, ['e' + side]: a2 - a1 };
}
// 姿态插值
export function blend(a, b, f) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? rest()[k], y = b[k] ?? rest()[k];
    o[k] = Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], f)) : typeof x === 'number' ? lerp(x, y, f) : (f < 0.5 ? x : y);
  }
  return o;
}
export const SKEL = SK;

// 道具的角度：abs 是绝对角（0 = 朝下，正 = 朝前），换成手腕坐标里的角
// 矛、火把的「头」画在 +y 方向，所以多转半圈；abs 永远指「有用的那一头」的方向
const FLIP = { spear: 1, torch: 1 };
const absAng = (h, m) => (h.abs !== undefined ? { ...h, ang: h.abs - M.angle(m) + (FLIP[h.kind] ? Math.PI : 0), world: h.abs } : h);
const gravLocal = (m) => { const a = M.angle(m); return [-Math.sin(a), -Math.cos(a)]; }; // 世界「下」方向在部件坐标里

// ── 画一个偶
// opt: { x, y, s（偶高/100）, face（±1）, t, fade（特征淡出）, hold: { F: {kind, ang}, B: {...} }, hand: {F:'fist'|'open', B} }
export function drawPuppet(ctx, P, pose, opt = {}) {
  const { x = 0, y = 0, s = 1, face = 1, t = 0 } = opt;
  const J = fk(P, pose);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(opt.rot || 0); ctx.scale(s * face, s);
  const with_ = (m, fn) => { ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); fn(); ctx.restore(); };
  const hold = opt.hold || {}, hk = opt.hand || {};
  const fade = opt.fade || 0;
  // 尾
  if (P.tail && fade < 0.99) with_(J.root, () => { ctx.save(); ctx.globalAlpha *= 1 - fade; tail(ctx, P, t); ctx.restore(); });
  // 远侧手臂
  const armB = () => {
    if (P.amputate) { with_(J.shB, () => emptySleeve(ctx, P, gravLocal(J.shB))); return; }
    if (hold.B) with_(J.wrB, () => prop(ctx, hold.B.kind, absAng(hold.B, J.wrB)));
    with_(J.shB, () => upperArm(ctx, P));
    with_(J.wrB, () => hand(ctx, P, hk.B || (hold.B ? 'fist' : 'open')));
    with_(J.elB, () => foreArm(ctx, P, gravLocal(J.elB)));
    with_(J.elB, () => rivet(ctx, 0, 0, 0.6));
  };
  armB();
  // 腿与下装
  with_(J.thB, () => thigh(ctx, P)); with_(J.knB, () => shin(ctx, P));
  with_(J.thF, () => thigh(ctx, P)); with_(J.knF, () => shin(ctx, P));
  if (P.lower === 'trousers' || P.lower === 'tunic' || P.lower === 'coat') { with_(J.knB, () => rivet(ctx, 0, 0, 0.55)); with_(J.knF, () => rivet(ctx, 0, 0, 0.55)); }
  lower(ctx, P, J);
  // 躯干与头
  with_(J.headM, () => head(ctx, P, fade));
  with_(J.torsoM, () => torso(ctx, P));
  with_(J.torsoM, () => { rivet(ctx, SK.neck[0], SK.neck[1] - 0.6, 0.55); });
  // 近侧手臂
  if (hold.F && hold.F.behind) with_(J.wrF, () => prop(ctx, hold.F.kind, absAng(hold.F, J.wrF)));
  with_(J.shF, () => upperArm(ctx, P));
  with_(J.elF, () => foreArm(ctx, P, gravLocal(J.elF)));
  with_(J.wrF, () => hand(ctx, P, hk.F || (hold.F ? 'fist' : 'open')));
  if (hold.F && !hold.F.behind) with_(J.wrF, () => prop(ctx, hold.F.kind, absAng(hold.F, J.wrF)));
  with_(J.shF, () => rivet(ctx, 0, 0, 0.7)); with_(J.elF, () => rivet(ctx, 0, 0, 0.6));
  ctx.restore();
  return J;
}
// 偶坐标 → 舞台坐标
export function toStage(opt, p) { const { x = 0, y = 0, s = 1, face = 1, rot = 0 } = opt; const px = p[0] * s * face, py = p[1] * s, c = Math.cos(rot), sn = Math.sin(rot); return [x + px * c - py * sn, y + px * sn + py * c]; }
export function toLocal(opt, q) { const { x = 0, y = 0, s = 1, face = 1, rot = 0 } = opt; const dx = q[0] - x, dy = q[1] - y, c = Math.cos(-rot), sn = Math.sin(-rot); return [(dx * c - dy * sn) / (s * face), (dx * sn + dy * c) / s]; }

// 操纵杆：从颈与手垂下去的细杆（虚，离幕远）
export function rods(ctx, J, opt, { neck = true, hands = true, len = 60 } = {}) {
  const pts = [];
  if (neck) pts.push(M.ap(J.torsoM, [SK.neck[0] - 3, SK.neck[1] - 4]));
  if (hands) pts.push(J.handF, J.handB);
  ctx.save(); ctx.strokeStyle = 'rgba(30,20,14,0.5)'; ctx.lineWidth = 0.5;
  for (const p of pts) { const a = toStage(opt, p); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (opt.face || 1) * 6, a[1] - len); ctx.stroke(); }
  ctx.restore();
}
export { piece, pattern, holeDot, rivet, cloud, flower, edgeDots, OUT, HOLE, LW };
// 单独一只断下来的手臂（上臂 + 小臂 + 手），原点在肩，ang 为整体转角
export function drawArm(ctx, P, x, y, s, ang, face = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s); ctx.rotate(ang);
  upperArm(ctx, P);
  ctx.save(); ctx.translate(0, -SK.up); ctx.rotate(0.3);
  foreArm(ctx, P, [Math.sin(-ang - 0.3), -Math.cos(ang + 0.3)]);
  ctx.translate(0, -SK.fore); hand(ctx, P, 'open'); ctx.restore();
  ctx.restore();
}
