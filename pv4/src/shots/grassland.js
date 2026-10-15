// 万花洲：她仰面睡在草里；他穿过草原走来，停在她身边。（设定 12.2，已进入正文）
// part a：远景，摇臂缓缓降下；part b：低机位，他立在逆光里，她转过头
// part c：两人坐在草里说话（「明布川？听起来像狗的名字。」）
import { kneel } from '../poses.js';
import { Actor, figureGroups } from '../actor.js';
import { grid, Geo } from '../mesh.js';
import { grassField, flowerField } from '../renderer.js';
import { jian } from '../props.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, noise2, rng, qaxis, qmul, clamp, translate, mmul, rotY, rotZ } from '../math.js';
import { walkCycle as walk, frame } from '../figure.js';
import { ZFY, MBC } from '../cast.js';

const H = (x, z) => 2.2 * fbm2(x * 0.018 + 3, z * 0.018 + 1) + 0.5 * fbm2(x * 0.07, z * 0.07) - 0.05 * Math.exp(-(x * x + z * z) / 30);

export default function grassland(R, args) {
  const part = args.part || 'a';
  const R0 = rng(7);
  // 地形：远处起伏的丘陵
  const terrain = grid(400, 400, 160, 160, H, (x, z, y) => {
    const n = fbm2(x * 0.05, z * 0.05);
    return [0.26 + 0.06 * n, 0.3 + 0.05 * n, 0.12, 0.95];
  }, null, -200, -200).upload();
  const cx = part === 'a' ? 0.5 : 0, cz = part === 'a' ? 1.5 : 0, rad = part === 'a' ? 15 : 6;
  const gy = H(cx, cz);
  const nest = (x, z) => Math.exp(-(((x - 0.15) * (x - 0.15)) / 1.3 + (z * z) / 0.55));     // 她躺的地方草矮一些
  // 花：成片、多种颜色（万花），每朵有茎
  const FL = [[0.95, 0.85, 0.82], [0.92, 0.6, 0.68], [0.98, 0.86, 0.4], [0.75, 0.6, 0.9], [0.95, 0.95, 0.92], [0.92, 0.42, 0.32]];
  const fl = [];
  for (let i = 0; i < 14000; i++) {
    const r = Math.sqrt(R0()) * rad, a = R0() * Math.PI * 2;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const patch = fbm2(x * 0.25 + 7, z * 0.25);
    if (patch < -0.05 && R0() < 0.85) continue;
    const c = FL[Math.floor((patch * 3 + 3 + R0() * 1.5) % FL.length + FL.length) % FL.length];
    const h = (0.22 + 0.36 * R0()) * (1 - 0.5 * nest(x, z));
    fl.push({ x, z, h, c, s: 0.02 + 0.016 * R0(), sd: R0() });
  }
  // 她躺着的地方（a、b）不长花，免得花从她身上穿出来（事后过滤，不改变随机序列）
  if (part !== 'c') for (let i = fl.length - 1; i >= 0; i--) { const f = fl[i]; if (f.x > -1.05 && f.x < 1.1 && Math.abs(f.z) < 0.36) fl.splice(i, 1); }
  const flowers = flowerField(fl.length, (i) => ({ a: [fl[i].x, gy + fl[i].h, fl[i].z, fl[i].s], b: [...fl[i].c, fl[i].sd] }));
  // 草：近处密、远处疏；花茎也是草叶
  const N = part === 'a' ? 170000 : 110000;
  const grass = grassField(N + fl.length, (i) => {
    if (i >= N) { const f = fl[i - N]; return { a: [f.x, f.z, f.h, 0.5], b: [0.28, 0.4, 0.14, 0.004] }; }
    const r = Math.sqrt(R0()) * rad, a = R0() * Math.PI * 2;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = (0.42 + 0.35 * R0() + 0.25 * fbm2(x * 0.3, z * 0.3)) * (1 - 0.75 * nest(x, z));
    const v = R0();
    const col = [0.32 + 0.1 * v, 0.4 + 0.1 * v, 0.14 + 0.05 * R0()];
    return { a: [x, z, h, R0()], b: [...col, 0.011 + 0.007 * R0()] };
  });
  // 她的剑
  const swordM = jian().upload();
  const zfy = new Actor(ZFY, { skirt: { len: 0.95, flare: 1.7, color: ZFY.colors.robe, color2: ZFY.colors.robe2 }, sleeves: { width: 0.14, color: ZFY.colors.robe, color2: ZFY.colors.robe2 }, hair: { len: 0.62, color: ZFY.colors.hair, nx: 7, ny: 11 } });
  const mbc = new Actor(MBC, { skirt: { len: 0.95, flare: 1.9, color: MBC.colors.robe, color2: MBC.colors.robe2 }, sleeves: { width: 0.14, color: MBC.colors.robe, color2: MBC.colors.robe2 } });
  const sunDir = norm([-0.75, 0.14, -0.55]);
  // 她躺着：身体沿 x 轴，头朝 -x
  const lieQ = qmul(qaxis([0, 0, 1], -Math.PI / 2 + 0.04), qaxis([0, 1, 0], Math.PI / 2));

  return {
    frame(t, dt) {
      const wind = [0.9, 0, 0.35];
      const env = { wind: [0.6, 0, 0.25], t, ground: gy };
      const zs = zfy.s;
      let camPos, camTgt, fov = 30, focus, ap = 0.06;
      if (part === 'a' || part === 'b') {
        // 她：仰面躺着，一只手搭在腹前，一只手摊在草里
        const turn = part === 'b' ? smoother(2.6, 3.6, t) : 0;
        const pel = [0.1, gy + 0.11, 0.0];
        const up = [-1, 0, 0];   // 身体的「上」朝 -x（头的方向）
        zfy.update({
          pos: pel, rootQ: lieQ, lean: [0, 0, 0], head: [-0.15, -turn * 0.6, 0],
          handL: add(pel, [-0.18, 0.12, 0.05]), elbowL: [0, 1, 0.4],
          handR: add(pel, [-0.2, 0.0, -0.38]), elbowR: [0, -0.3, -1],
          footL: add(pel, [0.82, -0.04, 0.08]), footR: add(pel, [0.8, -0.04, -0.12]), kneeL: [0, 1, 0], kneeR: [0, 1, 0],
        }, dt, env);
        // 他：从远处走来（a），停在她身边俯视（b）
        let pos, yaw, footL, footR, head = [0.15, 0, 0], lean = [0.05, 0, 0];
        if (part === 'a') {
          const base = [-2.6, 0, 3.6]; const dir = norm(sub([0.55, 0, 0.75], base));
          const d = 3.6 * smoother(0, 6.4, t) + 0.3 * t;
          const wc = walk(mbc.T.body.J, base, dir, Math.min(d, len2(sub([0.55, 0, 0.75], base))), { stride: 0.5, lift: 0.04 });
          pos = add(wc.pelvis, [0, gy, 0]); yaw = Math.atan2(dir[0], dir[2]); footL = add(wc.footL, [0, gy, 0]); footR = add(wc.footR, [0, gy, 0]);
        } else {
          const p0 = [-0.95, 0, 0.62];
          pos = [p0[0], gy + mbc.T.body.J.pelvis[1] - 0.01, p0[2]]; yaw = Math.atan2(0.25, -0.62);
          footL = [p0[0] + 0.08, gy + 0.085, p0[2] + 0.06]; footR = [p0[0] - 0.12, gy + 0.085, p0[2] + 0.02];
          head = [0.55, 0.1, 0]; lean = [0.12, 0, 0];
        }
        if (part === 'b') {
          // 他在她身边蹲下来，单膝着地，看着她
          const k = smoother(0.5, 2.1, t);
          const kp = kneel(mbc.T.body.J, [-0.95, gy, 0.62], yaw, k, { lean: [0.12 + 0.2 * k, 0, 0], head: [0.35 + 0.25 * k, 0, 0], handR: [-0.2, 0.62 - 0.1 * k, 0.32 * k] });
          mbc.update(kp, dt, env);
        } else mbc.update({ pos, yaw, lean, head, footL, footR, handL: null, handR: null }, dt, env);
        if (part === 'a') {
          camPos = keyed([[0, [6.2, gy + 4.6, 6.4]], [6.5, [3.6, gy + 2.6, 3.9]]], t); camTgt = keyed([[0, [-0.3, gy + 0.2, 0.6]], [6.5, [0.0, gy + 0.3, 0.4]]], t); fov = 32;
        } else {
          // 她躺在近处的花里，他在她身边蹲下
          const B = args.bc || [1.5, 1.35, -2.4, -0.55, 0.48, 0.3, 30];
          camPos = keyed([[0, [B[0], gy + B[1], B[2]]], [6, [B[0] - 0.12, gy + B[1] + 0.02, B[2] + 0.3]]], t); camTgt = [B[3], gy + B[4], B[5]]; fov = B[6];
        }
      } else {
        // part c：并肩坐在草里，她扭头笑他
        const pz = [0, gy, 0];
        const sitQ = qaxis([0, 1, 0], 0.4);
        zfy.update({ pos: add(pz, [0.35, 0.16, 0]), yaw: 0.35, lean: [0.35, 0, 0.1 + smooth(2, 2.6, t) * 0.25], head: [0.05, -smoother(2.0, 2.6, t) * 0.7, smooth(2.4, 3, t) * 0.12],
          footL: add(pz, [0.5, 0.06, 0.5]), footR: add(pz, [0.3, 0.06, 0.55]), kneeL: [0, 1, 0.3], kneeR: [0, 1, 0.3], handL: add(pz, [0.62, 0.42, 0.42]), handR: add(pz, [0.18, 0.06, 0.05]) }, dt, env);
        mbc.update({ pos: add(pz, [-0.4, 0.17, 0.05]), yaw: 0.3, lean: [0.25, 0, 0], head: [0.1, smooth(3.0, 3.6, t) * 0.4, 0],
          footL: add(pz, [-0.2, 0.06, 0.62]), footR: add(pz, [-0.42, 0.06, 0.66]), kneeL: [0.2, 1, 0.3], kneeR: [-0.1, 1, 0.3], handL: add(pz, [-0.1, 0.55, 0.5]), handR: add(pz, [-0.75, 0.06, -0.1]) }, dt, env);
        camPos = keyed([[0, [0.25, gy + 0.9, 3.4]], [6, [0.05, gy + 0.85, 3.0]]], t); camTgt = [0, gy + 0.55, 0.1]; fov = 30;
      }
      focus = Math.hypot(...sub(camPos, part === 'c' ? [0, gy + 0.6, 0] : part === 'b' ? [-0.85, gy + 0.8, 0.3] : [0.3, gy + 0.3, 0.2]));
      // 剑放在她身边的草里
      const swM = mmul(translate([-0.15, gy + 0.03, 0.42]), mmul(rotY(0.15), rotZ(-Math.PI / 2)));
      return {
        cam: { pos: camPos, target: camTgt, fov, dof: { focus, aperture: part === 'a' ? 0.04 : ap, maxR: 7 } },
        sun: { dir: sunDir, col: [2.0, 1.45, 0.85], shadow: { center: part === 'a' ? [1, gy + 0.5, 1] : [0.2, gy + 0.6, 0.2], radius: part === 'a' ? 6 : 2.6, soft: 2 } },
        amb: { sky: [0.22, 0.24, 0.3], gnd: [0.14, 0.13, 0.08] }, rim: [0.45, 0.3, 0.16],
        sky: { top: [0.2, 0.3, 0.48], hor: [1.0, 0.72, 0.45], gnd: [0.35, 0.3, 0.2], sunDisc: [0.99955, 26, 1.2, 9], clouds: 0.55, cloudCol: [0.75, 0.55, 0.45], cloudY: 1.2 },
        fog: { density: 0.006, falloff: 0.08, base: gy, max: 0.8, col: [0.75, 0.62, 0.48], sunCol: [1.0, 0.62, 0.3] },
        items: [{ mesh: terrain }, { mesh: swordM, model: swM }, ...zfy.items(), ...mbc.items()],
        figures: figureGroups([zfy, mbc]),
        grass: { mesh: grass.mesh, n: grass.n, wind: [wind[0], wind[2]], gust: 0.8, groundY: gy },
        flowers,
        shafts: { strength: part === 'b' ? 0.15 : 0.3, col: [1.0, 0.75, 0.45] },
        grade: { exposure: 0.95, sat: 0.95, contrast: 1.05, gain: [1.03, 1.0, 0.95], lift: [0.01, 0.008, 0.0], vignette: 0.4, grain: 0.03, bloom: 0.6 },
      };
    },
  };
}
const len2 = (v) => Math.hypot(v[0], v[1], v[2]);
