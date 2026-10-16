// 万花洲：金色的草原，开满花。
// a：远景，他从左边走进来，她仰面躺在草里。b：他在她身边蹲下（对白）。c：两人并肩坐着，她笑他的名字。
import { put, POSE, walking, rest, blend } from '../act.js';
import { ground, grass, mountains, sunGlow, cloudBank } from '../set.js';
import { drift } from '../fx.js';
import { keyed, smooth, smoother, lerp } from '../g2.js';
import { ZFY, MBC } from '../cast.js';
import { L } from '../puppet.js';

const GY = 16;
const meadow = (t, x0 = -40, x1 = 280) => [
  { d: 0.55, par: 0.35, alpha: 1, draw: (c) => { mountains(c, x0, x1, GY + 2, 40, { col: [96, 110, 120], seed: 3 }); cloudBank(c, 60, 78, 1.4); cloudBank(c, 190, 84, 1.1); } },
  { d: 0.45, par: 0.7, draw: (c) => { ground(c, GY + 4, x0, x1, 'hill', [150, 160, 80], 2); grass(c, x0, x1, GY + 4, t, { h: 6, dens: 1.0, col: [170, 180, 90], seed: 8, flowers: 0.25 }); } },
  { d: 0.08, draw: (c) => { ground(c, GY - 3, x0, x1, 'plain', [190, 170, 100], 5); } },
];

export default function grassland(args) {
  const part = args.part || 'a';
  return {
    frame(t) {
      const layers = [...meadow(t)];
      let cam, glows = [sunGlow(205, 70, 6, [255, 214, 140], 0.9)];
      if (part === 'a') {
        // 她躺在草里（头朝左，脸朝天）
        const her = { x: 156, y: GY + 2.2, s: 0.34, face: 1, rot: Math.PI / 2, t };
        const herPose = { ...rest(), ground: false, aF: -0.35, eF: 1.1, aB: -0.15, eB: 0.2, head: -0.15 + 0.1 * Math.sin(t * 0.5), legF: [0.1, 0.3], legB: [0.0, 0.1] };
        // 他：从左边走来，停在她脚边
        const w = walking(40, 15, Math.min(t, 5.2));
        const stop = smooth(4.4, 5.0, t);
        const hisPose = blend(w.pose, POSE.behind({ head: 0.2 }), stop);
        layers.push({ d: 0, draw: (c) => {
          put(c, ZFY, herPose, her);
          put(c, MBC, hisPose, { x: Math.min(w.x, 120), y: GY, s: 0.34, face: 1, t });
          grass(c, -40, 280, GY - 0.5, t, { h: 7, dens: 0.9, col: [150, 196, 96], seed: 21, flowers: 0.35 });
        } });
        layers.push({ d: 0.55, draw: (c) => grass(c, -40, 280, GY - 8, t, { h: 14, dens: 0.35, col: [120, 170, 80], seed: 33, flowers: 0.2 }) });
        cam = { x: keyed([[0, 112], [5, 122]], t), y: keyed([[0, 46], [5, 40]], t), zoom: keyed([[0, 1.15], [5, 1.5]], t) };
      } else if (part === 'b') {
        // 近：他在她身边蹲下来，看着她；她把脸转向他
        const her = { x: 136, y: GY + 3.1, s: 0.58, face: 1, rot: Math.PI / 2, t };
        const turn = smoother(2.2, 3.0, t), lift = smoother(2.8, 3.8, t);
        const herPose = { ...rest(), ground: false, aF: lerp(-0.25, 2.5, lift), eF: lerp(0.3, 1.3, lift), aB: -0.12, eB: 0.2, head: lerp(-0.1, 0.4, turn), legF: [0.25, 0.6], legB: [0.0, 0.1] };
        const k = smoother(0.0, 1.6, t);
        const hisPose = POSE.kneel(k, { head: 0.35 + 0.15 * k, lean: 0.15 + 0.12 * k, aF: lerp(0.1, 0.75, k), eF: lerp(0.2, 0.9, k), aB: -0.1 });
        layers.push({ d: 0, draw: (c) => {
          put(c, MBC, hisPose, { x: 150, y: GY, s: 0.58, face: -1, t });
          put(c, ZFY, herPose, her);
          grass(c, 60, 210, GY - 0.5, t, { h: 9, dens: 1.0, col: [150, 196, 96], seed: 41, flowers: 0.4 });
        } });
        layers.push({ d: 0.7, draw: (c) => grass(c, 40, 230, GY - 10, t, { h: 20, dens: 0.3, col: [120, 170, 80], seed: 47, flowers: 0.3 }) });
        cam = { x: keyed([[0, 128], [5, 126]], t), y: keyed([[0, 36], [5, 35]], t), zoom: keyed([[0, 1.85], [5, 2.0]], t) };
      } else {
        // c：并肩坐着。他报上名字；她扭头看他，笑得往后仰
        const laugh = smoother(4.0, 4.5, t) * (1 - smooth(5.2, 5.5, t) * 0.4);
        const look = smoother(3.0, 3.6, t);
        const hisPose = POSE.sitGround({ head: lerp(0.1, -0.05, smooth(2.6, 3.0, t)), aF: 0.6, eF: 0.9, aB: -0.7, eB: 0.3 });
        const herPose = POSE.sitGround({ head: lerp(0.15, 0.0, look) - 0.25 * laugh, lean: lerp(0.15, -0.05, laugh), aF: lerp(0.55, 1.9, laugh), eF: lerp(0.9, 2.4, laugh), aB: -0.7, eB: 0.3 });
        layers.push({ d: 0, draw: (c) => {
          put(c, MBC, hisPose, { x: 104, y: GY, s: 0.5, face: 1, t });
          put(c, ZFY, herPose, { x: 140, y: GY, s: 0.5, face: look > 0.5 ? -1 : 1, t });
          grass(c, 50, 200, GY - 0.5, t, { h: 9, dens: 1.1, col: [150, 196, 96], seed: 51, flowers: 0.35 });
        } });
        layers.push({ d: 0.7, draw: (c) => grass(c, 30, 220, GY - 9, t, { h: 18, dens: 0.3, col: [120, 170, 80], seed: 57, flowers: 0.3 }) });
        cam = { x: keyed([[0, 121], [5.5, 122]], t), y: keyed([[0, 33], [5.5, 32]], t), zoom: keyed([[0, 1.9], [5.5, 2.05]], t) };
      }
      layers.push({ d: 0.3, noTexture: true, draw: (c) => drift(c, -40, 280, 0, 100, t, { n: 40, kind: 'petal', col: L.rose, wind: 4, speed: 4, size: 0.7 }) });
      return {
        cam, layers, glow: glows,
        light: { sky: [[118, 92, 76], [206, 140, 80], [232, 168, 96], [190, 130, 70]], lamps: [{ x: 200, y: 70, r: 120, col: [255, 200, 130], k: 0.5 }, { x: 110, y: 36, r: 120, col: [255, 180, 110], k: 0.18 }] },
        grade: { exposure: 1.02, contrast: 1.06, sat: 1.05, vignette: 0.5, bloom: 0.25 },
      };
    },
  };
}
