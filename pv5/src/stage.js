// 影窗：一块纸幕，后面点着灯。
// 场景描述（每帧由镜头给出）：
//   cam:   { x, y, zoom }        舞台坐标里的视点（幕高 100 个单位，zoom 1 = 整幅幕）
//   light: { amb:[r,g,b], lamps:[{x,y,r,col,k}], paper:[r,g,b], flicker }   幕后的光
//   glow:  [fn(ctx)]             额外的光（太阳、火、灯笼的光晕），加在幕上
//   layers:[{ d, draw(ctx), alpha }]   皮影与布景；d = 离幕的距离（0 贴着幕，越大越虚越淡）
//   after: [fn(ctx)]             画在皮影之后、仍属于幕面的光（比如灯笼本身的亮）
//   grade: { exposure, contrast, sat, vignette, grain, bloom, fade, tint:[r,g,b] }
import { clamp, rng, TAU, rgba } from './g2.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export class Stage {
  constructor(W, H, aspect = 2.35) {
    this.W = W; this.H = H;
    this.AW = W; this.AH = Math.min(H, Math.round(W / aspect / 2) * 2);
    this.box = [0, (H - this.AH) / 2, W, (H + this.AH) / 2];
    this.screen = mk(this.AW, this.AH); this.sx = this.screen.getContext('2d');
    this.layer = mk(this.AW, this.AH); this.lx = this.layer.getContext('2d');
    // 虚的层在低分辨率里画、在低分辨率里模糊，再放大（省时间，模糊后看不出差别）
    this.lo = {};
    for (const q of [2, 4]) { const a = mk(Math.ceil(this.AW / q), Math.ceil(this.AH / q)), b = mk(a.width, a.height); this.lo[q] = { a, ax: a.getContext('2d'), b, bx: b.getContext('2d') }; }
    this.small = mk(this.AW >> 2, this.AH >> 2); this.smx = this.small.getContext('2d');
    this.paper = makePaper(1600, 700);
    this.grain = makeGrain(256);
    this.leather = makeLeather(512);
  }
  // 舞台坐标 → 像素的变换（y 向上）
  view(ctx, cam, q = 1) {
    const s = this.AH * (cam.zoom || 1) / 100 / q;
    ctx.setTransform(s, 0, 0, -s, this.AW / 2 / q - cam.x * s, this.AH / 2 / q + cam.y * s);
    return s;
  }
  render(sc, t) {
    const { AW, AH, sx } = this;
    const cam = sc.cam || { x: 117.5, y: 50, zoom: 1 };
    const L = sc.light || {};
    const g = { exposure: 1, contrast: 1, sat: 1, vignette: 0.45, grain: 0.05, bloom: 0.25, fade: 1, ...(sc.grade || {}) };
    const flick = 1 + (L.flicker ?? 0.02) * (Math.sin(t * 13.1) * 0.6 + Math.sin(t * 7.7 + 1.3) * 0.4);
    // 1. 幕后的光
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.filter = 'none'; sx.globalAlpha = 1;
    const amb = L.amb || [40, 30, 22];
    if (L.sky) {
      // 竖直方向的底色（上 → 下），给幕一个「天色」
      const gr = sx.createLinearGradient(0, 0, 0, AH);
      L.sky.forEach((c, i) => gr.addColorStop(i / (L.sky.length - 1), rgba(c)));
      sx.fillStyle = gr;
    } else sx.fillStyle = rgba(amb);
    sx.fillRect(0, 0, AW, AH);
    const s = this.view(sx, cam);
    sx.globalCompositeOperation = 'lighter';
    for (const lp of L.lamps || [{ x: 117.5, y: 55, r: 150, col: [255, 214, 150], k: 1 }]) {
      const gr = sx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, lp.r);
      const c = lp.col, k = (lp.k ?? 1) * flick;
      gr.addColorStop(0, rgba(c, Math.min(1, k)));
      gr.addColorStop(0.45, rgba(c, Math.min(1, k * 0.72)));
      gr.addColorStop(1, rgba(c, 0));
      sx.fillStyle = gr; sx.fillRect(lp.x - lp.r, lp.y - lp.r, lp.r * 2, lp.r * 2);
    }
    for (const fn of sc.glow || []) { sx.save(); fn(sx, s); sx.restore(); }
    // 纸的纤维（随幕一起缩放）
    sx.globalCompositeOperation = 'multiply';
    sx.save(); sx.scale(1, -1); sx.globalAlpha = 0.55; sx.drawImage(this.paper, -40, -125, 315, 150); sx.restore();
    sx.globalAlpha = 1;
    // 2. 皮影与布景：从远到近，乘到幕上
    const layers = (sc.layers || []).slice().sort((a, b) => (b.d || 0) - (a.d || 0));
    for (const ly of layers) {
      const d = ly.d || 0;
      const blur = d * 0.016 * AH * Math.sqrt(cam.zoom || 1) + (ly.blur || 0);
      const q = blur > 7 ? 4 : blur > 2.2 ? 2 : 1;
      const cv = q === 1 ? this.layer : this.lo[q].a, lx = q === 1 ? this.lx : this.lo[q].ax;
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, cv.width, cv.height); lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over'; lx.filter = 'none';
      const pr = ly.par ?? 1;
      const lcam = pr === 1 ? cam : { x: 117.5 + (cam.x - 117.5) * pr, y: 50 + (cam.y - 50) * pr, zoom: 1 + ((cam.zoom || 1) - 1) * pr };
      const ls = this.view(lx, lcam, q);
      ly.draw(lx, ls * q);
      if (!ly.noTexture) {
        // 皮子的质感：在已画的地方叠一层斑驳（染色的深浅不均）
        lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-atop'; lx.globalAlpha = 1;
        const k = Math.max(0.5 / q, ls / 9);
        lx.save(); lx.scale(k, k); lx.fillStyle = lx.createPattern(this.leather, 'repeat');
        lx.fillRect(0, 0, cv.width / k, cv.height / k); lx.restore();
        lx.globalCompositeOperation = 'source-over';
      }
      let src = cv;
      if (q > 1) { const L2 = this.lo[q]; L2.bx.setTransform(1, 0, 0, 1, 0, 0); L2.bx.clearRect(0, 0, L2.b.width, L2.b.height); L2.bx.filter = `blur(${(blur / q).toFixed(2)}px)`; L2.bx.drawImage(cv, 0, 0); L2.bx.filter = 'none'; src = L2.b; }
      sx.setTransform(1, 0, 0, 1, 0, 0);
      sx.globalCompositeOperation = ly.mode || 'multiply';
      sx.filter = q === 1 && blur > 0.35 ? `blur(${blur.toFixed(2)}px)` : 'none';
      sx.globalAlpha = clamp((ly.alpha ?? 1) * (1 - 0.42 * Math.min(1, d)));
      sx.imageSmoothingQuality = 'high';
      sx.drawImage(src, 0, 0, AW, AH);
      sx.filter = 'none'; sx.globalAlpha = 1;
    }
    // 3. 幕面上的光（灯笼的亮、火光透过来）
    if (sc.after && sc.after.length) {
      this.view(sx, cam); sx.globalCompositeOperation = 'lighter';
      for (const fn of sc.after) { sx.save(); fn(sx, s); sx.restore(); }
    }
    sx.setTransform(1, 0, 0, 1, 0, 0);
    // 4. 泛光
    if (g.bloom > 0) {
      const sm = this.smx; sm.globalCompositeOperation = 'source-over'; sm.filter = 'blur(5px) brightness(0.9) contrast(1.6)';
      sm.drawImage(this.screen, 0, 0, this.small.width, this.small.height); sm.filter = 'none';
      sx.globalCompositeOperation = 'screen'; sx.globalAlpha = g.bloom; sx.drawImage(this.small, 0, 0, AW, AH); sx.globalAlpha = 1;
    }
    // 5. 暗角
    sx.globalCompositeOperation = 'multiply';
    const vg = sx.createRadialGradient(AW / 2, AH / 2, AH * 0.35, AW / 2, AH / 2, AW * 0.62);
    vg.addColorStop(0, 'rgba(255,255,255,1)'); vg.addColorStop(1, rgba([255 * (1 - g.vignette), 255 * (1 - g.vignette * 1.05), 255 * (1 - g.vignette * 1.1)]));
    sx.fillStyle = vg; sx.fillRect(0, 0, AW, AH);
    if (g.tint) { sx.fillStyle = rgba(g.tint); sx.fillRect(0, 0, AW, AH); }
    // 6. 颗粒
    if (g.grain > 0) {
      sx.globalCompositeOperation = 'overlay'; sx.globalAlpha = g.grain * 4;
      const ox = Math.floor((Math.sin(t * 91.7) * 0.5 + 0.5) * 256), oy = Math.floor((Math.sin(t * 57.3 + 2) * 0.5 + 0.5) * 256);
      const pat = sx.createPattern(this.grain, 'repeat'); sx.translate(-ox, -oy); sx.fillStyle = pat; sx.fillRect(ox, oy, AW, AH); sx.setTransform(1, 0, 0, 1, 0, 0);
      sx.globalAlpha = 1;
    }
    sx.globalCompositeOperation = 'source-over';
    this.grade = g;
    return this.screen;
  }
  // 把幕放进整帧（黑边 + 调色 + 淡入淡出）
  compose(ctx, textDraw) {
    const { W, H, box, grade: g } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.filter = `brightness(${(g.exposure * g.fade).toFixed(3)}) contrast(${g.contrast.toFixed(3)}) saturate(${g.sat.toFixed(3)})`;
    ctx.drawImage(this.screen, box[0], box[1], box[2] - box[0], box[3] - box[1]);
    ctx.filter = 'none';
    if (textDraw) textDraw(ctx, this);
  }
}

