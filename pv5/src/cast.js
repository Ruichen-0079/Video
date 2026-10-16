// 角色：每个人是一套皮子（颜色、纹样、头茬、下装）
import { L } from './puppet.js';

// 子馥幽：末代亚人王朝的皇女（龙种，平时藏起特征）
export const ZFY_CHILD = { sex: 'f', head: 'child', child: true, hat: 'twin', robe: L.white, trim: L.red, inner: L.rose, pattern: 'flower', sleeve: 'wide', sleeveLen: 9, lower: 'skirt', skirtCol: L.rose, shoeCol: L.red, bodyW: 0.9 };
export const ZFY_TEEN = { sex: 'f', head: 'dan', hat: 'bun', robe: L.red, trim: L.gold, inner: L.white, pattern: 'flower', sleeve: 'wide', lower: 'skirt', skirtCol: L.crimson, shoeCol: L.gold };
export const ZFY_RUN = { sex: 'f', head: 'dan', hat: 'long', robe: L.crimson, trim: L.black, inner: L.white, pattern: 'dots', sleeve: 'narrow', lower: 'tunic', trousers: L.black, boots: L.black };
export const ZFY = { sex: 'f', head: 'dan', hat: 'bun', robe: L.red, trim: L.black, inner: L.white, pattern: 'flower', sleeve: 'wide', sleeveLen: 13, lower: 'skirt', skirtCol: L.red, shoeCol: L.black };
export const ZFY_MING = { sex: 'f', head: 'dan', hat: 'bunHigh', robe: L.jade, trim: L.gold, inner: L.white, pattern: 'lattice', sleeve: 'wide', lower: 'skirt', skirtCol: L.teal, shoeCol: L.red };
export const ZFY_OFFICER = { sex: 'f', head: 'dan', hat: 'tricorn', robe: L.blue, trim: L.gold, inner: L.white, pattern: 'plain', sleeve: 'narrow', lower: 'coat', trousers: L.white, boots: L.black, cuff: L.red };
export const ZFY_MODERN = { sex: 'f', head: 'dan', hat: 'long', robe: L.ink, trim: L.gray, inner: L.white, pattern: 'plain', sleeve: 'narrow', lower: 'skirt', skirtCol: L.ink, shoeCol: L.black };

// 明布川：墨蓝的长袍
export const MBC = { sex: 'm', head: 'sheng', hat: 'band', bandCol: L.ink, robe: L.indigo, trim: L.white, inner: L.white, pattern: 'cloud', sleeve: 'wide', lower: 'robe', trousers: L.ink, boots: L.black };
export const MBC_XIA = { ...MBC, hat: 'knotOld', hairCol: L.black, robe: L.brown, trim: L.cream, pattern: 'dots', sleeve: 'narrow', lower: 'tunic' };
export const MBC_MODERN = { sex: 'm', head: 'sheng', hat: 'short', robe: L.gray, trim: L.gray, inner: L.white, pattern: 'plain', sleeve: 'narrow', lower: 'trousers', trousers: L.ink, boots: L.black };

// 老武者：白发白须
export const OLD = { sex: 'm', head: 'lao', hat: 'knotOld', beard: 'long', robe: L.cream, trim: L.brown, inner: L.white, pattern: 'cloud', patS: 1.1, sleeve: 'wide', sleeveLen: 15, lower: 'robe', boots: L.brown };
export const OLD_MID = { ...OLD, head: 'sheng', hairCol: L.black, beard: 'short', beardCol: 'rgba(30,22,16,0.95)', robe: L.ochre };
export const WIFE = { sex: 'f', head: 'dan', hat: 'bun', robe: L.jade, trim: L.white, inner: L.white, pattern: 'flower', sleeve: 'wide', lower: 'skirt', skirtCol: L.green, shoeCol: L.red };

// 周朝的天才
export const GENIUS = { sex: 'm', head: 'sheng', hat: 'crown', robe: L.white, trim: L.red, inner: L.white, pattern: 'cloud', sleeve: 'wide', lower: 'robe', boots: L.black };

