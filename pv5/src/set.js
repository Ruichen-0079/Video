// 布景：刻在皮子上的宫殿、树、山、海、竹、帐篷……全部在舞台坐标里（幕高 100，y 向上）
import { piece, pattern, holeDot, cloud, flower, edgeDots, OUT, HOLE, LW, L } from './puppet.js';
import { curve, rgba, rng, lerp, clamp, TAU, noise1 } from './g2.js';

const ln = (ctx, w = LW) => { ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; };

// ── 地面
export function ground(ctx, y, x0, x1, kind = 'plain', col = L.brown, seed = 1) {
  const R = rng(seed);
  const top = [];
  for (let x = x0; x <= x1 + 2; x += 2) top.push([x, y + (kind === 'hill' ? 1.2 * noise1(x * 0.07 + seed) : 0)]);
  const build = (c) => { c.moveTo(x0, y - 40); top.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(x1, y - 40); c.closePath(); };
  piece(ctx, build, col, { alpha: 0.95 });
  ctx.save(); ctx.beginPath(); build(ctx); ctx.clip();
  if (kind === 'stone') { ln(ctx, 0.35); for (let x = x0; x < x1; x += 7) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 4); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x0, y - 2); ctx.lineTo(x1, y - 2); ctx.stroke(); pattern(ctx, 'lattice', x0, y - 30, x1, y - 4, 1.4); }
  else if (kind === 'sand') { for (let i = 0; i < (x1 - x0) * 0.8; i++) holeDot(ctx, x0 + R() * (x1 - x0), y - 1 - R() * 10, 0.25 + R() * 0.3); }
  else if (kind === 'floor') { ln(ctx, 0.3); for (let x = x0; x < x1; x += 5) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 10); ctx.stroke(); } pattern(ctx, 'dots', x0, y - 30, x1, y - 1.5, 1.2); }
  else if (kind !== 'plain') pattern(ctx, 'dots', x0, y - 30, x1, y - 2, 1.6);
  ctx.restore();
}

// ── 草：一丛丛刻出来的长草，随风摆
export function grass(ctx, x0, x1, y, t, { h = 9, dens = 1.2, col = L.olive, wind = 1, seed = 3, flowers = 0 } = {}) {
  const R = rng(seed);
  const n = Math.round((x1 - x0) * dens);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), hh = h * (0.45 + R() * 0.9), w = 0.3 + R() * 0.45, lean = (R() - 0.5) * 0.7;
    const sway = (Math.sin(t * 1.6 + x * 0.09) * 0.6 + Math.sin(t * 2.7 + x * 0.21) * 0.3) * wind * 0.12 + 0.1 * wind + lean;
    const tipx = x + Math.sin(sway) * hh, tipy = y + Math.cos(sway) * hh;
    const bend = Math.sin(sway) * hh * 0.25;
    const c = [col[0] * (0.85 + R() * 0.3), col[1] * (0.85 + R() * 0.3), col[2] * (0.8 + R() * 0.3)];
    piece(ctx, (cc) => { cc.moveTo(x - w, y - 0.5); cc.quadraticCurveTo(x - w * 0.4 + bend * 0.2, y + hh * 0.6, tipx, tipy); cc.quadraticCurveTo(x + w * 0.5 + bend * 0.35, y + hh * 0.55, x + w, y - 0.5); cc.closePath(); }, c, { lw: 0.18, alpha: 0.82 });
    if (flowers && R() < flowers) {
      const fc = [L.rose, L.yellow, L.white, L.pink, L.orange][Math.floor(R() * 5)];
      const fx = x + Math.sin(sway) * hh * 0.85, fy = y + Math.cos(sway) * hh * 0.85;
      ln(ctx, 0.18); ctx.beginPath(); ctx.moveTo(x + 0.4, y); ctx.quadraticCurveTo(x + 0.4 + bend * 0.2, y + hh * 0.5, fx, fy); ctx.stroke();
      const fs = 0.7 + R() * 0.5;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(fs, fs); for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(Math.cos(k * TAU / 5) * 0.9, Math.sin(k * TAU / 5) * 0.9, 0.85, 0.5, k * TAU / 5, 0, TAU); ctx.fillStyle = rgba(fc, 0.92); ctx.fill(); ln(ctx, 0.15); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, TAU); ctx.fillStyle = rgba(L.gold); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}

