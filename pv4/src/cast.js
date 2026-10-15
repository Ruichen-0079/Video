// 角色造型：全片统一（颜色只是象征，不是对人物外貌的设定）
export const SKIN = { fair: [0.87, 0.73, 0.64], warm: [0.8, 0.65, 0.53], tan: [0.68, 0.52, 0.4], old: [0.76, 0.6, 0.48] };

// 子馥幽：幼年（末代王朝的皇女）
export const ZFY_CHILD = {
  height: 1.12, sex: 'f', age: 'child', hair: 'twin', sleeve: 'wide',
  colors: { skin: SKIN.fair, robe: [0.78, 0.74, 0.66], robe2: [0.16, 0.22, 0.38], inner: [0.88, 0.86, 0.82], hair: [0.04, 0.035, 0.035], belt: [0.5, 0.16, 0.14], shoe: [0.28, 0.1, 0.09] },
};
// 子馥幽：少女（复国运动）——束发、深红战袍
export const ZFY_TEEN = {
  height: 1.55, sex: 'f', hair: 'topknot', sleeve: 'wide', armor: true,
  colors: { skin: SKIN.fair, robe: [0.34, 0.06, 0.06], robe2: [0.18, 0.15, 0.13], inner: [0.6, 0.55, 0.5], hair: [0.035, 0.03, 0.03], belt: [0.12, 0.1, 0.08], shoe: [0.08, 0.06, 0.05] },
};
// 子馥幽：成年——长发，深酒红衣，暗金缘
export const ZFY = {
  height: 1.66, sex: 'f', hair: 'long', sleeve: 'wide',
  colors: { skin: SKIN.fair, robe: [0.27, 0.06, 0.07], robe2: [0.55, 0.42, 0.22], inner: [0.84, 0.8, 0.75], hair: [0.03, 0.025, 0.03], belt: [0.08, 0.06, 0.06], shoe: [0.1, 0.06, 0.05] },
};
// 明布川：墨蓝衣，束发
export const MBC = {
  height: 1.78, sex: 'm', hair: 'topknot', sleeve: 'wide',
  colors: { skin: SKIN.warm, robe: [0.09, 0.11, 0.15], robe2: [0.3, 0.32, 0.36], inner: [0.78, 0.76, 0.72], hair: [0.03, 0.03, 0.035], belt: [0.12, 0.1, 0.08], shoe: [0.06, 0.05, 0.05] },
};
// 老武者：白发、白须、粗麻色袍
export const OLD = {
  height: 1.68, sex: 'm', age: 'old', hair: 'topknot', sleeve: 'wide', beard: 1,
  colors: { skin: SKIN.old, robe: [0.4, 0.37, 0.32], robe2: [0.28, 0.25, 0.21], inner: [0.72, 0.69, 0.63], hair: [0.84, 0.82, 0.78], belt: [0.22, 0.18, 0.14], shoe: [0.12, 0.1, 0.08] },
};
// 老武者中年（与妻子练武时）与妻子
export const OLD_MID = { ...OLD, age: 'adult', beard: 0.6, colors: { ...OLD.colors, hair: [0.42, 0.4, 0.38], skin: SKIN.warm } };
export const WIFE = {
  height: 1.6, sex: 'f', hair: 'bun', sleeve: 'wide',
  colors: { skin: SKIN.fair, robe: [0.42, 0.5, 0.44], robe2: [0.8, 0.78, 0.72], inner: [0.86, 0.84, 0.8], hair: [0.05, 0.045, 0.04], belt: [0.3, 0.24, 0.18], shoe: [0.15, 0.12, 0.1] },
};

