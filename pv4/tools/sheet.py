#!/usr/bin/env python3
"""把一组静帧拼成联系表：python3 tools/sheet.py out/lib out/lib.png [cols]"""
import sys, os, glob
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
fs = sorted(glob.glob(os.path.join(d, '*.png')))
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * h + (rows + 1) * 6), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, fs)):
    x, y = 6 + (i % cols) * (w + 6), 6 + (i // cols) * (h + 6)
    sheet.paste(im, (x, y))
    dr.text((x + 6, y + 4), os.path.basename(f)[1:-4] + 's', fill=(255, 255, 0))
sheet.save(out)
print(out, sheet.size)