// ── 宫殿：台基、柱、格窗、重檐
export function palace(ctx, x, y, w, h, { col = L.red, roof = L.ink, gold = L.gold, steps = true, base = 6 } = {}) {
  // 台基
  piece(ctx, (c) => c.rect(x - w / 2 - 4, y, w + 8, base), L.gray);
  ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2 - 4, y, w + 8, base); ctx.clip(); pattern(ctx, 'lattice', x - w / 2 - 4, y, x + w / 2 + 4, y + base, 1.0); ctx.restore();
  if (steps) for (let k = 0; k < 4; k++) piece(ctx, (c) => c.rect(x - 8 + k * 0.6, y - base * 0 + k * base / 4 - base / 4 + base / 4, 16 - k * 1.2, base / 4), L.cream);
  const y0 = y + base, ch = h * 0.55;
  // 墙与格窗
  piece(ctx, (c) => c.rect(x - w / 2, y0, w, ch), col);
  ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y0, w, ch); ctx.clip();
  const bays = Math.max(3, Math.round(w / 10));
  for (let i = 0; i < bays; i++) { const bx = x - w / 2 + (i + 0.5) * w / bays; ctx.save(); ctx.beginPath(); ctx.rect(bx - w / bays * 0.32, y0 + ch * 0.15, w / bays * 0.64, ch * 0.62); ctx.clip(); pattern(ctx, 'lattice', bx - 8, y0, bx + 8, y0 + ch, 0.9); ctx.restore(); ln(ctx); ctx.strokeRect(bx - w / bays * 0.32, y0 + ch * 0.15, w / bays * 0.64, ch * 0.62); }
  ctx.restore();
  // 柱
  for (let i = 0; i <= bays; i++) piece(ctx, (c) => c.rect(x - w / 2 + i * w / bays - 1, y0, 2, ch), L.crimson);
  // 斗拱与檐
  piece(ctx, (c) => c.rect(x - w / 2 - 2, y0 + ch, w + 4, 2.2), L.teal);
  ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2 - 2, y0 + ch, w + 4, 2.2); ctx.clip(); edgeDots(ctx, x - w / 2, y0 + ch + 1.1, x + w / 2, y0 + ch + 1.1, 0.45); ctx.restore();
  const roofPath = (c, yy, ww, hh) => { c.moveTo(x - ww / 2 - 6, yy + 3.4); c.quadraticCurveTo(x - ww / 2 + 2, yy, x - ww / 2 + 6, yy + 0.6); c.lineTo(x - ww * 0.3, yy + hh); c.lineTo(x + ww * 0.3, yy + hh); c.lineTo(x + ww / 2 - 6, yy + 0.6); c.quadraticCurveTo(x + ww / 2 - 2, yy, x + ww / 2 + 6, yy + 3.4); c.lineTo(x + ww / 2 + 4, yy + 1.0); c.lineTo(x - ww / 2 - 4, yy + 1.0); c.closePath(); };
  piece(ctx, (c) => roofPath(c, y0 + ch + 2.0, w + 10, h * 0.2), roof);
  ctx.save(); ctx.beginPath(); roofPath(ctx, y0 + ch + 2.0, w + 10, h * 0.2); ctx.clip(); pattern(ctx, 'stripe', x - w, y0 + ch + 2, x + w, y0 + ch + 2 + h * 0.2, 0.8); ctx.restore();
  piece(ctx, (c) => c.rect(x - w * 0.22, y0 + ch + 2 + h * 0.2, w * 0.44, h * 0.08), col);
  piece(ctx, (c) => roofPath(c, y0 + ch + 2 + h * 0.27, w * 0.62, h * 0.18), roof);
  // 鸱吻
  for (const sx of [-1, 1]) piece(ctx, (c) => { const bx = x + sx * w * 0.19, by = y0 + ch + 2 + h * 0.45; c.moveTo(bx, by); c.quadraticCurveTo(bx + sx * 2.5, by + 4, bx + sx * 0.6, by + 5.2); c.lineTo(bx - sx * 0.6, by + 0.2); c.closePath(); }, gold);
  return { top: y0 + ch + 2 + h * 0.45 };
}
// 长阶
export function stairs(ctx, x0, y0, x1, y1, n, col = L.cream) {
  for (let k = 0; k < n; k++) {
    const u = k / n, xa = lerp(x0, x1, u), ya = lerp(y0, y1, u), xb = lerp(x0, x1, (k + 1) / n), yb = lerp(y0, y1, (k + 1) / n);
    piece(ctx, (c) => { c.moveTo(xa, ya); c.lineTo(xa, yb); c.lineTo(Math.max(x0, x1) + 30, yb); c.lineTo(Math.max(x0, x1) + 30, ya); c.closePath(); }, col, { lw: 0.35 });
  }
}

