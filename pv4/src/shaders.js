// 着色器：标准材质、蒙皮、布料、草、海、天空、粒子、阴影与后期
export const COMMON = `
uniform vec3 camPos;
uniform vec3 sunDir; uniform vec3 sunCol;
uniform vec3 skyAmb, gndAmb, rimCol;
uniform vec4 plPos[8]; uniform vec4 plCol[8]; uniform int nPl;
uniform vec4 fogP; uniform vec3 fogCol, fogSunCol;
uniform sampler2D shadowMap; uniform mat4 shadowVP; uniform float shadowOn, shadowSoft;
uniform float time;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vno(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vno(p); p*=2.03; a*=.5; } return s; }
float shadowAt(vec3 P, vec3 N){
  if (shadowOn < 0.5) return 1.0;
  vec3 q = P + N * 0.02 + sunDir * 0.01;
  vec4 s = shadowVP * vec4(q, 1.0);
  vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float sum = 0.0;
  vec2 ts = vec2(shadowSoft) / vec2(textureSize(shadowMap, 0));
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    float d = texture(shadowMap, c.xy + vec2(i, j) * ts).r;
    sum += c.z - 0.0015 > d ? 0.0 : 1.0;
  }
  return sum / 25.0;
}
vec3 shade(vec3 P, vec3 N, vec3 alb, float rough, vec4 m){
  float emis = m.x, sss = m.y, sheen = m.z, ao = m.w;
  vec3 V = normalize(camPos - P);
  float ndl = dot(N, sunDir);
  float sh = shadowAt(P, N);
  float wrap = sss * 0.6 + sheen * 0.25;
  float diff = max((ndl + wrap) / (1.0 + wrap), 0.0);
  vec3 H = normalize(sunDir + V);
  float a = max(rough * rough, 0.02); float a2 = a * a; float ndh = max(dot(N, H), 0.0);
  float D = a2 / (3.14159 * pow(ndh * ndh * (a2 - 1.0) + 1.0, 2.0));
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = min(D * F * 0.25, 8.0) * max(ndl, 0.0);
  vec3 col = alb * sunCol * diff * sh + sunCol * spec * sh;
  col += alb * vec3(1.0, 0.35, 0.25) * sss * 0.18 * smoothstep(0.4, -0.1, ndl) * smoothstep(-0.6, 0.0, ndl) * sunCol * sh;
  vec3 amb = mix(gndAmb, skyAmb, N.y * 0.5 + 0.5);
  col += alb * amb * ao;
  for (int i = 0; i < 8; i++) {
    if (i >= nPl) break;
    vec3 d = plPos[i].xyz - P; float dl = length(d); vec3 l = d / max(dl, 1e-4);
    float att = 1.0 / (1.0 + dl * dl / (plPos[i].w * plPos[i].w));
    float nl = max((dot(N, l) + wrap) / (1.0 + wrap), 0.0);
    vec3 Hl = normalize(l + V); float Dl = a2 / (3.14159 * pow(pow(max(dot(N, Hl), 0.0), 2.0) * (a2 - 1.0) + 1.0, 2.0));
    col += plCol[i].rgb * att * (alb * nl + min(Dl * 0.04, 4.0) * max(dot(N, l), 0.0));
  }
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += rimCol * fr * (0.35 + sheen * 0.8) * ao;
  col += alb * emis;
  return col;
}
vec3 fogged(vec3 col, vec3 P){
  vec3 d = P - camPos; float dist = length(d); vec3 rd = d / max(dist, 1e-4);
  float k = fogP.y;
  float y0 = camPos.y - fogP.z, y1 = P.y - fogP.z;
  float integ = abs(y1 - y0) > 1e-3 ? (exp(-k * y0) - exp(-k * y1)) / (k * (y1 - y0)) : exp(-k * y0);
  float f = 1.0 - exp(-fogP.x * dist * max(integ, 0.0));
  f = min(f, fogP.w);
  float sa = pow(max(dot(rd, sunDir), 0.0), 6.0);
  return mix(col, fogCol + fogSunCol * sa, f);
}
`;

