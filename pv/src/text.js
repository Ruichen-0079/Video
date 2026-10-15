// 文字：Canvas 2D 排版 + 「按笔顺书写」
//
// 书写使用 Make Me a Hanzi 的笔画轮廓与中线（Arphic 楷体），
// 每一笔沿中线逐渐显现——字是被「写」出来的，留下的是行迹。

import { clamp, smooth, hash } from './noise.js';

export const FONTS = {
  serifL: '"WH Serif Light"',
  serif: '"WH Serif"',
  serifB: '"WH Serif Bold"',
  kai: '"WH Kai"',
  brush: '"WH Brush"',
};

let HZ = null;
const pathCache = new Map();
export async function loadHanzi(url) {
  HZ = await (await fetch(url)).json();
}
function glyph(ch) {
  if (!HZ || !HZ[ch]) return null;
  let g = pathCache.get(ch);
  if (!g) {
    const d = HZ[ch];
    g = {
      strokes: d.s.map((s) => new Path2D(s)),
      medians: d.m.map((m) => {
        let L = 0;
        const segs = [0];
        for (let i = 1; i < m.length; i++) { L += Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]); segs.push(L); }
        return { pts: m, len: L, acc: segs };
      }),
    };
    g.total = g.medians.reduce((a, m) => a + m.len + 120, 0);
    pathCache.set(ch, g);
  }
  return g;
}
export const hasGlyph = (ch) => !!(HZ && HZ[ch]);

function pointAt(m, d) {
  const { pts, acc } = m;
  if (d <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    if (acc[i] >= d) {
      const t = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
  }
  return pts[pts.length - 1];
}

/**
 * 按笔顺书写一个字。
 * ctx: 2D 上下文；(x,y) 字框左上角；size 字号（像素）；p ∈ [0,1] 书写进度。
 * opt.color；opt.tip(x,y,strength) 回调——笔尖位置，用于在光层里画笔锋的火花。
 * 返回 false 表示无此字的笔画数据（调用者应退回普通字体）。
 */
export function writeChar(ctx, ch, x, y, size, p, opt = {}) {
  const g = glyph(ch);
  if (!g) return false;
  const s = size / 1024;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, -s);
  ctx.translate(0, -900);
  ctx.fillStyle = opt.color || '#000';
  ctx.strokeStyle = opt.color || '#000';
  let budget = clamp(p) * g.total;
  for (let i = 0; i < g.strokes.length; i++) {
    const m = g.medians[i];
    const need = m.len + 120;
    if (budget <= 0) break;
    if (budget >= need) {
      ctx.fill(g.strokes[i]);
      budget -= need;
      continue;
    }
    // 正在写的一笔：裁剪到笔画轮廓，沿中线画粗线
    const d = Math.max(0, budget - 0);
    ctx.save();
    ctx.clip(g.strokes[i]);
    ctx.lineWidth = 150;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const pts = m.pts;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) {
      if (m.acc[k] <= d) ctx.lineTo(pts[k][0], pts[k][1]);
      else { const q = pointAt(m, d); ctx.lineTo(q[0], q[1]); break; }
    }
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 1, pts[0][1]);
    ctx.stroke();
    ctx.restore();
    if (opt.tip) {
      const q = pointAt(m, d);
      opt.tip(x + q[0] * s, y + (900 - q[1]) * s, 1);
    }
    budget = 0;
  }
  ctx.restore();
  return true;
}

/** 普通字体绘制，带字距 */
export function drawText(ctx, str, x, y, { font = FONTS.serif, size = 40, color = '#fff', align = 'center', spacing = 0, alpha = 1, weight = '' } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  const chars = [...str];
  const ws = chars.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * size * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += ws[i] + spacing * size;
  });
  ctx.restore();
  return total;
}

/** 竖排：自上而下，逐字出现（reveal ∈ [0, n]，可带小数实现最后一个字淡入） */
export function drawVText(ctx, str, x, y, { font = FONTS.serif, size = 40, color = '#fff', spacing = 0.25, reveal = Infinity, alpha = 1, drift = 0 } = {}) {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const chars = [...str];
  let cy = y;
  chars.forEach((c, i) => {
    const a = clamp(reveal - i);
    if (a > 0) {
      ctx.globalAlpha = alpha * a;
      // 标点在竖排中的位置
      const punct = '，。、'.includes(c);
      ctx.fillText(c, x + (punct ? size * 0.35 : 0), cy - (1 - a) * drift * size + (punct ? -size * 0.35 : 0));
    }
    cy += size * (1 + spacing);
  });
  ctx.restore();
  return cy - y;
}

/**
 * 「书写」一行字（横排或竖排），每个字依次按笔顺写出。
 * p ∈ [0,1] 为整行进度；overlap 让后一个字在前一个字写完前就起笔。
 */
export function writeLine(ctx, str, x, y, size, p, { vertical = false, gap = 0.12, color = '#000', overlap = 0.35, tip, fallbackFont = FONTS.kai, align = 'center' } = {}) {
  const chars = [...str];
  const n = chars.length;
  const step = size * (1 + gap);
  const total = step * n - size * gap;
  let ox = x, oy = y;
  if (!vertical) ox = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  else oy = align === 'center' ? y - total / 2 : y;
  const per = 1 / (n - (n - 1) * overlap);
  chars.forEach((c, i) => {
    const t0 = i * per * (1 - overlap);
    const q = clamp((p - t0) / per);
    const cx = vertical ? ox - size / 2 : ox + i * step;
    const cy = vertical ? oy + i * step : y - size / 2;
    if (q <= 0) return;
    if ('，。、「」：《》'.includes(c)) {
      drawText(ctx, c, cx + size / 2, cy + size / 2, { font: fallbackFont, size: size * 0.9, color, alpha: q });
      return;
    }
    if (!writeChar(ctx, c, cx, cy, size, q, { color, tip })) {
      drawText(ctx, c, cx + size / 2, cy + size / 2, { font: fallbackFont, size: size * 0.95, color, alpha: q });
    }
  });
  return total;
}