// ── 廊：一排柱子、横梁、挂灯；z 用来做纵深（远处小、淡）
export function colonnade(ctx, x0, x1, y, h, step = 18, { col = L.crimson, beam = L.teal } = {}) {
  for (let x = x0; x <= x1; x += step) {
    piece(ctx, (c) => c.rect(x - 1.4, y, 2.8, h), col);
    piece(ctx, (c) => c.rect(x - 2.2, y, 4.4, 1.2), L.gray);
  }
  piece(ctx, (c) => c.rect(x0 - 10, y + h, x1 - x0 + 20, 3.0), beam);
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, y + h, x1 - x0 + 20, 3.0); ctx.clip(); pattern(ctx, 'cloud', x0 - 10, y + h, x1 + 10, y + h + 3, 0.5); ctx.restore();
  for (let x = x0; x < x1; x += step) piece(ctx, (c) => { c.moveTo(x + 1.4, y + h - 0.2); c.quadraticCurveTo(x + step / 2, y + h - 4, x + step - 1.4, y + h - 0.2); c.lineTo(x + step - 1.4, y + h); c.lineTo(x + 1.4, y + h); c.closePath(); }, col);
}
export function hangLantern(ctx, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.3 + x) * 0.04);
  ln(ctx, 0.35); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3); ctx.stroke();
  piece(ctx, (c) => c.ellipse(0, -6.5, 3.0, 3.6, 0, 0, TAU), L.red, { alpha: 0.75 });
  piece(ctx, (c) => { c.rect(-1.8, -3.2, 3.6, 0.8); c.rect(-1.8, -10.6, 3.6, 0.8); }, L.gold);
  ln(ctx, 0.3); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 0.6, -10.6); ctx.lineTo(k * 0.9, -13.4); ctx.stroke(); }
  ctx.restore();
}
// 灯笼的光（加在幕上）
export function lampGlow(x, y, r = 14, col = [255, 170, 80], k = 0.9) {
  return (ctx) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, k)); g.addColorStop(0.3, rgba(col, k * 0.5)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
}

