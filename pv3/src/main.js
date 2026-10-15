// 「逝水」：window.PV.renderFrame(t, frame)
// 水面模拟是有状态的：必须按帧推进。随机跳转时会从头重算（模拟本身很快，只有着色慢）。

import * as SH from './shaders.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1920), H = +(qs.get('h') || 1080);
const FPS = +(qs.get('fps') || 30);
const N = +(qs.get('n') || 1024);   // 波动模拟分辨率（预览可用 ?n=512）
const SUB = 4;                  // 每帧子步
const CG = 400;                 // 焦散网格

const canvas = document.getElementById('out');
canvas.width = W; canvas.height = H;
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float FBO');
gl.getExtension('OES_texture_float_linear');

let E = null;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ───────────────────────── GL 工具
function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
  return s;
}
function prog(vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function tex(w, h, fmt = gl.RGBA16F, type = gl.HALF_FLOAT, filter = gl.LINEAR) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function fbo(w, h, fmt, type) {
  const t = tex(w, h, fmt, type); const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
  return { t, f, w, h };
}
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const quadVAO = gl.createVertexArray();
gl.bindVertexArray(quadVAO); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
function pass(P, target, setup) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
  gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
  gl.useProgram(P.p); setup(P.u);
  gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
}
let unit = 0;
function bind(u, name, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u[name], unit); unit++; }

// ───────────────────────── 程序
const P = {
  wave: prog(SH.VS_QUAD, SH.FS_WAVE, ['p']),
  dye: prog(SH.VS_QUAD, SH.FS_DYE, ['p']),
  caustic: prog(SH.VS_CAUSTIC, SH.FS_CAUSTIC, ['g']),
  float: prog(SH.VS_FLOAT, SH.FS_FLOAT, ['q', 'iA', 'iB', 'iC', 'iD']),
  water: prog(SH.VS_QUAD, SH.FS_WATER, ['p']),
  blur: prog(SH.VS_QUAD, SH.FS_BLUR, ['p']),
  bright: prog(SH.VS_QUAD, SH.FS_BRIGHT, ['p']),
  final: prog(SH.VS_QUAD, SH.FS_FINAL, ['p']),
};
let simA = fbo(N, N, gl.RGBA32F, gl.FLOAT), simB = fbo(N, N, gl.RGBA32F, gl.FLOAT);
let dyeA = fbo(N, N), dyeB = fbo(N, N);
const caus = fbo(N, N), shad = fbo(512, 512);
const hdr = fbo(W, H);
const bl = [];
{ let w = W, h = H; for (let i = 0; i < 3; i++) { w = Math.round(w / 2); h = Math.round(h / 2); bl.push([fbo(w, h), fbo(w, h)]); } }

// 焦散网格
const cVAO = gl.createVertexArray();
let cCount = 0;
{
  const v = new Float32Array(CG * CG * 2);
  for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) { v[(j * CG + i) * 2] = i / (CG - 1); v[(j * CG + i) * 2 + 1] = j / (CG - 1); }
  const idx = new Uint32Array((CG - 1) * (CG - 1) * 6);
  let k = 0;
  for (let j = 0; j < CG - 1; j++) for (let i = 0; i < CG - 1; i++) { const a = j * CG + i; idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + CG; idx[k++] = a + 1; idx[k++] = a + CG + 1; idx[k++] = a + CG; }
  cCount = k;
  gl.bindVertexArray(cVAO);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
}
// 漂浮物（花瓣、书页、空中的信）：实例化四边形
const fVAO = gl.createVertexArray();
const fInst = gl.createBuffer();
const MAXF = 200, FST = 16;
const fData = new Float32Array(MAXF * FST);
{
  gl.bindVertexArray(fVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, fInst); gl.bufferData(gl.ARRAY_BUFFER, fData.byteLength, gl.DYNAMIC_DRAW);
  for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(1 + k); gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, FST * 4, k * 16); gl.vertexAttribDivisor(1 + k, 1); }
  gl.bindVertexArray(null);
}
// 题字与信纸的纹理
function canvasTexture(c) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
let titleT = null, letterT = null;

