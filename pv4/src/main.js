// 入口：window.PV.renderFrame(t, frame)。按剪辑表找到镜头，镜头内的模拟按帧推进。
import { initGL } from './gl.js';
import { Renderer } from './renderer.js';
import { loadFonts, textState, drawText } from './text.js';
import { SHOTS as ALL, TEXT as ALLTEXT, timeline, DEBUG } from './edit.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1920), H = +(qs.get('h') || 1080), FPS = +(qs.get('fps') || 30);
const canvas = document.getElementById('out'); canvas.width = W; canvas.height = H;
initGL(canvas);
let R = null;
// 调试：?only=镜头名&a=参数（JSON）
const only = qs.get('only');
const SHOTS = only ? [{ id: only, make: DEBUG[only], dur: +(qs.get('dur') || 10), args: JSON.parse(qs.get('a') || '{}') }] : ALL;
const TEXT = only ? [] : ALLTEXT;
const TL = timeline(SHOTS);
let cur = null;        // { entry, shot, lastF }

function shotAt(t) {
  for (const e of TL.list) if (t >= e.start && t < e.end) return e;
  return TL.list[TL.list.length - 1];
}
function renderFrame(t, frame) {
  const f = frame ?? Math.round(t * FPS);
  const e = shotAt(t);
  const f0 = Math.round(e.start * FPS);
  if (!cur || cur.entry !== e || f <= cur.lastF || f - cur.lastF > 1) {
    // 新镜头或跳帧：从镜头开头重新推进
    if (!cur || cur.entry !== e) { if (cur && cur.shot.dispose) cur.shot.dispose(); cur = { entry: e, shot: e.make(R, e.args || {}), lastF: f0 - 1 }; }
    else { cur.shot = e.make(R, e.args || {}); cur.lastF = f0 - 1; }
    // offset：镜头从模拟的第 offset 秒开始（特写插入同一段动作时用）
    const off = Math.round((e.offset || 0) * FPS);
    for (let k = -off; k < 0; k++) cur.shot.frame((k + off) / FPS, k === -off ? 0 : 1 / FPS, false);
    for (let k = f0; k < f; k++) cur.shot.frame((k - f0) / FPS + (e.offset || 0), k === f0 && !off ? 0 : 1 / FPS, false), (cur.lastF = k);
  }
  const lt = (f - f0) / FPS;
  const sc = cur.shot.frame(lt + (e.offset || 0), f === f0 && !e.offset ? 0 : 1 / FPS, true);
  cur.lastF = f;
  // 镜头首尾的淡入淡出
  const g = (sc.grade = sc.grade || {});
  let fade = 1;
  if (e.fadeIn) fade *= Math.min(1, lt / e.fadeIn);
  if (e.fadeOut) fade *= Math.min(1, (e.end - e.start - lt) / e.fadeOut);
  g.fade = (g.fade ?? 1) * Math.max(0, fade);
  const ts = textState(TEXT, t);
  R.render(sc, f, lt + (e.offset || 0), { key: ts.key, draw: (x, RR) => drawText(x, RR, ts.on) });
  return true;
}
async function init() {
  await loadFonts();
  R = new Renderer(W, H, { aspect: 2.35, samples: +(qs.get('ms') || 4) });
  return { W, H, FPS, duration: TL.duration };
}
window.PV = { ready: init(), renderFrame, grab: (type = 'image/png', q) => canvas.toDataURL(type, q) };