// ── 墙、门、院
export function wall(ctx, x0, x1, y, h, { col = L.gray, cap = L.ink } = {}) {
  piece(ctx, (c) => c.rect(x0, y, x1 - x0, h), col);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y, x1 - x0, h); ctx.clip(); ln(ctx, 0.25); for (let yy = y + 2.5; yy < y + h; yy += 2.5) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); } ctx.restore();
  piece(ctx, (c) => { c.moveTo(x0 - 2, y + h); c.lineTo(x1 + 2, y + h); c.lineTo(x1 + 1, y + h + 2.4); c.lineTo(x0 - 1, y + h + 2.4); c.closePath(); }, cap);
}
export function house(ctx, x, y, w, h, { col = L.ochre, roof = L.ink, door = true, window = true, lit = false } = {}) {
  piece(ctx, (c) => c.rect(x - w / 2, y, w, h), col);
  if (door) piece(ctx, (c) => c.rect(x - w * 0.12, y, w * 0.24, h * 0.62), lit ? L.yellow : L.brown, { alpha: lit ? 0.4 : 0.95 });
  if (window) for (const sx of [-1, 1]) { piece(ctx, (c) => c.rect(x + sx * w * 0.3 - 2.5, y + h * 0.4, 5, 4), lit ? L.yellow : L.cream, { alpha: lit ? 0.35 : 0.8 }); ctx.save(); ctx.beginPath(); ctx.rect(x + sx * w * 0.3 - 2.5, y + h * 0.4, 5, 4); ctx.clip(); pattern(ctx, 'lattice', x + sx * w * 0.3 - 3, y + h * 0.4, x + sx * w * 0.3 + 3, y + h * 0.4 + 4, 0.6); ctx.restore(); }
  piece(ctx, (c) => { c.moveTo(x - w / 2 - 4, y + h - 0.5); c.quadraticCurveTo(x - w / 2, y + h + 0.6, x - w * 0.3, y + h + h * 0.45); c.lineTo(x + w * 0.3, y + h + h * 0.45); c.quadraticCurveTo(x + w / 2, y + h + 0.6, x + w / 2 + 4, y + h - 0.5); c.closePath(); }, roof);
  ctx.save(); ctx.beginPath(); ctx.rect(x - w, y + h, w * 2, h * 0.5); ctx.clip(); pattern(ctx, 'stripe', x - w, y + h, x + w, y + h * 1.5, 0.7); ctx.restore();
}