// ───────────────────────── 矩阵
function persp(fovy, aspect, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; }
function lookAt(e, c, up) {
  const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(up, z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
function mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
function inv(m) {
  const a = m, o = new Array(16);
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
  return o;
}
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ───────────────────────── 时间线
const LAMP = norm([0.22, 1.0, 0.12]);    // 灯的方向
// 月在天顶：守的那一段，镜头悬在他滴水的正上方往下看——月的倒影、水面的环、河床上焦散的环，同一个圆心
const MOON = [0, 1, 0];
const lightDir = (t) => norm(LAMP.map((v, i) => lerp(v, MOON[i], smooth(9.4, 12.0, t))));
let L = LAMP;
// 第五项是画面绕铅垂轴的转角（弧度）：守的时候，画面围着月慢慢转
const CAM = [
  [0.0, [0.06, 2.35, -0.30], [0.02, 0, 0.32], 44, 0],
  [9.0, [0.00, 2.20, -0.42], [0.00, 0, 0.30], 46, 0],
  [12.5, [0.04, 2.05, 0.22], [0.045, 0, 0.30], 44, 0],
  [18.4, [0.04, 1.85, 0.22], [0.040, 0, 0.29], 44, 0.24],
  [21.0, [0.04, 1.80, 0.22], [-0.22, 0, -0.02], 46, 0.24],
  [24.0, [0.15, 1.40, -0.62], [0.32, 0, 0.08], 42, 0],
  [27.0, [0.30, 1.05, -1.05], [0.42, 0, 0.75], 42, 0],
  [33.0, [0.30, 1.20, -1.75], [0.45, 0.0, 0.75], 44, 0],
];
// 她的灯：倒影落在她滴水的地方（从 21 秒的镜头看过去）
let HER = [0, 1, 0];
function camAt(t) {
  let i = 0; while (i < CAM.length - 2 && t > CAM[i + 1][0]) i++;
  const [t0, e0, c0, f0, r0] = CAM[i], [t1, e1, c1, f1, r1] = CAM[i + 1];
  const u = ease(clamp((t - t0) / (t1 - t0)));
  const roll = lerp(r0, r1, u);
  // 「上」取下游方向（+z）略带一点竖直分量：俯视与斜视时画面朝向都稳定
  return { eye: e0.map((v, k) => lerp(v, e1[k], u)), tgt: c0.map((v, k) => lerp(v, c1[k], u)), fov: lerp(f0, f1, u), up: norm([Math.sin(roll), 0.3, Math.cos(roll)]) };
}
// 关键帧之间平滑插值
function keyed(K, t) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], smooth(K[i][0], K[i + 1][0], t));
  return K[K.length - 1][1];
}
// 河面的细碎起伏：雨前起风；斩下之后死寂；守的时候是一面镜子；相遇时微动；城里起风；最后又成了镜子
const CHOP = [[0, 0.12], [2.0, 0.15], [7.5, 0.75], [9.0, 0.8], [9.7, 0.05], [12, 0.03], [18.3, 0.03], [19.6, 0.14], [23.0, 0.12], [24.4, 0.07], [25.6, 0.55], [28.2, 0.55], [30.0, 0.012], [33, 0.012]];
const chopAt = (t) => keyed(CHOP, t);
function era(t) {
  const h = E.herLight;
  return {
    eLamp: smooth(0.3, 2.0, t) * (1 - smooth(5.5, 8.0, t)),
    eFire: smooth(5.0, 7.5, t) * (1 - smooth(9.02, 9.25, t)),
    eMoon: smooth(9.4, 12.0, t),
    eBloom: smooth(18.8, 21.0, t) * (1 - smooth(23.6, 26.0, t)),
    eHer: smooth(h[0], h[1], t) * (1 - smooth(h[2], h[3], t)),
    eCity: smooth(23.5, 28.0, t),
    eTitle: smooth(E.title.t0, E.title.t0 + 2.5, t),
  };
}
const fireFlicker = (t) => 0.72 + 0.16 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) + 0.12 * Math.sin(t * 23.7) * Math.sin(t * 3.1);
function lightAt(t, e) {
  // 光的颜色：灯（暖）→ 火（橙红）→ 月（冷）→ 城（中性）
  let c = [0.02, 0.025, 0.035];
  const add = (k, col) => { c = c.map((v, i) => v + k * col[i]); };
  add(e.eLamp, [1.45, 0.82, 0.32]);
  add(e.eFire * fireFlicker(t), [1.5, 0.45, 0.10]);
  add(e.eMoon * (1 - 0.6 * e.eCity), [0.40, 0.50, 0.68]);
  add(e.eBloom, [0.16, 0.14, 0.10]);
  add(e.eCity, [0.26, 0.22, 0.20]);
  return c;
}