// 亚人贵族与兵：角、耳、尾
export const NOBLE = (horns, ears, robe, robe2) => ({
  height: 1.76, sex: 'm', hair: 'topknot', sleeve: 'wide', horns, ears,
  colors: { skin: SKIN.fair, robe, robe2, inner: [0.82, 0.78, 0.7], hair: [0.05, 0.04, 0.04], belt: [0.55, 0.42, 0.2], shoe: [0.08, 0.06, 0.05], horn: [0.78, 0.7, 0.56] },
});
export const DEMI_GUARD = (horns) => ({
  height: 1.85, sex: 'm', hair: 'topknot', sleeve: 'narrow', armor: true, horns, build: 1.12, cell: 0.016, tunic: 0.5,
  colors: { skin: SKIN.warm, robe: [0.1, 0.08, 0.07], robe2: [0.5, 0.36, 0.14], inner: [0.2, 0.1, 0.08], hair: [0.05, 0.04, 0.04], belt: [0.5, 0.36, 0.14], shoe: [0.05, 0.04, 0.04], horn: [0.75, 0.68, 0.55] },
});
// 人类奴隶：短褐
export const SLAVE = (k = 0) => ({
  height: 1.66 + (k % 3) * 0.03, sex: 'm', hair: 'short', sleeve: 'narrow', cell: 0.016, tunic: 0.42,
  colors: { skin: SKIN.tan, robe: [0.36 + 0.03 * k, 0.32, 0.26], robe2: [0.3, 0.27, 0.22], inner: [0.32, 0.28, 0.22], hair: [0.05, 0.04, 0.04], belt: [0.2, 0.16, 0.12], shoe: [0.25, 0.2, 0.16] },
});
// 人类士兵（开国之军）
export const HUMAN_SOLDIER = (k = 0) => ({
  height: 1.7 + (k % 3) * 0.02, sex: 'm', hair: 'topknot', sleeve: 'narrow', armor: true, cell: 0.018, tunic: 0.5,
  colors: { skin: SKIN.warm, robe: [0.3, 0.22, 0.14], robe2: [0.22, 0.2, 0.18], inner: [0.4, 0.3, 0.2], hair: [0.05, 0.04, 0.04], belt: [0.15, 0.12, 0.1], shoe: [0.1, 0.08, 0.06] },
});
// 平民
export const VILLAGER = (k = 0, sex = 'm') => ({
  height: sex === 'f' ? 1.56 : 1.68, sex, hair: sex === 'f' ? 'bun' : 'topknot', sleeve: 'narrow', cell: 0.016, tunic: sex === 'f' ? 0.93 : 0.78,
  colors: { skin: SKIN.warm, robe: [[0.26, 0.21, 0.16], [0.16, 0.19, 0.22], [0.3, 0.26, 0.2], [0.2, 0.17, 0.13]][k % 4], robe2: [0.25, 0.22, 0.18], inner: [0.6, 0.56, 0.5], hair: [0.05, 0.04, 0.04], belt: [0.2, 0.16, 0.12], shoe: [0.15, 0.12, 0.1] },
});

// 夏：明布川爱过的女人（年轻 / 中年 / 老）
export const XIA_WOMAN = (stage) => ({
  height: 1.58, sex: 'f', hair: 'bun', sleeve: 'narrow', tunic: 0.93,
  colors: { skin: stage > 1 ? [0.74, 0.6, 0.5] : SKIN.warm, robe: [0.46, 0.4, 0.3], robe2: [0.3, 0.25, 0.18], inner: [0.6, 0.55, 0.48], hair: [[0.05, 0.04, 0.04], [0.42, 0.4, 0.38], [0.86, 0.85, 0.82]][stage], belt: [0.3, 0.2, 0.12], shoe: [0.2, 0.15, 0.1] },
});
export const MBC_XIA = { ...MBC, colors: { ...MBC.colors, robe: [0.32, 0.28, 0.22], robe2: [0.22, 0.2, 0.16] } };
// 子馥幽：明清时的装束；十八世纪北美的军官
export const ZFY_MING = { ...ZFY, colors: { ...ZFY.colors, robe: [0.18, 0.2, 0.3], robe2: [0.75, 0.7, 0.6] } };
export const ZFY_OFFICER = { height: 1.66, sex: 'f', hair: 'bun', sleeve: 'narrow', hat: 'tricorn', colors: { skin: SKIN.fair, robe: [0.1, 0.13, 0.26], robe2: [0.72, 0.62, 0.42], inner: [0.82, 0.8, 0.74], hair: [0.03, 0.025, 0.03], belt: [0.82, 0.8, 0.74], shoe: [0.05, 0.04, 0.04], hat: [0.04, 0.04, 0.05] } };
export const CONTINENTAL = (k) => ({ height: 1.72 + (k % 3) * 0.02, sex: 'm', hair: 'short', sleeve: 'narrow', hat: 'tricorn', tunic: 0.45, cell: 0.018, colors: { skin: SKIN.warm, robe: [0.12, 0.15, 0.3], robe2: [0.75, 0.68, 0.5], inner: [0.8, 0.78, 0.72], hair: [0.3, 0.25, 0.2], belt: [0.8, 0.78, 0.72], shoe: [0.05, 0.04, 0.04] } });
export const MBC_MODERN = { height: 1.78, sex: 'm', hair: 'short', sleeve: 'narrow', colors: { skin: SKIN.warm, robe: [0.72, 0.72, 0.7], robe2: [0.6, 0.6, 0.58], inner: [0.1, 0.1, 0.12], hair: [0.03, 0.03, 0.035], belt: [0.08, 0.08, 0.08], shoe: [0.05, 0.05, 0.05] } };
