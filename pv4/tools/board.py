#!/usr/bin/env python3
"""分镜总览：每个镜头取一帧，配上时间码、段落和这一镜的文字。
python3 tools/board.py 成片.mp4 输出.jpg [列数]"""
import sys, os, json, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
video, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
cue = json.load(open(os.path.join(ROOT, 'assets', 'cues.json')))
FONT = os.environ.get('BOARD_FONT', '/tmp/claude-0/fonts/NotoSerifCJKsc-Regular.otf')
LIGHT = os.environ.get('BOARD_FONT_LIGHT', '/tmp/claude-0/fonts/NotoSerifCJKsc-Light.otf')

# 五个层次（与 src/edit.js 的分段一致）
SECTIONS = [(0, '引子 · 万花洲'), (10, '一 · 旧时代的世界'), (35, '二 · 历史秩序的断裂'), (69.5, '三 · 武学的传承'),
            (104.5, '四 · 漫长历史中的个体命运'), (152.5, '五 · 开放的收束')]
def section(t):
    s = SECTIONS[0][1]
    for t0, name in SECTIONS:
        if t >= t0 - 1e-3: s = name
    return s

shots = [dict(s) for s in cue['shots']]
shots.append({'id': 'river', 'start': cue['duration'], 'end': cue['duration'] + cue['river']})
W, H = 480, 204                      # 2.35:1 画框
PAD, LAB = 10, 92
tmp = tempfile.mkdtemp()
fnt = ImageFont.truetype(FONT, 15); fsm = ImageFont.truetype(LIGHT, 14); fhd = ImageFont.truetype(FONT, 26)
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + PAD) + PAD, 70 + rows * (H + LAB + PAD) + PAD), (14, 14, 16))
dr = ImageDraw.Draw(sheet)
dr.text((PAD + 4, 18), '万花行记 · 预告（第四版）  分镜总览', font=fhd, fill=(236, 230, 220))

def texts_for(s):
    out = []
    for e in cue['text']:
        mid = (e['t0'] + e['t1']) / 2
        if s['start'] <= mid < s['end'] and e['style'] != 'stamp':
            pre = {'line': '「', 'narr': ''}.get(e['style'], '')
            suf = '」' if e['style'] == 'line' else ''
            out.append(pre + e['text'] + suf)
    st = [e['text'] for e in cue['text'] if e['style'] == 'stamp' and s['start'] <= e['t0'] < s['end']]
    return st, out

def wrap(txt, font, width):
    lines, cur = [], ''
    for ch in txt:
        if dr.textlength(cur + ch, font=font) > width: lines.append(cur); cur = ch
        else: cur += ch
    if cur: lines.append(cur)
    return lines

for i, s in enumerate(shots):
    dur = s['end'] - s['start']
    t = s['start'] + dur * 0.62
    f = os.path.join(tmp, f'{i:02d}.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', f], check=True)
    im = Image.open(f).convert('RGB')
    iw, ih = im.size
    ah = round(iw / 2.35 / 2) * 2
    im = im.crop((0, (ih - ah) // 2, iw, (ih + ah) // 2)).resize((W, H), Image.LANCZOS)
    x = PAD + (i % cols) * (W + PAD); y = 70 + (i // cols) * (H + LAB + PAD)
    sheet.paste(im, (x, y))
    mm, ss = divmod(s['start'], 60)
    st, tx = texts_for(s)
    head = f"{int(mm)}:{ss:04.1f}  {s['id']}" + (f"  ［{' · '.join(st)}］" if st else '')
    dr.text((x + 2, y + H + 6), head, font=fnt, fill=(214, 190, 140))
    dr.text((x + W - 2, y + H + 6), section(s['start']), font=fsm, fill=(130, 126, 120), anchor='ra')
    ly = y + H + 28
    body = tx if tx else (['（第三版结尾：信纸、河面、片名）'] if s['id'] == 'river' else [])
    lines = [l for txt in body for l in wrap(txt, fsm, W - 4)]
    for l in lines[:3]:
        dr.text((x + 2, ly), l, font=fsm, fill=(220, 216, 208)); ly += 20
sheet.save(out, quality=90)
print(out, sheet.size)
