// 「逝水」的全部着色器。
// 水面是一张 1024² 的高度场，按波动方程逐步推进；墨随水流平流；
// 焦散用网格折射投影求得（光线经过起伏水面后在河床上的会聚）；
// 最后一遍逐像素：视线 → 水面（反射 + 折射）→ 河床 / 沉剑 → 吸收与墨色。

export const VS_QUAD = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

// ───────────────────────── 波动方程
export const FS_WAVE = `#version 300 es
precision highp float;
uniform sampler2D S;
uniform vec2 px;          // 1/N
uniform float k;          // (c dt / dx)^2
uniform float damp;       // 每步阻尼
uniform vec4 drops[24];   // x, y (uv), 半径(uv), 强度(米)
uniform int nd;
uniform vec4 blade;       // 本步刀锋扫过的线段 a.xy → b.xy（uv）
uniform vec2 bladeK;      // 半径(uv)、强度
in vec2 uv; out vec4 o;
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-9),0.,1.); return length(pa-ba*h); }
void main(){
  vec4 s = texture(S, uv);
  float h = s.x, v = s.y;
  float lap = texture(S, uv+vec2(px.x,0)).x + texture(S, uv-vec2(px.x,0)).x + texture(S, uv+vec2(0,px.y)).x + texture(S, uv-vec2(0,px.y)).x - 4.0*h;
  // 对角项让波前更圆
  float lapd = texture(S, uv+px).x + texture(S, uv-px).x + texture(S, uv+vec2(px.x,-px.y)).x + texture(S, uv+vec2(-px.x,px.y)).x - 4.0*h;
  v += k * (0.8*lap + 0.2*0.5*lapd);
  v *= damp;
  h += v;
  h *= 0.99995;
  for (int i = 0; i < 24; i++) {
    if (i >= nd) break;
    vec4 d = drops[i];
    float r2 = dot(uv-d.xy, uv-d.xy) / (d.z*d.z);
    h -= d.w * exp(-r2 * 2.0) * (1.0 - 0.5*r2);
  }
  if (bladeK.y != 0.0) {
    float dd = segd(uv, blade.xy, blade.zw) / bladeK.x;
    v -= bladeK.y * exp(-dd*dd*2.0);
  }
  // 边缘吸收层：不让波从边界反射回来
  vec2 e = min(uv, 1.0-uv);
  float sponge = smoothstep(0.0, 0.07, min(e.x, e.y));
  h *= mix(0.97, 1.0, sponge); v *= mix(0.9, 1.0, sponge);
  o = vec4(h, v, 0, 1);
}`;

// ───────────────────────── 墨：随水流平流、慢慢扩散
export const FS_DYE = `#version 300 es
precision highp float;
uniform sampler2D D;
uniform vec2 px;
uniform float dt, time;
uniform float flow;        // uv/s，沿 +y（下游）
uniform vec4 inkSrc[12];   // 注入：x,y,半径(uv)，强度；颜色通道见 inkCh
uniform vec4 inkCh[12];
uniform int ns;
uniform vec4 blade; uniform vec2 bladeK; uniform vec3 bladeCol;
in vec2 uv; out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
vec2 curl(vec2 p){ float e=0.01; float n1=vn(p+vec2(0,e)), n2=vn(p-vec2(0,e)), n3=vn(p+vec2(e,0)), n4=vn(p-vec2(e,0)); return vec2(n1-n2, -(n3-n4))/(2.0*e); }
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float t=clamp(dot(pa,ba)/max(dot(ba,ba),1e-9),0.,1.); return length(pa-ba*t); }
void main(){
  vec2 vel = vec2(0.0, flow) + (curl(uv*7.0 + vec2(0, time*0.05)) * 0.0028 + curl(uv*19.0 - time*0.03) * 0.0012) * (0.6 + 0.4*sin(time*0.3));
  vec2 src = uv - vel * dt;
  vec4 c = texture(D, src);
  vec4 nb = (texture(D, src+vec2(px.x,0)) + texture(D, src-vec2(px.x,0)) + texture(D, src+vec2(0,px.y)) + texture(D, src-vec2(0,px.y))) * 0.25;
  c = mix(c, nb, 0.08);
  c *= vec4(0.985, 0.9975, 0.995, 0.99);
  for (int i = 0; i < 12; i++) {
    if (i >= ns) break;
    vec4 s = inkSrc[i];
    float r2 = dot(uv-s.xy, uv-s.xy) / (s.z*s.z);
    c += inkCh[i] * s.w * exp(-r2*2.5) * dt;
  }
  if (bladeK.y != 0.0) {
    float dd = segd(uv, blade.xy, blade.zw) / bladeK.x;
    c.rgb += bladeCol * exp(-dd*dd*2.0) * (0.6 + 0.8*vn(uv*300.0));
  }
  o = max(c, 0.0);
}`;

