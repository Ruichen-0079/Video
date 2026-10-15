// 海边：年幼的皇女站在潮线上；一个老人走来，摸了摸她的头。（设定：【画面】）
import { Actor, figureGroups } from '../actor.js';
import { Geo, grid } from '../mesh.js';
import { rock } from '../props.js';
import { mesh } from '../gl.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, translate, mmul, scaleM, noise2, fbm2, easeInOut, clamp } from '../math.js';
import { walkCycle as walk } from '../figure.js';

export const GIRL = {
  height: 1.12, sex: 'f', age: 'child', hair: 'twin', sleeve: 'wide',
  colors: { skin: [0.86, 0.71, 0.62], robe: [0.78, 0.76, 0.72], robe2: [0.16, 0.22, 0.38], inner: [0.88, 0.86, 0.82], hair: [0.04, 0.035, 0.035], belt: [0.5, 0.16, 0.14], shoe: [0.28, 0.1, 0.09] },
};
export const OLD = {
  height: 1.68, sex: 'm', age: 'old', hair: 'topknot', sleeve: 'wide', beard: 1,
  colors: { skin: [0.76, 0.6, 0.48], robe: [0.40, 0.37, 0.32], robe2: [0.28, 0.25, 0.21], inner: [0.72, 0.69, 0.63], hair: [0.84, 0.82, 0.78], belt: [0.22, 0.18, 0.14], shoe: [0.12, 0.1, 0.08] },
};