// 风吹出的涟漪：20 道水波，波长 3.5–30 厘米，大多顺着水流方向
const WAVES = [];
{
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const NW = 20;
  for (let i = 0; i < NW; i++) {
    const lam = 0.035 * Math.pow(0.30 / 0.035, (i + rnd() * 0.8) / NW);
    const k = (2 * Math.PI) / lam;
    const th = Math.PI / 2 + (rnd() - 0.5) * 2.6;
    const slope = (0.06 * Math.pow(lam / 0.3, 0.15)) / Math.sqrt(NW / 2);
    WAVES.push({ kx: k * Math.cos(th), kz: k * Math.sin(th), a: slope / k, w: Math.sqrt(9.81 * k + 7.3e-5 * k * k * k), p0: rnd() * 6.283 });
  }
}
const waveArr = new Float32Array(20 * 4);
function wavesAt(t) {
  WAVES.forEach((w, i) => waveArr.set([w.kx, w.kz, w.a, w.p0 - w.w * t - w.kz * E.current * t], i * 4));
  return waveArr;
}

// ───────────────────────── 事件 → 本帧的输入
function swordAt(t) {
  const s = E.sword;
  if (t < s.drop) return null;
  const u = clamp((t - s.drop) / (s.settle - s.drop));
  const e = 1 - Math.pow(1 - u, 2.2);
  const y = lerp(-0.01, -E.depth + 0.012, e);
  const sway = Math.sin(u * 9) * 0.05 * (1 - u);
  return {
    p: [s.pos[0] + sway * 0.4, y, s.pos[1] + e * 0.12],
    a: s.angle + Math.sin(u * 5) * 0.25 * (1 - u) + e * 0.18,
    blur: 0.002 + 0.006 * (1 - u) * (u < 1 ? 1 : 0),
    bury: smooth(s.settle + 1.0, 33.0, t) * 0.75,
    vis: smooth(s.drop, s.drop + 0.12, t),
  };
}
function bladeAt(t) {
  const c = E.cut;
  const u = clamp((t - c.t0) / (c.t1 - c.t0));
  const e = u * u * (3 - 2 * u);
  return [lerp(c.p0[0], c.p1[0], e), lerp(c.p0[1], c.p1[1], e)];
}
// 信：从空中飘下（24.45 落水），浮着湿透，再慢慢沉下去，顺流漂向城市的倒影
const LETTER_HW = 0.105, LETTER_HH = 0.15;
function letterAt(t) {
  const l = E.letter;
  const t0 = l.t - l.fall;
  if (t < t0) return null;
  const a = t - l.t;
  const x = l.pos[0] + Math.sin(a * 0.4) * 0.03;
  const z = l.pos[1] + 0.065 * Math.max(a, 0) + 0.003 * Math.max(a, 0) ** 2;
  const rot = l.angle + 0.04 * a;
  if (t < l.t) {
    const u = (t - t0) / l.fall;
    return { air: true, x: x - 0.18 * (1 - u) ** 1.5, z: z - 0.22 * (1 - u), y: 0.9 * (1 - u) ** 1.6, rot: rot + 0.6 * (1 - u), tilt: Math.sin(u * 5.5) * 0.7 * (1 - u) };
  }
  return {
    air: false, x, z, rot,
    y: -0.0015 - 0.6 * ease(clamp((t - (l.t + 2.4)) / 4.5)),
    wet: smooth(l.t, l.t + 3.0, t),
    vis: 1 - smooth(l.t + 3.8, l.t + 6.0, t),
    sink: smooth(l.t + 2.4, l.t + 6.0, t),
  };
}
// 书页：燃烧着飘落，落水即熄，变成焦黑的一片，顺流而下，渐渐沉没
function pageAt(p, t) {
  const t0 = p.land - p.fall;
  if (t < t0) return null;
  let x, z, y, tilt, rot, burn, heat, alpha = 1, wet = 0;
  if (t < p.land) {
    const u = (t - t0) / p.fall;
    y = p.h0 * Math.pow(1 - u, 1.2);
    x = p.x + Math.sin(u * 5 + p.seed) * 0.12 * (1 - u);
    z = p.z - 0.3 * (1 - u) + Math.cos(u * 4 + p.seed) * 0.06 * (1 - u);
    tilt = Math.sin(u * 6.5 + p.seed) * 0.9 * Math.pow(1 - u, 0.7);
    rot = p.rot + u * p.spin;
    burn = p.burn0 + (t - t0) * 0.06;
    heat = 1;
  } else {
    const a = t - p.land;
    y = 0; tilt = 0;
    x = p.x + Math.sin(a * 0.4 + p.seed) * 0.02;
    z = p.z + E.current * 1.3 * a;
    rot = p.rot + p.spin + a * 0.04;
    burn = p.burn0 + p.fall * 0.06 + Math.min(a, 0.6) * 0.04;
    heat = Math.exp(-a / 0.3);
    wet = smooth(0, 1.2, a);
    alpha = 1 - smooth(11.5, 14.5, t);
  }
  if (t > E.cut.t0) heat *= Math.exp(-(t - E.cut.t0) * 6);
  return { x, z, y, tilt, rot, burn, heat, alpha, wet };
}
const toUV = (x, z) => [x / E.domain + 0.5, z / E.domain + 0.5];

