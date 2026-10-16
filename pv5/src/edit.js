// 剪辑表：镜头顺序、时长、转场；字幕与字卡（时间相对于各自镜头的开头）
//
// 第五版：同一份剪辑与文字，画面换成皮影戏（皮影偶、刻出来的布景、幕后的灯）。
// 五个层次：旧时代的世界 → 历史秩序的断裂 → 武学的传承 → 漫长历史中的个体命运 → 开放的收束
// 每一句文字都出自设定总览中作者已确定的内容；【未定】的地方保持开放。
import sheet from './shots/sheet.js';
import grassland from './shots/grassland.js';
import { procession, corridor, seaside } from './shots/old_world.js';
import { siege, herb, banner, escape } from './shots/break.js';
import { lineage, duel, school, purge, couple, tablets } from './shots/martial.js';
import { xia, huangquan, montage, reunion } from './shots/fate.js';
import { modern, blank } from './shots/end.js';
export const DEBUG = { sheet, grassland, procession, corridor, seaside, siege, herb, banner, escape, lineage, duel, school, purge, couple, tablets, xia, huangquan, montage, reunion, modern, blank };

const S = (id, make, dur, args = {}, extra = {}) => ({ id, make, dur, args, ...extra });
export const SHOTS = [
  // ── 引子：万花洲
  S('grassA', grassland, 5.0, { part: 'a' }, { fadeIn: 1.2 }),
  S('grassB', grassland, 5.0, { part: 'b' }, { fadeOut: 0.4 }),
  // ── 一 · 旧世
  S('procA', procession, 3.5, { part: 'a' }, { fadeIn: 0.6 }),
  S('procB', procession, 3.5, { part: 'b' }),
  S('procC', procession, 4.5, { part: 'c' }),
  S('corridor', corridor, 6.5, {}),
  S('seaside', seaside, 7.0, {}, { fadeOut: 0.6 }),
  // ── 二 · 断裂
  S('siegeA', siege, 4.5, { part: 'a' }, { fadeIn: 0.4 }),
  S('siegeB', siege, 4.0, { part: 'b' }),
  S('siegeC', siege, 4.0, { part: 'c' }),
  S('herb', herb, 6.5, {}),
  S('bannerA', banner, 4.5, { part: 'a' }),
  S('bannerB', banner, 4.5, { part: 'b' }),
  S('escapeA', escape, 3.8, { part: 'a' }),
  S('escapeB', escape, 2.7, { part: 'b' }, { fadeOut: 0.5 }),
  // ── 三 · 武学
  S('line0', lineage, 2.5, { era: 0 }, { fadeIn: 0.4 }),
  S('line1', lineage, 2.5, { era: 1 }),
  S('line2', lineage, 2.5, { era: 2 }),
  S('duelA', duel, 6.5, { cutT: 3.4 }),
  S('school', school, 4.0, {}),
  S('purge', purge, 4.5, {}),
  S('coupleA', couple, 4.0, { part: 'a' }),
  S('coupleB', couple, 4.0, { part: 'b' }),
  S('tablets', tablets, 4.5, {}, { fadeOut: 0.5 }),
  // ── 四 · 个体命运
  S('xiaA', xia, 4.5, { part: 'a' }, { fadeIn: 0.4 }),
  S('xiaB', xia, 3.0, { part: 'b' }),
  S('grassC', grassland, 5.5, { part: 'c' }),
  S('hqA', huangquan, 4.0, { part: 'a' }),
  S('hqB', huangquan, 4.0, { part: 'b' }, { fadeOut: 0.8 }),
  S('ming', montage, 6.5, { which: 'ming' }, { fadeIn: 0.5 }),
  S('chains', montage, 3.0, { which: 'chains' }),
  S('war', montage, 3.5, { which: 'war' }),
  S('reunion', reunion, 4.5, {}, { fadeOut: 0.6 }),
  // ── 五 · 收束
  S('modernA', modern, 5.5, { part: 'a' }, { fadeIn: 0.8 }),
  S('modernB', modern, 4.0, { part: 'b' }, { fadeOut: 0.8 }),
  S('card', blank, 7.5, {}),
];
// 之后接第三版的河（信沉下去，城市的倒影里浮出书名），在 tools/final.sh 里拼接

export function timeline(shots) {
  let t = 0; const list = [];
  for (const s of shots) { list.push({ ...s, start: t, end: t + s.dur }); t += s.dur; }
  return { list, duration: t };
}

