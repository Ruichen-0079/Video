// WebGL2 小工具：程序、纹理、帧缓冲（含多重采样）、网格缓冲
export let gl = null;
export function initGL(canvas) {
  gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
  if (!gl) throw new Error('no webgl2');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float FBO');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

function compile(type, src, name) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`[${name}] ` + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
  }
  return s;
}
export function program(vs, fs, attribs = [], name = '?') {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs, name)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs, name));
  attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[${name}] ` + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u, name };
}

export function texture(w, h, { fmt = 'RGBA16F', filter = 'LINEAR', wrap = 'CLAMP_TO_EDGE', data = null } = {}) {
  const F = {
    RGBA16F: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], RGBA32F: [gl.RGBA32F, gl.RGBA, gl.FLOAT], RGBA8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
    R32F: [gl.R32F, gl.RED, gl.FLOAT], R16F: [gl.R16F, gl.RED, gl.HALF_FLOAT], DEPTH: [gl.DEPTH_COMPONENT32F, gl.DEPTH_COMPONENT, gl.FLOAT],
  }[fmt];
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[filter]); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[filter]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl[wrap]); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl[wrap]);
  t.w = w; t.h = h; t.fmt = F;
  return t;
}
export function fbo(colors, depth = null) {
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  colors.forEach((c, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, c, 0));
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  gl.drawBuffers(colors.length ? colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i) : [gl.NONE]);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete ' + st);
  const w = (colors[0] || depth).w, h = (colors[0] || depth).h;
  return { f, colors, depth, w, h };
}
// 多重采样帧缓冲：nColor 个 RGBA16F + 深度
export function msaaFbo(w, h, nColor, samples) {
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  const rbs = [];
  for (let i = 0; i < nColor; i++) {
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, rb); rbs.push(rb);
  }
  const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
  gl.drawBuffers(rbs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('msaa fbo incomplete ' + st);
  return { f, rbs, depth: d, w, h, samples };
}
// 把多重采样缓冲的第 i 个颜色附件解析到普通帧缓冲
export function resolve(src, i, dst) {
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.f); gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.f); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.blitFramebuffer(0, 0, src.w, src.h, 0, 0, dst.w, dst.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
}

// 网格：attrs = { name: {data: Float32Array, size} }，按 layout 顺序绑定到 0..n
export function mesh(layout, attrs, index = null, { dynamic = false } = {}) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const bufs = {};
  layout.forEach((name, i) => {
    const a = attrs[name]; if (!a) return;
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, a.data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(i);
    if (a.int) gl.vertexAttribIPointer(i, a.size, gl.UNSIGNED_BYTE, 0, 0);
    else gl.vertexAttribPointer(i, a.size, a.type || gl.FLOAT, !!a.normalized, 0, 0);
    if (a.divisor) gl.vertexAttribDivisor(i, a.divisor);
    bufs[name] = b;
  });
  let ib = null, count = 0, itype = gl.UNSIGNED_INT;
  if (index) {
    ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const arr = index instanceof Uint32Array ? index : new Uint32Array(index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, gl.STATIC_DRAW); count = arr.length;
  } else count = attrs[layout[0]].data.length / attrs[layout[0]].size;
  gl.bindVertexArray(null);
  return { vao, bufs, ib, count, itype, layout };
}
export function updateAttr(m, name, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, m.bufs[name]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
}

let quad = null;
export function fullscreen() {
  if (!quad) quad = mesh(['p'], { p: { data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), size: 2 } });
  gl.bindVertexArray(quad.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
}
let unit = 0;
export const resetUnits = () => { unit = 0; };
export function bindTex(u, name, t) {
  if (u[name] === undefined || u[name] === null) return;
  gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u[name], unit); unit++;
}
// 一遍全屏处理
export function pass(P, target, setup) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
  gl.viewport(0, 0, target ? target.w : gl.canvas.width, target ? target.h : gl.canvas.height);
  gl.useProgram(P.p); resetUnits(); setup(P.u); fullscreen();
}
export const VS_QUAD = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