// 本帧（t0, t1] 内发生的水滴
function dropsIn(t0, t1) {
  const out = [];
  for (const r of E.rain) if (r.t > t0 && r.t <= t1) out.push([r.x, r.z, 0.016, 0.0045 * r.a]);
  for (const d of E.hisDrops) if (d > t0 && d <= t1) out.push([E.his.pos[0], E.his.pos[1], 0.022, 0.008]);
  for (const d of E.herDrops) if (d > t0 && d <= t1) out.push([E.her.pos[0], E.her.pos[1], 0.022, 0.008]);
  if (E.sword.drop > t0 && E.sword.drop <= t1) out.push([E.sword.pos[0], E.sword.pos[1], 0.05, 0.006]);
  if (E.letter.t > t0 && E.letter.t <= t1) { const l = letterAt(E.letter.t); out.push([l.x, l.z, 0.07, 0.0016]); }
  for (const p of E.pages) if (p.land > t0 && p.land <= t1) { const q = pageAt(p, p.land); out.push([q.x, q.z, 0.035, 0.0016]); }
  for (const p of E.petals) if (p.t > t0 && p.t <= t1) out.push([p.x, p.z, 0.012, 0.0004]);
  return out.slice(0, 24);
}

// ───────────────────────── 花瓣：落水之后随水流漂，被滴水的波推开，彼此靠拢成簇（落花流水）
let PS = null;
function resetPetals() { PS = E.petals.map((p) => ({ x: p.x, z: p.z, r: p.rot, on: false })); }
function flowVel(x, z, t) {
  return [
    0.022 * Math.sin(1.7 * z + 0.5 * t + 1.3) + 0.010 * Math.sin(3.3 * z - 2.1 * x + 0.8 * t),
    E.current * 1.4 + 0.018 * Math.sin(1.3 * x - 0.4 * t + 0.7) + 0.008 * Math.cos(2.9 * x + 1.7 * z),
  ];
}
function stepPetals(t, dt) {
  const drips = [];
  for (const d of E.hisDrops) if (t - d > 0 && t - d < 3) drips.push([E.his.pos[0], E.his.pos[1], t - d]);
  for (const d of E.herDrops) if (t - d > 0 && t - d < 3) drips.push([E.her.pos[0], E.her.pos[1], t - d]);
  const act = [];
  E.petals.forEach((p, i) => { const s = PS[i]; if (t >= p.t) { if (!s.on) { s.on = true; s.x = p.x; s.z = p.z; s.r = p.rot; } act.push(s); } });
  for (const s of act) {
    let [vx, vz] = flowVel(s.x, s.z, t);
    for (const [dx, dz, age] of drips) {
      const rx = s.x - dx, rz = s.z - dz, r = Math.hypot(rx, rz) + 1e-4;
      const push = (0.07 * Math.exp(-(((r - 0.32 * age) / 0.06) ** 2))) / (1 + 5 * r);
      vx += (push * rx) / r; vz += (push * rz) / r;
    }
    for (const o of act) {
      if (o === s) continue;
      const rx = o.x - s.x, rz = o.z - s.z, r = Math.hypot(rx, rz);
      if (r < 0.07 && r > 1e-5) {
        const k = r < 0.02 ? -0.04 * (1 - r / 0.02) : 0.012 * (1 - r / 0.07);
        vx += (k * rx) / r; vz += (k * rz) / r;
      }
    }
    s.vx = vx; s.vz = vz;
  }
  for (const s of act) { s.x += s.vx * dt; s.z += s.vz * dt; s.r += (s.vx * 3.0 - s.vz * 1.0) * dt; }
}
function petalAt(p, i, t) {
  const t0 = p.t - p.fall;
  if (t < t0) return null;
  if (t < p.t) {
    const u = (t - t0) / p.fall;
    return { x: p.x + Math.sin(u * 7 + p.rot) * 0.05 * (1 - u), z: p.z - 0.08 * (1 - u), y: p.h0 * (1 - u), rot: p.rot + p.spin * 6 * (1 - u), tilt: 0.9 * Math.sin(u * 9 + p.rot) * (1 - u), a: smooth(0, 0.15, u) };
  }
  const s = PS[i];
  return { x: s.x, z: s.z, y: 0, rot: s.r, tilt: 0, a: (1 - smooth(5, 7.5, t - p.t)) * (1 - smooth(27.5, 29.3, t)) };
}