export const VS_STD = `#version 300 es
in vec3 p; in vec3 n; in vec4 c; in vec4 m;
uniform mat4 VP, M;
out vec3 wp; out vec3 wn; out vec4 vc; out vec4 vm;
out vec3 rp;
void main(){ vec4 w = M * vec4(p, 1.0); wp = w.xyz; wn = normalize(mat3(M) * n); vc = c; vm = m; rp = p; gl_Position = VP * w; }`;

export const VS_SKIN = `#version 300 es
in vec3 p; in vec3 n; in vec4 c; in vec4 m; in uvec4 bi; in vec4 bw;
uniform mat4 VP; uniform sampler2D boneTex; uniform int row0;
out vec3 wp; out vec3 wn; out vec4 vc; out vec4 vm; out vec3 rp;
mat4 bone(int b){ int r = row0 + gl_InstanceID; return mat4(texelFetch(boneTex, ivec2(b*4, r), 0), texelFetch(boneTex, ivec2(b*4+1, r), 0), texelFetch(boneTex, ivec2(b*4+2, r), 0), texelFetch(boneTex, ivec2(b*4+3, r), 0)); }
void main(){
  mat4 S = bone(int(bi.x)) * bw.x + bone(int(bi.y)) * bw.y + bone(int(bi.z)) * bw.z + bone(int(bi.w)) * bw.w;
  vec4 w = S * vec4(p, 1.0); wp = w.xyz; wn = normalize(mat3(S) * n); vc = c; vm = m; rp = p;
  gl_Position = VP * w;
}`;

export const FS_STD = `#version 300 es
precision highp float; precision highp int;
${COMMON}
uniform float twoSided; uniform vec4 tint; uniform float dissolve;
uniform float faceOn; uniform vec4 headC;         // 静止姿态下的头心与尺度：用来画脸（泥人式的描画）
uniform float weave;
in vec3 wp; in vec3 wn; in vec4 vc; in vec4 vm; in vec3 rp;
layout(location=0) out vec4 o; layout(location=1) out vec4 od;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main(){
  vec3 N = normalize(wn);
  if (twoSided > 0.5 && dot(N, camPos - wp) < 0.0) N = -N;
  vec3 alb = vc.rgb * tint.rgb;
  if (dissolve > 0.0 && vm.x < -0.5) { if (hsh(floor(rp.xz * 300.0) + floor(rp.y * 300.0)) < dissolve) discard; }
  vec4 mm = vm; mm.x = max(mm.x, 0.0);
  // 布：细密的织纹与深浅
  if (mm.z > 0.45) alb *= 0.95 + 0.07 * vno(rp.xy * 70.0 + rp.zz * 37.0) + 0.012 * sin(rp.y * 1400.0 + vno(rp.xz * 40.0) * 6.0) * weave;
  // 发：顺着头发方向的细纹与光泽
  if (mm.z > 0.2 && mm.z < 0.3) { float st = vno(vec2(atan(rp.x - headC.x, rp.z - headC.z) * 40.0, rp.y * 6.0)); alb *= 0.75 + 0.5 * st; }
  // 脸：只在皮肤上，按静止姿态的头部坐标画眉、眼线、唇
  if (faceOn > 0.5 && mm.y > 0.5) {
    vec3 q = (rp - headC.xyz) / headC.w;
    if (q.z > 0.05 && abs(q.y) < 0.08) {
      vec2 f = q.xy;
      float d = 1.0;
      for (int k = 0; k < 2; k++) {
        float sx = k == 0 ? 1.0 : -1.0;
        // 眼线：微微下垂的弧（低垂的目光）
        float ey = 0.011 - 0.0028 * pow((abs(f.x) - 0.033) / 0.016, 2.0);
        if (abs(f.x) > 0.018 && abs(f.x) < 0.05 && f.x * sx > 0.0) d = min(d, abs(f.y - ey) / 0.0026);
        // 眉
        float by = 0.034 + 0.004 * (1.0 - pow((abs(f.x) - 0.034) / 0.02, 2.0));
        if (abs(f.x) > 0.014 && abs(f.x) < 0.056 && f.x * sx > 0.0) d = min(d, abs(f.y - by) / (0.0022 + 0.0014 * smoothstep(0.05, 0.02, abs(f.x))));
      }
      float lineA = 1.0 - smoothstep(0.6, 1.0, d);
      alb = mix(alb, vec3(0.07, 0.05, 0.045), lineA * 0.85);
      // 唇
      float lip = smoothstep(0.012, 0.006, abs(f.x)) * smoothstep(0.004, 0.0015, abs(f.y + 0.047));
      alb = mix(alb, alb * vec3(0.78, 0.42, 0.4), lip * 0.8);
      // 腮红（很淡）
      alb = mix(alb, alb * vec3(1.0, 0.82, 0.8), smoothstep(0.03, 0.0, length(vec2(abs(f.x) - 0.05, f.y + 0.02))) * 0.35);
    }
  }
  vec3 col = shade(wp, N, alb, vc.a, mm);
  o = vec4(fogged(col, wp), 1.0);
  od = vec4(length(wp - camPos), 0.0, 0.0, 1.0);
}`;

