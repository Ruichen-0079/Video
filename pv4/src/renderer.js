// 渲染器：阴影 → 多重采样主画面（天空、物体、人物、布、草、花、海）→ 粒子 → 景深 → 光晕/体积光 → 调色与字幕
import { gl, program, texture, fbo, msaaFbo, resolve, pass, bindTex, resetUnits, fullscreen, VS_QUAD, mesh } from './gl.js';
import * as S from './shaders.js';
import { persp, lookAt, mmul, inv, ortho, norm, sub, add, mul, cross, xform, len, DEG } from './math.js';
import { NB } from './figure.js';

export class Renderer {
  constructor(W, H, { aspect = 2.35, samples = 4, shadowRes = 2048 } = {}) {
    this.W = W; this.H = H;
    this.AH = Math.min(H, Math.round(W / aspect / 2) * 2);   // 画面（宽银幕）高度
    this.AW = W;
    this.box = [0, (H - this.AH) / 2, W, (H + this.AH) / 2];
    const AW = this.AW, AH = this.AH;
    this.P = {
      std: program(S.VS_STD, S.FS_STD, ['p', 'n', 'c', 'm'], 'std'),
      skin: program(S.VS_SKIN, S.FS_STD, ['p', 'n', 'c', 'm', 'bi', 'bw'], 'skin'),
      stdD: program(S.VS_STD, S.FS_DEPTH, ['p', 'n', 'c', 'm'], 'stdD'),
      skinD: program(S.VS_SKIN, S.FS_DEPTH, ['p', 'n', 'c', 'm', 'bi', 'bw'], 'skinD'),
      grass: program(S.VS_GRASS, S.FS_GRASS, ['q', 'iA', 'iB'], 'grass'),
      grassD: program(S.VS_GRASS, S.FS_DEPTH, ['q', 'iA', 'iB'], 'grassD'),
      flower: program(S.VS_FLOWER, S.FS_FLOWER, ['q', 'iA', 'iB'], 'flower'),
      sky: program(VS_QUAD, S.FS_SKY, ['p'], 'sky'),
      water: program(S.VS_WATER, S.FS_WATER, ['p'], 'water'),
      part: program(S.VS_PART, S.FS_PART, ['q', 'iA', 'iB', 'iC'], 'part'),
      copy: program(VS_QUAD, S.FS_COPY, ['p'], 'copy'),
      dof: program(VS_QUAD, S.FS_DOF, ['p'], 'dof'),
      dofmix: program(VS_QUAD, S.FS_DOFMIX, ['p'], 'dofmix'),
      bright: program(VS_QUAD, S.FS_BRIGHT, ['p'], 'bright'),
      blur: program(VS_QUAD, S.FS_BLUR, ['p'], 'blur'),
      shafts: program(VS_QUAD, S.FS_SHAFTS, ['p'], 'shafts'),
      final: program(VS_QUAD, S.FS_FINAL, ['p'], 'final'),
    };
    this.ms = msaaFbo(AW, AH, 2, samples);
    this.colT = texture(AW, AH); this.colF = fbo([this.colT]);
    this.depT = texture(AW, AH, { fmt: 'RGBA16F', filter: 'NEAREST' }); this.depF = fbo([this.depT]);
    this.dofT = texture(AW >> 1, AH >> 1); this.dofF = fbo([this.dofT]);
    this.mixT = texture(AW, AH); this.mixF = fbo([this.mixT]);
    this.shT = texture(AW >> 1, AH >> 1); this.shF = fbo([this.shT]);
    this.bl = [];
    { let w = AW, h = AH; for (let i = 0; i < 4; i++) { w = Math.max(4, w >> 1); h = Math.max(4, h >> 1); this.bl.push([fbo([texture(w, h)]), fbo([texture(w, h)])]); } }
    this.shadowRes = shadowRes;
    this.smT = texture(shadowRes, shadowRes, { fmt: 'DEPTH', filter: 'NEAREST' });
    this.smF = fbo([], this.smT);
    // 骨骼纹理：每行一个人物实例，每根骨骼 4 个纹素
    this.boneRows = 256;
    this.boneTex = texture(NB * 4, this.boneRows, { fmt: 'RGBA32F', filter: 'NEAREST' });
    this.boneData = new Float32Array(NB * 4 * 4 * this.boneRows);
    this.textCanvas = document.createElement('canvas'); this.textCanvas.width = W; this.textCanvas.height = H;
    this.textCtx = this.textCanvas.getContext('2d');
    this.textTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.textCanvas);
    this.textKey = null;
  }

  // 每帧：scene 由镜头给出
  render(sc, frame, t, textDraw) {
    const AW = this.AW, AH = this.AH;
    const cam = sc.cam;
    const aspect = AW / AH;
    const proj = persp((cam.fov || 40) * DEG, aspect, cam.near || 0.05, cam.far || 2000);
    const up = cam.up || [0, 1, 0];
    const view = lookAt(cam.pos, cam.target, up);
    const VP = mmul(proj, view), iVP = inv(VP);
    this.VP = VP;
    const sun = sc.sun || { dir: [0.3, 0.8, 0.4], col: [1, 1, 1] };
    const sunDir = norm(sun.dir);
    // 上传全部人物实例的骨骼
    if (sc.figures && sc.figures.length) {
      let row = 0;
      for (const fg of sc.figures) { fg._row = row; for (const mats of fg.inst) { this.boneData.set(mats, row * NB * 16); row++; } }
      gl.bindTexture(gl.TEXTURE_2D, this.boneTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NB * 4, Math.max(1, row), gl.RGBA, gl.FLOAT, this.boneData.subarray(0, Math.max(1, row) * NB * 16));
    }
    // 阴影
    let shadowVP = null;
    if (sun.shadow) {
      const sh = sun.shadow, c = sh.center, r = sh.radius;
      const sv = lookAt(add(c, mul(sunDir, r * 2)), c, Math.abs(sunDir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
      shadowVP = mmul(ortho(-r, r, -r, r, 0.1, r * 4), sv);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.smF.f); gl.viewport(0, 0, this.shadowRes, this.shadowRes);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.colorMask(false, false, false, false);
      this.drawGeometry(sc, shadowVP, true, t);
      gl.colorMask(true, true, true, true);
    }
    this.U = { sc, sunDir, shadowVP, t };
    // 主画面
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ms.f); gl.viewport(0, 0, AW, AH);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.P.sky.p); resetUnits(); this.lighting(this.P.sky.u);
    const sky = sc.sky || {};
    const u = this.P.sky.u;
    gl.uniformMatrix4fv(u.invVP, false, new Float32Array(iVP));
    gl.uniform3fv(u.skyTop, sky.top || [0.1, 0.2, 0.4]); gl.uniform3fv(u.skyHor, sky.hor || [0.5, 0.6, 0.7]); gl.uniform3fv(u.skyGnd, sky.gnd || [0.2, 0.2, 0.2]);
    gl.uniform4fv(u.sunDisc, sky.sunDisc || [0.9997, 20, 0.5, 8]); gl.uniform4fv(u.moon, sky.moon || [0, 1, 0, 0]);
    gl.uniform1f(u.stars, sky.stars || 0); gl.uniform1f(u.clouds, sky.clouds || 0); gl.uniform3fv(u.cloudCol, sky.cloudCol || [0.5, 0.5, 0.55]); gl.uniform1f(u.cloudY, sky.cloudY || 1.0);
    fullscreen();
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
    this.drawGeometry(sc, VP, false, t);
    // 解析颜色与深度
    resolve(this.ms, 0, this.colF); resolve(this.ms, 1, this.depF);
    // 粒子（画在解析后的画面上）
    if (sc.particles && sc.particles.length) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.colF.f); gl.viewport(0, 0, AW, AH);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
      const P = this.P.part;
      gl.useProgram(P.p); resetUnits(); this.lighting(P.u);
      bindTex(P.u, 'depthTex', this.depT);
      gl.uniform2f(P.u.res, AW, AH);
      gl.uniformMatrix4fv(P.u.VP, false, new Float32Array(VP));
      const right = [view[0], view[4], view[8]], upv = [view[1], view[5], view[9]];
      gl.uniform3fv(P.u.camRight, right); gl.uniform3fv(P.u.camUp, upv);
      for (const ps of sc.particles) {
        ps.upload(); if (!ps.n) continue;
        gl.uniform1i(P.u.kind, ps.kind);
        if (ps.additive) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(ps.mesh.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ps.n); gl.bindVertexArray(null);
      }
      gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
    }
    // 景深
    let src = this.colT;
    const dof = cam.dof;
    if (dof && dof.aperture > 0) {
      pass(this.P.dof, this.dofF, (u) => { bindTex(u, 'tex', this.colT); bindTex(u, 'depthTex', this.depT); gl.uniform2f(u.px, 1 / (AW >> 1), 1 / (AH >> 1)); gl.uniform1f(u.focus, dof.focus); gl.uniform1f(u.aperture, dof.aperture); gl.uniform1f(u.maxR, (dof.maxR || 7) * Math.sqrt(Math.max(1, AW / 640))); });
      pass(this.P.dofmix, this.mixF, (u) => { bindTex(u, 'tex', this.colT); bindTex(u, 'blurTex', this.dofT); bindTex(u, 'depthTex', this.depT); gl.uniform1f(u.focus, dof.focus); gl.uniform1f(u.aperture, dof.aperture); });
      src = this.mixT;
    }
    // 光晕
    const g = sc.grade || {};
    let s2 = src;
    for (let i = 0; i < this.bl.length; i++) {
      const [A, Bf] = this.bl[i];
      if (i === 0) pass(this.P.bright, A, (u) => { bindTex(u, 'tex', s2); gl.uniform1f(u.thresh, g.bloomThresh || 0.8); });
      else pass(this.P.copy, A, (u) => bindTex(u, 'tex', s2));
      pass(this.P.blur, Bf, (u) => { bindTex(u, 'tex', A.colors[0]); gl.uniform2f(u.dir, 1 / A.w, 0); });
      pass(this.P.blur, A, (u) => { bindTex(u, 'tex', Bf.colors[0]); gl.uniform2f(u.dir, 0, 1 / A.h); });
      s2 = A.colors[0];
    }
    // 体积光
    let shaftOn = 0;
    if (sc.shafts && sc.shafts.strength > 0) {
      const sp = mmul(VP, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const L = sc.shafts.pos || add(cam.pos, mul(sunDir, 1000));
      const clip = [VP[0] * L[0] + VP[4] * L[1] + VP[8] * L[2] + VP[12], VP[1] * L[0] + VP[5] * L[1] + VP[9] * L[2] + VP[13], 0, VP[3] * L[0] + VP[7] * L[1] + VP[11] * L[2] + VP[15]];
      if (clip[3] > 0) {
        const suv = [clip[0] / clip[3] * 0.5 + 0.5, clip[1] / clip[3] * 0.5 + 0.5];
        pass(this.P.shafts, this.shF, (u) => { bindTex(u, 'tex', src); bindTex(u, 'depthTex', this.depT); gl.uniform2fv(u.sunUV, suv); gl.uniform1f(u.strength, sc.shafts.strength); gl.uniform3fv(u.tintC, sc.shafts.col || [1, 0.9, 0.7]); });
        shaftOn = 1;
      }
    }
    // 字幕
    if (textDraw) {
      const key = textDraw.key;
      if (key !== this.textKey) {
        const x = this.textCtx; x.clearRect(0, 0, this.W, this.H);
        textDraw.draw(x, this);
        gl.bindTexture(gl.TEXTURE_2D, this.textTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.textCanvas);
        this.textKey = key;
      }
    }
    pass(this.P.final, null, (u) => {
      bindTex(u, 'tex', src); bindTex(u, 'b1', this.bl[0][0].colors[0]); bindTex(u, 'b2', this.bl[1][0].colors[0]); bindTex(u, 'b3', this.bl[2][0].colors[0]);
      bindTex(u, 'shaftTex', this.shT); bindTex(u, 'textTex', this.textTex);
      gl.uniform2f(u.res, this.W, this.H); gl.uniform4fv(u.box, this.box);
      gl.uniform1f(u.frame, frame); gl.uniform1f(u.fade, g.fade ?? 1); gl.uniform1f(u.exposure, g.exposure ?? 1); gl.uniform1f(u.grain, g.grain ?? 0.03);
      gl.uniform1f(u.bloom, g.bloom ?? 0.6); gl.uniform1f(u.sat, g.sat ?? 1); gl.uniform1f(u.contrast, g.contrast ?? 1); gl.uniform1f(u.vignette, g.vignette ?? 0.35);
      gl.uniform3fv(u.wb, g.wb || [1, 1, 1]); gl.uniform3fv(u.lift, g.lift || [0, 0, 0]); gl.uniform3fv(u.gain, g.gain || [1, 1, 1]);
      gl.uniform1f(u.shaftOn, shaftOn);
    });
  }

  lighting(u) {
    const { sc, sunDir, shadowVP, t } = this.U || { sc: {}, sunDir: [0, 1, 0], t: 0 };
    const sun = sc.sun || {};
    gl.uniform3fv(u.camPos, sc.cam.pos);
    gl.uniform3fv(u.sunDir, sunDir); gl.uniform3fv(u.sunCol, sun.col || [1, 1, 1]);
    const amb = sc.amb || {};
    gl.uniform3fv(u.skyAmb, amb.sky || [0.2, 0.25, 0.3]); gl.uniform3fv(u.gndAmb, amb.gnd || [0.1, 0.08, 0.06]); gl.uniform3fv(u.rimCol, sc.rim || [0, 0, 0]);
    const L = sc.lights || [];
    const pp = new Float32Array(32), pc = new Float32Array(32);
    L.slice(0, 8).forEach((l, i) => { pp.set([...l.pos, l.radius || 2], i * 4); pc.set([...l.col, 0], i * 4); });
    gl.uniform4fv(u.plPos, pp); gl.uniform4fv(u.plCol, pc); gl.uniform1i(u.nPl, Math.min(8, L.length));
    const f = sc.fog || {};
    gl.uniform4fv(u.fogP, [f.density || 0, f.falloff || 0.2, f.base || 0, f.max ?? 1]);
    gl.uniform3fv(u.fogCol, f.col || [0.5, 0.5, 0.5]); gl.uniform3fv(u.fogSunCol, f.sunCol || [0, 0, 0]);
    gl.uniform1f(u.shadowOn, shadowVP ? 1 : 0); gl.uniform1f(u.shadowSoft, sun.shadow?.soft || 1.5);
    if (shadowVP) { gl.uniformMatrix4fv(u.shadowVP, false, new Float32Array(shadowVP)); bindTex(u, 'shadowMap', this.smT); }
    gl.uniform1f(u.time, t);
  }

  drawGeometry(sc, VP, depthOnly, t) {
    const vp = new Float32Array(VP);
    // 静态与布
    const P = depthOnly ? this.P.stdD : this.P.std;
    gl.useProgram(P.p); resetUnits(); if (!depthOnly) this.lighting(P.u);
    gl.uniformMatrix4fv(P.u.VP, false, vp);
    for (const it of sc.items || []) {
      if (depthOnly && it.noShadow) continue;
      gl.uniformMatrix4fv(P.u.M, false, new Float32Array(it.model || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
      if (!depthOnly) { gl.uniform1f(P.u.twoSided, it.twoSided ? 1 : 0); gl.uniform4fv(P.u.tint, it.tint || [1, 1, 1, 1]); gl.uniform1f(P.u.dissolve, it.dissolve || 0); gl.uniform1f(P.u.faceOn, 0); gl.uniform1f(P.u.weave, it.weave ?? 1); }
      const m = it.mesh; gl.bindVertexArray(m.vao);
      if (m.ib) gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); else gl.drawArrays(gl.TRIANGLES, 0, m.count);
    }
    // 人物（蒙皮，实例化）
    if (sc.figures && sc.figures.length) {
      const PS = depthOnly ? this.P.skinD : this.P.skin;
      gl.useProgram(PS.p); resetUnits(); if (!depthOnly) this.lighting(PS.u);
      gl.uniformMatrix4fv(PS.u.VP, false, vp);
      bindTex(PS.u, 'boneTex', this.boneTex);
      if (!depthOnly) { gl.uniform1f(PS.u.twoSided, 0); gl.uniform1f(PS.u.dissolve, 0); }
      for (const fg of sc.figures) {
        if (!fg.inst.length) continue;
        if (!depthOnly) { gl.uniform4fv(PS.u.tint, fg.tint || [1, 1, 1, 1]); gl.uniform1f(PS.u.faceOn, fg.face ? 1 : 0); if (fg.face) gl.uniform4fv(PS.u.headC, fg.face); gl.uniform1f(PS.u.weave, 1); }
        if (!depthOnly) gl.uniform1f(PS.u.dissolve, fg.dissolve || 0);
        gl.uniform1i(PS.u.row0, fg._row);
        gl.bindVertexArray(fg.mesh.vao); gl.drawElementsInstanced(gl.TRIANGLES, fg.mesh.count, gl.UNSIGNED_INT, 0, fg.inst.length); gl.bindVertexArray(null);
      }
    }
    // 草
    if (sc.grass) {
      const PG = depthOnly ? this.P.grassD : this.P.grass;
      gl.useProgram(PG.p); resetUnits(); if (!depthOnly) this.lighting(PG.u);
      gl.uniformMatrix4fv(PG.u.VP, false, vp); gl.uniform1f(PG.u.time, t);
      gl.uniform2fv(PG.u.wind, sc.grass.wind || [0.6, 0.2]); gl.uniform1f(PG.u.gust, sc.grass.gust ?? 0.6);
      gl.uniform1f(PG.u.groundY, sc.grass.groundY || 0); gl.uniform4fv(PG.u.groundK, sc.grass.groundK || [0, 0, 0, 0]);
      gl.bindVertexArray(sc.grass.mesh.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, sc.grass.mesh.verts, sc.grass.n); gl.bindVertexArray(null);
    }
    if (depthOnly) return;
    if (sc.flowers) {
      const PF = this.P.flower;
      gl.useProgram(PF.p); resetUnits(); this.lighting(PF.u);
      gl.uniformMatrix4fv(PF.u.VP, false, vp); gl.uniform1f(PF.u.time, t);
      gl.uniform2fv(PF.u.wind, sc.grass?.wind || [0.6, 0.2]); gl.uniform1f(PF.u.gust, sc.grass?.gust ?? 0.6);
      gl.bindVertexArray(sc.flowers.mesh.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sc.flowers.n); gl.bindVertexArray(null);
    }
    if (sc.water) {
      const PW = this.P.water, w = sc.water;
      gl.useProgram(PW.p); resetUnits(); this.lighting(PW.u);
      gl.uniformMatrix4fv(PW.u.VP, false, vp); gl.uniform1f(PW.u.time, t); gl.uniform1f(PW.u.waterY, w.y || 0);
      const wv = new Float32Array(24); (w.waves || []).slice(0, 6).forEach((x, i) => wv.set(x, i * 4));
      gl.uniform4fv(PW.u.waves, wv);
      gl.uniform3fv(PW.u.deepCol, w.deep || [0.02, 0.05, 0.07]); gl.uniform3fv(PW.u.shallowCol, w.shallow || [0.1, 0.2, 0.2]);
      gl.uniform3fv(PW.u.skyTop, sc.sky?.top || [0.1, 0.2, 0.4]); gl.uniform3fv(PW.u.skyHor, sc.sky?.hor || [0.5, 0.6, 0.7]);
      gl.uniform4fv(PW.u.shore, w.shore || [-10, 0, 1, 0]); gl.uniform1f(PW.u.foamAmt, w.foam ?? 1);
      gl.bindVertexArray(w.mesh.vao); gl.drawElements(gl.TRIANGLES, w.mesh.count, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
    }
  }
}

// 草叶网格：一片叶子 7 个顶点的三角带；实例数据 iA(x,z,h,seed) iB(rgb,width)
export function grassField(n, place) {
  const q = [];
  const segs = 3;
  for (let i = 0; i <= segs; i++) { const y = i / segs; q.push(-1, y, 1, y); }
  q.push(0, 1.08);
  const A = new Float32Array(n * 4), Bc = new Float32Array(n * 4);
  let k = 0;
  for (let i = 0; i < n; i++) { const r = place(i); if (!r) continue; A.set(r.a, k * 4); Bc.set(r.b, k * 4); k++; }
  const m = mesh(['q', 'iA', 'iB'], { q: { data: new Float32Array(q), size: 2 }, iA: { data: A.subarray(0, k * 4), size: 4, divisor: 1 }, iB: { data: Bc.subarray(0, k * 4), size: 4, divisor: 1 } });
  m.verts = q.length / 2;
  return { mesh: m, n: k };
}
export function flowerField(n, place) {
  const A = new Float32Array(n * 4), Bc = new Float32Array(n * 4);
  let k = 0;
  for (let i = 0; i < n; i++) { const r = place(i); if (!r) continue; A.set(r.a, k * 4); Bc.set(r.b, k * 4); k++; }
  const m = mesh(['q', 'iA', 'iB'], { q: { data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), size: 2 }, iA: { data: A.subarray(0, k * 4), size: 4, divisor: 1 }, iB: { data: Bc.subarray(0, k * 4), size: 4, divisor: 1 } });
  return { mesh: m, n: k };
}
// 海面网格
export function waterGrid(w, d, nx, nz, x0, z0) {
  const p = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) p.push(x0 + (i / nx) * w, 0, z0 + (j / nz) * d);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1; idx.push(a, c, e, a, e, b); }
  return mesh(['p'], { p: { data: new Float32Array(p), size: 3 } }, new Uint32Array(idx));
}