// ───────────────────────── 焦散：网格折射投影
export const VS_CAUSTIC = `#version 300 es
uniform sampler2D S;
uniform vec2 px;
uniform float dom, depth, nScale;
uniform vec3 L;            // 指向光源
in vec2 g;                 // 网格坐标 0..1
out vec2 oldP; out vec2 newP;
void main(){
  float hx = (texture(S, g+vec2(px.x,0)).x - texture(S, g-vec2(px.x,0)).x) / (2.0*px.x*dom);
  float hz = (texture(S, g+vec2(0,px.y)).x - texture(S, g-vec2(0,px.y)).x) / (2.0*px.y*dom);
  vec3 n = normalize(vec3(-hx*nScale, 1.0, -hz*nScale));
  vec3 r = refract(-L, n, 1.0/1.333);
  vec3 r0 = refract(-L, vec3(0,1,0), 1.0/1.333);
  vec2 p = g * dom;
  newP = p + r.xz * (depth / -r.y);
  oldP = p + r0.xz * (depth / -r0.y);
  vec2 c = newP / dom;
  gl_Position = vec4(c*2.0-1.0, 0, 1);
}`;
export const FS_CAUSTIC = `#version 300 es
precision highp float;
in vec2 oldP; in vec2 newP; out vec4 o;
void main(){
  float a0 = length(dFdx(oldP)) * length(dFdy(oldP));
  float a1 = length(dFdx(newP)) * length(dFdy(newP));
  float I = a0 / max(a1, 1e-12);
  o = vec4(min(I, 40.0) * 0.25, 0, 0, 1);      // 4 个三角形重叠的网格：每个贡献 1/4（见 JS）
}`;