// 只写深度（阴影图）
export const FS_DEPTH = `#version 300 es
precision highp float; precision highp int;
out vec4 o;
void main(){ o = vec4(1.0); }`;

// 草：实例化的草叶，风吹弯
export const VS_GRASS = `#version 300 es
in vec2 q;               // x: -1/1 叶宽方向, y: 0..1 高度
in vec4 iA;              // x, z, 高度, 种子
in vec4 iB;              // 颜色 rgb, 宽度
uniform mat4 VP; uniform float time; uniform vec2 wind; uniform float gust;
uniform float groundY; uniform vec4 groundK;     // 地面起伏 y = groundY + k.x*sin(k.y*x)*... 简化
out vec3 wp; out vec3 wn; out vec4 vc; out float vh;
float hs(float n){ return fract(sin(n*91.7)*43758.5); }
void main(){
  float sd = iA.w;
  float ang = sd * 6.2831;
  vec2 dir = vec2(cos(ang), sin(ang));
  float h = iA.z;
  float y = q.y;
  // 风：大尺度阵风波 + 细小抖动
  float wv = sin(dot(iA.xy, normalize(wind + 1e-4)) * 0.9 - time * 2.2 + sin(iA.x * 0.3) * 1.5) * 0.5 + 0.5;
  float bend = (0.25 + 0.75 * wv * gust) * length(wind) + 0.15 * sin(time * 3.1 + sd * 40.0);
  vec2 bdir = normalize(wind + 1e-4) * bend + dir * 0.25;
  float curve = y * y;
  vec3 base = vec3(iA.x, groundY + groundK.x * sin(iA.x * groundK.y) * cos(iA.y * groundK.z), iA.y);
  float w = iB.w * (1.0 - y * 0.85);
  vec2 side = vec2(-dir.y, dir.x);
  vec3 pos = base + vec3(side.x * q.x * w, y * h * (1.0 - 0.3 * curve * bend), side.y * q.x * w) + vec3(bdir.x, 0.0, bdir.y) * curve * h * 0.6;
  wp = pos;
  wn = normalize(vec3(-bdir.x * 0.5 + dir.x * 0.3, 1.0, -bdir.y * 0.5 + dir.y * 0.3));
  vc = vec4(iB.rgb, 1.0); vh = y;
  gl_Position = VP * vec4(pos, 1.0);
}`;
export const FS_GRASS = `#version 300 es
precision highp float; precision highp int;
${COMMON}
in vec3 wp; in vec3 wn; in vec4 vc; in float vh;
layout(location=0) out vec4 o; layout(location=1) out vec4 od;
void main(){
  vec3 N = normalize(wn);
  vec3 alb = vc.rgb * mix(0.45, 1.15, vh);
  vec3 V = normalize(camPos - wp);
  float sh = shadowAt(wp, N);
  float back = pow(max(dot(-V, sunDir), 0.0), 3.0);            // 逆光透过草叶
  vec3 col = alb * (sunCol * (max(dot(N, sunDir), 0.0) * 0.7 + 0.3) * sh + mix(gndAmb, skyAmb, 0.6 + 0.4 * vh));
  col += alb * sunCol * back * vh * 1.4 * sh * vec3(1.0, 0.95, 0.6);
  o = vec4(fogged(col, wp), 1.0);
  od = vec4(length(wp - camPos), 0.0, 0.0, 1.0);
}`;

