// 角色样张：所有主要人物并排站着，用来检验皮影的样子
import { drawPuppet, rest, walkPose } from '../puppet.js';
import * as C from '../cast.js';

export default function sheet(args) {
  const list = args.list || ['ZFY_CHILD', 'ZFY', 'MBC', 'OLD', 'GENIUS', 'BRIDE', 'DEMI_GUARD', 'SLAVE', 'NOBLE1', 'ZFY_OFFICER'];
  const get = (n) => (n === 'NOBLE1' ? C.NOBLE(1) : n === 'DEMI_GUARD' ? C.DEMI_GUARD(0) : n === 'SLAVE' ? C.SLAVE(0) : C[n]);
  return {
    frame(t) {
      const zoom = args.zoom || 1;
      return {
        cam: { x: args.cx ?? 117.5, y: args.cy ?? 50, zoom },
        light: { amb: [60, 40, 26], lamps: [{ x: 117.5, y: 60, r: 170, col: [255, 222, 168], k: 1 }] },
        layers: [{ d: 0, draw: (ctx) => {
          list.forEach((n, i) => {
            const P = get(n);
            const pose = args.walk ? walkPose(t * 0.8 + i * 0.13) : { ...rest(), aF: -0.25 + 0.1 * Math.sin(t + i), eF: 0.6, head: 0.05 };
            drawPuppet(ctx, P, pose, { x: 14 + i * 23, y: 8, s: P.child ? 0.5 : 0.62, face: i % 2 ? -1 : 1, t, hold: n === 'MBC' || n === 'GENIUS' ? { F: { kind: 'sword', ang: 2.2 } } : n === 'DEMI_GUARD' ? { F: { kind: 'spear', ang: 0 } } : {} });
          });
        } }],
        grade: { exposure: 1.0, contrast: 1.05, sat: 1.0 },
      };
    },
  };
}