// ───────────────────────── 漂浮物：花瓣、烧过的书页（可以在空中飘落，也可以浮在水面）
export const VS_FLOAT = `#version 300 es
uniform sampler2D S;
uniform vec2 px;
uniform float dom, nScale;
uniform mat4 VP;
uniform vec3 Lsh; uniform float depth; uniform float shadowPass, mirrorPass;
in vec2 q;                 // 四边形角 -1..1
in vec4 iA;                // x, z, 旋转, 尺寸
in vec4 iB;                // 种类, 不透明度, 宽高比, 热（书页）
in vec4 iC;                // 离水面的高度(0 = 浮着), 倾角, 烧掉的程度, 种子
in vec4 iD;                // 湿
out vec2 lq; out vec4 vB; out vec4 vC; out vec4 vD; out vec3 vN; out vec3 wp;
void main(){
  float c = cos(iA.z), s = sin(iA.z);
  vec2 lp = vec2(q.x * iA.w * iB.z, q.y * iA.w);
  float tc = cos(iC.y), ts = sin(iC.y);
  vec3 l3 = vec3(lp.x, lp.y*ts, lp.y*tc);              // 绕本地 x 轴翻转（飘落时）
  vec2 xz = iA.xy + vec2(c*l3.x - s*l3.z, s*l3.x + c*l3.z);
  vec3 nl = vec3(0.0, tc, -ts);
  lq = q; vB = iB; vC = iC; vD = iD;
  if (iC.x > 0.002) {
    wp = vec3(xz.x, iC.x + l3.y, xz.y);
    vN = vec3(c*nl.x - s*nl.z, nl.y, s*nl.x + c*nl.z);
  } else {
    vec2 g = xz / dom + 0.5;
    float h = texture(S, g).x;
    float hx = (texture(S, g+vec2(px.x,0)).x - texture(S, g-vec2(px.x,0)).x) / (2.0*px.x*dom);
    float hz = (texture(S, g+vec2(0,px.y)).x - texture(S, g-vec2(0,px.y)).x) / (2.0*px.y*dom);
    vN = normalize(vec3(-hx*nScale*0.6, 1.0, -hz*nScale*0.6));
    wp = vec3(xz.x, h*nScale*0.5 + 0.0015, xz.y);
  }
  if (shadowPass > 0.5) {
    vec2 f = wp.xz - Lsh.xz / Lsh.y * (depth + wp.y);     // 沿光线投到河床
    gl_Position = vec4((f / dom + 0.5) * 2.0 - 1.0, 0, 1);
  } else {
    vec3 pp = wp; if (mirrorPass > 0.5) pp.y = -pp.y;
    gl_Position = VP * vec4(pp, 1.0);
  }
}`;
export const FS_FLOAT = `#version 300 es
precision highp float;
uniform sampler2D letterT;
uniform vec3 L; uniform vec3 lightCol; uniform vec3 eyeP; uniform float shadowPass, mirrorPass; uniform float ambient, time;
in vec2 lq; in vec4 vB; in vec4 vC; in vec4 vD; in vec3 vN; in vec3 wp; out vec4 o;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }
// 一片花瓣：x 横向，y 从瓣根(-1)到瓣尖(+1)。万花：瓣形不止一种
float petalSD(vec2 p, float kind){
  float t = clamp((p.y + 1.0) * 0.5, 0.0, 1.0);
  float w;
  if (kind < 0.5)      w = 0.66 * pow(sin(3.14159 * pow(t, 0.75)), 0.55) * (0.35 + 0.65*t);   // 樱：倒卵，瓣尖有缺口
  else if (kind < 1.5) w = 0.86 * sqrt(max(0.0, 1.0 - pow(p.y - 0.1, 2.0))) * (0.55 + 0.45*t);  // 梅：圆
  else if (kind < 2.5) w = 0.58 * pow(sin(3.14159 * t), 0.75) * (0.75 + 0.25*(1.0 - t));        // 桃：尖卵
  else if (kind < 3.5) w = 0.24 * pow(sin(3.14159 * t), 0.5);                                    // 菊：窄长
  else                 w = 0.90 * pow(sin(3.14159 * pow(t, 0.7)), 0.5) * (1.0 + 0.05*sin(p.x*17.0)); // 蔷薇：宽，边缘起伏
  float d = max(abs(p.x) - w, abs(p.y) - 1.0);
  if (kind < 0.5) d = max(d, -(length((p - vec2(0.0, 1.06)) * vec2(1.0, 0.8)) - 0.2));
  return d;
}
void main(){
  float kind = vB.x;
  vec3 N = normalize(vN);
  if (dot(N, eyeP - wp) < 0.0) N = -N;
  float dif = max(dot(N, L), 0.0) * 0.7 + 0.3;          // 薄的东西：背光处也透一点光
  if (kind > 9.5 && kind < 10.5) {
    // 信：还在空中，飘下来（落到水上以后由水面着色器接手）
    if (mirrorPass > 0.5) discard;
    if (shadowPass > 0.5) { o = vec4(0.4*vB.y); return; }
    float ink = texture(letterT, vec2(0.5 - 0.5*lq.x, 0.5 - 0.5*lq.y)).a;
    float crease = 1.0 - 0.22*exp(-pow(lq.y*24.0, 2.0)) - 0.08*exp(-pow(lq.x*40.0, 2.0));
    vec3 paper = vec3(0.25, 0.24, 0.215) * (1.0 - ink*0.85) * crease * (lq.y < 0.0 ? 0.72 : 1.0);
    o = vec4(paper * (lightCol * dif + ambient * 1.5), vB.y);
    return;
  }
  if (kind > 10.5) {
    // 烧过的书页：朱丝栏写本，火从边缘往里烧
    vec2 uv = lq*0.5 + 0.5;
    float seed = vC.w;
    vec2 e2 = min(uv, 1.0 - uv);
    float f = min(e2.x, e2.y)*1.5 + fbm(uv*vec2(3.0, 2.2) + seed*7.31)*0.62 + fbm(uv*13.0 + seed*3.7)*0.16 - 0.32;
    float burn = vC.z;
    float fw = fwidth(f)*1.2 + 0.002;
    float a = smoothstep(burn - fw, burn + fw, f) * vB.y;
    if (a < 0.003) discard;
    if (shadowPass > 0.5) { o = vec4(a*0.5); return; }
    float charM = 1.0 - smoothstep(burn + 0.01, burn + 0.12, f);
    float brown = 1.0 - smoothstep(burn + 0.08, burn + 0.26, f);
    float rim = exp(-pow((f - burn - 0.006) / 0.009, 2.0));
    float heat = vB.w;
    float flick = 0.6 + 0.4*vn(vec2(uv.x*7.0 + time*3.0, uv.y*7.0 - time*6.0 + seed*9.0));
    vec3 emit = vec3(1.0, 0.36, 0.07) * rim * heat * flick * 6.0
              + vec3(1.0, 0.20, 0.04) * charM * heat * smoothstep(0.62, 0.92, vn(uv*38.0 + vec2(time*1.5, seed*5.0))) * 1.6;
    if (mirrorPass > 0.5) { o = vec4(emit * 0.02 * a, 1.0); return; }
    vec3 paper = vec3(0.52, 0.47, 0.38) * (0.9 + 0.1*vn(uv*50.0 + seed));
    float cx = uv.x * 9.0;
    float dr = abs(fract(cx + 0.5) - 0.5) / 9.0;
    float rule = smoothstep(0.0030, 0.0012, dr) * step(0.06, uv.y) * step(uv.y, 0.94);
    float border = smoothstep(0.004, 0.0015, abs(uv.y - 0.06)) + smoothstep(0.004, 0.0015, abs(uv.y - 0.94));
    vec2 cell = vec2(floor(cx), floor(uv.y * 22.0));
    vec2 lc = vec2(fract(cx), fract(uv.y * 22.0));
    float glyph = step(0.52, vn(lc*vec2(6.0, 5.0) + cell*17.3 + seed)) * step(0.24, lc.x) * step(lc.x, 0.76) * step(0.12, lc.y) * step(lc.y, 0.88);
    glyph *= step(0.08, uv.y) * step(uv.y, 0.92) * step(0.12, h1(cell + seed));
    vec3 col = paper;
    col = mix(col, vec3(0.60, 0.16, 0.10), clamp(rule + border, 0.0, 1.0) * 0.85);
    col = mix(col, vec3(0.09, 0.08, 0.07), glyph * 0.85);
    col = mix(col, col * vec3(0.55, 0.36, 0.18), brown);
    col = mix(col, vec3(0.028, 0.024, 0.022), charM);
    // 落水以后：吸饱了水，颜色沉下去，边缘先湿
    float wet = vD.x;
    float wetM = clamp(wet * 2.2 - (f - burn) * 0.8 + 0.2*vn(uv*9.0 + seed), 0.0, 1.0);
    col = mix(col, col * vec3(0.22, 0.21, 0.20) + vec3(0.008), wetM);
    o = vec4(col * (lightCol * dif + ambient * 2.0) + emit, a * (1.0 - 0.25*wetM));
    return;
  }
  if (mirrorPass > 0.5) discard;
  float d;
  if (kind > 4.5) {
    // 偶尔一整朵：五瓣
    float r = length(lq), an = atan(lq.y, lq.x);
    float aa = mod(an + 0.628, 1.2566) - 0.628;
    vec2 pq = vec2(sin(aa), cos(aa)) * r;
    d = min(petalSD(vec2(pq.x*1.35, pq.y*2.0 - 1.0), 1.0) * 0.5, r - 0.09);
  } else d = petalSD(lq, kind);
  float fw = fwidth(d) + 1e-4;
  float a = smoothstep(fw, -fw, d) * vB.y;
  if (a < 0.003) discard;
  if (shadowPass > 0.5) { o = vec4(a*0.45); return; }
  vec3 base = kind < 0.5 ? vec3(0.86,0.62,0.66) : kind < 1.5 ? vec3(0.84,0.80,0.76) : kind < 2.5 ? vec3(0.82,0.52,0.56)
            : kind < 3.5 ? vec3(0.84,0.72,0.48) : kind < 4.5 ? vec3(0.60,0.24,0.30) : vec3(0.86,0.74,0.76);
  float t = kind > 4.5 ? 1.0 - length(lq) : clamp((lq.y + 1.0) * 0.5, 0.0, 1.0);
  vec3 col = base * (0.58 + 0.42*smoothstep(0.0, 0.75, t));               // 瓣根暗
  col = mix(col, col * vec3(0.92, 0.96, 0.66), (1.0 - t) * 0.45);          // 瓣根微黄绿
  if (kind > 4.5) col = mix(vec3(0.85, 0.70, 0.30), col, smoothstep(0.1, 0.22, length(lq)));
  float vein = abs(sin(atan(lq.x, lq.y + 1.3) * 16.0));
  col *= 1.0 - 0.07 * smoothstep(0.7, 1.0, vein) * t;
  col *= 1.0 + 0.18 * smoothstep(-0.15, 0.0, d);                           // 瓣缘透光
  vec3 V = normalize(eyeP - wp);
  float sp = pow(max(dot(reflect(-L, N), V), 0.0), 60.0) * 0.5;
  o = vec4(col * (lightCol * dif + ambient * 1.5) * 0.6 + lightCol * sp * 0.2, a);
}`;