// 花：朝上的小花盘（实例化）
export const VS_FLOWER = `#version 300 es
in vec2 q;
in vec4 iA;      // x, y, z, 尺寸
in vec4 iB;      // 颜色 rgb, 种子
uniform mat4 VP; uniform float time; uniform vec2 wind; uniform float gust;
out vec2 lq; out vec3 wp; out vec4 vc;
void main(){
  float sd = iB.w;
  float sway = sin(time * 2.0 + iA.x * 0.9 + sd * 30.0) * 0.05 * length(wind) * (0.5 + gust);
  vec3 c = iA.xyz + vec3(normalize(wind + 1e-4) * sway * 2.0, 0.0).xzy;
  float a = sd * 6.2831;
  vec3 u = vec3(cos(a), 0.15, sin(a)), v = vec3(-sin(a), 0.25, cos(a));
  vec3 pos = c + (u * q.x + v * q.y) * iA.w;
  lq = q; wp = pos; vc = iB;
  gl_Position = VP * vec4(pos, 1.0);
}`;
export const FS_FLOWER = `#version 300 es
precision highp float; precision highp int;
${COMMON}
in vec2 lq; in vec3 wp; in vec4 vc;
layout(location=0) out vec4 o; layout(location=1) out vec4 od;
void main(){
  float r = length(lq), an = atan(lq.y, lq.x);
  float n = 5.0 + floor(fract(vc.a * 7.0) * 3.0);
  float petal = 0.55 + 0.45 * cos(an * n);
  if (r > petal) discard;
  vec3 alb = mix(vec3(1.0, 0.85, 0.3), vc.rgb, smoothstep(0.12, 0.25, r));
  float sh = shadowAt(wp, vec3(0, 1, 0));
  vec3 V = normalize(camPos - wp);
  float back = pow(max(dot(-V, sunDir), 0.0), 2.0);
  vec3 col = alb * (sunCol * (0.6 * sh + back * 0.8 * sh) + skyAmb * 1.2);
  o = vec4(fogged(col, wp), 1.0);
  od = vec4(length(wp - camPos), 0.0, 0.0, 1.0);
}`;

// 天空（全屏，画在最远处）
export const FS_SKY = `#version 300 es
precision highp float; precision highp int;
${COMMON}
uniform mat4 invVP;
uniform vec3 skyTop, skyHor, skyGnd;
uniform vec4 sunDisc;        // 大小(cos), 强度, 光晕, 光晕指数
uniform vec4 moon;           // 方向 xyz, 强度
uniform float stars, clouds; uniform vec3 cloudCol; uniform float cloudY;
in vec2 uv;
layout(location=0) out vec4 o; layout(location=1) out vec4 od;
vec3 skyColor(vec3 rd){
  float y = rd.y;
  vec3 c = y > 0.0 ? mix(skyHor, skyTop, pow(clamp(y, 0.0, 1.0), 0.5)) : mix(skyHor, skyGnd, pow(clamp(-y * 3.0, 0.0, 1.0), 0.6));
  float sd = dot(rd, sunDir);
  c += sunCol * (smoothstep(sunDisc.x, sunDisc.x + 0.0004, sd) * sunDisc.y + pow(max(sd, 0.0), sunDisc.w) * sunDisc.z);
  if (moon.w > 0.0) {
    float md = dot(rd, normalize(moon.xyz));
    c += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99955, 0.9996, md) * moon.w * (0.85 + 0.15 * vno(rd.xz * 900.0)) + pow(max(md, 0.0), 300.0) * moon.w * 0.05 + pow(max(md, 0.0), 12.0) * moon.w * 0.004);
  }
  if (stars > 0.0 && y > 0.0) {
    vec2 g = rd.xz / (rd.y + 0.3) * 260.0;
    float s = hsh(floor(g)); vec2 f = fract(g) - 0.5;
    c += vec3(0.8, 0.85, 1.0) * stars * step(0.996, s) * smoothstep(0.25, 0.0, length(f)) * (0.5 + 0.5 * sin(time * 2.0 + s * 100.0)) * smoothstep(0.0, 0.3, y);
  }
  if (clouds > 0.0 && y > 0.0) {
    vec2 cp = rd.xz / (rd.y + 0.08) * cloudY + vec2(time * 0.01, 0.0);
    float cl = smoothstep(0.45, 0.8, fbm(cp * 1.2));
    float lit = pow(max(dot(rd, sunDir), 0.0), 4.0);
    c = mix(c, cloudCol + sunCol * lit * 0.6, cl * clouds * smoothstep(0.0, 0.15, y));
  }
  return c;
}
void main(){
  vec4 a = invVP * vec4(uv * 2.0 - 1.0, -1.0, 1.0); a /= a.w;
  vec4 b = invVP * vec4(uv * 2.0 - 1.0, 1.0, 1.0); b /= b.w;
  vec3 rd = normalize(b.xyz - a.xyz);
  vec3 c = skyColor(rd);
  // 地平线上的雾
  float sa = pow(max(dot(rd, sunDir), 0.0), 6.0);
  c = mix(c, fogCol + fogSunCol * sa, fogP.w * exp(-max(rd.y, 0.0) * 18.0) * step(0.0001, fogP.x));
  o = vec4(c, 1.0); od = vec4(1e4, 0, 0, 1);
}`;

