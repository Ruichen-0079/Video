// 旧世：晨雾里的御道。人类奴隶抬着轿子，长角、狐耳、拖着尾巴的亚人贵族走在旁边，远处是层层台基上的宫殿。
// part a：远景横移；part b：贴着轿杠的跟拍（奴隶弯着的背 vs 贵族挺直的身子）；part c：狐耳贵妇把耳朵和尾巴藏起来
import { Actor, figureGroups } from '../actor.js';
import { Geo, box, grid } from '../mesh.js';
import { hall, terrace } from '../env.js';
import { palanquin, spear, segModel, unitCyl, pole } from '../props.js';
import { Cloth } from '../cloth.js';
import { add, sub, mul, norm, lerp, smooth, smoother, keyed, fbm2, rng, translate, mmul, rotY, clamp } from '../math.js';
import { walkCycle as walk } from '../figure.js';
import { NOBLE, DEMI_GUARD, SLAVE } from '../cast.js';

export default function procession(R, args) {
  const part = args.part || 'a';
  const R0 = rng(21);
  const roadY = 0.7;
  const ground = grid(600, 600, 120, 120, (x, z) => 0.6 * fbm2(x * 0.02, z * 0.02) - (Math.abs(x) < 6 ? 0 : 0.1), (x, z) => {
    const n = fbm2(x * 0.08, z * 0.08); return [0.42 + 0.05 * n, 0.38 + 0.04 * n, 0.3, 0.95];
  }, null, -300, -400).upload();
  // 御道：抬高的石路，路面是大石板
  const road = new Geo();
  road.add(box(6, roadY, 400, [0.52, 0.5, 0.46, 0.9]), translate([0, roadY / 2, -150]));
  for (let k = 0; k < 140; k++) {
    road.add(box(5.9, 0.02, 0.06, [0.3, 0.28, 0.26, 0.9]), translate([0, roadY + 0.005, 40 - k * 2.4]));
    for (let q = 0; q < 3; q++) { const v = 0.85 + 0.25 * R0(); road.add(box(1.94, 0.012, 2.3, [0.5 * v, 0.48 * v, 0.44 * v, 0.85]), translate([-1.97 + q * 1.97, roadY + 0.004, 38.8 - k * 2.4])); }
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 40; k++) road.add(box(0.25, 0.5, 0.25, [0.6, 0.58, 0.53, 0.9]), translate([sx * 2.85, roadY + 0.25, 40 - k * 9]));
  const roadM = road.upload();
  // 远处的宫殿：三层台基 + 大殿
  const pal = new Geo();
  pal.add(terrace(90, 60, 3, 4.5), translate([0, 0, -190]));
  pal.add(hall(40, 18, 9, { bays: 9, base: 1.2 }), mmul(translate([0, 13.5, -195]), rotY(0)));
  pal.add(hall(22, 12, 7, { bays: 5, base: 0.8 }), translate([-38, 4.5, -185]));
  pal.add(hall(22, 12, 7, { bays: 5, base: 0.8 }), translate([38, 4.5, -185]));
  const palM = pal.upload();
  // 旗：路两边的长幡
  const flags = [];
  for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) {
    const x = sx * 3.6, z = 10 - k * 14, h = 7;
    const c = new Cloth(6, 14, (i, j) => [x, h - 0.2 - j * 0.28, z + i * 0.12], { color: [0.3, 0.05, 0.05, 0.9], colorFn: (u, v) => (v > 0.9 ? [0.6, 0.45, 0.2, 0.8] : [0.3, 0.05, 0.05, 0.9]), damping: 0.97 });
    for (let i = 0; i < 6; i++) c.setPin(i, 0, [x, h - 0.2, z + i * 0.12]);
    flags.push({ c, pole: pole(h), x, z });
  }
  const poleM = pole(7).upload();
  // 轿子与奴隶
  const palM2 = palanquin().upload();
  const cyl = unitCyl([0.22, 0.15, 0.1, 0.7]).upload();
  const iron = unitCyl([0.18, 0.17, 0.16, 0.4]).upload();
  const spearM = spear().upload();
  const bundleM = box(0.5, 0.42, 0.34, [0.4, 0.34, 0.24, 0.95]).upload();
  const slaves = [0, 1, 2, 3].map((k) => new Actor(SLAVE(k), {}));
  const porters = [4, 5].map((k) => new Actor(SLAVE(k), {}));
  const guards = [0, 1].map(() => new Actor(DEMI_GUARD('ox'), {}));
  const noble = new Actor(NOBLE('antler', null, [0.16, 0.2, 0.3], [0.62, 0.5, 0.24]), { skirt: { len: 0.95, flare: 1.8, color: [0.16, 0.2, 0.3], color2: [0.62, 0.5, 0.24] }, sleeves: { width: 0.15, color: [0.16, 0.2, 0.3], color2: [0.62, 0.5, 0.24] } });
  const FOX = { ...NOBLE(null, 'fox', [0.62, 0.36, 0.3], [0.85, 0.8, 0.7]), sex: 'f', height: 1.64, hair: 'bun', colors: { ...NOBLE(null, 'fox', [0.62, 0.36, 0.3], [0.85, 0.8, 0.7]).colors, hair: [0.42, 0.22, 0.12] } };
  const fox = new Actor(FOX, { skirt: { len: 0.95, flare: 1.8, color: [0.62, 0.36, 0.3], color2: [0.85, 0.8, 0.7] }, sleeves: { width: 0.12, color: [0.62, 0.36, 0.3], color2: [0.85, 0.8, 0.7] }, tail: { len: 0.9, w: 0.07, color: [0.62, 0.34, 0.16], tip: [0.92, 0.9, 0.86] } });
  const sunDir = part === 'b' ? norm([-0.85, 0.1, -0.5]) : norm([0.18, 0.13, -0.97]);
  const speed = 0.8;

  return {
    frame(t, dt) {
      const env = { wind: [0.4, 0, 0.1], t, ground: roadY };
      // 队伍沿 -z 前进
      const z0 = (part === 'c' ? 6 : 8) - speed * t;
      const items = [{ mesh: ground }, { mesh: roadM }, { mesh: palM, noShadow: true }];
      for (const f of flags) { if (dt > 0) f.c.step(dt, { force: (p) => [0.6 + 0.8 * Math.sin(t * 1.3 + f.z), 0, 1.5 + Math.sin(t * 2.1 + f.z * 0.3)], gravity: -6, iters: 6 }); else for (let k = 0; k < 30; k++) f.c.step(1 / 30, { force: () => [0.6, 0, 1.5], gravity: -6, iters: 6 }); f.c.upload(); items.push({ mesh: f.c.mesh, twoSided: true }, { mesh: poleM, model: translate([f.x, 0, f.z]) }); }
      // 抬轿：四人，弯腰
      const bob = Math.abs(Math.sin(t * speed / 0.46 * Math.PI)) * 0.02;
      const pc = [0.0, roadY + 1.25 - bob, z0 - 2.5];
      const poleY = roadY + 1.38 - bob;
      const bearers = [[-0.45, 1.25], [0.45, 1.25], [-0.45, -1.25], [0.45, -1.25]];
      slaves.forEach((a, k) => {
        const [bx, bz] = bearers[k];
        const off = (k % 2) * 0.23;
        const wc = walk(a.T.body.J, [pc[0] + bx, 0, pc[2] + bz + speed * t + off], [0, 0, -1], speed * t + off, { stride: 0.46, lift: 0.05 });
        a.update({ pos: [pc[0] + bx, wc.pelvis[1] + roadY - 0.06, pc[2] + bz], yaw: Math.PI, lean: [0.42, 0, 0], head: [0.25, 0, 0], shrug: 1,
          handL: [pc[0] + bx + 0.02, poleY + 0.02, pc[2] + bz - 0.1], handR: [pc[0] + bx - 0.02, poleY + 0.02, pc[2] + bz + 0.12],
          footL: add(wc.footL, [0, roadY, 0]), footR: add(wc.footR, [0, roadY, 0]) }, dt, env);
      });
      for (const sx of [-0.45, 0.45]) items.push({ mesh: cyl, model: segModel([sx, poleY, pc[2] + 2.0], [sx, poleY, pc[2] - 2.0], 0.035) });
      items.push({ mesh: palM2, model: translate([pc[0], pc[1] - 0.55, pc[2]]) });
      // 背东西的奴隶，脚镣
      porters.forEach((a, k) => {
        const zz = z0 + 0.8 + k * 1.3, xx = k ? -0.9 : 0.8;
        const wc = walk(a.T.body.J, [xx, 0, zz + speed * t], [0, 0, -1], speed * t + k * 0.3, { stride: 0.42, lift: 0.04 });
        a.update({ pos: add(wc.pelvis, [0, roadY - 0.07, 0]), yaw: Math.PI, lean: [0.6, 0, 0], head: [0.1, 0, 0], handL: add(wc.pelvis, [0.2, 0.35, -0.25]), handR: add(wc.pelvis, [-0.2, 0.35, -0.25]), footL: add(wc.footL, [0, roadY, 0]), footR: add(wc.footR, [0, roadY, 0]) }, dt, env);
        items.push({ mesh: bundleM, model: translate(add(a.W.chest, [0, 0.05, 0.22])) });
      });
      // 每个奴隶的脚镣：两个铁环 + 一段下垂的链
      for (const a of [...slaves, ...porters]) {
        const L = a.W.ankleL, Rr = a.W.ankleR; const mid = add(mul(add(L, Rr), 0.5), [0, -0.06, 0]);
        items.push({ mesh: iron, model: segModel(add(L, [0, -0.02, 0]), add(L, [0, 0.03, 0]), 0.055) }, { mesh: iron, model: segModel(add(Rr, [0, -0.02, 0]), add(Rr, [0, 0.03, 0]), 0.055) });
        items.push({ mesh: iron, model: segModel(L, mid, 0.008) }, { mesh: iron, model: segModel(mid, Rr, 0.008) });
      }
      // 亚人卫兵（牛角）在前，持矛
      guards.forEach((a, k) => {
        const xx = k ? -1.0 : 1.0, zz = z0 - 6.2;
        const wc = walk(a.T.body.J, [xx, 0, zz + speed * t], [0, 0, -1], speed * t + k * 0.4, { stride: 0.6, lift: 0.06 });
        const pel = add(wc.pelvis, [0, roadY, 0]);
        const hR = add(pel, [xx > 0 ? -0.28 : 0.28, 0.12, -0.05]);
        a.update({ pos: pel, yaw: Math.PI, lean: [-0.02, 0, 0], handR: hR, elbowR: [0, -1, 0.3], footL: add(wc.footL, [0, roadY, 0]), footR: add(wc.footR, [0, roadY, 0]) }, dt, env);
        items.push({ mesh: spearM, model: translate(add(hR, [0, -0.1, 0])) });
      });
      // 贵族：长鹿角的男子走在轿旁；狐耳贵妇在后
      {
        const wc = walk(noble.T.body.J, [1.55, 0, z0 - 2.0 + speed * t], [0, 0, -1], speed * t, { stride: 0.55, lift: 0.05 });
        noble.update({ pos: add(wc.pelvis, [0, roadY, 0]), yaw: Math.PI, lean: [-0.06, 0, 0], head: [-0.08, part === 'b' ? -0.25 : 0, 0], handL: add(wc.pelvis, [-0.06, roadY + 0.02, -0.2]), handR: add(wc.pelvis, [0.06, roadY + 0.02, -0.2]), footL: add(wc.footL, [0, roadY, 0]), footR: add(wc.footR, [0, roadY, 0]) }, dt, env);
      }
      {
        const fz = part === 'c' ? 4.8 - 0.55 * t : z0 + 3.4;
        const fdir = part === 'c' ? [0, 0, -1] : [0, 0, -1];
        const wc = walk(fox.T.body.J, [part === 'c' ? -2.8 : -1.4, 0, fz + (part === 'c' ? 0.55 * t : speed * t)], fdir, part === 'c' ? 0.55 * t : speed * t, { stride: 0.42, lift: 0.04 });
        fox.featureFade = part === 'c' ? smooth(1.6, 3.6, t) : 0;
        fox.update({ pos: add(wc.pelvis, [0, roadY, 0]), yaw: Math.PI, lean: [-0.04, 0, 0], head: [part === 'c' ? 0.12 : 0, part === 'c' ? -0.25 * smooth(1.2, 2.4, t) : 0, 0], handL: add(wc.pelvis, [0.035, roadY + 0.14, -0.22]), handR: add(wc.pelvis, [-0.035, roadY + 0.16, -0.22]), elbowL: [1, -0.5, 0.3], elbowR: [-1, -0.5, 0.3], footL: add(wc.footL, [0, roadY, 0]), footR: add(wc.footR, [0, roadY, 0]) }, dt, env);
      }
      const actors = [...slaves, ...porters, ...guards, noble, fox];
      for (const a of actors) items.push(...a.items());
      const groups = figureGroups(actors);
      const foxG = groups.find((g) => g.mesh === fox.T.mesh); if (foxG) foxG.dissolve = fox.featureFade;
      // 镜头
      let cam;
      if (part === 'a') {
        const cp = keyed([[0, [5.5, 1.5, 15]], [6.5, [4.6, 2.3, 11.5]]], t);
        cam = { pos: cp, target: keyed([[0, [0.5, 2.6, -14]], [6.5, [0.3, 3.4, -18]]], t), fov: 32, dof: { focus: 12, aperture: 0.03 } };
      } else if (part === 'b') {
        const zc = z0 - 2.0;
        cam = { pos: keyed([[0, [9.5, 0.35, zc + 1.5]], [5, [9.2, 0.4, zc - 0.5]]], t), target: [0, roadY + 1.3, zc - 1.0], fov: 30, dof: { focus: 9.5, aperture: 0.04 } };
      } else {
        const fp = fox.W.head;
        // 侧面跟拍：耳朵与尾巴的轮廓清楚，身后的仪仗虚成一片
        const C = args.c || [-3.0, 0.4, -0.4, 24];
        const cpos = add(fox.W.pelvis, [C[0], C[1], C[2]]);
        cam = { pos: cpos, target: add(fox.W.pelvis, [0, 0.36, -0.75]), fov: C[3], dof: { focus: Math.hypot(...sub(fox.W.pelvis, cpos)), aperture: 0.9, maxR: 9 } };
      }
      return {
        cam,
        sun: { dir: sunDir, col: [1.8, 1.35, 0.9], shadow: { center: [0, roadY + 1, z0 - 1.5], radius: 7, soft: 2 } },
        amb: { sky: [0.13, 0.15, 0.19], gnd: [0.1, 0.085, 0.07] }, rim: [0.55, 0.38, 0.22],
        sky: { top: [0.2, 0.26, 0.36], hor: [0.8, 0.66, 0.5], gnd: [0.3, 0.26, 0.22], sunDisc: [0.9996, 16, 1.0, 10], clouds: 0.35, cloudCol: [0.5, 0.46, 0.44] },
        fog: { density: 0.0085, falloff: 0.035, base: 0, max: 0.9, col: [0.42, 0.42, 0.42], sunCol: [1.0, 0.7, 0.4] },
        items: items.filter((i) => i && i.mesh),
        figures: groups,
        shafts: { strength: part === 'a' ? 0.35 : 0.15, col: [1.0, 0.85, 0.6] },
        grade: { exposure: 1.0, sat: 0.85, contrast: 1.1, gain: [1.02, 0.99, 0.94], lift: [0.005, 0.008, 0.014], vignette: 0.5, grain: 0.035, bloom: 0.55 },
      };
    },
  };
}
