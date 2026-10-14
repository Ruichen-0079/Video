// 场景共用的效果：光写字、墨写字、印章
import { writeLine, drawText, drawVText, FONTS } from './text.js';
import { clamp, hash } from './noise.js';
import { rgba } from './draw.js';

/** 用光写一行字；笔尖处在光层里留下一个亮点 */
export function lightWrite(f, str, x, y, size, p, { color = [0.86, 0.80, 0.70], alpha = 1, vertical = false, tipK = 1, gap, overlap, align } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const ctx = f.light;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighten';   // 笔画交叠处不叠加变亮
  writeLine(ctx, str, x, y, size, p, {
    vertical, color: rgba(color, 1), gap, overlap, align,
    tip: tipK > 0 && p < 1 ? (tx, ty) => {
      f.L.dot(tx, ty, size * 0.035, 1, 0.9, 0.75, 1.6 * tipK * alpha);
      f.L.dot(tx, ty, size * 0.16, 1, 0.8, 0.55, 0.12 * tipK * alpha);
    } : null,
  });
  ctx.restore();
}

/** 用墨写一行字 */
export function inkWrite(f, str, x, y, size, p, { color = [0.08, 0.07, 0.06], alpha = 1, vertical = false, gap, overlap, align } = {}) {
  if (p <= 0 || alpha <= 0) return;
  const ctx = f.ink;
  ctx.save();
  ctx.globalAlpha = alpha;
  writeLine(ctx, str, x, y, size, p, { vertical, color: rgba(color, 1), gap, overlap, align });
  ctx.restore();
}

/** 印章（白文：朱底白字）。chars 可为 1–4 字 */
export function seal(f, chars, x, y, size, a = 1, rot = 0) {
  if (a <= 0) return;
  const ctx = f.ink;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.rotate(rot);
  const s = size;
  // 不规整的印边
  ctx.fillStyle = 'rgb(196,40,30)';
  ctx.beginPath();
  const seed = [...chars].reduce((q, c) => q + c.charCodeAt(0), 0);
  const P = 14;
  for (let i = 0; i < P * 4; i++) {
    const side = Math.floor(i / P), u = (i % P) / P;
    const j = (hash(seed + i) - 0.5) * s * 0.025;
    let px, py;
    if (side === 0) { px = -s / 2 + u * s; py = -s / 2 + j; }
    else if (side === 1) { px = s / 2 + j; py = -s / 2 + u * s; }
    else if (side === 2) { px = s / 2 - u * s; py = s / 2 + j; }
    else { px = -s / 2 + j; py = s / 2 - u * s; }
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // 字：挖空（用纸色覆盖 —— 墨层里用接近白的颜色表示「不吸收」）
  ctx.globalCompositeOperation = 'destination-out';
  const cs = [...chars];
  ctx.font = `${cs.length === 1 ? s * 0.78 : s * 0.42}px ${FONTS.brush}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  if (cs.length === 1) ctx.fillText(cs[0], 0, s * 0.03);
  else if (cs.length === 2) { ctx.fillText(cs[0], 0, -s * 0.21); ctx.fillText(cs[1], 0, s * 0.23); }
  else {
    // 四字印：右上起，竖读
    const pos = [[s * 0.21, -s * 0.21], [s * 0.21, s * 0.23], [-s * 0.21, -s * 0.21], [-s * 0.21, s * 0.23]];
    cs.forEach((c, i) => ctx.fillText(c, pos[i][0], pos[i][1]));
  }
  // 印泥斑驳
  for (let i = 0; i < 40; i++) {
    const rx = (hash(seed * 3 + i) - 0.5) * s, ry = (hash(seed * 7 + i) - 0.5) * s;
    ctx.globalAlpha = a * 0.5 * hash(seed + i * 11);
    ctx.beginPath();
    ctx.arc(rx, ry, s * 0.02 * hash(i + seed), 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}

export { drawText, drawVText, FONTS };