// 海：Gerstner 波
export const VS_WATER = `#version 300 es
in vec3 p;
uniform mat4 VP; uniform float time; uniform vec4 waves[6]; uniform float waterY;
out vec3 wp; out vec3 wn;
void main(){
  vec3 P = vec3(p.x, waterY, p.z);
  vec3 N = vec3(0, 1, 0);
  vec3 T = vec3(1,0,0), Bt = vec3(0,0,1);
  for (int i = 0; i < 6; i++) {
    vec4 w = waves[i];          // dir.xy, 振幅, 波长
    if (w.z <= 0.0) continue;
    vec2 d = normalize(w.xy); float k = 6.2831 / w.w; float c = sqrt(9.8 / k);
    float f = k * (dot(d, p.xz) - c * time);
    float q = 0.6 / (k * w.z * 6.0);
    P.x += q * w.z * d.x * cos(f); P.z += q * w.z * d.y * cos(f); P.y += w.z * sin(f);
    N.x -= d.x * k * w.z * cos(f); N.z -= d.y * k * w.z * cos(f);
  }
  wp = P; wn = normalize(N);
  gl_Position = VP * vec4(P, 1.0);
}`;
export const FS_WATER = `#version 300 es
precision highp float; precision highp int;
${COMMON}
uniform vec3 deepCol, shallowCol, skyTop, skyHor;
uniform vec4 shore;   // 海岸线：沙滩高度 y = shore.x + shore.y * (dot(xz, shoreDir)) ；shore.zw = 方向
uniform float foamAmt;
in vec3 wp; in vec3 wn;
layout(location=0) out vec4 o; layout(location=1) out vec4 od;
void main(){
  vec3 N = normalize(wn + vec3(vno(wp.xz * 3.0 + time * 0.3) - 0.5, 0.0, vno(wp.xz * 3.1 - time * 0.27) - 0.5) * 0.15);
  vec3 V = normalize(camPos - wp);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(skyHor, skyTop, pow(clamp(R.y, 0.0, 1.0), 0.5));
  float sd = max(dot(R, sunDir), 0.0);
  sky += sunCol * (pow(sd, 300.0) * 6.0 + pow(sd, 20.0) * 0.25);
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float ground = shore.x + shore.y * dot(wp.xz, shore.zw);
  float depth = wp.y - ground;
  vec3 body = mix(shallowCol, deepCol, smoothstep(0.0, 1.5, depth));
  body *= (sunCol * 0.4 + skyAmb);
  vec3 col = mix(body, sky, F);
  // 浪花：浅处
  float foam = smoothstep(0.25, 0.0, depth) * smoothstep(0.35, 0.75, vno(wp.xz * 6.0 + vec2(time * 0.4, 0.0)) + 0.4 * sin(depth * 30.0 - time * 3.0));
  col = mix(col, (sunCol * 0.8 + skyAmb * 2.0) * 0.9, foam * foamAmt);
  float a = smoothstep(-0.02, 0.06, depth);
  o = vec4(fogged(col, wp), 1.0);
  od = vec4(length(wp - camPos), 0, 0, 1);
}`;