// ── 树
export function plumTree(ctx, x, y, s = 1, { flowers = true, col = L.brown, fcol = L.rose, seed = 5, bare = false } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const branch = (bx, by, ang, len, w, depth) => {
    const ex = bx + Math.sin(ang) * len, ey = by + Math.cos(ang) * len;
    const mx = (bx + ex) / 2 + Math.cos(ang) * len * 0.15 * (R() - 0.5) * 2, my = (by + ey) / 2;
    piece(ctx, (c) => { c.moveTo(bx - w, by); c.quadraticCurveTo(mx - w * 0.7, my, ex - w * 0.3, ey); c.lineTo(ex + w * 0.3, ey); c.quadraticCurveTo(mx + w * 0.7, my, bx + w, by); c.closePath(); }, col, { lw: 0.35 });
    if (depth > 0) { const n = 2 + (R() < 0.4 ? 1 : 0); for (let k = 0; k < n; k++) branch(ex, ey, ang + (R() - 0.5) * 1.6, len * (0.55 + R() * 0.2), w * 0.6, depth - 1); }
    else if (flowers && !bare) for (let k = 0; k < 4; k++) flower(ctx, ex + (R() - 0.5) * 4, ey + (R() - 0.5) * 3, 0.9 + R() * 0.5, rgba(fcol, 0.95));
  };
  branch(0, 0, 0.05, 18, 2.2, 4);
  ctx.restore();
}
export function pine(ctx, x, y, s = 1, col = L.green) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  piece(ctx, (c) => { c.moveTo(-1.2, 0); c.quadraticCurveTo(-2, 14, 1, 30); c.lineTo(2, 30); c.quadraticCurveTo(0.6, 14, 1.4, 0); c.closePath(); }, L.brown);
  for (let k = 0; k < 4; k++) { const yy = 14 + k * 5, ww = 14 - k * 2.6; piece(ctx, (c) => { c.moveTo(-ww, yy); c.quadraticCurveTo(0, yy + 6, ww, yy); c.quadraticCurveTo(0, yy + 2, -ww, yy); c.closePath(); }, col); ctx.save(); ctx.beginPath(); ctx.moveTo(-ww, yy); ctx.quadraticCurveTo(0, yy + 6, ww, yy); ctx.closePath(); ctx.clip(); pattern(ctx, 'dots', -ww, yy, ww, yy + 6, 0.7); ctx.restore(); }
  ctx.restore();
}
export function bamboo(ctx, x, y, h, t, { col = L.green, seed = 2, n = 1 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = x + (R() - 0.5) * 18 * (n > 1 ? 1 : 0), hh = h * (0.8 + R() * 0.4), w = 1.0 + R() * 0.6;
    const sway = Math.sin(t * 0.9 + bx * 0.3) * 0.03;
    ctx.save(); ctx.translate(bx, y); ctx.rotate(sway);
    piece(ctx, (c) => c.rect(-w, 0, w * 2, hh), col, { lw: 0.35 });
    ln(ctx, 0.35); for (let yy = 7; yy < hh; yy += 7 + R() * 2) { ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    for (let yy = 16; yy < hh; yy += 8 + R() * 4) { const sd = R() < 0.5 ? -1 : 1; for (let k = 0; k < 3; k++) { const a = sd * (0.6 + k * 0.45); piece(ctx, (c) => { c.moveTo(0, yy); c.quadraticCurveTo(Math.sin(a) * 4 + sd * 1, yy + Math.cos(a) * 4 + 1, Math.sin(a) * 8, yy + Math.cos(a) * 8 - 2); c.quadraticCurveTo(Math.sin(a) * 3, yy + Math.cos(a) * 3 - 1, 0, yy); c.closePath(); }, col, { lw: 0.3 }); } }
    ctx.restore();
  }
}

// ── 山（远景，通常放在 d 大的层上，糊开）
export function mountains(ctx, x0, x1, y, h, { col = L.teal, seed = 9 } = {}) {
  const pts = [[x0, y]];
  for (let x = x0; x <= x1; x += 6) pts.push([x, y + h * (0.45 + 0.55 * Math.abs(noise1(x * 0.03 + seed)) ) * (0.6 + 0.4 * Math.sin(x * 0.011 + seed))]);
  pts.push([x1, y]);
  piece(ctx, (c) => { c.moveTo(x0, y - 20); pts.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(x1, y - 20); c.closePath(); }, col, { alpha: 0.85 });
}
// ── 海：一排排刻出来的海水纹，左右流动
export function sea(ctx, x0, x1, y0, y1, t, { col = L.blue, foam = L.white, rows = 5 } = {}) {
  piece(ctx, (c) => c.rect(x0, y0 - 30, x1 - x0, y1 - y0 + 30), col, { alpha: 0.85 });
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 - 30, x1 - x0, y1 - y0 + 30); ctx.clip();
  for (let r = 0; r < rows; r++) {
    const yy = y1 - (r + 0.6) * (y1 - y0) / rows, sp = 6 - r * 0.6, ph = t * (0.8 + r * 0.15) * (r % 2 ? 1 : -1);
    ln(ctx, 0.45);
    for (let x = x0 - 12 + ((ph * 4) % sp); x < x1 + 12; x += sp) {
      ctx.beginPath(); ctx.arc(x, yy, sp * 0.45, 0.15 * Math.PI, 0.85 * Math.PI, false); ctx.strokeStyle = HOLE; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, yy, sp * 0.45, 0.1 * Math.PI, 0.9 * Math.PI, false); ctx.strokeStyle = OUT; ctx.lineWidth = 0.3; ctx.stroke();
    }
  }
  ctx.restore();
  // 浪头
  const wv = (c) => { c.moveTo(x0, y1); for (let x = x0; x <= x1; x += 3) c.lineTo(x, y1 + 0.8 * Math.sin(x * 0.25 + t * 1.6) + 0.5 * Math.sin(x * 0.6 - t * 2.3)); c.lineTo(x1, y1 - 1.6); c.lineTo(x0, y1 - 1.6); c.closePath(); };
  piece(ctx, wv, foam, { alpha: 0.6, lw: 0.35 });
}

