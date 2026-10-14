#!/usr/bin/env python3
"""从源码中收集所有用到的汉字，生成：
  assets/fonts/*.woff2   —— 字体子集（只含用到的字，体积很小，渲染可复现）
  assets/hanzi.json      —— Make Me a Hanzi 的笔画数据子集（用于「光写字」）

用法：python3 tools/build_assets.py <原始字体目录> <graphics.txt>
原始字体（均为 OFL / Arphic 许可）：
  NotoSerifCJKsc-Light.otf / -Regular.otf / -Bold.otf   https://github.com/notofonts/noto-cjk
  LXGWWenKai-Regular.ttf                                https://github.com/lxgw/LxgwWenKai
  MaShanZheng-Regular.ttf                               https://github.com/google/fonts
graphics.txt                                            https://github.com/skishore/makemeahanzi
"""
import json, os, re, sys, glob
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir, graphics = sys.argv[1], sys.argv[2]

text = ''
for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.js'), recursive=True):
    text += open(f, encoding='utf8').read()
chars = sorted(set(c for c in text if ord(c) > 0x2E7F))
chars += list('0123456789')
ascii_ = ''.join(chr(i) for i in range(0x20, 0x7F))
allc = ''.join(chars) + ascii_ + '·—「」『』，。、：；！？…《》（）'
print(len(chars), 'CJK chars')

fonts = {
    'serif-light': 'NotoSerifCJKsc-Light.otf',
    'serif': 'NotoSerifCJKsc-Regular.otf',
    'serif-bold': 'NotoSerifCJKsc-Bold.otf',
    'kai': 'LXGWWenKai-Regular.ttf',
    'brush': 'MaShanZheng-Regular.ttf',
}
os.makedirs(os.path.join(ROOT, 'assets', 'fonts'), exist_ok=True)
for name, fn in fonts.items():
    p = os.path.join(src_dir, fn)
    if not os.path.exists(p):
        print('skip', fn); continue
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.layout_features = ['*']
    opt.name_IDs = ['*']
    opt.notdef_outline = True
    font = subset.load_font(p, opt)
    sub = subset.Subsetter(opt)
    sub.populate(text=allc)
    sub.subset(font)
    out = os.path.join(ROOT, 'assets', 'fonts', name + '.woff2')
    subset.save_font(font, out, opt)
    print(name, os.path.getsize(out) // 1024, 'KB')

want = set(chars)
data = {}
for line in open(graphics, encoding='utf8'):
    d = json.loads(line)
    if d['character'] in want:
        data[d['character']] = {'s': d['strokes'], 'm': d['medians']}
json.dump(data, open(os.path.join(ROOT, 'assets', 'hanzi.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
missing = [c for c in chars if c not in data and not c.isdigit()]
print('hanzi', len(data), 'missing', ''.join(missing)[:80])
