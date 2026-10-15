// WebGL2 合成器
//
// 画面由两种「物质」组成，对应原作「历史事实与私人记忆，可以有各自不同的表达方式」：
//   墨（ink）——吸收光，落在纸上，是记载；
//   光（light）——加色发光，落在夜里，是活过的时间。
// 每一帧：背景（夜 ↔ 纸，可连续插值）× exp(-墨) + 光 + 光晕，再加胶片颗粒与暗角。

const VS_QUAD = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

// 线与点：屏幕空间像素坐标，uv 决定横截面衰减
const VS_LINE = `#version 300 es
uniform vec2 res;
in vec2 pos; in vec2 uv; in vec4 col;
out vec2 vuv; out vec4 vcol;
void main(){
  vuv = uv; vcol = col;
  vec2 c = pos / res * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0., 1.);
}`;
const FS_LINE = `#version 300 es
precision highp float;
in vec2 vuv; in vec4 vcol; out vec4 o;
void main(){
  float r2 = dot(vuv, vuv);
  // 中心实、边缘柔：高斯 + 一点硬核，让细线不发虚
  float a = exp(-r2 * 4.2) * 0.85 + (1.0 - smoothstep(0.0, 1.0, r2)) * 0.15;
  o = vcol * a;
}`;

const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D tex; uniform vec2 dir; in vec2 uv; out vec4 o;
void main(){
  vec4 s = texture(tex, uv) * 0.2270270270;
  s += texture(tex, uv + dir * 1.3846153846) * 0.3162162162;
  s += texture(tex, uv - dir * 1.3846153846) * 0.3162162162;
  s += texture(tex, uv + dir * 3.2307692308) * 0.0702702703;
  s += texture(tex, uv - dir * 3.2307692308) * 0.0702702703;
  o = s;
}`;

const FS_COPY = `#version 300 es
precision highp float;
uniform sampler2D tex; uniform sampler2D tex2; uniform float k2; in vec2 uv; out vec4 o;
void main(){ o = texture(tex, uv) + texture(tex2, uv) * k2; }`;

const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D lightT, inkT, lightC, inkC, b1, b2, b3, b4, occC;
uniform vec2 res; uniform float time, frame;
uniform float paper;      // 0 夜 → 1 纸
uniform float exposure, bloomK, grainK, vignK, fade, inkK;
uniform vec3 nightA, nightB, paperCol, tint;
// 转场「焚 / 洇」：burn 为进度，burnC 为起点；mode 0 火（余烬边）、1 墨洇（暗边）、2 光（白边）
uniform float burn, burnMode, inkSel, lightSel; uniform vec2 burnC;
in vec2 uv; out vec4 o;

float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float ih(vec2 p, float s){ uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y ^ uint(s)*2654435761u) * 1597334673u; n ^= n >> 16; n *= 2246822519u; n ^= n >> 13; return float(n) * (1.0/4294967296.0); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.02; a*=.5; } return s; }

vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }

void main(){
  vec2 px = uv * res;
  vec2 q = px / res.y;                    // 与分辨率无关的纹理坐标
  // ── 夜：上深下略亮的蓝黑，带极淡的云气
  float cloud = fbm(q * 1.6 + vec2(time*0.004, 0.)) ;
  vec3 night = mix(nightB, nightA, smoothstep(0.0, 1.0, uv.y)) * (0.85 + 0.3*cloud);
  // ── 纸：宣纸的纤维与云絮
  float fib = fbm(q * vec2(9., 140.)) * 0.5 + fbm(q * vec2(120., 7.)) * 0.5;
  float blot = fbm(q * 3.0 + 7.3);
  vec3 pap = paperCol * (0.93 + 0.05*blot + 0.04*(fib-0.5));
  float mask = 0.0, edge = 0.0, fld = 1e3;
  if (burn > -0.5) {
    vec2 bc = q - burnC;
    fld = length(bc) * 0.75 + (fbm(q * 2.3 + 3.1) - 0.5) * 0.55 + (fbm(q * 11.0) - 0.5) * 0.08;
    float soft = burnMode > 0.5 && burnMode < 1.5 ? 0.035 : 0.006;
    mask = 1.0 - smoothstep(burn - soft, burn + soft * 0.3, fld);
    edge = exp(-pow((fld - burn) / 0.012, 2.0)) + 0.35 * exp(-pow((fld - burn) / 0.05, 2.0));
  }
  float pl = mix(paper, 1.0 - paper, mask);
  vec3 bg = mix(night, pap, pl);
  float km = (inkSel > 0.0) ? mask : 1.0 - mask;
  float inkMul = mix(1.0, km, abs(inkSel));
  float lm = (lightSel > 0.0) ? mask : 1.0 - mask;
  float lightMul = mix(1.0, lm, abs(lightSel));

  // ── 墨：线条墨 + 文字墨。纸纹会让墨色不匀
  vec3 ink = texture(inkT, uv).rgb;
  vec4 ic = texture(inkC, uv);
  // 画布上的墨：rgb 是「在白纸上看起来的颜色」，转换为吸收率
  vec3 icAbs = -log(clamp(ic.rgb, vec3(0.03), vec3(1.0))) * ic.a;
  float grainInk = 0.8 + 0.4 * fbm(q * 60.0);
  vec3 absorb = (ink + icAbs) * grainInk * inkK * inkMul;
  vec3 col = bg * exp(-absorb);

  // ── 光
  vec3 L = texture(lightT, uv).rgb + texture(lightC, uv).rgb;
  vec3 B = texture(b1, uv).rgb * 0.55 + texture(b2, uv).rgb * 0.75 + texture(b3, uv).rgb * 0.9 + texture(b4, uv).rgb * 1.1;
  // 剪影（夜）：遮住其后的光；光晕在其后加上，会从边缘漫进来——逆光的感觉
  vec4 oc = texture(occC, uv);
  oc.a *= lightMul;   // 剪影属于夜的世界，转场时和光一起被烧掉或显现
  col += L * lightMul;
  col = mix(col, oc.rgb, oc.a);   // 纹理是非预乘的：rgb 即颜色
  col += B * bloomK * lightMul * (1.0 - 0.9 * oc.a);
  if (burn > -0.5) {
    if (burnMode < 0.5) col += vec3(1.6, 0.55, 0.15) * (0.6 + 0.8 * fbm(q * 30.0 + time)) * edge;
    else if (burnMode < 1.5) {
      // 墨洇：边缘外侧有一圈渐淡的晕，带纸纤维的毛边
      float dd = max(fld - burn, 0.0);
      float halo = exp(-dd / (0.035 + 0.03 * fbm(q * 18.0)));
      col *= 1.0 - 0.75 * halo * (0.7 + 0.3 * fib);
    }
    else col += vec3(1.4, 1.3, 1.1) * edge;
    col = max(col, 0.0);
  }
  col *= tint;

  // 暗角
  vec2 d = uv - 0.5; d.x *= res.x / res.y;
  col *= 1.0 - vignK * smoothstep(0.35, 1.05, length(d));

  col = aces(col * exposure);
  col *= fade;
  // 颗粒：每帧不同但可复现
  col = pow(max(col, 0.0), vec3(1.0/2.2));
  // 颗粒加在显示空间（伽马之后），暗部不会被放大成噪点
  float g = (ih(px, frame) + ih(px, frame + 7.0) - 1.0) * 0.7;
  col += g * grainK;
  // 抖动，避免暗部色带
  col += (ih(px, frame + 13.0) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function program(gl, vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

function makeFB(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete ' + st);
  return { tex, fb, w, h };
}

function canvasTex(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

// ───────────────────────────── 线条批处理
export class LineBatch {
  constructor() {
    this.cap = 1 << 16;
    this.v = new Float32Array(this.cap * 8);
    this.n = 0;              // 顶点数
    this.idx = new Uint32Array(this.cap * 3);
    this.ni = 0;
    this.pts = [];           // 当前折线暂存
  }
  grow(nv, ni) {
    while (this.n + nv > this.cap || this.ni + ni > this.idx.length) {
      this.cap *= 2;
      const v = new Float32Array(this.cap * 8); v.set(this.v); this.v = v;
      const id = new Uint32Array(this.cap * 3); id.set(this.idx); this.idx = id;
    }
  }
  vert(x, y, u, w, r, g, b, a) {
    const o = this.n * 8;
    const v = this.v;
    v[o] = x; v[o + 1] = y; v[o + 2] = u; v[o + 3] = w; v[o + 4] = r; v[o + 5] = g; v[o + 6] = b; v[o + 7] = a;
    return this.n++;
  }
  // 点：半径 rad（像素），颜色已预乘强度
  dot(x, y, rad, r, g, b, a) {
    if (a <= 0.0005) return;
    if (rad < 0.8) { a *= (rad / 0.8) * (rad / 0.8); rad = 0.8; }
    rad *= 1.6;
    this.grow(4, 6);
    const i0 = this.vert(x - rad, y - rad, -1, -1, r * a, g * a, b * a, a);
    this.vert(x + rad, y - rad, 1, -1, r * a, g * a, b * a, a);
    this.vert(x + rad, y + rad, 1, 1, r * a, g * a, b * a, a);
    this.vert(x - rad, y + rad, -1, 1, r * a, g * a, b * a, a);
    const I = this.idx; let k = this.ni;
    I[k++] = i0; I[k++] = i0 + 1; I[k++] = i0 + 2; I[k++] = i0; I[k++] = i0 + 2; I[k++] = i0 + 3;
    this.ni = k;
  }
  // 折线：逐点添加，end() 时三角化
  p(x, y, w, r, g, b, a) { this.pts.push(x, y, w, r, g, b, a); }
  end() {
    const P = this.pts;
    const m = P.length / 7;
    if (m < 2) { this.pts.length = 0; return; }
    this.grow(m * 2, (m - 1) * 6);
    const base = this.n;
    for (let i = 0; i < m; i++) {
      const o = i * 7;
      const x = P[o], y = P[o + 1];
      const i0 = Math.max(0, i - 1) * 7, i1 = Math.min(m - 1, i + 1) * 7;
      let dx = P[i1] - P[i0], dy = P[i1 + 1] - P[i0 + 1];
      const L = Math.hypot(dx, dy) || 1;
      dx /= L; dy /= L;
      let w = P[o + 2], a = P[o + 6];
      // 亚像素线：保持最小宽度，用透明度补偿能量，避免锯齿闪烁
      if (w < 1.1) { a *= w / 1.1; w = 1.1; }
      const hw = w * 0.5 * 1.7;
      const nx = -dy * hw, ny = dx * hw;
      const r = P[o + 3] * a, g = P[o + 4] * a, b = P[o + 5] * a;
      this.vert(x + nx, y + ny, 0, 1, r, g, b, a);
      this.vert(x - nx, y - ny, 0, -1, r, g, b, a);
    }
    const I = this.idx; let k = this.ni;
    for (let i = 0; i < m - 1; i++) {
      const a0 = base + i * 2;
      I[k++] = a0; I[k++] = a0 + 1; I[k++] = a0 + 2;
      I[k++] = a0 + 1; I[k++] = a0 + 3; I[k++] = a0 + 2;
    }
    this.ni = k;
    this.pts.length = 0;
  }
  clear() { this.n = 0; this.ni = 0; this.pts.length = 0; }
}

// ───────────────────────────── 渲染器
export class Renderer {
  constructor(canvas, W, H) {
    this.W = W; this.H = H;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();

    this.pLine = program(gl, VS_LINE, FS_LINE, ['pos', 'uv', 'col']);
    this.pBlur = program(gl, VS_QUAD, FS_BLUR, ['p']);
    this.pCopy = program(gl, VS_QUAD, FS_COPY, ['p']);
    this.pFinal = program(gl, VS_QUAD, FS_FINAL, ['p']);

    this.light = makeFB(gl, W, H);
    this.ink = makeFB(gl, W, H);
    this.bl = [];
    let w = W, h = H;
    for (let i = 0; i < 4; i++) {
      w = Math.max(8, Math.round(w / 2)); h = Math.max(8, Math.round(h / 2));
      this.bl.push([makeFB(gl, w, h), makeFB(gl, w, h)]);
    }
    this.texLightC = canvasTex(gl);
    this.texInkC = canvasTex(gl);
    this.texOccC = canvasTex(gl);

    this.lineVBO = gl.createBuffer();
    this.lineIBO = gl.createBuffer();
    this.lineVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIBO);
    gl.bindVertexArray(null);

    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.lightLines = new LineBatch();
    this.inkLines = new LineBatch();
  }

  begin() {
    const gl = this.gl;
    for (const fb of [this.light, this.ink]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb.fb);
      gl.viewport(0, 0, fb.w, fb.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.lightLines.clear();
    this.inkLines.clear();
  }

  drawBatch(batch, fb) {
    if (batch.ni === 0) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.fb);
    gl.viewport(0, 0, fb.w, fb.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pLine.p);
    gl.uniform2f(this.pLine.u.res, this.W, this.H);
    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, batch.v.subarray(0, batch.n * 8), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, batch.idx.subarray(0, batch.ni), gl.STREAM_DRAW);
    gl.drawElements(gl.TRIANGLES, batch.ni, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    batch.clear();
  }

  // 中途刷新（批次很大时可以分段提交）
  flush() {
    this.drawBatch(this.lightLines, this.light);
    this.drawBatch(this.inkLines, this.ink);
  }

  upload(tex, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  pass(prog, target, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
    gl.useProgram(prog.p);
    setup(prog.u);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  bindTex(unit, tex) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  finish(lightCanvas, inkCanvas, P, occCanvas) {
    const gl = this.gl;
    this.flush();
    this.upload(this.texLightC, lightCanvas);
    this.upload(this.texInkC, inkCanvas);
    this.upload(this.texOccC, occCanvas);

    // 光晕：逐级降采样 + 高斯
    let src = this.light.tex, src2 = this.texLightC;
    for (let i = 0; i < this.bl.length; i++) {
      const [a, b] = this.bl[i];
      this.pass(this.pCopy, a, (u) => {
        this.bindTex(0, src); gl.uniform1i(u.tex, 0);
        this.bindTex(1, src2); gl.uniform1i(u.tex2, 1);
        gl.uniform1f(u.k2, i === 0 ? (P.textBloom ?? 0.3) : 0);
      });
      this.pass(this.pBlur, b, (u) => { this.bindTex(0, a.tex); gl.uniform1i(u.tex, 0); gl.uniform2f(u.dir, 1 / a.w, 0); });
      this.pass(this.pBlur, a, (u) => { this.bindTex(0, b.tex); gl.uniform1i(u.tex, 0); gl.uniform2f(u.dir, 0, 1 / a.h); });
      src = a.tex; src2 = a.tex;
    }

    this.pass(this.pFinal, null, (u) => {
      const T = [this.light.tex, this.ink.tex, this.texLightC, this.texInkC, this.bl[0][0].tex, this.bl[1][0].tex, this.bl[2][0].tex, this.bl[3][0].tex, this.texOccC];
      const N = ['lightT', 'inkT', 'lightC', 'inkC', 'b1', 'b2', 'b3', 'b4', 'occC'];
      T.forEach((t, i) => { this.bindTex(i, t); gl.uniform1i(u[N[i]], i); });
      gl.uniform2f(u.res, this.W, this.H);
      gl.uniform1f(u.time, P.time);
      gl.uniform1f(u.frame, P.frame);
      gl.uniform1f(u.paper, P.paper);
      gl.uniform1f(u.exposure, P.exposure);
      gl.uniform1f(u.bloomK, P.bloom);
      gl.uniform1f(u.grainK, P.grain);
      gl.uniform1f(u.vignK, P.vignette);
      gl.uniform1f(u.fade, P.fade);
      gl.uniform1f(u.inkK, P.inkK);
      gl.uniform3fv(u.nightA, P.nightA);
      gl.uniform3fv(u.nightB, P.nightB);
      gl.uniform3fv(u.paperCol, P.paperCol);
      gl.uniform3fv(u.tint, P.tint);
      gl.uniform1f(u.burn, P.burn ?? -1);
      gl.uniform1f(u.burnMode, P.burnMode ?? 0);
      gl.uniform1f(u.inkSel, P.inkSel ?? 0);
      gl.uniform1f(u.lightSel, P.lightSel ?? 0);
      gl.uniform2fv(u.burnC, P.burnC ?? [0.9, 0.5]);
    });
  }
}
