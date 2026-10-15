// 调试：中性背景下检查人物的形体、蒙皮与布料
import { Actor, figureGroups } from '../actor.js';
import { grid } from '../mesh.js';
import { add, keyed, smooth, smoother } from '../math.js';
import { walkCycle as walk } from '../figure.js';
import { GIRL, OLD } from './seaside.js';

export default function studio(R, args) {
  const floor = grid(20, 20, 20, 20, () => 0, () => [0.18, 0.18, 0.185, 0.9]).upload();
  const P = args.who === 'girl' ? GIRL : OLD;
  if (args.mode === 'face') { const k = P === GIRL ? 1.12 / 1.7 : 1; args.d = 0.9 * k; args.h = 1.62 * k; args.ty = 1.6 * k; args.fov = 30; }
  const a = new Actor(P, { skirt: { len: 0.95, flare: 1.9, color: P.colors.robe, color2: P.colors.robe2 }, sleeves: { width: 0.17, color: P.colors.robe, color2: P.colors.robe2 } });
  return {
    frame(t, dt) {
      const mode = args.mode || 'stand';
      const J = a.T.body.J;
      let pose;
      if (mode === 'walk') {
        const wc = walk(J, [-1.2, 0, 0], [1, 0, 0], (+args.speed || 0.6) * t, { stride: +args.stride || 0.46, lift: 0.045 });
        pose = { pos: wc.pelvis, yaw: Math.PI / 2, footL: wc.footL, footR: wc.footR, lean: [0.1, 0, 0] };
      } else if (mode === 'reach') {
        pose = { pos: [0, J.pelvis[1] - 0.04, 0], yaw: 0, lean: [0.3, 0, 0], handR: [-0.1, 1.15, 0.45], elbowR: [-0.4, -0.4, 0.3] };
      } else pose = { pos: [0, J.pelvis[1], 0], yaw: 0 };
      a.update(pose, dt, { t, wind: [0.2, 0, 0] });
      const ang = (args.ang || 0.6) + (args.spin ? t * 0.6 : 0);
      const d = +(args.d || 3.2), h = +(args.h || 1.1);
      return {
        cam: { pos: [Math.sin(ang) * d, h, Math.cos(ang) * d], target: [0, +(args.ty || 0.95), 0], fov: +(args.fov || 32) },
        sun: { dir: [0.5, 0.8, 0.6], col: [1.3, 1.25, 1.2], shadow: { center: [0, 0.8, 0], radius: 2.5 } },
        amb: { sky: [0.16, 0.17, 0.19], gnd: [0.07, 0.065, 0.06] }, rim: [0.12, 0.12, 0.14],
        sky: { top: [0.08, 0.085, 0.09], hor: [0.14, 0.14, 0.145], gnd: [0.1, 0.1, 0.1] },
        items: [{ mesh: floor }, ...a.items()],
        figures: figureGroups([a]),
        grade: { exposure: 1.0, vignette: 0.2, grain: 0.01 },
      };
    },
  };
}
