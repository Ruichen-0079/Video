// 黑场（字卡用）
export default function blank() {
  return { frame() { return { cam: { pos: [0, 1, 5], target: [0, 1, 0], fov: 40 }, sun: { dir: [0, 1, 0], col: [0, 0, 0] }, amb: { sky: [0, 0, 0], gnd: [0, 0, 0] }, sky: { top: [0, 0, 0], hor: [0, 0, 0], gnd: [0, 0, 0] }, items: [], grade: { fade: 0, grain: 0 } }; } };
}