// ───────────────────────── 模拟一步
let simFrame = -1;
function resetSim() {
  for (const f of [simA, simB, dyeA, dyeB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.viewport(0, 0, N, N); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  resetPetals();
  simFrame = 0;
}
const dropArr = new Float32Array(24 * 4);
function stepFrame(f) {
  const t1 = f / FPS, t0 = (f - 1) / FPS;
  const dts = 1 / FPS / SUB;
  const dx = E.domain / N, c = 0.42;
  const k = Math.pow(c * dts / dx, 2);
  const damp = Math.exp(Math.log(0.35) * dts);
  const drops = dropsIn(t0, t1);
  for (let s = 0; s < SUB; s++) {
    const ta = t0 + s * dts, tb = ta + dts;
    unit = 0;
    pass(P.wave, simB, (u) => {
      bind(u, 'S', simA.t);
      gl.uniform2f(u.px, 1 / N, 1 / N);
      gl.uniform1f(u.k, k); gl.uniform1f(u.damp, damp);
      dropArr.fill(0);
      const n = s === 0 ? drops.length : 0;
      for (let i = 0; i < n; i++) { const d = drops[i]; const g = toUV(d[0], d[1]); dropArr.set([g[0], g[1], d[2] / E.domain, d[3]], i * 4); }
      gl.uniform4fv(u.drops, dropArr); gl.uniform1i(u.nd, n);
      // 刀锋
      if (tb > E.cut.t0 && ta < E.cut.t1 + 0.02) {
        const a = toUV(...bladeAt(ta)), b = toUV(...bladeAt(tb));
        gl.uniform4f(u.blade, a[0], a[1], b[0], b[1]);
        gl.uniform2f(u.bladeK, 0.008 / E.domain, 0.0016);
      } else gl.uniform2f(u.bladeK, 1, 0);
    });
    [simA, simB] = [simB, simA];
  }
  // 墨
  unit = 0;
  pass(P.dye, dyeB, (u) => {
    bind(u, 'D', dyeA.t);
    gl.uniform2f(u.px, 1 / N, 1 / N);
    gl.uniform1f(u.dt, 1 / FPS); gl.uniform1f(u.time, t1);
    gl.uniform1f(u.flow, E.current / E.domain);
    const src = [], ch = [];
    const lt = letterAt(t1);
    if (lt && !lt.air && t1 > E.letter.t + 0.4) {
      // 信上的几列字：墨从纸上洇进水里
      const k = smooth(E.letter.t + 0.4, E.letter.t + 2.5, t1) * (1 - smooth(E.letter.t + 6.5, 33, t1) * 0.6);
      for (let i = 0; i < 4; i++) {
        const lx = (-0.06 + i * 0.04), lz = 0.03 * Math.sin(t1 * 2 + i);
        const ca = Math.cos(lt.rot), sa = Math.sin(lt.rot);
        const g = toUV(lt.x + ca * lx - sa * lz, lt.z + sa * lx + ca * lz);
        src.push(g[0], g[1], 0.03 / E.domain, 0.8 * k);
        ch.push(0, 1, 0, 0);
      }
    }
    const n = src.length / 4;
    const S = new Float32Array(48), Cc = new Float32Array(48);
    S.set(src); Cc.set(ch);
    gl.uniform4fv(u.inkSrc, S); gl.uniform4fv(u.inkCh, Cc); gl.uniform1i(u.ns, n);
    if (t1 > E.cut.t0 && t0 < E.cut.t1) {
      const a = toUV(...bladeAt(t0)), b = toUV(...bladeAt(t1));
      gl.uniform4f(u.blade, a[0], a[1], b[0], b[1]);
      gl.uniform2f(u.bladeK, 0.04 / E.domain, 1); gl.uniform3f(u.bladeCol, 0.32, 0, 0);
    } else gl.uniform2f(u.bladeK, 1, 0);
  });
  [dyeA, dyeB] = [dyeB, dyeA];
  stepPetals(t1, 1 / FPS);
  simFrame = f;
}

// ───────────────────────── 画一帧
const splashArr = new Float32Array(16 * 4);
function draw(f) {
  const t = f / FPS;
  L = lightDir(t);
  const e = era(t);
  const lc = lightAt(t, e);
  const cam = camAt(t);
  const view = lookAt(cam.eye, cam.tgt, cam.up);
  const proj = persp((cam.fov * Math.PI) / 180, W / H, 0.05, 100);
  const VP = mul(proj, view), iVP = inv(VP);

  // 焦散（水滴的波）
  gl.bindFramebuffer(gl.FRAMEBUFFER, caus.f); gl.viewport(0, 0, N, N);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(P.caustic.p); unit = 0;
  bind(P.caustic.u, 'S', simA.t);
  gl.uniform2f(P.caustic.u.px, 1 / N, 1 / N);
  gl.uniform1f(P.caustic.u.dom, E.domain); gl.uniform1f(P.caustic.u.depth, E.depth); gl.uniform1f(P.caustic.u.nScale, 1.0);
  gl.uniform3fv(P.caustic.u.L, L);
  gl.bindVertexArray(cVAO); gl.drawElements(gl.TRIANGLES, cCount, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);

  // 漂浮物：数据
  let nf = 0;
  const put = (arr) => { if (nf < MAXF) { fData.set(arr, nf * FST); nf++; } };
  E.petals.forEach((p, i) => {
    const q = petalAt(p, i, t);
    if (!q || q.a <= 0.002) return;
    const whole = p.kind === 5;
    put([q.x, q.z, q.rot, (whole ? 0.034 : 0.02) * p.s, p.kind, q.a, whole ? 1.0 : 0.75, 0, q.y, q.tilt, 0, p.s, 0, 0, 0, 0]);
  });
  for (const p of E.pages) {
    const q = pageAt(p, t);
    if (!q || q.alpha <= 0.002) continue;
    put([q.x, q.z, q.rot, p.size, 11, q.alpha, p.aspect, q.heat, q.y, q.tilt, q.burn, p.seed, q.wet, 0, 0, 0]);
  }
  const lt = letterAt(t);
  if (lt && lt.air) put([lt.x, lt.z, lt.rot, LETTER_HH, 10, 1, LETTER_HW / LETTER_HH, 0, lt.y, lt.tilt, 0, 0, 0, 0, 0, 0]);
  gl.bindBuffer(gl.ARRAY_BUFFER, fInst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, fData.subarray(0, nf * FST));
  const floatUniforms = (u, shadow, mirror) => {
    unit = 0;
    bind(u, 'S', simA.t); bind(u, 'letterT', letterT);
    gl.uniform2f(u.px, 1 / N, 1 / N); gl.uniform1f(u.dom, E.domain); gl.uniform1f(u.nScale, 1.0);
    gl.uniformMatrix4fv(u.VP, false, new Float32Array(VP));
    gl.uniform3fv(u.Lsh, L); gl.uniform1f(u.depth, E.depth); gl.uniform1f(u.shadowPass, shadow); gl.uniform1f(u.mirrorPass, mirror);
    gl.uniform3fv(u.L, L); gl.uniform3fv(u.lightCol, lc); gl.uniform3fv(u.eyeP, cam.eye); gl.uniform1f(u.ambient, 0.03); gl.uniform1f(u.time, t);
  };
  const drawFloats = () => { gl.bindVertexArray(fVAO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nf); gl.bindVertexArray(null); };
  // 阴影（投到河床）
  gl.bindFramebuffer(gl.FRAMEBUFFER, shad.f); gl.viewport(0, 0, 512, 512);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  if (nf) { gl.useProgram(P.float.p); floatUniforms(P.float.u, 1, 0); gl.blendFunc(gl.ONE, gl.ONE); drawFloats(); }
  gl.disable(gl.BLEND);

  // 水
  const sw = swordAt(t);
  const fall = new Float32Array(8);
  let fi = 0;
  for (const [list, pos] of [[E.hisDrops, E.his.pos], [E.herDrops, E.her.pos]]) {
    for (const d of list) {
      const tau = d - t;
      if (tau > 0 && tau < 0.32) { const y = 0.9 * Math.pow(tau / 0.32, 2); fall.set([pos[0], y, pos[1], smooth(0.32, 0.22, tau)], fi * 4); break; }
    }
    fi++;
  }
  splashArr.fill(0);
  let nsp = 0;
  for (const r of E.rain) { const a = t - r.t; if (a >= 0 && a < 0.08 && nsp < 16) { splashArr.set([r.x, r.z, 0.005, (1 - a / 0.08) * r.a * 0.6], nsp * 4); nsp++; } }
  if (t >= E.cut.t0 && t < E.cut.t1 + 0.25) {
    for (let k = 0; k < 6 && nsp < 16; k++) {
      const tt = t - k * 0.03; if (tt < E.cut.t0) break;
      const b = bladeAt(Math.min(tt, E.cut.t1)); const age = t - tt;
      splashArr.set([b[0] + Math.sin(k * 7) * 0.03, b[1] + Math.cos(k * 5) * 0.03, 0.01, 1.0 * Math.exp(-age * 12)], nsp * 4); nsp++;
    }
  }
  for (const [list, pos] of [[E.hisDrops, E.his.pos], [E.herDrops, E.her.pos]]) for (const d of list) { const a = t - d; if (a >= 0 && a < 0.1 && nsp < 16) { splashArr.set([pos[0], pos[1], 0.007, (1 - a / 0.1) * 1.0], nsp * 4); nsp++; } }

  pass(P.water, hdr, (u) => {
    unit = 0;
    bind(u, 'S', simA.t); bind(u, 'Ctex', caus.t); bind(u, 'Dtex', dyeA.t); bind(u, 'Shtex', shad.t); bind(u, 'titleT', titleT); bind(u, 'letterT', letterT);
    gl.uniform2f(u.px, 1 / N, 1 / N); gl.uniform2f(u.res, W, H);
    gl.uniform1f(u.dom, E.domain); gl.uniform1f(u.depth, E.depth); gl.uniform1f(u.nScale, 1.0); gl.uniform1f(u.time, t);
    gl.uniform1f(u.pixA, (2 * Math.tan((cam.fov * Math.PI) / 360)) / H);
    gl.uniform3fv(u.eyeP, cam.eye); gl.uniformMatrix4fv(u.invVP, false, new Float32Array(iVP));
    gl.uniform3fv(u.L, L); gl.uniform3fv(u.lightCol, lc); gl.uniform1f(u.ambient, 0.005 + 0.007 * e.eCity);
    gl.uniform3fv(u.moonD, MOON); gl.uniform3fv(u.herD, HER);
    // 光池：灯是一小池暖光；火与月更大、更散
    const pr = 0.7 * e.eLamp + 1.6 * e.eFire + 1.1 * e.eMoon * (1 - e.eCity) + 2.5 * e.eCity + 0.2;
    const pc = [lerp(0.05, -0.05, e.eMoon), lerp(0.25, 0.3, e.eMoon)];
    gl.uniform3f(u.pool, pc[0], pc[1], pr);
    gl.uniform4f(u.herPool, E.her.pos[0], E.her.pos[1], 0.42, 0.9 * e.eHer);
    for (const k of Object.keys(e)) gl.uniform1f(u[k], e[k]);
    gl.uniform4fv(u.waves, wavesAt(t)); gl.uniform1f(u.chop, chopAt(t)); gl.uniform1f(u.gustT, t * 0.05);
    if (sw) {
      gl.uniform3fv(u.swordP, sw.p); gl.uniform1f(u.swordA, sw.a); gl.uniform1f(u.swordBury, sw.bury); gl.uniform1f(u.swordVis, sw.vis); gl.uniform1f(u.swordBlur, sw.blur);
    } else gl.uniform1f(u.swordVis, 0);
    if (lt && !lt.air) {
      gl.uniform4f(u.letterP, lt.x, lt.y, lt.z, lt.rot); gl.uniform4f(u.letterK, lt.wet, lt.vis, LETTER_HW, LETTER_HH * (1 - 0.3 * lt.sink));
    } else gl.uniform4f(u.letterK, 0, 0, LETTER_HW, LETTER_HH);
    // 刀锋扫过：轨迹上的白浪很快消失
    const b = bladeAt(t), a2 = bladeAt(E.cut.t0);
    gl.uniform4f(u.bladeSeg, a2[0], a2[1], b[0], b[1]);
    gl.uniform1f(u.bladeGlow, t > E.cut.t1 + 1.5 ? 0 : Math.exp(-Math.max(0, t - E.cut.t1) * 4.0) * smooth(E.cut.t0, E.cut.t0 + 0.03, t));
    gl.uniform4fv(u.fall, fall);
    gl.uniform4fv(u.splash, splashArr); gl.uniform1i(u.nsp, nsp);
  });
  // 漂浮物：先画书页火光在水里的倒影，再画它们本身
  if (nf) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.f); gl.viewport(0, 0, W, H);
    gl.enable(gl.BLEND);
    gl.useProgram(P.float.p);
    gl.blendFunc(gl.ONE, gl.ONE); floatUniforms(P.float.u, 0, 1); drawFloats();
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); floatUniforms(P.float.u, 0, 0); drawFloats();
    gl.disable(gl.BLEND);
  }
  // 光晕
  let src = hdr.t;
  for (let i = 0; i < bl.length; i++) {
    const [A, B] = bl[i];
    unit = 0;
    if (i === 0) pass(P.bright, A, (u) => bind(u, 'tex', src));
    else pass(P.blur, A, (u) => { bind(u, 'tex', src); gl.uniform2f(u.dir, 0, 0); });
    unit = 0; pass(P.blur, B, (u) => { bind(u, 'tex', A.t); gl.uniform2f(u.dir, 1 / A.w, 0); });
    unit = 0; pass(P.blur, A, (u) => { bind(u, 'tex', B.t); gl.uniform2f(u.dir, 0, 1 / A.h); });
    src = A.t;
  }
  const fade = smooth(0.0, 1.4, t) * (1 - smooth(E.fadeOut[0], E.fadeOut[1], t));
  unit = 0;
  pass(P.final, null, (u) => {
    bind(u, 'hdr', hdr.t); bind(u, 'b1', bl[0][0].t); bind(u, 'b2', bl[1][0].t); bind(u, 'b3', bl[2][0].t);
    gl.uniform2f(u.res, W, H); gl.uniform1f(u.frame, f); gl.uniform1f(u.fade, fade);
    gl.uniform1f(u.exposure, 1.25); gl.uniform1f(u.grain, 0.016);
  });
}

