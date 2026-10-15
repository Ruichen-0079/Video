#!/usr/bin/env python3
"""字体子集：只保留 src/ 里出现的字（字幕、字卡、片名）。python3 tools/fonts.py [原始字体目录]"""
import os, sys, glob
from fontTools import subset
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/fonts'
text = ''.join(open(f, encoding='utf8').read() for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.js'), recursive=True))
chars = ''.join(sorted(set(c for c in text if ord(c) > 0x2E7F))) + ''.join(chr(i) for i in range(0x20, 0x7F)) + '「」『』，。、：；！？…—·'
os.makedirs(os.path.join(ROOT, 'assets', 'fonts'), exist_ok=True)
for name, fn in {'serif': 'NotoSerifCJKsc-Regular.otf', 'serif-light': 'NotoSerifCJKsc-Light.otf', 'kai': 'LXGWWenKai-Regular.ttf'}.items():
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']
    f = subset.load_font(os.path.join(SRC, fn), opt)
    s = subset.Subsetter(opt); s.populate(text=chars); s.subset(f)
    out = os.path.join(ROOT, 'assets', 'fonts', name + '.woff2'); subset.save_font(f, out, opt)
    print(name, os.path.getsize(out) // 1024, 'KB', len(chars), 'chars')