// ── 帐篷（开口朝观众）
export function tent(ctx, x, y, w, h, { col = L.ochre, open = true } = {}) {
  piece(ctx, (c) => { c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y + h * 0.6); c.lineTo(x, y + h); c.lineTo(x + w / 2, y + h * 0.6); c.lineTo(x + w / 2, y); c.closePath(); }, col);
  if (open) piece(ctx, (c) => { c.moveTo(x - w * 0.3, y); c.lineTo(x - w * 0.3, y + h * 0.55); c.lineTo(x, y + h * 0.78); c.lineTo(x + w * 0.3, y + h * 0.55); c.lineTo(x + w * 0.3, y); c.closePath(); }, L.yellow, { alpha: 0.25 });
  ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y + h * 0.58, w, 2); ctx.clip(); edgeDots(ctx, x - w / 2, y + h * 0.59, x + w / 2, y + h * 0.59, 0.4); ctx.restore();
}
// 桌子
export function table(ctx, x, y, w, h, col = L.brown) {
  piece(ctx, (c) => c.rect(x - w / 2, y + h - 1.4, w, 1.4), col);
  piece(ctx, (c) => { c.rect(x - w / 2 + 1, y, 1.2, h - 1.4); c.rect(x + w / 2 - 2.2, y, 1.2, h - 1.4); }, col);
}
// 旗：杆 + 飘动的布
export function flag(ctx, x, y, h, t, { col = L.red, w = 16, fh = 10, mark = 'dragon', droop = 0, burn = 0, ang = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  piece(ctx, (c) => c.rect(-0.5, 0, 1.0, h), L.brown);
  piece(ctx, (c) => { c.moveTo(-1.4, h); c.lineTo(1.4, h); c.lineTo(0, h + 2.6); c.closePath(); }, L.gold);
  const pts = (side) => { const a = []; for (let i = 0; i <= 8; i++) { const u = i / 8; const yy = h - (side ? fh : 0) - u * u * droop * fh * 0.8 + Math.sin(t * 3 + u * 4) * u * 1.2; a.push([0.5 + u * w * (1 - droop * 0.3), yy]); } return a; };
  const top = pts(0), bot = pts(1).reverse();
  const cut = burn > 0 ? Math.floor((1 - burn) * 8) : 8;
  const build = (c) => { c.moveTo(top[0][0], top[0][1]); for (let i = 1; i <= cut; i++) c.lineTo(top[i][0], top[i][1]); for (let i = 8 - cut; i <= 8; i++) c.lineTo(bot[i][0], bot[i][1] + (i === 8 - cut && burn > 0 ? 2 * Math.sin(t * 20) : 0)); c.closePath(); };
  piece(ctx, build, col);
  ctx.save(); ctx.beginPath(); build(ctx); ctx.clip();
  pattern(ctx, 'cloud', 0, h - fh, w, h, 0.7);
  if (mark === 'dragon') { const cx = w * 0.45, cy = h - fh * 0.5 + Math.sin(t * 3 + 2) * 0.5; ctx.beginPath(); ctx.arc(cx, cy, fh * 0.28, 0, TAU); ctx.fillStyle = rgba(L.gold, 0.95); ctx.fill(); ln(ctx); ctx.stroke(); ctx.save(); ctx.translate(cx, cy); ctx.scale(fh * 0.04, fh * 0.04); dragonMark(ctx); ctx.restore(); }
  ctx.restore();
  ctx.restore();
}
function dragonMark(ctx) {
  ctx.beginPath(); ctx.moveTo(-5, -2); ctx.bezierCurveTo(-2, 4, 2, -4, 5, 2); ctx.lineWidth = 1.2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.arc(5, 2, 1.1, 0, TAU); ctx.fillStyle = OUT; ctx.fill();
}
// 轿子
export function palanquin(ctx, x, y, s = 1, col = L.crimson) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  piece(ctx, (c) => c.rect(-32, 0, 64, 1.4), L.brown);                    // 轿杆
  piece(ctx, (c) => c.rect(-9, -6, 18, 20), col);
  ctx.save(); ctx.beginPath(); ctx.rect(-6, -2, 12, 10); ctx.clip(); pattern(ctx, 'lattice', -7, -3, 7, 9, 0.8); ctx.restore(); ln(ctx); ctx.strokeRect(-6, -2, 12, 10);
  piece(ctx, (c) => { c.moveTo(-14, 14); c.quadraticCurveTo(-8, 15, -6, 19); c.lineTo(6, 19); c.quadraticCurveTo(8, 15, 14, 14); c.lineTo(12, 13.2); c.lineTo(-12, 13.2); c.closePath(); }, L.ink);
  piece(ctx, (c) => { c.moveTo(-1.6, 19); c.lineTo(1.6, 19); c.lineTo(0, 22.6); c.closePath(); }, L.gold);
  for (const sx of [-1, 1]) { ln(ctx, 0.3); ctx.beginPath(); ctx.moveTo(sx * 13, 13.5); ctx.lineTo(sx * 13, 8); ctx.stroke(); piece(ctx, (c) => c.ellipse(sx * 13, 6.6, 0.9, 1.6, 0, 0, TAU), L.red); }
  ctx.restore();
}
// 牌位与蜡烛
export function tablet(ctx, x, y, s = 1, name = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  piece(ctx, (c) => c.rect(-4, 0, 8, 2), L.brown);
  piece(ctx, (c) => { c.moveTo(-2.6, 2); c.lineTo(-2.6, 15); c.quadraticCurveTo(0, 17.4, 2.6, 15); c.lineTo(2.6, 2); c.closePath(); }, L.black);
  piece(ctx, (c) => c.rect(-1.6, 3.4, 3.2, 10.4), L.gold, { alpha: 0.85 });
  if (name) { ctx.fillStyle = OUT; for (let k = 0; k < 4; k++) ctx.fillRect(-0.5, 4.4 + k * 2.4, 1.0, 1.4); }
  ctx.restore();
}
export function candle(ctx, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  piece(ctx, (c) => c.rect(-0.8, 0, 1.6, 5), L.cream);
  const f = 1 + 0.12 * Math.sin(t * 17 + x);
  piece(ctx, (c) => { c.moveTo(-0.6, 5.4); c.quadraticCurveTo(-0.8, 6.6 * f, 0, 8 * f); c.quadraticCurveTo(0.8, 6.6 * f, 0.6, 5.4); c.closePath(); }, L.yellow, { alpha: 0.4, lw: 0.25 });
  ctx.restore();
}
// 工厂与烟囱（明）
export function factory(ctx, x, y, w, h, { col = L.brown } = {}) {
  piece(ctx, (c) => { c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y + h); for (let k = 0; k < 4; k++) { const xx = x - w / 2 + k * w / 4; c.lineTo(xx + w / 8, y + h + 4); c.lineTo(xx + w / 4, y + h); } c.lineTo(x + w / 2, y); c.closePath(); }, col);
  ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y, w, h); ctx.clip(); for (let k = 0; k < 6; k++) piece(ctx, (c) => c.rect(x - w / 2 + 2 + k * w / 6, y + h * 0.4, w / 12, h * 0.3), L.yellow, { alpha: 0.4 }); ctx.restore();
}
export function chimney(ctx, x, y, h, w = 3, col = L.brown) {
  piece(ctx, (c) => { c.moveTo(x - w / 2, y); c.lineTo(x - w * 0.35, y + h); c.lineTo(x + w * 0.35, y + h); c.lineTo(x + w / 2, y); c.closePath(); }, col);
  ln(ctx, 0.3); for (let yy = y + 4; yy < y + h; yy += 4) { ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke(); }
}
// 砖楼（美国）
export function brickBuilding(ctx, x, y, w, h, t = 0, { col = L.crimson, lit = 0.7 } = {}) {
  piece(ctx, (c) => c.rect(x - w / 2, y, w, h), col);
  const R = rng(Math.round(x * 7));
  for (let fy = y + 5; fy < y + h - 4; fy += 8) for (let fx = x - w / 2 + 3; fx < x + w / 2 - 4; fx += 7) { const on = R() < lit; piece(ctx, (c) => c.rect(fx, fy, 3.6, 5), on ? L.yellow : L.ink, { alpha: on ? 0.3 : 0.9, lw: 0.3 }); }
  piece(ctx, (c) => c.rect(x - w / 2 - 1, y + h, w + 2, 1.6), L.ink);
}
export function streetLamp(ctx, x, y, h = 24) {
  piece(ctx, (c) => c.rect(x - 0.4, y, 0.8, h), L.black);
  piece(ctx, (c) => { c.moveTo(x - 2, y + h); c.lineTo(x + 2, y + h); c.lineTo(x + 1.4, y + h + 3.4); c.lineTo(x - 1.4, y + h + 3.4); c.closePath(); }, L.yellow, { alpha: 0.35 });
  piece(ctx, (c) => { c.moveTo(x - 2.4, y + h + 3.4); c.lineTo(x + 2.4, y + h + 3.4); c.lineTo(x, y + h + 5.4); c.closePath(); }, L.black);
}
// 现代公寓：大窗，窗外的城市灯火
export function apartmentWindow(ctx, x0, x1, y0, y1, t) {
  // 窗框
  piece(ctx, (c) => { c.rect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6); c.rect(x1, y0, x0 - x1, y1 - y0); }, L.ink);
  for (let k = 1; k < 3; k++) piece(ctx, (c) => c.rect(x0 + k * (x1 - x0) / 3 - 0.8, y0, 1.6, y1 - y0), L.ink);
}
export function cityLights(x0, x1, y0, y1, t, seed = 4) {
  const R = rng(seed); const pts = [];
  for (let i = 0; i < 220; i++) pts.push([x0 + R() * (x1 - x0), y0 + Math.pow(R(), 1.8) * (y1 - y0), 0.25 + R() * 0.6, R(), R()]);
  return (ctx) => {
    for (const [x, y, r, c, ph] of pts) {
      const k = 0.55 + 0.45 * Math.sin(t * (0.5 + ph) + ph * 9);
      const col = c < 0.6 ? [255, 210, 150] : c < 0.85 ? [255, 240, 220] : [255, 120, 90];
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8); g.addColorStop(0, rgba(col, 0.75 * k)); g.addColorStop(0.35, rgba(col, 0.35 * k)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6);
    }
  };
}
// 祥云（布景里的装饰云）
export function cloudBank(ctx, x, y, s = 1, col = L.cream) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  piece(ctx, (c) => { c.moveTo(-14, 0); c.bezierCurveTo(-16, 5, -9, 8, -6, 5); c.bezierCurveTo(-5, 10, 3, 10, 4, 5); c.bezierCurveTo(8, 8, 15, 5, 13, 0); c.closePath(); }, col, { alpha: 0.8 });
  ln(ctx, 0.4); for (const [cx, cy, r] of [[-9, 3, 2.2], [0, 5, 2.6], [8, 3, 2.0]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0.2, Math.PI * 1.6); ctx.stroke(); }
  ctx.restore();
}
// 太阳 / 月亮（光，加在幕上）
export function sunGlow(x, y, r, col = [255, 200, 120], k = 1) {
  return (ctx) => {
    let g = ctx.createRadialGradient(x, y, 0, x, y, r * 6); g.addColorStop(0, rgba(col, 0.55 * k)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba([255, 250, 235], k); ctx.fill();
  };
}
