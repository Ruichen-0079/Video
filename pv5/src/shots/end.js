// 五 · 开放的收束
// modern a：现代的公寓，夜。他从床上惊醒，坐起来，转头看向写字桌上的信纸。modern b：桌上的信，杯子，窗外的城市。
import { put, POSE, walking, rest, blend } from '../act.js';
import { ground, table, apartmentWindow, cityLights, lampGlow } from '../set.js';
import { keyed, smooth, smoother, lerp, rgba } from '../g2.js';
import { MBC_MODERN } from '../cast.js';
import { L, piece } from '../puppet.js';

const GY = 12;
function room(c, t) {
  apartmentWindow(c, 60, 180, GY + 10, GY + 60, t);
  ground(c, GY, -80, 330, 'floor', [60, 60, 70], 26);
}
function skyline(c) {
  let x = 50; let k = 0;
  while (x < 190) { const w = 6 + ((k * 37) % 9), h = 10 + ((k * 53) % 26); piece(c, (q) => q.rect(x, GY + 10, w, h), [60, 64, 90], { alpha: 0.9, lw: 0.2 }); x += w + 1; k++; }
}
function bed(c) { piece(c, (k) => k.rect(60, GY, 50, 8), [90, 90, 110]); piece(c, (k) => k.rect(60, GY + 8, 50, 3), [200, 200, 210]); piece(c, (k) => k.rect(56, GY, 4, 17), [70, 60, 60]); }
function desk(c, t, x = 170) {
  table(c, x, GY, 34, 16, [80, 60, 50]);
  // 信纸
  piece(c, (k) => { k.moveTo(x - 9, GY + 16.2); k.lineTo(x + 3, GY + 16.2); k.lineTo(x + 4, GY + 17.0); k.lineTo(x - 8, GY + 17.0); k.closePath(); }, [250, 246, 236], { lw: 0.3 });
  // 杯子
  piece(c, (k) => k.rect(x + 8, GY + 16, 3, 4), [200, 210, 230], { lw: 0.3 });
}
export function modern(args) {
  const part = args.part || 'a';
  return {
    frame(t) {
      const city = cityLights(62, 178, GY + 12, GY + 36, t, 4);
      if (part === 'a') {
        const up = smoother(0.5, 1.3, t), look = smoother(3.0, 3.8, t);
        const pose = up < 0.5 ? { ...rest(), ground: false, head: 0.1 } : POSE.sitGround({ head: lerp(0.05, 0.05, look), lean: 0.1 });
        return {
          cam: { x: keyed([[0, 108], [5.5, 116]], t), y: keyed([[0, 36], [5.5, 35]], t), zoom: keyed([[0, 1.8], [5.5, 1.95]], t) },
          layers: [
            { d: 0.5, par: 0.6, draw: (c) => skyline(c) },
            { d: 0.05, draw: (c) => { room(c, t); bed(c); desk(c, t, 150); } },
            { d: 0, draw: (c) => {
              if (up < 0.5) put(c, MBC_MODERN, pose, { x: 104, y: GY + 15, s: 0.48, face: 1, rot: Math.PI / 2 * (1 - up * 2), t });
              else put(c, MBC_MODERN, pose, { x: 80, y: GY + 11, s: 0.48, face: look > 0.5 ? 1 : -1, t });
            } },
          ],
          glow: [city],
          light: { sky: [[8, 10, 20], [20, 22, 40], [30, 30, 50], [14, 14, 22]], lamps: [{ x: 120, y: 50, r: 110, col: [140, 150, 200], k: 0.22 }] },
          grade: { exposure: 1.2, contrast: 1.1, sat: 0.85, vignette: 0.6, bloom: 0.35 },
        };
      }
      // b：近，桌上的信纸被窗缝里的风掀起一角
      return {
        cam: { x: keyed([[0, 168], [4, 170]], t), y: keyed([[0, 30], [4, 29]], t), zoom: keyed([[0, 3.6], [4, 4.0]], t) },
        layers: [
          { d: 0.6, par: 0.5, draw: (c) => skyline(c) },
          { d: 0.3, par: 0.6, draw: (c) => room(c, t) },
          { d: 0, draw: (c) => {
            table(c, 170, GY, 34, 16, [80, 60, 50]);
            const lift = 0.06 + 0.05 * Math.sin(t * 1.7);
            c.save(); c.translate(161, GY + 16.4); c.rotate(lift);
            piece(c, (k) => { k.moveTo(0, 0); k.lineTo(12, 0); k.lineTo(12.4, 0.7); k.lineTo(0.4, 0.7); k.closePath(); }, [250, 246, 236], { lw: 0.2 });
            c.restore();
            // 信纸上的字（几行细墨）
            c.save(); c.globalAlpha = 0.7; c.strokeStyle = 'rgba(30,30,40,0.8)'; c.lineWidth = 0.08;
            for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(161.5, GY + 16.55 + k * 0.15); c.lineTo(171, GY + 16.55 + k * 0.15); c.stroke(); }
            c.restore();
            piece(c, (k) => k.rect(178, GY + 16, 3, 4), [200, 210, 230], { lw: 0.25 });
          } },
        ],
        glow: [city, lampGlow(170, GY + 30, 30, [200, 210, 255], 0.15)],
        light: { sky: [[8, 10, 20], [20, 22, 40], [30, 30, 50], [14, 14, 22]], lamps: [{ x: 170, y: 40, r: 60, col: [140, 150, 200], k: 0.22 }] },
        grade: { exposure: 1.2, contrast: 1.1, sat: 0.85, vignette: 0.62, bloom: 0.35 },
      };
    },
  };
}
export function blank() { return { frame: () => ({ layers: [], light: { amb: [0, 0, 0], lamps: [] }, grade: { exposure: 0, grain: 0, bloom: 0, vignette: 0 } }) }; }