// 纸幕的纤维纹理：浅色底上的细长纤维与云状的厚薄
function makePaper(w, h) {
  const c = mk(w, h), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  const R = rng(17);
  for (let i = 0; i < 260; i++) { const cx = R() * w, cy = R() * h, r = 30 + R() * 140; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); const a = 0.03 + R() * 0.05; gr.addColorStop(0, `rgba(170,150,120,${a})`); gr.addColorStop(1, 'rgba(170,150,120,0)'); x.fillStyle = gr; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
  x.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const cx = R() * w, cy = R() * h, a = R() * TAU, l = 3 + R() * 16;
    x.strokeStyle = R() < 0.5 ? `rgba(120,100,70,${0.05 + R() * 0.12})` : `rgba(255,255,255,${0.1 + R() * 0.2})`;
    x.lineWidth = 0.4 + R() * 0.9;
    x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(cx + Math.cos(a + 0.5) * l * 0.5, cy + Math.sin(a + 0.5) * l * 0.5, cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke();
  }
  return c;
}
function makeLeather(n) {
  const c = mk(n, n), x = c.getContext('2d'), R = rng(29);
  for (let i = 0; i < 900; i++) { const cx = R() * n, cy = R() * n, r = 6 + R() * 50; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); const a = 0.05 + R() * 0.12; gr.addColorStop(0, `rgba(70,36,12,${a})`); gr.addColorStop(1, 'rgba(70,36,12,0)'); x.fillStyle = gr;
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) x.fillRect(cx - r + dx, cy - r + dy, r * 2, r * 2); }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(60,30,10,${0.05 + R() * 0.1})`; x.fillRect(R() * n, R() * n, 1 + R() * 2, 1 + R() * 2); }
  return c;
}
function makeGrain(n) {
  const c = mk(n, n), x = c.getContext('2d'), d = x.createImageData(n, n), R = rng(5);
  for (let i = 0; i < n * n; i++) { const v = 128 + (R() + R() + R() - 1.5) * 90; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}