// 文字：narr 叙述（下方黑边）、line 对白（画面下方，m 明布川 / f 子馥幽）、stamp 时代（上方黑边）、card 字卡
const TXT = {
  grassA: [['stamp', 0.8, 4.8, '万花洲']],
  grassB: [['line', 0.6, 2.3, '你很美。', 'm'], ['line', 2.6, 4.8, '美貌也是有代价的。', 'f']],
  procA: [['stamp', 0.4, 6.8, '亚人王朝'], ['narr', 0.5, 3.3, '很久以前，亚人统治着人间。']],
  procB: [['narr', 0.2, 3.3, '人类，是他们的奴隶。']],
  procC: [['narr', 0.3, 4.3, '亚人能凭想象显出兽的特征，也能把它藏起来。']],
  corridor: [['stamp', 0.3, 6.3, '末代亚人王朝'], ['narr', 0.4, 3.3, '末代的皇女子馥幽长得很慢，在宫中受人排挤。'], ['narr', 3.6, 6.3, '她看着姐姐出嫁。']],
  seaside: [['narr', 0.9, 3.9, '她年幼时，在海边遇见过一个老人。'], ['narr', 4.2, 6.6, '老人摸了摸她的头。']],
  siegeA: [['stamp', 0.3, 12.2, '王朝覆灭'], ['narr', 0.4, 4.3, '那个老人，只是一个寿命普通的人类。']],
  siegeB: [['narr', 0.3, 3.8, '他扶持人类的开国皇帝，']],
  siegeC: [['narr', 0.3, 3.8, '推翻了末代亚人王朝。']],
  herb: [['narr', 0.3, 3.3, '王朝覆灭后，一种草药的烟能逼亚人现出原形。'], ['narr', 3.5, 6.3, '人们用它狩猎残余的亚人。']],
  bannerA: [['narr', 0.3, 4.3, '复国的人，把小皇女推到了旗下。']],
  bannerB: [['narr', 0.3, 4.3, '她渐渐看清了旗子背后的交易。']],
  escapeA: [['narr', 0.3, 3.6, '她出逃时，被复国的人砍伤。']],
  escapeB: [['narr', 0.2, 2.5, '那道伤疤，一直没有消失。']],
  line0: [['narr', 0.2, 2.4, '招式，本来并不存在。']],
  line1: [['narr', 0.1, 2.4, '有人想出它，有人学会它，']],
  line2: [['narr', 0.1, 2.4, '传得够久，它就成了真的。']],
  duelA: [['stamp', 0.3, 6.3, '周'], ['narr', 0.3, 3.2, '周朝。明布川年轻，刚刚登峰造极。'], ['narr', 3.7, 6.3, '他斩断了一个天才的左臂。']],
  school: [['narr', 0.3, 3.9, '那人以这道伤为根基，创立了负伤流派。']],
  purge: [['narr', 0.3, 2.3, '后来，明布川清洗了这个流派。'], ['narr', 2.5, 4.4, '这是他一生的悔恨。']],
  coupleA: [['narr', 0.3, 2.0, '那个老人的武学，是和妻子一起练成的，'], ['narr', 2.2, 3.9, '重在守护。']],
  coupleB: [['narr', 0.3, 1.7, '妻子早逝。'], ['narr', 1.9, 3.9, '他追求的道，是放手。']],
  tablets: [['narr', 0.4, 4.3, '历代剑圣的背后，一直是同一个人。']],
  xiaA: [['stamp', 0.3, 7.3, '夏'], ['narr', 0.3, 2.3, '明布川生在史书所称的夏朝。'], ['narr', 2.5, 4.4, '他不会老。']],
  xiaB: [['narr', 0.2, 2.9, '他爱过的人老了，他被赶走了。']],
  grassC: [['stamp', 0.3, 5.3, '万花洲'], ['narr', 0.3, 2.6, '那个老人，为他们造了一个世界。'], ['line', 2.8, 3.9, '我叫明布川。', 'm'], ['line', 4.0, 5.4, '听起来像狗的名字。', 'f']],
  hqA: [['stamp', 0.3, 7.8, '黄泉'], ['narr', 0.3, 3.9, '为了一个因他而死的巫女，他闯了黄泉。']],
  hqB: [['narr', 0.3, 3.4, '然后，他沉睡了很久。']],
  ming: [['stamp', 0.2, 6.3, '明'], ['narr', 0.2, 3.2, '明朝走向资本主义，工业渐渐盖过了武学。'], ['narr', 3.4, 6.4, '她一个人走过了许多朝代，以才女闻名，']],
  chains: [['narr', 0.1, 2.9, '推动废除亚人奴隶制，']],
  war: [['stamp', 0.1, 3.4, '北美 · 独立战争'], ['narr', 0.1, 3.4, '在美国独立战争中担任军官。']],
  reunion: [['narr', 0.3, 2.0, '她一直在等他。'], ['narr', 2.3, 4.3, '他们在美国重逢。']],
  modernA: [['stamp', 0.6, 5.3, '现代'], ['narr', 0.8, 2.9, '「我从床上惊醒。四周空荡荡，什么也没有。」'], ['narr', 3.1, 5.3, '「望向写字桌上她留下的信纸，」']],
  modernB: [['narr', 0.3, 3.6, '她留下一封信，走了。']],
  card: [['card1', 0.4, 7.2, '她身上的那道伤疤，还没有消失。'], ['card2', 2.2, 7.2, '他还不知道，怎样与一个人长久地生活。'], ['card3', 4.0, 7.2, '她会去哪里，还没有写下。']],
};
export const TEXT = (() => {
  const tl = timeline(SHOTS); const out = []; let id = 0;
  for (const e of tl.list) for (const [style, a, b, text, who] of TXT[e.id] || []) out.push({ id: id++, style, t0: e.start + a, t1: e.start + b, text, who });
  // 跨镜头的时代戳：合并相同文字
  return out;
})();
