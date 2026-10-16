// 入口：window.PV.renderFrame(t, frame)。每帧只依赖时间 t（皮影没有需要逐帧推进的模拟）。
import { Stage } from './stage.js';
import { loadFonts, textState, drawText } from './text.js';
import { SHOTS as ALL, TEXT as ALLTEXT, timeline, DEBUG } from './edit.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1920), H = +(qs.get('h') || 1080), FPS = +(qs.get('fps') || 30);
const canvas = document.getElementById('out'); canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
let S = null;
// 调试：?only=镜头名&a=参数（JSON）
const only = qs.get('only');
const SHOTS = only ? [{ id: only, make: DEBUG[only], dur: +(qs.get('dur') || 10), args: JSON.parse(qs.get('a') || '{}') }] : ALL;
const TEXT = only ? [] : ALLTEXT;
const TL = timeline(SHOTS);
const cache = new Map();

function shotAt(t) {
  for (const e of TL.list) if (t >= e.start && t < e.end) return e;
  return TL.list[TL.list.length - 1];
}
function renderFrame(t) {
  const e = shotAt(t);
  let shot = cache.get(e);
  if (!shot) { shot = e.make(e.args || {}); cache.set(e, shot); }
  const lt = t - e.start + (e.offset || 0);
  const sc = shot.frame(lt);
  const g = (sc.grade = sc.grade || {});
  let fade = 1;
  if (e.fadeIn) fade *= Math.min(1, (t - e.start) / e.fadeIn);
  if (e.fadeOut) fade *= Math.min(1, (e.end - t) / e.fadeOut);
  g.fade = (g.fade ?? 1) * Math.max(0, fade);
  S.render(sc, t);
  const ts = textState(TEXT, t);
  S.compose(ctx, (x, R) => drawText(x, R, ts.on));
  return true;
}
async function init() {
  await loadFonts();
  S = new Stage(W, H, 2.35);
  return { W, H, FPS, duration: TL.duration };
}
window.PV = { ready: init(), renderFrame, grab: (type = 'image/png', q) => canvas.toDataURL(type, q) };