// 粒子
export const VS_PART = `#version 300 es
in vec2 q; in vec4 iA; in vec4 iB; in vec4 iC;
uniform mat4 VP; uniform vec3 camPos; uniform vec3 camRight, camUp; uniform int kind;
out vec2 lq; out vec4 vcol; out float vage; out float vseed; out vec3 wp;
void main(){
  vec3 c = iA.xyz; float s = iA.w;
  vec3 r = camRight, u = camUp;
  float age = fract(iC.w), seed = floor(iC.w) / 1000.0;
  if (kind == 3 || kind == 2 || kind == 9) {
    // 雨、火星：沿速度方向拉长
    vec3 v = iC.xyz; vec3 vd = normalize(v + 1e-5);
    vec3 view = normalize(c - camPos);
    vec3 side = normalize(cross(vd, view));
    float L = kind == 3 ? length(v) * 0.03 : length(v) * 0.02 + s;
    r = side * s; u = vd * max(L, s);
    vec3 pos = c + r * q.x + u * q.y;
    lq = q; vcol = iB; vage = age; vseed = seed; wp = pos;
    gl_Position = VP * vec4(pos, 1.0); return;
  }
  if (kind == 6) {
    float a = seed * 6.28 + age * 20.0 * (seed - 0.5);
    float ca = cos(a), sa = sin(a);
    vec2 qq = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    vec3 pos = c + (r * qq.x + u * qq.y * (0.5 + 0.5 * abs(sin(age * 30.0 + seed * 10.0)))) * s;
    lq = q; vcol = iB; vage = age; vseed = seed; wp = pos;
    gl_Position = VP * vec4(pos, 1.0); return;
  }
  float stretch = kind == 1 ? 1.6 : 1.0;
  vec3 pos = c + (r * q.x + u * q.y * stretch) * s + (kind == 1 ? u * s * 0.4 : vec3(0));
  lq = q; vcol = iB; vage = age; vseed = seed; wp = pos;
  gl_Position = VP * vec4(pos, 1.0);
}`;
export const FS_PART = `#version 300 es
precision highp float; precision highp int;
${COMMON}
uniform int kind; uniform sampler2D depthTex; uniform vec2 res;
in vec2 lq; in vec4 vcol; in float vage; in float vseed; in vec3 wp;
out vec4 o;
void main(){
  float r = length(lq);
  float sceneD = texture(depthTex, gl_FragCoord.xy / res).r;
  float myD = length(wp - camPos);
  float soft = clamp((sceneD - myD) / 0.4, 0.0, 1.0);
  if (kind == 0 || kind == 8) {
    // 烟：软的噪声团
    float n = fbm(lq * 1.6 + vseed * 17.0 + vage * 0.6);
    float a = smoothstep(1.0, 0.2, r + (n - 0.5) * 0.7) * vcol.a * soft;
    a *= smoothstep(0.0, 0.15, vage) * (1.0 - smoothstep(0.6, 1.0, vage));
    vec3 V = normalize(camPos - wp);
    vec3 lit = vcol.rgb * (sunCol * (0.35 + 0.65 * pow(max(dot(-V, sunDir), 0.0), 2.0)) + skyAmb * 1.5);
    for (int i = 0; i < 8; i++) { if (i >= nPl) break; float dl = length(plPos[i].xyz - wp); lit += vcol.rgb * plCol[i].rgb / (1.0 + dl * dl / (plPos[i].w * plPos[i].w)) * 0.8; }
    o = vec4(fogged(lit, wp) * a, a); return;
  }
  if (kind == 1) {
    // 火：随年龄由白黄到橙红再到暗
    vec2 p = lq; p.y += 0.3;
    float n = fbm(vec2(p.x * 2.0 + vseed * 10.0, p.y * 1.5 - vage * 4.0));
    float sh = smoothstep(1.0, 0.1, length(vec2(p.x * (1.3 + p.y * 0.6), p.y * 0.8)) + (n - 0.5) * 0.9);
    vec3 c = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.35, 0.05), smoothstep(0.1, 0.55, vage));
    c = mix(c, vec3(0.3, 0.05, 0.0), smoothstep(0.55, 1.0, vage));
    float a = sh * (1.0 - smoothstep(0.7, 1.0, vage)) * soft;
    o = vec4(c * a * vcol.a * 3.0, 0.0); return;
  }
  if (kind == 2 || kind == 7) {
    float a = smoothstep(1.0, 0.0, abs(lq.x)) * smoothstep(1.0, 0.3, abs(lq.y)) * (1.0 - vage) * soft;
    o = vec4(vcol.rgb * a * vcol.a * 4.0, 0.0); return;
  }
  if (kind == 3) {
    float a = smoothstep(1.0, 0.0, abs(lq.x)) * smoothstep(1.0, 0.6, abs(lq.y)) * vcol.a * soft;
    vec3 lit = vcol.rgb * (skyAmb * 3.0 + sunCol * 0.3);
    for (int i = 0; i < 8; i++) { if (i >= nPl) break; float dl = length(plPos[i].xyz - wp); lit += plCol[i].rgb / (1.0 + dl * dl / (plPos[i].w * plPos[i].w)) * 0.5; }
    o = vec4(lit * a, a); return;
  }
  if (kind == 6) {
    // 花瓣
    float d = length(vec2(lq.x * 1.6, lq.y)) - 0.9;
    if (d > 0.0) discard;
    vec3 lit = vcol.rgb * (sunCol * 0.7 + skyAmb * 1.5);
    o = vec4(fogged(lit, wp) * vcol.a, vcol.a); return;
  }
  if (kind == 9) {
    float a = smoothstep(1.0, 0.3, length(lq)) * vcol.a;
    o = vec4(vcol.rgb * (skyAmb + sunCol * 0.4) * a, a); return;
  }
  // 雪、尘
  float a = smoothstep(1.0, 0.0, r) * vcol.a * soft;
  vec3 lit = vcol.rgb * (sunCol * 0.8 + skyAmb * 2.0);
  for (int i = 0; i < 8; i++) { if (i >= nPl) break; float dl = length(plPos[i].xyz - wp); lit += vcol.rgb * plCol[i].rgb / (1.0 + dl * dl / (plPos[i].w * plPos[i].w)); }
  o = vec4(lit * a, a);
}`;

