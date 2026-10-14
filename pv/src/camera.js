// 极简透视相机 + 景深：远离焦平面的线条变粗、变淡，像镜头里的散景。

export class Camera {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.set([0, 0, -10], [0, 0, 0], 40);
    this.focus = 10;      // 焦距（世界单位）
    this.aperture = 0;    // 0 = 全清晰
    this.roll = 0;
  }
  set(eye, target, fovDeg, roll = 0) {
    this.eye = eye; this.target = target; this.fov = fovDeg; this.roll = roll;
    const f = norm(sub(target, eye));
    let up = [Math.sin(roll), Math.cos(roll), 0];
    let r = norm(cross(up, f));
    if (!isFinite(r[0])) r = [1, 0, 0];
    const u = cross(f, r);
    this.f = f; this.r = r; this.u = u;
    this.k = (this.H * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
    return this;
  }
  // 返回 [sx, sy, depth, scale]；depth<=near 时返回 null
  project(x, y, z, out) {
    const dx = x - this.eye[0], dy = y - this.eye[1], dz = z - this.eye[2];
    const cz = dx * this.f[0] + dy * this.f[1] + dz * this.f[2];
    if (cz < 0.05) return null;
    const cx = dx * this.r[0] + dy * this.r[1] + dz * this.r[2];
    const cy = dx * this.u[0] + dy * this.u[1] + dz * this.u[2];
    const s = this.k / cz;
    out = out || [0, 0, 0, 0];
    out[0] = this.W * 0.5 + cx * s;
    out[1] = this.H * 0.5 - cy * s;
    out[2] = cz;
    out[3] = s;
    return out;
  }
  // 弥散圆半径（像素）
  coc(depth) {
    if (!this.aperture) return 0;
    return Math.abs(1 / depth - 1 / this.focus) * this.aperture * this.k;
  }
}

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