// ───────────────────────── 主着色：水面
export const FS_WATER = `#version 300 es
precision highp float;
uniform sampler2D S, Ctex, Dtex, Shtex, titleT, letterT;
uniform vec2 px, res;
uniform float dom, depth, nScale, time, pixA;
uniform vec3 eyeP; uniform mat4 invVP;
uniform vec3 L; uniform vec3 lightCol; uniform float ambient;
uniform vec3 pool;           // 光照到河床上的一池：中心 xz、半径
uniform vec4 herPool;        // 她的灯照到河床上：中心 xz、半径、强度
uniform vec3 moonD, herD;    // 月与她的灯的方向（倒影正好落在两处滴水上）
// 时代：灯、火、月、花、她、城、题
uniform float eLamp, eFire, eMoon, eBloom, eHer, eCity, eTitle;
// 风吹出的细碎涟漪：20 道不同方向、不同波长的水波
uniform vec4 waves[20];      // kx, kz, 振幅(米), 相位
uniform float chop, gustT;
// 剑
uniform vec3 swordP; uniform float swordA, swordBury, swordVis, swordBlur;
// 信：沉在水面之下 letterP.y 处的一张纸
uniform vec4 letterP;        // x, y, z, 旋转
uniform vec4 letterK;        // 湿, 可见, 半宽, 半高
// 刀光
uniform vec4 bladeSeg; uniform float bladeGlow;
// 落下的水滴（亮点）与刚溅起的点
uniform vec4 fall[2];
uniform vec4 splash[16]; uniform int nsp;
in vec2 uv; out vec4 o;

float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }

// 风在水面上吹出一块块「猫爪」：有的地方起皱，有的地方还是镜子
float gust(vec2 x){
  float n = vn(x*0.55 + vec2(0.0, -gustT)) * 0.65 + vn(x*1.3 + vec2(3.1, -gustT*1.4)) * 0.35;
  return mix(0.2, 1.0, smoothstep(0.3, 0.75, n));
}
// 涟漪的梯度；hess = (hxx, hzz, hxz)。fp 为像素足迹（米），压掉会走样的短波
vec2 waveGrad(vec2 x, float fp, out vec3 hess){
  vec2 g = vec2(0.0); hess = vec3(0.0);
  for (int i = 0; i < 20; i++) {
    vec4 w = waves[i];
    float kk = dot(w.xy, w.xy);
    float a = w.z * exp(-kk*fp*fp*0.5);
    float ph = dot(w.xy, x) + w.w;
    float c = cos(ph), s = sin(ph);
    g += a * c * w.xy;
    hess -= a * s * vec3(w.x*w.x, w.y*w.y, w.x*w.y);
  }
  float m = gust(x) * chop;
  hess *= m;
  return g * m;
}
// 涟漪在河床上聚成的焦散：折射映射的雅可比行列式（光源有大小，所以不会无限亮）
float causChop(vec2 y, float fp, float DD){
  vec3 hs;
  vec2 gy = waveGrad(y, fp, hs);
  waveGrad(y + DD*gy, fp, hs);
  float a = 1.0 - DD*hs.x, b = 1.0 - DD*hs.y, c = DD*hs.z;
  float det = a*b - c*c;
  return 1.0 / sqrt(det*det + 0.02);
}

// 天空 / 岸上的世界（只会在水的倒影里看见）
vec3 env(vec3 d){
  float el = asin(clamp(d.y, -1., 1.));
  float az = atan(d.x, d.z);
  vec3 c = mix(vec3(0.006,0.008,0.016), vec3(0.002,0.003,0.008), smoothstep(0.0, 1.2, el));
  float cl = fbm(vec2(az*2.2, el*5.0) + vec2(time*0.012, 0.0));
  c += vec3(0.012,0.015,0.024) * smoothstep(0.35, 0.75, cl) * eMoon;
  c += vec3(0.02,0.012,0.005) * smoothstep(0.4, 0.8, cl) * eLamp;
  // 月
  float md = dot(d, moonD);
  vec2 mu = (d - moonD*md).xz / 0.0265;                                  // 月面上的坐标
  float maria = 1.0 - 0.22*smoothstep(0.45, 0.7, fbm(mu*1.6 + 3.0)) - 0.08*fbm(mu*5.0);
  c += vec3(0.82,0.88,1.0) * (smoothstep(0.99962, 0.99968, md) * 45.0 * maria + pow(max(md,0.0), 1500.0) * 3.0 + pow(max(md,0.0), 80.0)*0.25 + pow(max(md,0.0), 12.0)*0.03) * eMoon * (1.0 - 0.8*eCity);
  // 灯：为乾隆提着的那盏灯
  float ld = dot(d, L);
  float fl = 0.9 + 0.1*sin(time*13.0) * sin(time*7.3);
  c += vec3(1.0,0.60,0.25) * (smoothstep(0.99962, 0.99986, ld) * 38.0 + pow(max(ld,0.0), 1400.0) * 9.0 + pow(max(ld,0.0), 200.0) * 1.2 + pow(max(ld,0.0), 30.0) * 0.25) * eLamp * fl;
  // 她的灯
  float hd = dot(d, herD);
  float hf = 0.94 + 0.06*sin(time*9.0 + 1.0) * sin(time*5.7);
  c += vec3(1.0,0.70,0.42) * (smoothstep(0.99970, 0.99986, hd) * 36.0 + pow(max(hd,0.0), 1200.0) * 6.0 + pow(max(hd,0.0), 90.0) * 0.4) * eHer * hf;
  // 火：天空映成橙红，翻动
  float fn = fbm(vec2(az*2.5 + time*0.6, el*4.0 - time*1.2));
  c += vec3(1.0,0.30,0.07) * eFire * (0.10 + 1.3*fn*fn*fn) * (0.3 + 0.7*smoothstep(0.3, 1.4, el));
  // 相遇：天色转暖
  c += vec3(0.02, 0.015, 0.008) * eBloom * (0.6 + 0.4*cl);
  // 城：对岸的灯——在水里被拉成长长的光带
  if (eCity > 0.001 && el < 0.6) {
    for (int i = 0; i < 40; i++) {
      float fi = float(i);
      float a0 = (h1(vec2(fi, 1.0)) - 0.5) * 1.7;
      float e0 = 0.185 + 0.17 * pow(h1(vec2(fi, 2.0)), 1.4);
      float hu = h1(vec2(fi, 3.0));
      vec3 lc = hu < 0.55 ? vec3(1.0,0.66,0.34) : hu < 0.8 ? vec3(0.75,0.85,1.0) : hu < 0.9 ? vec3(1.0,0.2,0.25) : vec3(0.2,0.95,0.9);
      float blink = 0.8 + 0.2*step(0.3, h1(vec2(fi, floor(time*0.5))));
      float dd = length(vec2(az - a0, el - e0));
      c += lc * (exp(-dd*dd*90000.0) * 9.0 + exp(-dd*dd*1500.0) * 0.10) * blink * eCity;
    }
    // 车灯：贴着岸线流动（从街的这边驶来，那一边逝去）
    float lane = exp(-pow((el-0.172)*400.0, 2.0));
    float cars = smoothstep(0.7, 1.0, vn(vec2(az*30.0 - time*2.0, 1.0)));
    float cars2 = smoothstep(0.7, 1.0, vn(vec2(az*30.0 + time*1.6, 7.0)));
    c += (vec3(1.0,0.82,0.55)*cars + vec3(1.0,0.15,0.1)*cars2) * lane * 4.0 * eCity;
    c += vec3(0.05,0.035,0.03) * exp(-max(el - 0.17, 0.0)*14.0) * smoothstep(0.05, 0.17, el) * eCity;
  }
  // 题：只在倒影里读得出来
  if (eTitle > 0.001) {
    vec2 tu = vec2((0.40 - az) / 0.80, (el - 0.41) / 0.22);
    if (tu.x > 0.0 && tu.x < 1.0 && tu.y > 0.0 && tu.y < 1.0) {
      float a = texture(titleT, tu).a;
      c += vec3(1.0,0.93,0.82) * a * 3.0 * eTitle;
    }
  }
  return c;
}

float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
// 剑：局部坐标 x 沿剑身（尖在 +x），单位米。part：0 刃，1 剑格，2 柄，3 剑首
float sdSword(vec2 p, out float part){
  float Lb = 0.74, tipS = Lb - 0.085;
  float hw = mix(0.0165, 0.0125, clamp(p.x / Lb, 0.0, 1.0));
  if (p.x > tipS) hw *= sqrt(max(0.0, (Lb - p.x) / (Lb - tipS)));
  float blade = max(abs(p.y) - hw, max(-p.x, p.x - Lb));
  float guard = max(abs(p.x + 0.011) - 0.008 - 0.005*(1.0 - abs(p.y)/0.041), abs(p.y) - 0.041);
  float grip = sdBox(p - vec2(-0.105, 0.0), vec2(0.084, 0.0112));
  float pommel = length((p - vec2(-0.205, 0.0)) * vec2(1.3, 1.0)) - 0.0185;
  float d = blade; part = 0.0;
  if (guard < d) { d = guard; part = 1.0; }
  if (grip < d) { d = grip; part = 2.0; }
  if (pommel < d) { d = pommel; part = 3.0; }
  return d;
}

// 河床：细沙与淤泥，几乎没有颜色
vec3 floorCol(vec2 xz){
  float sand = fbm(xz*38.0)*0.4 + fbm(xz*5.0)*0.6;
  vec2 w = xz + vec2(fbm(xz*1.5), fbm(xz*1.5 + 9.0)) * 0.4;
  float rip = smoothstep(-0.3, 1.0, sin(w.x*24.0 + w.y*9.0 + fbm(xz*3.0)*3.0));
  vec3 c = vec3(0.30,0.28,0.245) * (0.75 + 0.4*sand) * (0.92 + 0.1*rip);
  c = mix(c, vec3(0.12,0.12,0.11), smoothstep(0.45, 0.8, fbm(xz*1.1 + 4.0)) * 0.8);
  c *= 0.85 + 0.3*smoothstep(0.55, 0.75, fbm(xz*60.0));        // 砂砾
  return c;
}

void main(){
  vec2 ndc = uv*2.0-1.0;
  vec4 wpN = invVP * vec4(ndc, -1.0, 1.0); wpN /= wpN.w;
  vec4 wpF = invVP * vec4(ndc, 1.0, 1.0); wpF /= wpF.w;
  vec3 ro = eyeP, rd = normalize(wpF.xyz - wpN.xyz);
  if (rd.y > -0.002) { o = vec4(0.0,0.0,0.0,1.0); return; }
  float t = -ro.y / rd.y;
  vec3 P = ro + rd * t;
  vec2 g = P.xz / dom + 0.5;
  float inside = step(0.0, g.x) * step(g.x, 1.0) * step(0.0, g.y) * step(g.y, 1.0);
  float hx = 0.0, hz = 0.0;
  if (inside > 0.5) {
    hx = (texture(S, g+vec2(px.x,0)).x - texture(S, g-vec2(px.x,0)).x) / (2.0*px.x*dom);
    hz = (texture(S, g+vec2(0,px.y)).x - texture(S, g-vec2(0,px.y)).x) / (2.0*px.y*dom);
  }
  float fp = t * pixA / max(-rd.y, 0.12);                   // 一个像素在水面上的宽度（米）
  float far = 1.0 / (1.0 + t*t*0.04);
  vec3 hs;
  vec2 wg = waveGrad(P.xz, fp*1.5, hs);
  vec3 n = normalize(vec3(-hx*nScale*far - wg.x, 1.0, -hz*nScale*far - wg.y));

  // 反射
  vec3 rr = reflect(rd, n);
  if (rr.y < 0.02) rr.y = 0.02 + (0.02 - rr.y);
  vec3 refl = env(normalize(rr));
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);

  // 折射到水下
  vec3 tr = refract(rd, n, 1.0/1.333);
  float tf = -depth / tr.y;
  vec3 Q = P + tr * tf;
  float path = tf;
  vec2 fuv = Q.xz / dom + 0.5;
  vec3 alb = floorCol(Q.xz);
  float caus = texture(Ctex, fuv).r * causChop(Q.xz, fp + 0.003, depth * 0.25);
  float cc = pow(caus, 1.2);
  float pl = exp(-dot(Q.xz - pool.xy, Q.xz - pool.xy) / (pool.z*pool.z));
  float hp = exp(-dot(Q.xz - herPool.xy, Q.xz - herPool.xy) / (herPool.z*herPool.z)) * herPool.w;
  vec3 herCol = vec3(1.0, 0.64, 0.34);

  // 河床的阴影：花瓣、书页、剑、信
  float shadow = 1.0 - texture(Shtex, fuv).r;
  float part;
  if (swordVis > 0.0) {
    vec3 Fp = Q + L * ((swordP.y + depth) / L.y);
    vec2 sp = Fp.xz - swordP.xz;
    float ca = cos(swordA), sa = sin(swordA);
    vec2 lp = vec2(ca*sp.x + sa*sp.y, -sa*sp.x + ca*sp.y);
    float soft = 0.006 + (swordP.y + depth) * 0.05;
    shadow *= 1.0 - 0.55 * smoothstep(soft, -soft, sdSword(lp, part)) * swordVis;
  }
  if (letterK.y > 0.0) {
    vec3 Fp = Q + L * ((letterP.y + depth) / L.y);
    vec2 sp = Fp.xz - letterP.xz;
    float ca = cos(letterP.w), sa = sin(letterP.w);
    vec2 lq = vec2(ca*sp.x + sa*sp.y, -sa*sp.x + ca*sp.y);
    float dE = max(abs(lq.x) - letterK.z, abs(lq.y) - letterK.w);
    float soft = 0.012 + (letterP.y + depth) * 0.05;
    shadow *= 1.0 - 0.35 * (1.0 - 0.5*letterK.x) * smoothstep(soft, -soft, dE) * letterK.y;
  }
  vec3 lit = (lightCol * pl + herCol * hp) * (0.05 + cc * 0.95) * shadow + ambient;
  vec3 under = alb * lit;

  // 剑：在 swordP.y 的平面上
  if (swordVis > 0.0) {
    float ts = swordP.y / tr.y;
    vec3 Qs = P + tr * ts;
    vec2 sp = Qs.xz - swordP.xz;
    float ca = cos(swordA), sa = sin(swordA);
    vec2 lp = vec2(ca*sp.x + sa*sp.y, -sa*sp.x + ca*sp.y);
    float sd = sdSword(lp, part);
    float bw = max(swordBlur, fp*1.2);
    float a = smoothstep(bw, -bw, sd) * swordVis;
    if (a > 0.0) {
      // 慢慢被泥沙盖住：时间
      float cover = 0.0;
      if (swordBury > 0.0) cover = smoothstep(-0.05, 0.05, swordBury - fbm(Qs.xz*14.0) - 0.1);
      float hw = mix(0.0165, 0.0125, clamp(lp.x / 0.74, 0.0, 1.0));
      float across = clamp(lp.y / hw, -1.0, 1.0);
      vec3 side = vec3(-sa, 0.0, ca);
      vec3 sn = normalize(vec3(0.0, 1.0, 0.0) + side * sign(across) * 0.32);   // 剑脊两侧的斜面
      vec3 V = -tr;
      float spec = pow(max(dot(reflect(-L, sn), V), 0.0), 30.0);
      vec3 col;
      if (part < 0.5) {
        vec3 steel = vec3(0.30, 0.31, 0.32) * (0.85 + 0.25*vn(lp*vec2(20.0, 600.0)));
        steel = mix(steel, vec3(0.20, 0.16, 0.12), smoothstep(0.55, 0.8, fbm(lp*vec2(30.0, 90.0))) * (0.3 + 0.7*swordBury));  // 锈斑
        float ridge = exp(-across*across*400.0);
        float edgeL = smoothstep(0.82, 1.0, abs(across));
        col = steel * (0.35 + 0.65*max(dot(sn, L), 0.0)) + (spec * 0.6 + ridge * 0.08 + edgeL * 0.05) * vec3(0.85,0.88,0.9) * (0.4 + 0.6*cc);
      } else if (part < 1.5 || part > 2.5) {
        vec3 bronze = mix(vec3(0.30, 0.22, 0.11), vec3(0.16, 0.22, 0.19), smoothstep(0.4, 0.8, fbm(lp*80.0)));
        col = bronze * (0.5 + 0.5*max(dot(sn, L), 0.0)) + spec * 0.25 * vec3(0.9, 0.75, 0.5);
      } else {
        float wrap = abs(sin((lp.x*1.0 + abs(lp.y)*1.4) * 520.0));            // 缠绳
        col = vec3(0.07, 0.055, 0.045) * (0.55 + 0.45*wrap);
      }
      col *= mix(1.0, 0.6, swordBury);
      vec3 swLit = (lightCol * pl + herCol * hp) * (0.25 + cc * 0.75) + ambient;
      vec3 sc = mix(col * swLit, under, cover);
      under = mix(under, sc, a);
      path = mix(path, ts, a * (1.0 - cover));
    }
  }

  // 信：她留下的信纸。先浮着，湿透，再慢慢沉下去
  if (letterK.y > 0.0) {
    float tl = letterP.y / tr.y;
    vec3 Ql = P + tr * tl;
    vec2 sp = Ql.xz - letterP.xz;
    float ca = cos(letterP.w), sa = sin(letterP.w);
    vec2 lp = vec2(ca*sp.x + sa*sp.y, -sa*sp.x + ca*sp.y);
    vec2 q = lp / letterK.zw;
    float wet = letterK.x;
    float rag = (vn(q*vec2(9.0, 13.0)) - 0.5) * 0.006 * wet;
    float dE = max(abs(lp.x) - letterK.z, abs(lp.y) - letterK.w) + rag;
    float aL = smoothstep(fp*1.2, -fp*1.2, dE) * letterK.y;
    if (aL > 0.0) {
      vec2 luv = vec2(0.5 - 0.5*q.x, 0.5 - 0.5*q.y);
      float ink = texture(letterT, luv, wet * 2.5).a;
      vec2 ed = 1.0 - abs(q);
      float wetEdge = smoothstep(wet*0.9 + 0.10, wet*0.9 - 0.12, min(ed.x, ed.y) + vn(q*14.0)*0.14 - 0.06);
      float w = max(wetEdge, wet*0.55);
      float crease = 1.0 - 0.22*exp(-pow(q.y*24.0, 2.0)) - 0.08*exp(-pow(q.x*40.0, 2.0));
      float sideL = q.y < 0.0 ? 0.78 : 1.0;
      vec3 paper = vec3(0.50, 0.48, 0.43) * (0.9 + 0.06*vn(q*70.0) + 0.06*vn(q*vec2(220.0, 60.0)));
      paper *= 1.0 + 0.18*smoothstep(0.9, 1.0, max(abs(q.x), abs(q.y))) * (1.0 - wet);
      paper = mix(paper, vec3(0.40, 0.41, 0.40), w * 0.8);
      paper *= 1.0 - ink * (1.0 - 0.7*wet) * 0.85;
      float plL = exp(-dot(Ql.xz - pool.xy, Ql.xz - pool.xy) / (pool.z*pool.z));
      vec3 litL = lightCol * plL * (0.35 + 0.45*min(cc, 3.0)) + ambient * 1.5;
      vec3 lc = paper * litL * crease * sideL;
      float trn = w * 0.4;                                     // 湿纸透光
      under = mix(under, lc, aL * (1.0 - trn));
      path = mix(path, tl, aL * (1.0 - trn));
    }
  }

  // 水体吸收 + 散射
  vec3 sigma = vec3(0.95, 0.80, 0.78);
  vec3 trans = exp(-sigma * path * 1.5);
  vec3 scatter = vec3(0.006, 0.009, 0.010) * (lightCol * 0.6 + herCol * herPool.w * 0.3 + ambient * 3.0);
  under = under * trans + scatter * (1.0 - trans);
  // 墨：在水中的颜色（吸收）+ 一点被照亮的散射
  vec4 dy = inside > 0.5 ? texture(Dtex, g) : vec4(0);
  vec3 absorb = dy.r * vec3(0.25, 1.9, 2.1) + dy.g * vec3(2.2, 2.1, 1.7);
  under *= exp(-absorb * 1.2);
  under += (dy.r * vec3(0.16, 0.02, 0.012) + dy.g * vec3(0.01, 0.012, 0.02)) * (lightCol * 0.25 + ambient * 2.0);

  vec3 col = mix(under, refl, F);

  // 刀锋扫过：一线白浪，转瞬即逝
  if (bladeGlow > 0.0) {
    vec2 a = bladeSeg.xy, b = bladeSeg.zw, pp = P.xz;
    vec2 pa = pp - a, ba = b - a; float hh = clamp(dot(pa,ba)/max(dot(ba,ba),1e-9), 0., 1.);
    float dd = length(pa - ba*hh);
    float foam = smoothstep(0.6, 0.9, vn(pp*vec2(160.0, 90.0)) * 0.6 + vn(pp*420.0) * 0.5) * exp(-dd*dd*12000.0);
    col += vec3(0.85, 0.88, 0.9) * bladeGlow * (foam * 0.35 + exp(-dd*dd*600000.0) * 0.5 * pow(hh, 6.0));
  }
  // 将落的水滴：一点亮光
  for (int i = 0; i < 2; i++) {
    vec4 f = fall[i];
    if (f.w <= 0.0) continue;
    vec3 c = vec3(f.x, f.y, f.z);
    vec3 oc = c - ro; float tc = dot(oc, rd); float dd = length(oc - rd*tc);
    col += vec3(0.9,0.95,1.0) * f.w * (exp(-dd*dd*1.2e6) * 2.0 + exp(-dd*dd*4e4) * 0.1);
  }
  // 溅起的一瞬
  for (int i = 0; i < 16; i++) {
    if (i >= nsp) break;
    vec4 s = splash[i];
    float dd = length(P.xz - s.xy);
    col += vec3(0.85,0.9,1.0) * s.w * exp(-dd*dd/(s.z*s.z)) * 0.5;
  }
  o = vec4(col, 1.0);
}`;

