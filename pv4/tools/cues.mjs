// 导出剪辑表（镜头起止、文字）给配乐脚本：assets/cues.json
import fs from 'node:fs';
const { SHOTS, TEXT, timeline } = await import('../src/edit.js');
const tl = timeline(SHOTS);
const out = { duration: tl.duration, river: 7.5, shots: tl.list.map((e) => ({ id: e.id, start: +e.start.toFixed(3), end: +e.end.toFixed(3), args: e.args })), text: TEXT };
fs.writeFileSync(new URL('../assets/cues.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.shots.length, 'shots', out.duration, 's');
