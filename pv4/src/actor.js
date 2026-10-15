// 演员：身体（蒙皮网格）+ 裙摆（布）+ 长发（布）+ 尾巴（布）+ 手中之物
import { gl, mesh } from './gl.js';
import { buildBody, solvePose, skinMatrices, NB, frame } from './figure.js';
import { Cloth } from './cloth.js';
import { add, sub, mul, norm, cross, len, lerp, qrot, qaxis, xform, dot, clamp } from './math.js';

const typeCache = new Map();
export function figureType(P) {
  const key = JSON.stringify(P);
  if (typeCache.has(key)) return typeCache.get(key);
  const body = buildBody(P);
  const g = body.geo;
  const m = mesh(['p', 'n', 'c', 'm', 'bi', 'bw'], {
    p: { data: new Float32Array(g.p), size: 3 }, n: { data: new Float32Array(g.n), size: 3 },
    c: { data: new Float32Array(g.c), size: 4 }, m: { data: new Float32Array(g.m), size: 4 },
    bi: { data: body.bi, size: 4, int: true }, bw: { data: body.bw, size: 4 },
  }, new Uint32Array(g.i));
  const T = { body, mesh: m, P };
  typeCache.set(key, T);
  return T;
}

export class Actor {
  // opts: { skirt:{len, flare, color, color2}, hair:{len, width, color}, tail:{len, r, color}, sash:{...} }
  constructor(P, opts = {}) {
    this.T = figureType(P);
    this.P = P; this.opts = opts;
    this.mats = new Float32Array(NB * 16);
    this.cloths = [];
    this.inited = false;
    this.s = this.T.body.J._s;
  }
  // 由姿态求骨骼并推进布料；dt = 0 时只摆布不模拟（第一帧）
  update(pose, dt, env = {}) {
    const body = this.T.body;
    const r = solvePose(body, pose);
    this.W = r.W; this.cur = r.cur; this.pose = pose;
    skinMatrices(body, r.cur, this.mats);
    // 断了左小臂：骨骼缩到肘部
    if (this.opts.amputateL) for (const b of [6, 7]) { for (let q = 0; q < 12; q++) this.mats[b * 16 + q] *= 0.0001; const e = r.W.elbowL; this.mats[b * 16 + 12] = e[0]; this.mats[b * 16 + 13] = e[1]; this.mats[b * 16 + 14] = e[2]; }
    const W = r.W, s = this.s;
    const yaw = pose.yaw || 0;
    const fwd = qrot(qaxis([0, 1, 0], yaw), [0, 0, 1]), left = qrot(qaxis([0, 1, 0], yaw), [1, 0, 0]);
    this.fwd = fwd; this.left = left;
    const sk = this.opts.skirt;
    if (sk && !this.skirt) this.makeSkirt(sk, W, fwd, left);
    const hr = this.opts.hair;
    if (hr && !this.hair) this.makeHair(hr, W, r);
    const tl = this.opts.tail;
    if (tl && !this.tail) this.makeTail(tl, W, fwd, left);
    const sv = this.opts.sleeves;
    if (sv && !this.sleeveL) { this.sleeveL = this.makeSleeve(sv, W, 'L'); this.sleeveR = this.makeSleeve(sv, W, 'R'); }
    // 钉住的点跟着身体
    if (this.skirt) {
      const c = this.skirt, nx = c.nx;
      const ring = this.skirtRing(W, fwd, left, sk);
      for (let i = 0; i < nx; i++) c.setPin(i, 0, ring[i]);
    }
    if (this.hair) {
      const pins = this.hairPins(W, r, hr);
      pins.forEach((p, i) => this.hair.setPin(i, 0, p));
    }
    if (this.tail) {
      const base = this.tailBase(W, fwd, left);
      this.tail.setPin(0, 0, base[0]); this.tail.setPin(1, 0, lerp3(base[0], base[1], 0.5)); this.tail.setPin(2, 0, base[1]);
    }
    if (this.sleeveL) { this.pinSleeve(this.sleeveL, sv, W, 'L'); this.pinSleeve(this.sleeveR, sv, W, 'R'); }
    const colliders = this.colliders(W);
    const skirtCol = this.skirtColliders(W);
    const wind = env.wind || [0, 0, 0];
    const force = (p) => [wind[0] * (1 + 0.4 * Math.sin(env.t * 3.1 + p[1] * 7)), wind[1], wind[2] * (1 + 0.4 * Math.sin(env.t * 2.7 + p[0] * 5))];
    if (dt > 0) {
      if (this.skirt) this.skirt.step(dt, { colliders: skirtCol, force, ground: (env.ground ?? 0) + 0.01, iters: 10, sub: 3 });
      for (const [sl, side] of [[this.sleeveL, 'L'], [this.sleeveR, 'R']]) if (sl) sl.step(dt, { colliders: this.armColliders(W, side), force, ground: (env.ground ?? 0) + 0.01, iters: 8, sub: 3 });
      if (this.hair) this.hair.step(dt, { colliders, force, ground: (env.ground ?? 0) + 0.01, iters: 8, sub: 3 });
      if (this.tail) this.tail.step(dt, { colliders: colliders.slice(0, 2), force, ground: (env.ground ?? 0) + 0.01, iters: 8, sub: 3 });
    } else if (!this.inited) {
      // 第一帧：让布先垂下来静置
      for (let k = 0; k < 40; k++) {
        if (this.skirt) this.skirt.step(1 / 60, { colliders: skirtCol, force, ground: (env.ground ?? 0) + 0.01, iters: 6, sub: 1 });
        for (const [sl, side] of [[this.sleeveL, 'L'], [this.sleeveR, 'R']]) if (sl) sl.step(1 / 60, { colliders: this.armColliders(W, side), force, ground: (env.ground ?? 0) + 0.01, iters: 6, sub: 1 });
        if (this.hair) this.hair.step(1 / 60, { colliders, force, ground: (env.ground ?? 0) + 0.01, iters: 6, sub: 1 });
        if (this.tail) this.tail.step(1 / 60, { colliders: colliders.slice(0, 2), force, ground: (env.ground ?? 0) + 0.01, iters: 6, sub: 1 });
      }
    }
    this.inited = true;
    for (const c of [this.skirt, this.hair, this.tail, this.sleeveL, this.sleeveR]) if (c) c.upload();
    return this;
  }
  colliders(W) {
    const s = this.s;
    return [
      { a: W.hipL, b: W.kneeL, r: 0.088 * s, r2: 0.07 * s }, { a: W.hipR, b: W.kneeR, r: 0.088 * s, r2: 0.07 * s },
      { a: W.kneeL, b: W.ankleL, r: 0.068 * s, r2: 0.055 * s }, { a: W.kneeR, b: W.ankleR, r: 0.068 * s, r2: 0.055 * s },
      { a: W.pelvis, b: W.chest, r: 0.15 * s }, { c: add(W.head, [0, 0.06 * s, 0]), r: 0.115 * s },
    ];
  }
  // 裙摆的碰撞体：包住双腿的「钟」，跨步时自然张开，不会被腿卡住
  skirtColliders(W) {
    const s = this.s;
    const midK = lerp3(W.kneeL, W.kneeR, 0.5), midA = lerp3(W.ankleL, W.ankleR, 0.5);
    // 半径不超过裙摆在那个高度的半径（布不能被撑开）
    const hem = this.hemR || 0.25 * s;
    const rk = Math.min(len(sub(W.kneeL, W.kneeR)) / 2 + 0.075 * s, hem * 0.72), ra = Math.min(len(sub(W.ankleL, W.ankleR)) / 2 + 0.06 * s, hem * 0.88);
    const hipC = lerp3(W.hipL, W.hipR, 0.5);
    return [{ a: hipC, b: midK, r: 0.15 * s, r2: rk }, { a: midK, b: midA, r: rk, r2: ra }, { a: W.pelvis, b: W.chest, r: 0.15 * s }];
  }
  armColliders(W, side) {
    const s = this.s;
    return [{ a: W['shoulder' + side], b: W['elbow' + side], r: 0.065 * s }, { a: W['elbow' + side], b: W['wrist' + side], r: 0.058 * s }, { a: W.spine, b: W.chest, r: 0.15 * s }, { c: W.pelvis, r: 0.17 * s }];
  }
  // 宽袖：筒状布，沿手臂的上缘钉住，下面的一半自然垂成袖兜
  sleeveFrames(W, side, sv) {
    const s = this.s, ny = sv.ny || 9;
    const sh = W['shoulder' + side], el = W['elbow' + side], wr = W['wrist' + side];
    const l1 = len(sub(el, sh)), l2 = len(sub(wr, el)), ext = (sv.ext ?? 0.05) * s;
    const total = l1 + l2 + ext;
    const lateral = mul(this.left, side === 'L' ? 1 : -1);
    const out = [];
    for (let j = 0; j < ny; j++) {
      const d = (j / (ny - 1)) * total;
      let c, ax;
      if (d < l1) { ax = norm(sub(el, sh)); c = add(sh, mul(ax, d)); }
      else { ax = norm(sub(wr, el)); c = add(el, mul(ax, d - l1)); }
      const pu = sub([0, 1, 0], mul(ax, ax[1]));
      const w = Math.abs(ax[1]);
      let upr = len(pu) > 1e-3 ? norm(pu) : lateral;
      const k = clamp((w - 0.7) / 0.25);
      upr = norm(add(mul(upr, 1 - k), mul(lateral, k)));
      const sd = norm(cross(ax, upr));
      out.push({ c, ax, up: upr, sd, u: j / (ny - 1) });
    }
    return out;
  }
  makeSleeve(sv, W, side) {
    const s = this.s, nx = sv.nx || 10, ny = sv.ny || 9;
    const F = this.sleeveFrames(W, side, sv);
    const w = (sv.width || 0.16) * s;
    const col = sv.color, col2 = sv.color2 || col;
    return new Cloth(nx, ny, (i, j) => {
      const f = F[j]; const r = lerp(0.075 * s, w, Math.pow(f.u, 0.8));
      const a = (i / nx) * Math.PI * 2;
      return add(f.c, add(mul(f.up, Math.cos(a) * r), add(mul(f.sd, Math.sin(a) * r), [0, -r * 0.6 * (1 - Math.cos(a)) * 0.5, 0])));
    }, { wrap: true, colorFn: (u, v) => (v > 0.86 ? [...col2, 0.85] : [...col, 0.85]), mat: [0, 0, 0.7, 1], damping: 0.97, bend: 0.1 });
  }
  pinSleeve(c, sv, W, side) {
    const s = this.s, nx = c.nx, ny = c.ny;
    const F = this.sleeveFrames(W, side, sv);
    for (let j = 0; j < ny; j++) {
      const f = F[j];
      for (let i = 0; i < nx; i++) {
        const a = (i / nx) * Math.PI * 2;
        const top = Math.cos(a) > 0.2;
        const empty = this.opts.amputateL && side === 'L' && f.u > 0.42;     // 空袖：肘以下不再钉住
        if (j === 0 || (top && !empty)) {
          const r = j === 0 ? 0.075 * s : 0.062 * s;
          c.setPin(i, j, add(f.c, add(mul(f.up, Math.cos(a) * r), mul(f.sd, Math.sin(a) * r))));
        } else c.unpin(i, j);
      }
    }
  }
  skirtRing(W, fwd, left, sk) {
    const s = this.s, nx = sk.nx || 20;
    const c = lerp3(W.pelvis, W.spine, sk.top ?? 0.35);
    const rx = (sk.rx || 0.155) * s, rz = (sk.rz || 0.125) * s;
    const out = [];
    for (let i = 0; i < nx; i++) {
      const a = (i / nx) * Math.PI * 2;
      out.push(add(c, add(mul(left, Math.cos(a) * rx), mul(fwd, Math.sin(a) * rz))));
    }
    return out;
  }
  makeSkirt(sk, W, fwd, left) {
    const s = this.s, nx = sk.nx || 20, ny = sk.ny || 12;
    const ring = this.skirtRing(W, fwd, left, sk);
    const c = lerp3(W.pelvis, W.spine, sk.top ?? 0.35);
    const J = this.T.body.J;
    const L = (sk.len ?? 0.92) * lerp(J.pelvis[1], J.spine[1], sk.top ?? 0.35);
    const flare = sk.flare ?? 1.6;
    const col = sk.color, col2 = sk.color2 || col;
    this.skirt = new Cloth(nx, ny, (i, j) => {
      const u = j / (ny - 1); const p = ring[i];
      const d = sub(p, c);
      return add(c, add(mul(d, 1 + (flare - 1) * u), [0, -L * u, 0]));
    }, { wrap: true, colorFn: (u, v) => (v > 0.94 ? [...col2, 0.85] : [...col, 0.85]), mat: [0, 0, 0.7, 1], damping: 0.975, bend: 0.12 });
    this.skirtLen = L;
    this.hemR = (sk.rx || 0.155) * s * flare;
  }
  hairPins(W, r, hr) {
    const s = this.s, n = hr.nx || 7;
    const hq = r.headQ;
    const hc = add(W.head, qrot(hq, [0, 0.06 * s, 0]));
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = lerp(-1.0, 1.0, i / (n - 1));
      out.push(add(hc, qrot(hq, [Math.sin(a) * 0.085 * s, 0.03 * s - Math.abs(a) * 0.04 * s, -Math.cos(a) * 0.085 * s - 0.01 * s])));
    }
    return out;
  }
  makeHair(hr, W, r) {
    const s = this.s, nx = hr.nx || 7, ny = hr.ny || 10;
    const pins = this.hairPins(W, r, hr);
    const L = (hr.len || 0.5) * s;
    this.hair = new Cloth(nx, ny, (i, j) => add(pins[i], [0, -L * j / (ny - 1), -0.02 * j / ny]), { color: [...hr.color, 0.5], mat: [0, 0, 0.3, 1], damping: 0.97, bend: 0.3 });
  }
  tailBase(W, fwd, left) {
    const s = this.s;
    const b = add(W.pelvis, add(mul(fwd, -0.13 * s), [0, -0.02 * s, 0]));
    const w = (this.opts.tail.w || 0.05) * s;
    return [add(b, mul(left, w)), add(b, mul(left, -w))];
  }
  makeTail(tl, W, fwd, left) {
    const s = this.s, ny = tl.ny || 12;
    const base = this.tailBase(W, fwd, left);
    const L = (tl.len || 0.7) * s;
    this.tail = new Cloth(3, ny, (i, j) => add(lerp3(base[0], base[1], i / 2), add(mul(fwd, -L * 0.6 * j / ny), [0, -L * 0.6 * j / ny, 0])), { colorFn: (u, v) => [...(v > 0.8 && tl.tip ? tl.tip : tl.color), 0.6], mat: [-1, 0.2, 0.5, 1], damping: 0.96, bend: 0.6 });
    // 尾巴是一条有宽度的带子：渲染时由两列点构成
  }
  items() {
    const out = [];
    if (this.skirt) out.push({ mesh: this.skirt.mesh, twoSided: true });
    if (this.hair) out.push({ mesh: this.hair.mesh, twoSided: true });
    if (this.tail) out.push({ mesh: this.tail.mesh, twoSided: true, dissolve: this.featureFade || 0 });
    if (this.sleeveL) out.push({ mesh: this.sleeveL.mesh, twoSided: true }, { mesh: this.sleeveR.mesh, twoSided: true });
    return out;
  }
  // 手的坐标系（用于握剑）
  hand(side = 'R') { return this.cur[side === 'R' ? 10 : 7]; }
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// 把同类演员的骨骼收集成一组实例
export function figureGroup(actors, extra = {}) {
  if (!actors.length) return null;
  const b = actors[0].T.body;
  const face = actors[0].P.face === false ? null : [...b.headC, b.J._s * (b.P.age === 'child' ? 1.18 : 1)];
  return { mesh: actors[0].T.mesh, inst: actors.map((a) => a.mats), face, ...extra };
}
// 一组同类型演员按类型分组
export function figureGroups(actors) {
  const m = new Map();
  for (const a of actors) { if (!m.has(a.T)) m.set(a.T, []); m.get(a.T).push(a); }
  return [...m.values()].map((list) => figureGroup(list));
}