// ── 后期
export const FS_COPY = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex; in vec2 uv; out vec4 o;
void main(){ o = texture(tex, uv); }`;
// 景深：按弥散圈大小加权的圆盘采样（半分辨率）
export const FS_DOF = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex, depthTex; uniform vec2 px; uniform float focus, aperture, maxR;
in vec2 uv; out vec4 o;
float coc(float d){ return clamp(abs(d - focus) / max(d, 0.01) * aperture, 0.0, 1.0); }
void main(){
  float c0 = coc(texture(depthTex, uv).r);
  vec3 acc = vec3(0); float w = 0.0;
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 2.39996; float r = sqrt(float(i) + 0.5) / sqrt(24.0);
    vec2 off = vec2(cos(a), sin(a)) * r * maxR * px;
    float d = texture(depthTex, uv + off * max(c0, 0.15)).r;
    float cc = coc(d);
    float ww = cc >= r * 0.9 || d > texture(depthTex, uv).r ? 1.0 : 0.15;
    acc += texture(tex, uv + off * max(c0, cc)).rgb * ww; w += ww;
  }
  o = vec4(acc / w, c0);
}`;
export const FS_DOFMIX = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex, blurTex, depthTex; uniform float focus, aperture;
in vec2 uv; out vec4 o;
void main(){
  float d = texture(depthTex, uv).r;
  float c = clamp(abs(d - focus) / max(d, 0.01) * aperture, 0.0, 1.0);
  vec4 b = texture(blurTex, uv);
  o = vec4(mix(texture(tex, uv).rgb, b.rgb, smoothstep(0.05, 0.5, max(c, b.a * 0.7))), 1.0);
}`;
export const FS_BRIGHT = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex; uniform float thresh; in vec2 uv; out vec4 o;
void main(){ vec3 c = texture(tex, uv).rgb; float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(thresh, thresh * 3.0, l), 1); }`;
export const FS_BLUR = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex; uniform vec2 dir; in vec2 uv; out vec4 o;
void main(){
  vec4 s = texture(tex, uv) * 0.2270270270;
  s += texture(tex, uv + dir * 1.3846153846) * 0.3162162162; s += texture(tex, uv - dir * 1.3846153846) * 0.3162162162;
  s += texture(tex, uv + dir * 3.2307692308) * 0.0702702703; s += texture(tex, uv - dir * 3.2307692308) * 0.0702702703;
  o = s;
}`;
// 体积光：从光源屏幕位置做径向模糊
export const FS_SHAFTS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex, depthTex; uniform vec2 sunUV; uniform float strength; uniform vec3 tintC;
in vec2 uv; out vec4 o;
void main(){
  vec2 d = (sunUV - uv) / 48.0; vec2 p = uv; float acc = 0.0, w = 1.0;
  for (int i = 0; i < 48; i++) {
    float far = texture(depthTex, p).r > 5000.0 ? 1.0 : 0.0;
    vec3 c = texture(tex, p).rgb;
    acc += far * dot(c, vec3(0.3, 0.5, 0.2)) * w; w *= 0.965; p += d;
  }
  o = vec4(tintC * acc / 48.0 * strength, 1.0);
}`;
export const FS_FINAL = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex, b1, b2, b3, shaftTex, textTex, prevTex;
uniform vec2 res; uniform vec4 box;        // 画面在整帧中的位置（x0,y0,x1,y1）
uniform float frame, fade, exposure, grain, bloom, sat, contrast, vignette, shaftOn, mixPrev;
uniform vec3 wb, lift, gain;
in vec2 uv; out vec4 o;
float ih(vec2 p, float s){ uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y ^ uint(s)*2654435761u) * 1597334673u; n ^= n >> 16; n *= 2246822519u; n ^= n >> 13; return float(n) * (1.0/4294967296.0); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
void main(){
  vec2 fp = uv * res;
  vec3 c = vec3(0);
  bool inside = fp.y >= box.y && fp.y < box.w;
  if (inside) {
    vec2 su = vec2((fp.x - box.x) / (box.z - box.x), (fp.y - box.y) / (box.w - box.y));
    vec2 d = su - 0.5;
    float ca = dot(d, d) * 0.003;
    c = vec3(texture(tex, su + d * ca).r, texture(tex, su).g, texture(tex, su - d * ca).b);
    c += (texture(b1, su).rgb * 0.4 + texture(b2, su).rgb * 0.5 + texture(b3, su).rgb * 0.7) * bloom;
    if (shaftOn > 0.0) c += texture(shaftTex, su).rgb;
    c *= wb * exposure;
    vec2 dv = d * vec2((box.z - box.x) / (box.w - box.y), 1.0);
    c *= 1.0 - vignette * smoothstep(0.35, 1.1, length(dv));
    c = aces(c);
    // 调色：lift / gain / 饱和度 / 对比度
    c = pow(c, vec3(1.0/2.2));
    c = c * gain + lift * (1.0 - c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, sat);
    c = (c - 0.5) * contrast + 0.5;
    c = clamp(c, 0.0, 1.0) * fade;
    c += ((ih(fp, frame) + ih(fp, frame + 7.0) - 1.0) * 0.7) * grain * (0.6 + 0.4 * (1.0 - l));
  }
  vec4 tx = texture(textTex, vec2(uv.x, 1.0 - uv.y));
  c = mix(c, tx.rgb, tx.a);
  c += (ih(fp, frame + 13.0) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;
