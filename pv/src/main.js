// 入口：window.PV.renderFrame(t) —— 给定时间，确定地画出一帧。
import { Renderer } from './gl.js';
import { Camera } from './camera.js';
import { loadHanzi, FONTS } from './text.js';
import { setCues, grade } from './timeline.js';
import { SCENES } from './scenes/index.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1920), H = +(qs.get('h') || 1080);
const FPS = +(qs.get('fps') || 30);

const canvas = document.getElementById('out');
canvas.width = W; canvas.height = H;
const R = new Renderer(canvas, W, H);
const cam = new Camera(W, H);

const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const lightC = mk(), inkC = mk();
const light = lightC.getContext('2d'), ink = inkC.getContext('2d');

async function init() {
  const cues = await (await fetch('assets/cues.json')).json();
  setCues(cues);
  await loadHanzi('assets/hanzi.json');
  const faces = [
    ['WH Serif Light', 'serif-light'], ['WH Serif', 'serif'], ['WH Serif Bold', 'serif-bold'],
    ['WH Kai', 'kai'], ['WH Brush', 'brush'],
  ];
  for (const [fam, file] of faces) {
    try {
      const f = new FontFace(fam, `url(assets/fonts/${file}.woff2)`);
      await f.load();
      document.fonts.add(f);
    } catch (e) { console.warn('font', fam, e); }
  }
  await document.fonts.ready;
  for (const s of SCENES) if (s.init) await s.init({ W, H });
  return { W, H, FPS, duration: totalDuration(cues) };
}

function totalDuration(c) {
  const bar = (60 / c.bpm) * c.beatsPerBar;
  return c.sections[c.sections.length - 1].bars[1] * bar + c.tail;
}

function renderFrame(t, frame) {
  R.begin();
  // 重设宽度会彻底清空画布并标记为已更改；仅 clearRect 时，Chromium 上传纹理可能沿用旧快照
  lightC.width = W; inkC.width = W;
  light.globalCompositeOperation = 'lighter';
  ink.globalCompositeOperation = 'source-over';
  const S = H / 1080; // 以 1080p 为设计基准的缩放
  const post = grade(t);
  const f = { t, W, H, S, R, cam, light, ink, post, L: R.lightLines, I: R.inkLines, frame };
  for (const s of SCENES) {
    if (t >= s.start - (s.pre || 0) && t < s.end + (s.post || 0)) {
      f.lt = t - s.start;
      f.u = (t - s.start) / (s.end - s.start);
      light.save(); ink.save();
      s.render(f);
      light.restore(); ink.restore();
      R.flush();
    }
  }
  post.time = t;
  post.frame = frame ?? Math.round(t * FPS);
  R.finish(lightC, inkC, post);
}

window.PV = {
  ready: init(),
  renderFrame: (t, frame) => { renderFrame(t, frame); return true; },
  // 取当前帧（PNG data URL）
  grab: (type = 'image/png', q) => canvas.toDataURL(type, q),
  FONTS,
};