export default function seaside(R) {
  const groundY = (x, z) => 0.045 * z + 0.02 * fbm2(x * 0.6, z * 0.6) + 0.006 * Math.sin(x * 4 + z * 2.5 + fbm2(x, z) * 3);
  const waterY = -0.13;
  // 沙滩：湿沙近水更暗
  const beach = grid(40, 16, 200, 80, groundY, (x, z, y) => {
    const wet = clamp((y - waterY) / 0.12);
    const n = 0.06 * fbm2(x * 3, z * 3);
    const dry = [0.62 + n, 0.55 + n, 0.46 + n], wetc = [0.34, 0.31, 0.27];
    const c = [lerp(wetc[0], dry[0], wet), lerp(wetc[1], dry[1], wet), lerp(wetc[2], dry[2], wet)];
    return [...c, lerp(0.25, 0.95, wet)];
  }, null, -20, -9).upload();
  // 海：近密远疏
  const P = [], I = []; const nx = 220, nz = 140;
  for (let j = 0; j <= nz; j++) { const v = j / nz; const z = -1.8 - (Math.exp(v * 5.6) - 1) * 1.2; for (let i = 0; i <= nx; i++) P.push(-120 + (i / nx) * 240, 0, z); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; I.push(a, c, d, a, d, b); }
  const sea = mesh(['p'], { p: { data: new Float32Array(P), size: 3 } }, new Uint32Array(I));
  // 远处的礁石
  const rocks = new Geo();
  [[-30, -150, 9], [-18, -160, 5], [40, -170, 12], [55, -150, 4], [-6, -40, 1.6], [9, -26, 0.9]].forEach(([x, z, r], k) => rocks.add(rock(r, 11 + k, [0.18, 0.17, 0.17]), translate([x, waterY - r * 0.1, z])));
  const rocksM = rocks.upload();

  const girl = new Actor(GIRL, { skirt: { len: 0.96, flare: 1.5, color: GIRL.colors.robe, color2: GIRL.colors.robe2, rx: 0.13, rz: 0.11 }, sleeves: { width: 0.15, color: GIRL.colors.robe, color2: GIRL.colors.robe2 } });
  const old = new Actor(OLD, { skirt: { len: 0.95, flare: 1.9, color: OLD.colors.robe, color2: OLD.colors.robe2 }, sleeves: { width: 0.13, color: OLD.colors.robe, color2: OLD.colors.robe2 } });
  const gs = girl.s;
  const girlPos = [0.35, 0, -1.55];
  const stopX = 0.0;
  const sunDir = norm([0.62, 0.1, -0.78]);

  return {
    frame(t, dt) {
      const wind = [0.6, 0, 0.25];
      // 女孩：望着海，手垂着；被摸头时抬头
      const look = smooth(4.1, 5.0, t);
      const gy = groundY(girlPos[0], girlPos[2]);
      girl.update({
        pos: [girlPos[0], gy + girl.T.body.J.pelvis[1] - 0.005 + Math.sin(t * 1.7) * 0.002, girlPos[2]], yaw: Math.PI - 0.35 - look * 0.55,
        lean: [-0.04, 0, 0], head: [-0.05 - look * 0.42, look * 0.3, look * 0.1],
        handL: add([girlPos[0], 0, girlPos[2]], [0.1, gy + 0.5, 0.02]), handR: add([girlPos[0], 0, girlPos[2]], [-0.04, gy + 0.5, -0.12]),
        footL: [girlPos[0] + 0.07, gy + 0.06, girlPos[2] - 0.02], footR: [girlPos[0] - 0.06, gy + 0.06, girlPos[2] + 0.05],
      }, dt, { wind, t, ground: gy });
      // 老人：从左边慢慢走来（0–3.4 秒），停下，俯身，抬手放到她头上
      const walkDist = 2.6 * smoother(0, 3.6, t);
      const base = [stopX - 2.6, 0, -1.25];
      const wc = walk(old.T.body.J, base, [1, 0, 0], walkDist, { stride: 0.46, lift: 0.045, bob: 0.018 });
      const stand = smooth(3.2, 3.7, t);
      const pel = wc.pelvis;
      const oy = groundY(pel[0], pel[2]);
      const reach = smoother(3.8, 4.7, t);
      const headTop = add(girl.W.headTop, [0, 0.015, 0]);
      const handPat = add(headTop, [Math.sin(t * 2.2) * 0.008 * smooth(4.7, 5.2, t), 0, 0]);
      const restHand = add(pel, [0.05, -0.42, -0.12]);
      old.update({
        pos: [pel[0], pel[1] + oy - 0.03 - reach * 0.05, pel[2]], yaw: Math.PI / 2 + stand * 0.25,
        lean: [0.18 + reach * 0.22, 0, 0], head: [0.15 + reach * 0.25, -stand * 0.15, 0],
        // 她在他的左手边：用左手摸她的头，右手背在身后
        handL: reach > 0.001 ? add(mul(restHand, 1 - reach), mul(handPat, reach)) : null,
        elbowL: [-0.2, -0.6, -0.5], palmL: [0, -1, 0],
        handR: add(pel, [-0.12, -0.12, 0.2]),
        footL: add(wc.footL, [0, groundY(wc.footL[0], wc.footL[2]), 0]), footR: add(wc.footR, [0, groundY(wc.footR[0], wc.footR[2]), 0]),
      }, dt, { wind, t, ground: oy });
      // 镜头：低机位，缓慢推近
      const cp = keyed([[0, [1.55, 0.62, 2.9]], [7.5, [1.05, 0.72, 1.6]]], t);
      const ct = keyed([[0, [-0.35, 0.78, -1.5]], [7.5, [0.05, 0.86, -1.45]]], t);
      return {
        cam: { pos: cp, target: ct, fov: 34, dof: { focus: Math.hypot(...sub(cp, [0.1, 0.8, -1.45])), aperture: 0.09, maxR: 6 } },
        sun: { dir: sunDir, col: [1.5, 1.0, 0.68], shadow: { center: [0, 0.6, -1.4], radius: 3.5, soft: 2 } },
        amb: { sky: [0.17, 0.2, 0.27], gnd: [0.12, 0.1, 0.08] }, rim: [0.32, 0.2, 0.12],
        sky: { top: [0.16, 0.21, 0.32], hor: [0.85, 0.62, 0.46], gnd: [0.3, 0.25, 0.22], sunDisc: [0.99955, 18, 0.7, 10], clouds: 0.75, cloudCol: [0.36, 0.33, 0.36], cloudY: 1.4 },
        fog: { density: 0.008, falloff: 0.3, base: -0.2, max: 0.75, col: [0.6, 0.55, 0.52], sunCol: [0.85, 0.5, 0.28] },
        items: [{ mesh: beach }, { mesh: rocksM }, ...girl.items(), ...old.items()],
        figures: figureGroups([girl, old]),
        water: { mesh: sea, y: waterY, waves: [[0.1, 1, 0.035, 3.2], [0.5, 1, 0.02, 1.7], [-0.4, 1, 0.012, 1.1], [0.2, 1, 0.006, 0.6]], deep: [0.05, 0.08, 0.1], shallow: [0.2, 0.24, 0.22], shore: [0, 0.045, 0, 1], foam: 1 },
        grade: { exposure: 0.94, sat: 0.92, contrast: 1.12, gain: [1.02, 1.0, 0.97], lift: [0.0, 0.006, 0.014], vignette: 0.5, grain: 0.03, bloom: 0.5 },
      };
    },
  };
}
