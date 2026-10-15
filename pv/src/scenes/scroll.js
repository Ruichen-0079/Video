// 二 · 长卷（6–11.75 小节）：少年离乡；断臂
//
// 历史是一幅自右向左展开的长卷，纸从固定的笔尖下面向右移动。
// 众生是一道道短笔；一根不断的墨线是那个始终不老的人。
// 卷的上沿走着他的墨影：门口站着一个人，他离开；纸往后走，门口的人渐渐佝偻、坐下、淡去，他没有变。
// 到了周，一个持剑的人迎面而来——朱砂一笔，断臂。断处生出一束僵直的线（负伤流派），随后被一团墨晕清洗。

import { bar, BAR } from '../timeline.js';
import { brush, inkBlot, C } from '../draw.js';
import { hash, noise2, fbm2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { seal } from '../fx.js';
import { beginMask, figure, walk, smoothMask, maskToInk, STAND, mixPose, house } from '../silhouette.js';

const T0 = bar(6);
const SPEED = 118;
const uAt = (t) => (t - T0) * SPEED;
const HEAD = 0.36;
const RIVER_TOP = 470, RIVER_BOT = 900;           // 河道（设计坐标）；上沿是人走的「岸」
const BANK = RIVER_TOP - 18;
const yMing = (u) => 640 + 36 * Math.sin(u * 0.0021 + 1.2) + 12 * noise2(u * 0.004, 1.7);

const LIVES = [];
{
  const r = rng(2026);
  for (let u = -600; u < 3200; u += 5 + r() * 8) LIVES.push({ u, len: 40 + r() * 90, y: RIVER_TOP + 25 + r() * (RIVER_BOT - RIVER_TOP - 50), curve: (r() - 0.5) * 30, dark: 0.25 + r() * 0.5, seed: r() * 100 });
}

const E = { xia: 6.4, born: 6.3, house: 6.75, shang: 8.0, zhou: 9.0, duelIn: 9.4, cut: 10.5, branchEnd: 11.1, purge: 11.05, flood: 11.25 };
const U = Object.fromEntries(Object.entries(E).map(([k, v]) => [k, uAt(bar(v))]));

export default {
  name: 'scroll',
  start: bar(6) - 1.0, end: bar(11.75), post: 0.6,
  render(f) {
    const { t, W, H, S, I, ink, post } = f;
    const uh = uAt(t);
    const hx = W * HEAD;
    const sx = (u) => hx + (uh - u) * S;
    const uL = uh - (W - hx) / S - 40, uR = uh + hx / S + 40;
    const opening = t < bar(6) + 0.85;
    post.paper = opening ? 0 : 1;
    post.exposure = 0.86;
    post.paperCol = [0.86, 0.79, 0.64];
    post.vignette = 0.7;

    // ── 河水（马远式水纹）
    const nW = 26;
    for (let i = 0; i < nW; i++) {
      const base = RIVER_TOP + (i + 0.5) * (RIVER_BOT - RIVER_TOP) / nW;
      const pts = [];
      const phase = hash(i * 3.3) * 6.28;
      for (let x = -20 * S; x <= W + 20 * S; x += 7 * S) {
        const u = uh - (x - hx) / S;
        const amp = 6 + 5 * noise2(u * 0.002, i * 0.7);
        const y = base + amp * Math.sin(u * (0.018 + 0.004 * Math.sin(i)) + phase + t * 1.1) + 4 * Math.sin(u * 0.051 + phase * 2 - t * 0.7) * 0.6;
        pts.push(x, y * S);
      }
      const edge = Math.min(i, nW - 1 - i) / 3;
      brush(I, pts, 1.5 * S, C.inkBlack, (0.24 + 0.14 * hash(i)) * Math.min(1, 0.45 + edge), i * 7.1, { taper: 0.02, dry: 0.2 });
    }
    for (const [yb, sd] of [[BANK, 1], [RIVER_BOT + 16, 2]]) {
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let x = -20 * S; x <= W + 20 * S; x += 10 * S) { const u = uh - (x - hx) / S; pts.push(x, (yb + 7 * fbm2(u * 0.004, sd * 3 + k) + k * 5) * S); }
        brush(I, pts, (3.4 - k) * S, C.inkBlack, 0.38 - k * 0.09, sd * 11 + k, { taper: 0.01, dry: 0.5 });
      }
    }

    // ── 众生
    for (const l of LIVES) {
      if (l.u > uh || l.u + l.len < uL || l.u > uR) continue;
      const e = Math.min(l.u + l.len, uh);
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = l.u + (e - l.u) * (k / 8);
        const s = (u - l.u) / l.len;
        pts.push(sx(u), (l.y + Math.sin(s * Math.PI) * l.curve - s * 6) * S);
      }
      const fresh = 1 - smooth(0, 900, uh - l.u);
      brush(I, pts, 3.0 * S, C.inkBlack, Math.min(1, l.dark * (0.5 + 0.5 * fresh) * 1.6), l.seed, { taper: 0.25, dry: 0.3 });
    }

    // ── 不断的线
    const recl = (u) => 1 - 0.7 * smooth(U.purge - 30, U.purge + 80, u);
    if (uh > U.born) {
      const pts = [];
      const a = Math.max(uL, U.born), b = Math.min(uR, uh);
      for (let u = b; u >= a; u -= 5) pts.push(sx(u), yMing(u) * S);
      brush(I, pts, 4.0 * S, C.inkBlack, 1.0, 3.0, { taper: 0.0, dry: 0.35, pressure: (s) => recl(b - s * (b - a)) });
      if (U.born > uL) I.dot(sx(U.born), yMing(U.born) * S, 5 * S, ...C.inkBlack, 0.9);
      I.dot(hx, yMing(uh) * S, 5 * S, ...C.inkBlack, 1.0);
    }

    // ── 墨影：岸上的人
    const m = beginMask(W, H);
    const gy = BANK * S;                    // 地面
    const hs = 300 * S;                     // 人高（像素）
    // 他：始终在笔尖处行走
    const walkA = smooth(bar(E.house) - 0.4, bar(E.house) + 0.4, t);
    const hide = smooth(bar(E.purge), bar(E.purge + 0.5), t);       // 清洗之后：隐去
    let me = null;
    if (walkA > 0) {
      const ph = t * 4.2;
      let pose = walk(ph, 0.9);
      // 决斗：举剑、斩
      const ready = smooth(bar(E.cut - 0.55), bar(E.cut - 0.15), t), strike = smooth(bar(E.cut - 0.06), bar(E.cut + 0.04), t), after = smooth(bar(E.cut + 0.3), bar(E.cut + 0.7), t);
      pose = mixPose(pose, { ...STAND, torso: 0.1, armF: [2.6, 0.4], legF: [0.35, -0.2], legB: [-0.3, -0.05] }, ready * (1 - after));
      pose = mixPose(pose, { ...STAND, torso: 0.35, armF: [0.9, 0.1], legF: [0.7, -0.6], legB: [-0.5, -0.1], crouch: 0.3 }, strike * (1 - after));
      const props = [{ type: 'bundle' }];
      const swordA = lerp(lerp(0.5, 2.9, ready), 0.9, strike);
      if (ready > 0.01 && after < 0.99) props.push({ type: 'sword', angle: swordA, len: 0.48 });
      me = figure(m, { x: hx, y: gy - hs * 0.47, s: hs, dir: -1, kind: 'man', pose, props: ready > 0.5 && after < 0.5 ? props.slice(1) : props, t, wind: 0.4 });
    }
    // 门与门口的人：渐渐老去
    if (U.house < uR && U.house + 400 > uL) {
      const x = sx(U.house - 120);
      house(m, x, gy, 260 * S);
      const age = smooth(bar(E.house + 0.3), bar(E.shang + 0.8), t);
      const gone = smooth(bar(E.shang + 0.8), bar(E.zhou), t);
      if (gone < 1) {
        const pose = { ...STAND, torso: lerp(0.02, 0.5, age), head: lerp(0, 0.3, age), crouch: lerp(0, 0.7, smooth(0.6, 1, age)), armF: [lerp(0.4, 0.9, age), 0.6] };
        if (age > 0.6) { pose.legF = [lerp(0.06, 1.3, smooth(0.6, 1, age)), lerp(-0.04, -1.3, smooth(0.6, 1, age))]; pose.legB = pose.legF.slice(); }
        figure(m, { x: x - 175 * S, y: gy - hs * 0.43 * (1 - gone * 0.3), s: hs * lerp(0.92, 0.85, age), dir: -1, kind: 'woman', hairLen: lerp(1, 0.6, age), pose, t, wind: 0.2 });
      }
    }
    // 迎面而来的人（天才）与断臂
    let armPiece = null;
    if (t > bar(E.duelIn) && t < bar(E.purge + 0.6)) {
      const gx = sx(U.cut + 150);
      const ready = smooth(bar(E.cut - 0.55), bar(E.cut - 0.15), t);
      const cut = t > bar(E.cut);
      const kneel = smooth(bar(E.cut + 0.1), bar(E.cut + 0.45), t);
      let pose = mixPose(walk(t * 4.2, 0.8), { ...STAND, torso: 0.15, armF: [2.4, 0.3], armB: [1.5, 0.4], legF: [0.4, -0.3], legB: [-0.3, -0.05] }, ready);
      pose = mixPose(pose, { ...STAND, torso: 0.6, head: 0.3, crouch: 0.9, legF: [1.3, -1.6], legB: [0.2, -1.9], armF: [0.6, 1.2], armB: [0.2, 0] }, kneel);
      const o = { x: gx, y: gy - hs * 0.47, s: hs, dir: 1, kind: 'man', pose, t, wind: 0.4, props: [{ type: 'sword', angle: lerp(0.4, 2.7, ready) * (1 - kneel) + 0.3 * kneel, len: 0.5 }] };
      if (cut) {
        // 后臂离开身体：单独画成一块，旋转、下落
        const dt = t - bar(E.cut);
        armPiece = { x: gx - hs * 0.06, y: gy - hs * 0.75 + Math.min(dt, 0.7) * dt * hs * 1.6, rot: dt * 5 };
        o.pose = { ...o.pose, armB: [0, 0] };
        o.noArmB = true;
      }
      figure(m, o);
      if (armPiece && armPiece.y < gy) {
        m.save(); m.translate(armPiece.x, armPiece.y); m.rotate(armPiece.rot);
        m.beginPath(); m.ellipse(0, 0, hs * 0.03, hs * 0.15, 0, 0, 6.283); m.fill();
        m.beginPath(); m.ellipse(0, hs * 0.12, hs * 0.05, hs * 0.05, 0, 0, 6.283); m.fill();
        m.restore();
      }
    }
    smoothMask(W, H, 1.6, S);
    const shadowA = walkA * (1 - 0.75 * hide);
    maskToInk(f, 'rgb(20,17,14)', 0.88 * Math.max(shadowA, t > bar(E.duelIn) ? 0.88 : 0), 1.4);

    // 斩：朱砂一笔
    const cutT = clamp((t - bar(E.cut)) / 0.16);
    if (cutT > 0) {
      const x = sx(U.cut + 120), y = gy - hs * 0.6;
      const pts = [];
      for (let k = 0; k <= 12; k++) { const s = (k / 12) * cutT; pts.push(x - 110 * S + s * 220 * S, y - 120 * S + s * 240 * S + Math.sin(s * 3) * 8 * S); }
      brush(I, pts, 9 * S, C.inkRed, 0.95, 77, { taper: 0.25, dry: 0.4 });
      // 溅
      const r = rng(5);
      for (let k = 0; k < 40; k++) {
        const a = -0.6 + r() * 1.6, d = r() * 160 * S * easeOut(cutT);
        I.dot(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 + d * 0.3, (1 + r() * 4) * S, ...C.inkRed, 0.7);
      }
    }
    // 负伤流派：断处生出一束僵直的线，向前（左）铺开
    if (uh > U.cut) {
      const cy = yMing(U.cut) + 30;
      const e = Math.min(uh, U.cut + (U.branchEnd - U.cut));
      for (let k = 0; k < 13; k++) {
        const ang = (k / 12 - 0.5) * 1.1;
        const pts = [];
        for (let u = U.cut; u <= e; u += 8) pts.push(sx(u), (cy + Math.tan(ang) * (u - U.cut) * 0.55 + 40) * S);
        if (pts.length > 2) brush(I, pts, 2.2 * S, C.inkBlack, 0.75, 20 + k, { taper: 0.04, dry: 0 });
      }
    }
    // 清洗：墨晕
    const purge = smooth(bar(E.purge), bar(E.purge + 0.4), t);
    if (purge > 0) {
      const x = sx((U.cut + U.branchEnd) / 2), y = (yMing(U.cut) + 70) * S;
      inkBlot(ink, x, y, 220 * S * (0.4 + 0.6 * easeOut(purge)), 0.9 * purge, 41, 14);
    }

    // ── 朝代：朱印
    const sealAt = (ch, u, b0) => seal(f, ch, sx(u), 975 * S, 64 * S, smooth(bar(b0) - 0.2, bar(b0) + 0.25, t), (hash(u) - 0.5) * 0.06);
    sealAt('夏', U.xia, E.xia);
    sealAt('商', U.shang, E.shang);
    sealAt('周', U.zhou, E.zhou);

    // ── 洇：墨漫过纸
    if (t > bar(E.flood)) {
      post.burn = Math.pow((t - bar(E.flood)) / (BAR * 0.55), 1.3) * 1.6 - 0.02;
      post.burnMode = 1;
      post.burnC = [hx / H, 1 - (gy - hs * 0.6) / H];
      post.inkSel = -1;
      post.lightSel = 1;
    }
  },
};