function renderFrame(t, frame) {
  const f = frame ?? Math.round(t * FPS);
  if (f < simFrame || simFrame < 0) resetSim();
  while (simFrame < f) stepFrame(simFrame + 1);
  draw(f);
  return true;
}

async function init() {
  E = await (await fetch('assets/events.json')).json();
  { const c = camAt(21); HER = norm([(E.her.pos[0] - c.eye[0]) / c.eye[1], 1, (E.her.pos[1] - c.eye[2]) / c.eye[1]]); }
  for (const [fam, file] of [['WH Serif Light', 'serif-light']]) {
    const ff = new FontFace(fam, `url(assets/fonts/${file}.woff2)`); await ff.load(); document.fonts.add(ff);
  }
  // 题：倒影里的四个字
  {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '300 300px "WH Serif Light"';
    const s = '万花行记'; const sp = 430;
    [...s].forEach((ch, i) => x.fillText(ch, 1024 + (i - 1.5) * sp, 270));
    titleT = canvasTexture(c);
  }
  // 信：她留下的信。信里写了什么，原作没有说，所以这里只有笔迹，没有字
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 720;
    const x = c.getContext('2d');
    let seed = 1773;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    x.lineCap = 'round'; x.lineJoin = 'round';
    const stroke = (pts, w0, w1, a) => {
      // 一笔：由粗到细（提按），分段画
      for (let i = 1; i < pts.length; i++) {
        const u = i / (pts.length - 1);
        x.strokeStyle = `rgba(18,20,36,${a})`;
        x.lineWidth = w0 + (w1 - w0) * u;
        x.beginPath(); x.moveTo(...pts[i - 1]); x.lineTo(...pts[i]); x.stroke();
      }
    };
    const cols = 6, rows = 12, cw = 66, ch = 52;
    for (let col = 0; col < cols; col++) {
      const n = col === cols - 1 ? 5 : rows - (rnd() < 0.3 ? 1 : 0);
      for (let r = 0; r < n; r++) {
        const cx = 448 - col * cw + (rnd() - 0.5) * 4, cy = 62 + r * ch + (rnd() - 0.5) * 4;
        const a = 0.55 + 0.4 * rnd();
        const k = 3 + Math.floor(rnd() * 4);
        for (let j = 0; j < k; j++) {
          const kind = rnd();
          const ox = cx + (rnd() - 0.5) * 22, oy = cy + (rnd() - 0.5) * 22;
          if (kind < 0.3) { const L = 10 + rnd() * 16; stroke([[ox - L / 2, oy], [ox, oy - 1], [ox + L / 2, oy + 1]], 4.5, 2.5, a); }          // 横
          else if (kind < 0.55) { const L = 12 + rnd() * 18; stroke([[ox, oy - L / 2], [ox + 1, oy], [ox, oy + L / 2]], 4.5, 2.0, a); }      // 竖
          else if (kind < 0.72) { const L = 10 + rnd() * 14; stroke([[ox + 4, oy - L / 2], [ox, oy], [ox - L / 2, oy + L / 2]], 4.0, 1.2, a); } // 撇
          else if (kind < 0.86) { const L = 10 + rnd() * 14; stroke([[ox - 4, oy - L / 2], [ox, oy], [ox + L / 2, oy + L / 2 + 2]], 2.0, 5.0, a); } // 捺
          else { stroke([[ox, oy], [ox + 2.5, oy + 3]], 5.0, 3.0, a); }                                                                   // 点
        }
      }
    }
    letterT = canvasTexture(c);
  }
  return { W, H, FPS, duration: E.duration, sequential: true };
}

window.PV = { ready: init(), renderFrame, grab: (type = 'image/png', q) => canvas.toDataURL(type, q) };
