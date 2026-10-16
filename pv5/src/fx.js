// 特效：全部是时间 t 的确定函数（雨、雪、花瓣、火、烟、火星、刀光）
import { rgba, rng, TAU, clamp, lerp, noise1 } from './g2.js';
import { piece, OUT, L } from './puppet.js';

const fract = (x) => x - Math.floor(x);

// 雨：细长的斜线。画在一个层上（层的 d 决定虚实）
export function rain(ctx, x0, x1, y0, y1, t, { n = 260, speed = 120, slant = 0.18, len = 4, col = [230, 236, 255], a = 0.55, seed = 7, part = null } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), ph = R(), sp = speed * (0.8 + R() * 0.4), w = 0.18 + R() * 0.22;
    const H = y1 - y0 + len;
    const yy = y1 - fract(ph + t * sp / H) * H;
    let xx = x + (y1 - yy) * slant;
    if (part) { const dx = part(xx, yy); if (dx === null) continue; xx += dx; }
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - slant * len, yy + len); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = w; ctx.stroke();
  }
  ctx.restore();
}
// 雪 / 花瓣 / 尘：慢慢飘落的小片
export function drift(ctx, x0, x1, y0, y1, t, { n = 80, speed = 6, kind = 'snow', col = L.white, wind = 3, size = 0.6, seed = 11, a = 0.9 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), ph = R(), sp = speed * (0.6 + R() * 0.8), sz = size * (0.6 + R() * 0.8), wob = R() * TAU;
    const H = y1 - y0;
    const u = fract(ph + t * sp / H);
    const yy = y1 - u * H, xx = x0 + fract((x - x0 + wind * t + Math.sin(t * 0.8 + wob) * 2) / (x1 - x0)) * (x1 - x0);
    if (kind === 'petal') { ctx.save(); ctx.translate(xx, yy); ctx.rotate(t * 2 + wob); ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.55, 0, 0, TAU); ctx.fillStyle = rgba(col, a); ctx.fill(); ctx.lineWidth = 0.15; ctx.strokeStyle = OUT; ctx.stroke(); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(xx, yy, sz, 0, TAU); ctx.fillStyle = rgba(col, a * (kind === 'dust' ? 0.5 : 1)); ctx.fill(); }
  }
}
// 火：一簇刻出来的火焰（红、橙、黄三层，跳动）
export function flame(ctx, x, y, h, t, { w = null, seed = 1 } = {}) {
  w = w || h * 0.45;
  const layers = [[L.red, 1.0], [L.orange, 0.72], [L.yellow, 0.45]];
  for (const [col, k] of layers) {
    const hh = h * k * (1 + 0.15 * noise1(t * 6 + seed * 3 + k * 10));
    const ww = w * k;
    const sway = noise1(t * 4 + seed + k) * ww * 0.4;
    piece(ctx, (c) => {
      c.moveTo(x - ww, y);
      c.bezierCurveTo(x - ww * 1.1, y + hh * 0.4, x - ww * 0.2 + sway * 0.5, y + hh * 0.55, x - ww * 0.35 + sway, y + hh * 0.75);
      c.quadraticCurveTo(x - ww * 0.1 + sway * 0.6, y + hh * 0.6, x + sway, y + hh);
      c.quadraticCurveTo(x + ww * 0.25 + sway * 0.6, y + hh * 0.62, x + ww * 0.45 + sway * 0.8, y + hh * 0.7);
      c.bezierCurveTo(x + ww * 0.3, y + hh * 0.5, x + ww * 1.1, y + hh * 0.35, x + ww, y);
      c.closePath();
    }, col, { alpha: 0.75, lw: 0.35 });
  }
}
// 火光（加在幕上：暖色，闪动）
export function fireGlow(x, y, r, t, k = 1, seed = 0) {
  return (ctx) => {
    const f = k * (0.85 + 0.15 * noise1(t * 9 + seed) + 0.08 * Math.sin(t * 23 + seed));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba([255, 170, 70], 0.9 * f)); g.addColorStop(0.4, rgba([255, 110, 40], 0.45 * f)); g.addColorStop(1, rgba([200, 60, 20], 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
}
// 火星：往上飘、渐暗
export function embers(ctx, x0, x1, y0, h, t, { n = 40, seed = 3, col = [255, 200, 110] } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), ph = R(), sp = 0.25 + R() * 0.3;
    const u = fract(ph + t * sp);
    const yy = y0 + u * h, xx = x + Math.sin(t * 2 + i) * 2 + u * 6;
    ctx.beginPath(); ctx.arc(xx, yy, 0.35 + 0.3 * (1 - u), 0, TAU); ctx.fillStyle = rgba(col, (1 - u) * 0.9); ctx.fill();
  }
}
// 烟：一团团柔和的影子（幕后、离幕远，所以是虚的）。col 是烟的颜色；
// 绿色的药烟用 tint 画在幕上（光），普通的烟用深色乘上去
export function smoke(ctx, x, y, t, { n = 14, spread = 10, rise = 4, size = 6, col = [60, 56, 52], a = 0.35, seed = 5, wind = 3, life = 4 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const ph = R(), u = fract(ph + t / life);
    const xx = x + (R() - 0.5) * spread * 0.4 + wind * u * life + Math.sin(t + i) * 1.5, yy = y + rise * u * life;
    const r = size * (0.4 + u * 1.2);
    const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, r);
    const al = a * Math.sin(u * Math.PI);
    g.addColorStop(0, rgba(col, al)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(xx - r, yy - r, r * 2, r * 2);
  }
}
// 刀光：一道弧形的亮痕（加在幕上）
export function slashArc(cx, cy, r, a0, a1, k = 1, w = 1.2) {
  return (ctx) => {
    if (k <= 0) return;
    ctx.save(); ctx.lineCap = 'round';
    for (const [ww, al] of [[w * 6, 0.12], [w * 2.5, 0.35], [w, 0.9]]) { ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1, a1 < a0); ctx.strokeStyle = `rgba(255,248,230,${al * k})`; ctx.lineWidth = ww; ctx.stroke(); }
    ctx.restore();
  };
}
// 整幅幕的闪白
export function flash(k) { return (ctx) => { if (k > 0.001) { ctx.fillStyle = `rgba(255,250,240,${k})`; ctx.fillRect(-500, -500, 1500, 1500); } }; }
// 血：几滴深红
export function blood(ctx, x, y, t, t0, { n = 18, seed = 9 } = {}) {
  if (t < t0) return;
  const R = rng(seed), dt = t - t0;
  for (let i = 0; i < n; i++) {
    const vx = (R() - 0.3) * 18, vy = 4 + R() * 14, sz = 0.3 + R() * 0.5;
    const xx = x + vx * dt, yy = Math.max(1.2, y + vy * dt - 40 * dt * dt);
    ctx.beginPath(); ctx.arc(xx, yy, sz, 0, TAU); ctx.fillStyle = rgba([120, 10, 10], 0.95); ctx.fill();
  }
}
