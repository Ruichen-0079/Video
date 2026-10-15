// 字幕与字卡：画在 2D 画布上，合成到整帧（含宽银幕黑边）
export const FONT = { serif: '"PV Serif"', light: '"PV Serif Light"', kai: '"PV Kai"' };
export async function loadFonts() {
  for (const [fam, file] of [['PV Serif', 'serif'], ['PV Serif Light', 'serif-light'], ['PV Kai', 'kai']]) {
    try { const ff = new FontFace(fam, `url(assets/fonts/${file}.woff2)`); await ff.load(); document.fonts.add(ff); } catch (e) { console.warn('font', file, e.message); }
  }
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// 一条文字事件：{ t0, t1, text, style: 'narr'|'line'|'card'|'stamp'|'title', who }
// 返回当前帧要画的内容（含透明度），以及一个用于缓存的 key
export function textState(events, t) {
  const on = [];
  for (const e of events) {
    if (t < e.t0 - 0.01 || t > e.t1 + 0.01) continue;
    const fin = e.fin ?? 0.45, fout = e.fout ?? 0.45;
    const a = sm(e.t0, e.t0 + fin, t) * (1 - sm(e.t1 - fout, e.t1, t));
    if (a <= 0.004) continue;
    on.push({ e, a: Math.round(a * 40) / 40 });
  }
  return { key: on.map((o) => o.e.id + ':' + o.a).join('|'), on };
}

// 画：R 提供画面框 box
export function drawText(x, R, on) {
  const W = R.W, H = R.H, [bx0, by0, bx1, by1] = R.box;
  const barH = by0;
  x.textBaseline = 'middle'; x.textAlign = 'center';
  const sc = W / 1920;
  for (const { e, a } of on) {
    x.save();
    x.globalAlpha = a;
    if (e.style === 'narr') {
      // 叙述：下方黑边里，白色细宋
      x.font = `300 ${Math.round(34 * sc)}px ${FONT.light}`;
      x.fillStyle = 'rgba(236,232,224,1)';
      spaced(x, e.text, W / 2, H - barH / 2, 0.12 * 34 * sc);
    } else if (e.style === 'line') {
      // 对白：和叙述一样放在下方黑边里（任何画面上都看得清），楷体，带引号；他偏冷、她偏暖
      x.font = `${Math.round(37 * sc)}px ${FONT.kai}`;
      x.fillStyle = e.who === 'm' ? 'rgba(200,216,232,1)' : 'rgba(250,222,196,1)';
      spaced(x, '「' + e.text + '」', W / 2, H - barH / 2, 0.06 * 37 * sc);
    } else if (e.style === 'stamp') {
      // 时代与地点：上方黑边里，小字，字距宽
      x.font = `300 ${Math.round(24 * sc)}px ${FONT.light}`;
      x.fillStyle = 'rgba(200,192,178,1)';
      spaced(x, e.text, W / 2, barH / 2, 0.45 * 24 * sc);
    } else if (e.style.startsWith('card') && e.style.length === 5) {
      // 结尾字卡：三行依次浮现，固定位置
      const k = +e.style[4] - 1;
      const fs = Math.round(40 * sc);
      x.font = `300 ${fs}px ${FONT.light}`;
      x.fillStyle = 'rgba(232,228,220,1)';
      spaced(x, e.text, W / 2, H / 2 + (k - 1) * fs * 2.2, 0.14 * fs);
    } else if (e.style === 'card') {
      // 字卡：全黑画面中央
      const lines = e.text.split('\n');
      const fs = Math.round((e.size || 44) * sc);
      x.font = `300 ${fs}px ${FONT.light}`;
      x.fillStyle = 'rgba(236,232,224,1)';
      lines.forEach((ln, i) => spaced(x, ln, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.9, 0.14 * fs));
    } else if (e.style === 'title') {
      const fs = Math.round(96 * sc);
      x.font = `300 ${fs}px ${FONT.light}`;
      x.fillStyle = 'rgba(240,236,228,1)';
      spaced(x, e.text, W / 2, H / 2 - 10 * sc, 0.5 * fs);
      if (e.sub) { x.font = `300 ${Math.round(24 * sc)}px ${FONT.light}`; x.fillStyle = 'rgba(190,184,172,1)'; spaced(x, e.sub, W / 2, H / 2 + 90 * sc, 0.5 * 24 * sc); }
    }
    x.restore();
  }
}
// 逐字排，带字距
function spaced(x, s, cx, cy, sp) {
  const ch = [...s];
  const ws = ch.map((c) => x.measureText(c).width);
  const tot = ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1);
  let px = cx - tot / 2;
  const al = x.textAlign; x.textAlign = 'left';
  ch.forEach((c, i) => { x.fillText(c, px, cy); px += ws[i] + sp; });
  x.textAlign = al;
}