// 亚人贵族、守卫；人类奴隶、士兵、百姓
export const NOBLE = (k = 0) => ({ sex: k % 2 ? 'f' : 'm', head: k % 2 ? 'dan' : 'sheng', hat: k % 2 ? 'bunHigh' : 'crown', horns: ['dragon', null, 'antler', 'ox'][k % 4], ears: [null, 'fox', null, null][k % 4], robe: [L.yellow, L.purple, L.green, L.red][k % 4], trim: L.black, pattern: 'cloud', sleeve: 'wide', lower: k % 2 ? 'skirt' : 'robe', skirtCol: [L.yellow, L.purple, L.green, L.red][k % 4] });
export const DEMI_GUARD = (k = 0) => ({ sex: 'm', head: 'jing', face: 'solid', faceCol: [L.ochre, L.brown, L.olive][k % 3], hat: 'helmet', helmCol: L.black, plume: L.red, horns: ['ox', 'antler', 'dragon'][k % 3], armor: true, robe: L.crimson, trim: L.gold, pattern: 'plain', sleeve: 'narrow', lower: 'tunic', trousers: L.black, boots: L.black });
export const SLAVE = (k = 0) => ({ sex: 'm', head: 'jing', face: 'solid', faceCol: [L.ochre, L.cream, L.brown][k % 3], hat: 'band', bandCol: L.gray, robe: [L.gray, L.brown, L.ochre][k % 3], trim: L.gray, pattern: 'plain', sleeve: 'narrow', lower: 'tunic', trousers: L.gray, boots: L.brown });
export const HUMAN_SOLDIER = (k = 0) => ({ sex: 'm', head: 'jing', face: 'solid', faceCol: [L.ochre, L.cream][k % 2], hat: 'helmet', helmCol: L.gray, plume: L.blue, armor: true, robe: L.blue, trim: L.gold, pattern: 'plain', sleeve: 'narrow', lower: 'tunic', trousers: L.ink, boots: L.black });
export const EMPEROR = { sex: 'm', head: 'sheng', hat: 'crown', crownCol: L.yellow, beard: 'short', robe: L.yellow, trim: L.red, pattern: 'cloud', sleeve: 'wide', lower: 'robe', armor: true, boots: L.black };
export const VILLAGER = (k = 0, sex = 'm') => (sex === 'f'
  ? { sex: 'f', head: 'dan', hat: 'bun', robe: [L.blue, L.green, L.ochre, L.gray][k % 4], trim: L.white, pattern: ['dots', 'plain', 'flower', 'plain'][k % 4], sleeve: 'narrow', lower: 'skirt', skirtCol: [L.ink, L.teal, L.brown, L.gray][k % 4] }
  : { sex: 'm', head: 'jing', face: k % 2 ? 'solid' : 'hollow', faceCol: L.ochre, hat: 'band', bandCol: L.black, robe: [L.gray, L.brown, L.blue, L.olive][k % 4], trim: L.cream, pattern: 'plain', sleeve: 'narrow', lower: 'tunic', trousers: L.ink, boots: L.black });
export const LORD = (k = 0) => ({ sex: 'm', head: 'jing', face: 'solid', faceCol: [L.ochre, L.rose][k % 2], hat: 'crown', crownCol: L.gold, beard: 'short', horns: ['ox', 'antler'][k % 2], robe: [L.purple, L.green][k % 2], trim: L.gold, pattern: 'cloud', sleeve: 'wide', lower: 'robe' });
export const MAID = (k = 0) => ({ sex: 'f', head: 'dan', hat: 'bun', robe: L.teal, trim: L.white, pattern: 'dots', sleeve: 'wide', sleeveLen: 10, lower: 'skirt', skirtCol: L.ink });
export const BRIDE = { sex: 'f', head: 'dan', hat: 'veil', robe: L.red, trim: L.gold, pattern: 'flower', sleeve: 'wide', sleeveLen: 15, lower: 'skirt', skirtCol: L.red, shoeCol: L.gold };
export const CONTINENTAL = (k = 0) => ({ sex: 'm', head: 'jing', face: 'hollow', hat: 'tricorn', robe: L.blue, trim: L.white, inner: L.white, pattern: 'plain', sleeve: 'narrow', lower: 'coat', trousers: L.white, boots: L.black, cuff: L.red });
export const MIKO = { sex: 'f', head: 'dan', hat: 'long', robe: L.white, trim: L.red, pattern: 'plain', sleeve: 'wide', sleeveLen: 15, lower: 'skirt', skirtCol: L.red };