// ───────────────────────── 后期
export const FS_BLUR = `#version 300 es
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
export const FS_BRIGHT = `#version 300 es
precision highp float;
uniform sampler2D tex; in vec2 uv; out vec4 o;
void main(){ vec3 c = texture(tex, uv).rgb; float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(0.35, 1.5, l), 1); }`;
export const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D hdr, b1, b2, b3;
uniform vec2 res; uniform float frame, fade, exposure, grain;
in vec2 uv; out vec4 o;
float ih(vec2 p, float s){ uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y ^ uint(s)*2654435761u) * 1597334673u; n ^= n >> 16; n *= 2246822519u; n ^= n >> 13; return float(n) * (1.0/4294967296.0); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
void main(){
  vec2 d = uv - 0.5;
  // 轻微色散（边缘）
  float ca = dot(d, d) * 0.004;
  vec3 c = vec3(texture(hdr, uv + d*ca).r, texture(hdr, uv).g, texture(hdr, uv - d*ca).b);
  c += texture(b1, uv).rgb * 0.35 + texture(b2, uv).rgb * 0.45 + texture(b3, uv).rgb * 0.6;
  d.x *= res.x/res.y;
  c *= 1.0 - 0.45*smoothstep(0.3, 1.0, length(d));
  c = aces(c * exposure) * fade;
  c = pow(c, vec3(1.0/2.2));
  vec2 px = uv * res;
  c += ((ih(px, frame) + ih(px, frame+7.0) - 1.0) * 0.7) * grain;
  c += (ih(px, frame+13.0) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;
