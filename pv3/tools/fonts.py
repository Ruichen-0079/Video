#!/usr/bin/env python3
"""字体子集：画面里唯一的文字是书名，所以只保留这四个字。python3 tools/fonts.py <原始字体目录>"""
import os, sys
from fontTools import subset
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = '万花行记'
os.makedirs(os.path.join(ROOT, 'assets', 'fonts'), exist_ok=True)
for name, fn in {'serif-light': 'NotoSerifCJKsc-Light.otf'}.items():
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']
    f = subset.load_font(os.path.join(sys.argv[1], fn), opt)
    s = subset.Subsetter(opt); s.populate(text=chars); s.subset(f)
    out = os.path.join(ROOT, 'assets', 'fonts', name + '.woff2'); subset.save_font(f, out, opt)
    print(name, os.path.getsize(out) // 1024, 'KB')
