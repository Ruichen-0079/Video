// 时间轴：音乐与画面共享同一张节拍表（assets/cues.json）。
// 画面里所有关键动作都以「第几小节第几拍」来写，而不是以秒来写。

import { smooth, lerp } from './noise.js';

export const BPM = 75;
export const BEAT = 60 / BPM;      // 0.8 s
export const BAR = BEAT * 4;       // 3.2 s
export const bar = (b, beat = 0) => (b + beat / 4) * BAR;
let CUES = null;
export function setCues(c) { CUES = c; }
export const sec = (id) => {
  const s = CUES.sections.find((x) => x.id === id);
  return { start: s.bars[0] * BAR, end: s.bars[1] * BAR };
};

// 关键帧插值
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const u = smooth(t0, t1, t);
      if (Array.isArray(v0)) return v0.map((x, k) => lerp(x, v1[k], u));
      return lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

// 全片调色：纸/夜、曝光、整体色温。场景可以在此基础上再改。
const K = {
  paper: [[0, 0], [bar(48), 0]],
  exposure: [[0, 1.0], [bar(48), 1.0]],
  fade: [[0, 0], [1.2, 1], [bar(48) + 3.2, 1], [bar(48) + 6.2, 0]],
  tint: [[0, [1, 1, 1]], [bar(48), [1, 1, 1]]],
};
export function overrideGrade(k) { Object.assign(K, k); }

export function grade(t) {
  return {
    paper: track(K.paper, t),
    exposure: track(K.exposure, t),
    fade: track(K.fade, t),
    tint: track(K.tint, t),
    bloom: 0.9,
    grain: 0.018,
    vignette: 0.55,
    inkK: 1.0,
    nightA: [0.010, 0.013, 0.024],   // 上
    nightB: [0.020, 0.022, 0.034],   // 下
    paperCol: [0.92, 0.885, 0.80],
  };
}
