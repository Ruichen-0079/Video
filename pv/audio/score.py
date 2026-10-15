#!/usr/bin/env python3
"""《万花行记》PV 配乐 —— 全部由 numpy 合成，不使用任何采样或外部音频。

乐器（都是很朴素的物理/加法合成）：
  qin    —— 琴：加法合成的拨弦，高次泛音衰减快，可带「吟猱」滑音
  pipa   —— 弹拨的固定音型（更亮、更短）
  xiao   —— 箫：正弦 + 少量泛音 + 带通气声，慢起音、颤音
  pad    —— 弦乐铺底：多声部失谐锯齿波经低通
  bell   —— 编钟/磬：非整数倍泛音，长衰减
  taiko  —— 大鼓：下滑正弦 + 噪声
  swell  —— 镲/锣的渐强噪声
  waves  —— 海浪：褐噪声 + 慢起伏
  city   —— 城市的低频嗡鸣
混响：合成的立体声脉冲响应，FFT 卷积。

节拍与画面共享 assets/cues.json：75 BPM，一小节 3.2 秒。
用法：python3 audio/score.py  → assets/score.wav
"""
import json, os, math
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUES = json.load(open(os.path.join(ROOT, 'assets', 'cues.json')))
SR = 48000
BEAT = 60 / CUES['bpm']
BAR = BEAT * CUES['beatsPerBar']
TOTAL = CUES['sections'][-1]['bars'][1] * BAR + CUES['tail']
N = int(TOTAL * SR) + SR

rng = np.random.default_rng(1773)
dry = np.zeros((2, N))
wet = np.zeros((2, N))      # 混响发送


def T(bar, beat=0.0):
    return (bar * 4 + beat) * BEAT


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def hz(name):
    """'A3', 'C#4', 'Bb2' → 频率"""
    n = NOTE[name[0]]
    i = 1
    if name[1] in '#b':
        n += 1 if name[1] == '#' else -1
        i = 2
    octv = int(name[i:])
    return 440.0 * 2 ** ((n + 12 * (octv + 1) - 69) / 12)


def place(sig, t, pan=0.0, gain=1.0, rev=0.3):
    """把单声道信号放到时间 t（秒），等功率声像"""
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4) * gain
    r = np.sin((pan + 1) * np.pi / 4) * gain
    dry[0, i:i + len(sig)] += sig * l * (1 - rev * 0.5)
    dry[1, i:i + len(sig)] += sig * r * (1 - rev * 0.5)
    wet[0, i:i + len(sig)] += sig * l * rev
    wet[1, i:i + len(sig)] += sig * r * rev


def env_adsr(n, a, d, s, r, total):
    e = np.zeros(n)
    ta, td, tr = int(a * SR), int(d * SR), int(r * SR)
    hold = max(0, int(total * SR) - ta - td)
    idx = 0
    seg = min(ta, n); e[:seg] = np.linspace(0, 1, ta)[:seg]; idx = seg
    seg = min(td, n - idx); e[idx:idx + seg] = np.linspace(1, s, td)[:seg]; idx += seg
    seg = min(hold, n - idx); e[idx:idx + seg] = s; idx += seg
    seg = min(tr, n - idx); e[idx:idx + seg] = np.linspace(s, 0, tr)[:seg]
    return e


def lp(x, f, order=2):
    sos = butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos')
    return sosfilt(sos, x)


def hp(x, f, order=2):
    sos = butter(order, f, 'high', fs=SR, output='sos')
    return sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return sosfilt(sos, x)


# ───────────────────────────── 乐器
def qin(f, dur=4.0, bright=1.0, bend=None, vib=0.0, inharm=0.0004):
    """拨弦：加法合成。bend=(time, semitones) 列表，琴的滑音。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    semis = np.zeros(n)
    if bend:
        pts = [(0.0, 0.0)] + bend
        semis = np.interp(t, [p[0] for p in pts], [p[1] for p in pts])
    if vib:
        semis = semis + vib * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) * 2, 0, 1)
    ff = f * 2 ** (semis / 12)
    phase = 2 * np.pi * np.cumsum(ff) / SR
    out = np.zeros(n)
    pluck_pos = 0.18
    for k in range(1, 16):
        amp = abs(np.sin(np.pi * k * pluck_pos)) / k ** (1.15 - 0.25 * bright)
        if f * k > 9000:
            break
        decay = 0.9 + 2.6 * (k - 1) ** 1.25 / bright
        stretch = k * np.sqrt(1 + inharm * k * k)
        out += amp * np.sin(phase * stretch + rng.uniform(0, 6.28)) * np.exp(-decay * t)
    # 起音的拨弦噪声
    nz = rng.standard_normal(n) * np.exp(-t * 90) * 0.25
    out += bp(nz, f * 0.8, min(f * 8, 16000))
    # 琴体：轻微的共鸣峰
    body = bp(out, 180, 900) * 0.25
    out = out + body
    out *= np.exp(-t * 0.35)
    fade = np.ones(n); fade[-2000:] = np.linspace(1, 0, 2000)
    return out * fade * 0.5


def pipa(f, dur=1.2):
    return qin(f, dur, bright=1.9, inharm=0.0002) * np.exp(-np.arange(int(dur * SR)) / SR * 1.8)


def xiao(f, dur, vib=0.18, breath=0.12, att=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = vib * np.sin(2 * np.pi * 4.6 * t + 1.0) * np.clip((t - 0.4) / 0.6, 0, 1)
    ff = f * 2 ** (v / 12)
    ph = 2 * np.pi * np.cumsum(ff) / SR
    tone = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph) + 0.03 * np.sin(4 * ph)
    nz = bp(rng.standard_normal(n), f * 0.9, f * 3.2) * breath * 3
    e = env_adsr(n, att, 0.3, 0.8, min(0.6, dur * 0.4), dur)
    swell = 1 + 0.12 * np.sin(2 * np.pi * 0.7 * t)
    return (tone + nz) * e * swell * 0.25


def pad(freqs, dur, att=2.0, rel=2.5, cutoff=1400, det=0.08, voices=5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) * det
            ff = f * 2 ** (d / 12)
            ph = (ff * t + rng.uniform()) % 1.0
            out += (2 * ph - 1)
    out /= (len(freqs) * voices)
    out = lp(out, cutoff, 2)
    out = lp(out, cutoff * 1.5, 2)
    e = env_adsr(n, att, 0.5, 0.9, rel, dur)
    return out * e * 0.7


def bowed(f, dur, att=1.5, rel=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 12):
        trem = 1 + 0.05 * np.sin(2 * np.pi * (0.3 + 0.07 * k) * t + k)
        out += np.sin(2 * np.pi * f * k * t * (1 + 0.0003 * k)) / k ** 1.4 * trem
    e = env_adsr(n, att, 0.3, 0.9, rel, dur)
    return lp(out, 2500) * e * 0.3


def bell(f, dur=7.0, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    parts = [(0.5, 0.35, 1.4), (1.0, 1.0, 1.0), (2.0, 0.5, 1.6), (2.76, 0.45, 2.1), (5.40, 0.25, 3.6), (8.93, 0.12 * bright, 5.0), (13.3, 0.06 * bright, 7.0)]
    out = np.zeros(n)
    for r, a, d in parts:
        if f * r > 15000:
            continue
        beat = 1 + 0.3 * np.sin(2 * np.pi * 0.8 * t * r)
        out += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6)) * np.exp(-t * d * 0.55) * beat
    out += bp(rng.standard_normal(n) * np.exp(-t * 60), f, min(f * 6, 15000)) * 0.3
    return out * 0.3


def taiko(dur=2.5, f0=110, f1=48, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ff = f1 + (f0 - f1) * np.exp(-t * 14)
    ph = 2 * np.pi * np.cumsum(ff) / SR
    body = np.sin(ph) * np.exp(-t * 3.2)
    skin = lp(rng.standard_normal(n), 900) * np.exp(-t * 28) * 0.8
    return (body + skin) * gain * 0.9


def tick(gain=0.3):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 7000) * np.exp(-t * 120) * gain


def swell(dur, lo=3000, hi=14000, curve=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = (t / dur) ** curve
    e[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return bp(rng.standard_normal(n), lo, hi) * e * 0.25


def gong(dur=8.0, f=70):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for r, a in [(1, 1), (1.47, 0.6), (2.09, 0.5), (2.56, 0.4), (3.2, 0.3), (4.1, 0.2), (5.3, 0.15)]:
        sweep = 1 + 0.02 * np.exp(-t * 2)
        out += a * np.sin(2 * np.pi * f * r * sweep * t + rng.uniform(0, 6)) * np.exp(-t * (0.4 + 0.15 * r))
    out += bp(rng.standard_normal(n), 400, 6000) * np.exp(-t * 1.2) * 0.25 * np.clip(t * 6, 0, 1)
    return out * 0.35


def brown(n, cutoff=400):
    w = rng.standard_normal(n)
    return lp(w, cutoff, 2)


# ───────────────────────────── 谱
# 调式：A 羽（A C D E G），万花洲转到 C 宫（C D E G A），城里回到 A 羽。
P = lambda s: [hz(x) for x in s.split()]

# 「逝者如斯夫」动机：顺流而下
MOTIF = [('E4', 0, 1.5), ('D4', 1.5, 0.5), ('C4', 2, 1), ('D4', 3, 1), ('A3', 4, 4)]


def play_motif(start_bar, inst='qin', transpose=1.0, gain=1.0, pan=-0.1, rev=0.45, beat0=0):
    for name, b, d in MOTIF:
        f = hz(name) * transpose
        t = T(start_bar, beat0 + b)
        if inst == 'qin':
            bend = [(0.05, 0), (0.25, 0), (0.6, -0.35), (1.2, 0)] if d >= 4 else None
            place(qin(f, d * BEAT + 2.5, bend=bend, vib=0.15 if d >= 2 else 0), t, pan, gain, rev)
        elif inst == 'xiao':
            place(xiao(f, d * BEAT + 0.4), t, pan, gain, rev)


# ════════════════════════ 二改：44 小节的新结构 ════════════════════════
def marchdrums(b0, b1, gain=0.7, dense=False):
    for b in range(int(b0), int(math.ceil(b1))):
        if b < b0 or b >= b1: continue
        place(taiko(2.0, 100, 45, gain), T(b), -0.1, 0.65, 0.45)
        place(taiko(1.4, 130, 55, gain * 0.6), T(b, 2), 0.1, 0.55, 0.4)
        if dense:
            for k in (1.5, 3, 3.5):
                place(taiko(1.0, 150, 60, gain * 0.45), T(b, k), 0.2, 0.5, 0.35)

# ── 一 · 书海（0–6）：夜，长音，零落的琴
place(bowed(hz('A1'), T(6) + 2, att=4, rel=3), 0.0, 0, 0.55, 0.5)
place(bowed(hz('E2'), T(6) - T(1.5) + 2, att=4, rel=3), T(1.5), 0.2, 0.3, 0.5)
place(pad(P('A2 E3'), T(6) - T(0.75), att=5, rel=3, cutoff=500), T(0.75), 0, 0.35, 0.6)
air = hp(brown(int(T(7) * SR), 300), 80) * 0.05
air *= np.clip(np.arange(len(air)) / (SR * 5), 0, 1)
place(air, 0, 0, 1.0, 0.2)
for bb, name, pan in [(0.4, 'A3', -0.2), (1.0, 'E4', 0.1), (1.5, 'D4', 0.2), (2.0, 'C4', -0.1), (2.4, 'A3', -0.3)]:
    place(qin(hz(name), 5, bend=[(0.4, 0), (1.0, -0.25), (1.6, 0)] if name == 'A3' else None), T(bb), pan, 0.9, 0.5)
place(bell(hz('A3'), 9), T(1), 0.25, 0.35, 0.7)
# 逝者如斯夫，陛下
play_motif(3, 'qin', gain=1.1)
place(bell(hz('A2'), 10), T(3), 0, 0.5, 0.7)
# 古书如溪流，火
place(swell(T(6) - T(4.8), 1500, 9000, 2.0), T(4.8), 0, 0.6, 0.5)
for i in range(18):
    f = P('A4 C5 D5 E5 G5 A5 C6 D6')[i % 8]
    place(qin(f, 1.6, bright=1.6) * 0.5, T(4.8, i * 0.25), np.sin(i) * 0.6, 0.35 + i * 0.02, 0.6)

# ── 二 · 长卷（6–11.75）：少年离乡，断臂
place(taiko(3, 90, 40, 1.0), T(6), 0, 0.9, 0.5)
place(bell(hz('A2'), 9), T(6), 0, 0.4, 0.7)
ost = ['A3', 'E4', 'A4', 'C5', 'D5', 'C5', 'A4', 'E4']
for b in range(6, 11):
    for i in range(8):
        if b == 10 and i >= 2: continue          # 决斗前收住
        g = 0.3 + 0.2 * min(1, (b - 6) / 3)
        place(pipa(hz(ost[i]), 1.0), T(b, i * 0.5), 0.35 * np.sin(i * 1.3), g, 0.35)
for b, root in zip(range(6, 11), ['A1', 'F1', 'G1', 'A1', 'D2']):
    place(bowed(hz(root), BAR + 0.6, att=0.6, rel=1.0), T(b), 0, 0.5, 0.35)
    place(pad([hz(root) * 2, hz(root) * 3, hz(root) * 4.0], BAR + 0.8, att=0.8, rel=1.5, cutoff=900), T(b), 0, 0.32, 0.5)
# 门口的人老去：琴，慢，往下
for name, b, d in [('E4', 7, 1.5), ('D4', 7.5, 1), ('C4', 8, 1.5), ('A3', 8.5, 2), ('G3', 9.0, 3)]:
    place(qin(hz(name), d * BEAT + 3, bend=[(0.3, 0), (0.9, -0.3), (1.5, 0)], vib=0.12), T(b), -0.3, 0.75, 0.6)
for b in range(7, 10): place(taiko(1.8, 100, 45, 0.5), T(b), -0.1, 0.55, 0.45)
# 决斗：举剑 → 斩（10½）
place(swell(T(10.5) - T(9.75), 2000, 12000, 3.0), T(9.75), 0, 0.85, 0.4)
place(taiko(4, 160, 38, 1.4), T(10.5), 0, 1.0, 0.6)
place(gong(9, 62), T(10.5), 0, 0.8, 0.7)
place(bell(hz('E3'), 8, 1.4), T(10.5), 0.2, 0.5, 0.6)
place(pad(P('D3 A3 C4 E4'), BAR * 1.4, att=0.3, rel=3, cutoff=1500), T(11.05), 0, 0.45, 0.7)

# ── 三 · 海（11.75–14.25）：月，浪，箫；摸头
wv = brown(int((T(14.5) - T(11.4)) * SR), 600)
tt = np.arange(len(wv)) / SR
wv *= (0.6 + 0.4 * np.sin(2 * np.pi * tt / 5.5) ** 2) * np.clip(tt / 2.5, 0, 1) * np.clip((tt[-1] - tt) / 1.5, 0, 1)
place(wv * 0.33, T(11.4), -0.3, 1.0, 0.4)
place(wv[::-1] * 0.28, T(11.4), 0.3, 1.0, 0.4)
place(pad(P('A2 E3 B3 E4'), T(14.25) - T(11.75) + 1.5, att=2, rel=2.5, cutoff=1100), T(11.75), 0, 0.45, 0.7)
for name, b, d in [('E5', 0, 2), ('D5', 2, 1), ('B4', 3, 1), ('A4', 4, 2.5), ('G4', 6.5, 1.5)]:
    place(xiao(hz(name), d * BEAT + 0.5, att=0.5), T(12, b), 0.15, 0.7, 0.6)
place(bell(hz('A5'), 6, 0.6), T(13.1), 0.2, 0.28, 0.8)
place(qin(hz('E5'), 5, bright=0.5), T(13.1), 0.2, 0.45, 0.8)
place(qin(hz('A5'), 5, bright=0.5), T(13.35), 0.25, 0.3, 0.8)

# ── 四 · 剑舞（14.25–16）与覆灭（16–17.75）
# 剑舞：一招一式落在拍上，渐快
moves = [14.35 + k * (16.0 - 14.35) / 6 for k in range(7)]
for k, b in enumerate(moves[:-1]):
    place(taiko(1.6, 120 + k * 8, 50, 0.55 + k * 0.06), T(b), (-1) ** k * 0.2, 0.7, 0.45)
    place(qin(hz(['A4', 'C5', 'D5', 'E5', 'G5', 'A5'][k]), 2.2, bright=1.4), T(b), (-1) ** k * 0.3, 0.6, 0.5)
for i in range(int((16.0 - 14.4) * 8)):
    place(pipa(hz(['A3', 'E4', 'A4', 'E4'][i % 4]), 0.6), T(14.4, i * 0.5), 0.3 * np.sin(i), 0.22 + 0.012 * i, 0.3)
place(bowed(hz('A1'), T(16) - T(14.25) + 0.5, att=1.0, rel=0.5), T(14.25), 0, 0.55, 0.4)
place(swell(T(16) - T(15.25), 1500, 13000, 2.6), T(15.25), 0, 0.9, 0.5)
# 斩下：火
place(taiko(5, 140, 34, 1.6), T(16), 0, 1.0, 0.7)
place(gong(10, 55), T(16), 0, 0.9, 0.8)
place(bell(hz('A2'), 10, 1.4), T(16), 0, 0.5, 0.7)
fire = bp(rng.standard_normal(int((T(17.9) - T(16)) * SR)), 200, 3000)
tt = np.arange(len(fire)) / SR
fire *= (0.5 + 0.5 * np.abs(np.sin(tt * 7.3) * np.sin(tt * 3.1))) * 0.06 * np.clip(tt * 3, 0, 1)
place(fire, T(16), 0.2, 1.0, 0.4)
marchdrums(16.25, 17.75, 0.75, dense=True)
place(pad([hz('D2'), hz('A2'), hz('D3'), hz('F3')], T(17.75) - T(16) + 1, att=0.3, rel=1.5, cutoff=1300), T(16), 0, 0.55, 0.5)
place(bowed(hz('D1'), T(17.75) - T(16) + 1, att=0.3, rel=1.2), T(16), 0, 0.6, 0.4)
place(swell(BAR * 0.6, 1500, 9000, 2.0), T(17.15), 0, 0.6, 0.5)

# ── 五 · 旗与逃（17.75–21.25）
place(taiko(3, 110, 40, 1.1), T(17.75), 0, 0.85, 0.6)
place(bell(hz('D3'), 9, 1.2), T(17.75), 0, 0.45, 0.7)
for name, b, d in [('A4', 0, 1.5), ('D5', 1.5, 0.5), ('E5', 2, 1.5), ('G5', 3.5, 0.5), ('E5', 4, 2)]:
    place(xiao(hz(name), d * BEAT + 0.5, att=0.3), T(17.75, b), 0.1, 0.85, 0.55)
    place(bowed(hz(name) / 2, d * BEAT + 0.8, att=0.3, rel=0.8), T(17.75, b), -0.2, 0.4, 0.5)
place(pad(P('D3 A3 D4 F4'), T(19.25) - T(17.75) + 1, att=0.5, rel=1.5, cutoff=1800), T(17.75), 0, 0.5, 0.6)
marchdrums(17.75, 19.25, 0.55)
# 逃：急促
for i in range(int((20.25 - 19.25) * 16)):
    place(pipa(hz(['D4', 'F4', 'A4', 'D5'][i % 4]), 0.5), T(19.25, i * 0.25), 0.4 * np.sin(i * 1.7), 0.3, 0.3)
for k in range(8):
    place(taiko(1.0, 150, 60, 0.6), T(19.25, k * 0.5), 0.1 * (-1) ** k, 0.6, 0.3)
place(swell(T(20.25) - T(19.6), 2500, 13000, 3.5), T(19.6), 0, 0.8, 0.4)
# 伤：一声，然后空
place(taiko(3.5, 190, 40, 1.3), T(20.25), 0, 0.95, 0.6)
place(qin(hz('E5'), 4, bright=1.9, bend=[(0.05, 0), (0.6, -1.2)]), T(20.25), 0.3, 0.6, 0.7)
place(bell(hz('C3'), 9), T(20.25), -0.2, 0.4, 0.7)

# ── 六 · 笑（21.25–23.75）：独行，侧脸
place(bowed(hz('A1'), T(23.9) - T(21.0), att=1.5, rel=2), T(21.0), 0, 0.45, 0.5)
place(pad(P('A2 E3 C4'), T(23.9) - T(21.0), att=2, rel=2, cutoff=600), T(21.0), 0, 0.35, 0.7)
dragn = bp(rng.standard_normal(int((T(22.75) - T(21.0)) * SR)), 1800, 6000)
tt = np.arange(len(dragn)) / SR
dragn *= 0.012 * (0.6 + 0.4 * np.sin(tt * 4.1) ** 2) * np.clip(tt, 0, 1) * np.clip((tt[-1] - tt) * 2, 0, 1)
place(dragn, T(21.0), 0.3, 1.0, 0.3)       # 剑尖拖地的沙沙声
for name, b in [('A3', 21.25), ('C4', 21.75), ('A3', 22.25)]:
    place(qin(hz(name), 5, bend=[(0.05, 0), (0.4, 0), (1.2, -0.45), (2.0, -0.2)], vib=0.1), T(b), -0.1, 0.8, 0.6)
place(bell(hz('E4'), 8, 0.5), T(22.5), 0.1, 0.25, 0.85)
# 嘴角上牵：一个很高的泛音，略微滑上去
place(qin(hz('E5'), 6, bright=0.45, bend=[(0.1, -0.5), (0.9, 0.0)]), T(22.95), 0.15, 0.5, 0.85)
place(qin(hz('A5'), 6, bright=0.45), T(23.35), 0.2, 0.3, 0.85)

# ── 七 · 万花洲（23.75–30.2）
place(bell(hz('C3'), 10), T(23.75), 0, 0.5, 0.7)
place(gong(10, 55) * 0.5, T(23.75), 0, 0.5, 0.8)
chords = [P('C3 G3 E4'), P('A2 E3 C4'), P('F2 C3 A3'), P('G2 D3 B3')]
for i, b in enumerate([23.75, 24.75, 25.75, 26.75, 27.75, 28.75]):
    ch = chords[i % 4]
    cut = 900 if b < 26 else 2400
    place(pad(ch, BAR + 1.5, att=1.0, rel=2, cutoff=cut), T(b), 0, 0.55 if b < 26 else 0.7, 0.6)
    place(bowed(ch[0] / 2, BAR + 1, att=0.8), T(b), 0, 0.45, 0.4)
wind = bp(rng.standard_normal(int((T(30.2) - T(23.75)) * SR)), 300, 2500)
tt = np.arange(len(wind)) / SR
wind *= (0.3 + 0.7 * np.sin(2 * np.pi * tt / 6.4) ** 2) * 0.05 * np.clip(tt / 3, 0, 1)
place(wind, T(23.75), 0.4, 1.0, 0.3)
for i, name in enumerate(['C4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4']):
    place(qin(hz(name), 3), T(24.4, i * 0.5), 0.3, 0.45, 0.5)
# 万花
place(swell(BAR * 0.75, 2000, 14000, 2.5), T(25.25), 0, 0.7, 0.5)
place(taiko(4, 120, 40, 1.2), T(26), 0, 0.9, 0.7)
place(bell(hz('C4'), 10, 1.3), T(26), -0.3, 0.6, 0.7)
place(bell(hz('G4'), 10, 1.3), T(26, 0.5), 0.3, 0.45, 0.7)
gl = P('C4 D4 E4 G4 A4 C5 D5 E5 G5 A5 C6 D6 E6')
for b in range(26, 28):
    for i in range(16):
        k = (i if (b % 2) else 12 - (i % 13)) % 13
        place(qin(gl[k], 2.0, bright=1.5) * 0.5, T(b, i * 0.25), np.sin(i * 0.9 + b) * 0.7, 0.45, 0.6)
mel2 = [('E5', 0, 1.5), ('D5', 1.5, 0.5), ('C5', 2, 1), ('D5', 3, 1), ('G4', 4, 2), ('A4', 6, 2)]
for name, b, d in mel2:
    place(xiao(hz(name), d * BEAT + 0.5), T(26, b), 0.1, 0.9, 0.55)
    place(bowed(hz(name) / 2, d * BEAT + 0.8, att=0.4, rel=1.0), T(26, b), -0.2, 0.35, 0.5)
# 并肩坐着：两支箫
for name, b, d in [('G4', 0, 2), ('E4', 2, 2), ('D4', 4, 3)]:
    place(xiao(hz(name), d * BEAT + 0.5), T(28.25, b), -0.25, 0.6, 0.6)
for name, b, d in [('C5', 0.5, 2), ('A4', 2.5, 2), ('G4', 4.5, 2.5)]:
    place(xiao(hz(name), d * BEAT + 0.5), T(28.25, b), 0.25, 0.45, 0.6)
place(pad(P('A2 E3 C4 G4'), BAR * 1.5 + 2, att=1, rel=3, cutoff=1100), T(29.3), 0, 0.5, 0.7)
# 黄泉
place(bowed(hz('D1'), T(32.3) - T(30.2), att=0.5, rel=1.5), T(30.2), 0, 0.8, 0.5)
place(pad([hz('D2'), hz('Eb2'), hz('A2')], T(32.3) - T(30.2), att=0.8, rel=1.5, cutoff=600), T(30.2), 0, 0.6, 0.7)
for i in range(6):
    place(taiko(1.2, 70, 38, 0.75), T(30.25, i * 1.0), 0, 0.6, 0.3)
    place(taiko(1.0, 70, 38, 0.45), T(30.25, i * 1.0 + 0.3), 0, 0.5, 0.3)
place(swell(T(31.75) - T(31.0), 800, 6000, 3), T(31.0), 0, 0.7, 0.5)
place(gong(8, 48), T(31.75), 0, 0.9, 0.7)
place(bell(hz('D3'), 8, 1.4), T(31.75), 0, 0.5, 0.7)

# ── 八 · 散（32.25–38）：她的几百年
for b in range(32, 37):
    b0 = max(b, 32.25)
    rate = 2 if b < 34 else 4
    names = ['A3', 'C4', 'E4', 'A4', 'G4', 'E4', 'D4', 'C4'] if b < 35 else ['D4', 'F4', 'A4', 'D5', 'C5', 'A4', 'G4', 'F4']
    for i in range(4 * rate):
        tb = b + i / rate / 4
        if tb < 32.3: continue
        place(pipa(hz(names[i % 8]), 0.8), T(tb), 0.4 * np.sin(i), 0.3 + 0.04 * (b - 32), 0.3)
    for i in range(8):
        if b + i / 8 < 32.3: continue
        place(tick(0.35 if i % 2 == 0 else 0.2), T(b, i * 0.5), 0.6, 0.6, 0.2)
    root = ['A1', 'F1', 'G1', 'D2', 'Bb1'][b - 32]
    place(bowed(hz(root), BAR + 0.5, att=0.4, rel=0.8), T(b0), 0, 0.6, 0.35)
    place(pad([hz(root) * 2, hz(root) * 3, hz(root) * 5], BAR + 0.5, att=0.4, rel=1, cutoff=1600), T(b0), 0, 0.4, 0.5)
    place(taiko(1.8, 110, 45, 0.65), T(b0), 0, 0.65, 0.4)
    if b >= 34: place(taiko(1.4, 130, 50, 0.45), T(b, 2), 0, 0.55, 0.4)
play_motif(33, 'xiao', transpose=1.0, gain=0.6, pan=-0.3)
play_motif(35, 'xiao', transpose=2 ** (5 / 12), gain=0.7, pan=-0.3)
place(bowed(hz('E2'), T(37.35) - T(36.6) + 0.5, att=0.3), T(36.6), 0, 0.5, 0.4)
place(swell(T(37.35) - T(36.6), 2000, 14000, 2.5), T(36.6), 0, 0.8, 0.5)
# 重逢
place(taiko(5, 130, 38, 1.4), T(37.35), 0, 1.0, 0.7)
place(gong(10, 58), T(37.35), 0, 0.7, 0.8)
place(bell(hz('C4'), 10, 1.2), T(37.35), -0.2, 0.6, 0.8)
place(bell(hz('E4'), 10, 1.2), T(37.35, 0.25), 0.2, 0.5, 0.8)
place(pad(P('C3 G3 E4 G4'), BAR * 1.6 + 2, att=0.2, rel=3, cutoff=2600), T(37.35), 0, 0.75, 0.7)
place(bowed(hz('C2'), BAR * 1.6 + 2, att=0.3), T(37.35), 0, 0.6, 0.5)
for name, b, d in [('G4', 0, 1.5), ('E4', 1.5, 0.5), ('D4', 2, 1), ('E4', 3, 1), ('C4', 4, 2)]:
    place(xiao(hz(name), d * BEAT + 0.6), T(37.35, b), 0.1, 0.85, 0.6)

# ── 九 · 城（38–44 + 尾声）
hum = lp(rng.standard_normal(int((T(44) + 6 - T(38)) * SR)), 180, 2) * 0.12
tt = np.arange(len(hum)) / SR
hum *= np.clip(tt / 3, 0, 1) * np.clip((tt[-1] - tt) / 4, 0, 1)
place(hum, T(38), 0, 1.0, 0.2)
for b, pan in [(38.5, -1), (39.7, 1), (41.1, -1), (42.4, 1), (43.6, -1)]:
    n = int(3.5 * SR); tt2 = np.arange(n) / SR
    car = bp(rng.standard_normal(n), 200, 1800) * np.exp(-((tt2 - 1.75) / 0.8) ** 2) * 0.08
    place(car, T(b), pan * 0.7, 1.0, 0.3)
place(pad(P('A2 E3 C4'), T(44) - T(38) + 3, att=3, rel=5, cutoff=700), T(38), 0, 0.45, 0.7)
place(bowed(hz('A1'), T(44) - T(38) + 3, att=3, rel=5), T(38), 0, 0.4, 0.5)
solo = [('A3', 38.3, 0), ('C4', 38.3, 1.5), ('E4', 38.3, 2), ('D4', 39.3, 0), ('C4', 39.3, 2), ('A3', 40.3, 0),
        ('E4', 40.8, 0), ('D4', 40.8, 1.5), ('C4', 40.8, 2), ('D4', 40.8, 3), ('A3', 41.8, 0)]
for name, b, beat in solo:
    bend = [(0.05, 0), (0.3, 0), (0.9, -0.4), (1.6, 0)] if name == 'A3' else None
    place(qin(hz(name), 5, bend=bend, vib=0.1), T(b, beat), -0.1, 0.9, 0.55)
# 「真是他妈的，逝者如斯夫」：动机，低八度
play_motif(42.6, 'qin', transpose=0.5, gain=1.0, pan=0.0, rev=0.6)
# 书名
place(bell(hz('A2'), 12, 1.0), T(44), 0, 0.7, 0.8)
place(gong(12, 52) * 0.6, T(44), 0, 0.6, 0.8)
place(qin(hz('A4'), 8, bright=0.6), T(44, 0.02), 0.2, 0.5, 0.8)
place(qin(hz('E5'), 8, bright=0.6), T(44, 1), -0.2, 0.4, 0.8)

# ───────────────────────────── 混响与母带
def make_ir(sec=4.2, sr=SR):
    n = int(sec * sr)
    t = np.arange(n) / sr
    irs = []
    for ch in range(2):
        nz = rng.standard_normal(n)
        # 高频衰减得更快：两段低通交叉
        bright = nz * np.exp(-t * 3.2)
        dark = lp(nz, 2500) * np.exp(-t * 1.5)
        ir = bright * 0.5 + dark
        ir[: int(0.012 * sr)] *= np.linspace(0, 1, int(0.012 * sr))
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs


print('reverb...')
ir = make_ir()
wet = hp(wet, 220, 2)   # 低频不进混响，避免浑浊
rev = np.stack([fftconvolve(wet[0], ir[0])[:N], fftconvolve(wet[1], ir[1])[:N]])
mix = dry + rev * 1.4
mix = hp(mix, 35)
mix = mix - 0.5 * lp(mix, 140, 2)   # 低频搁架衰减约 6 dB
# 柔和压缩
peak = np.max(np.abs(mix))
mix = mix / peak
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
mix *= 10 ** (-1.0 / 20)
# 结尾淡出
end = int(TOTAL * SR)
mix = mix[:, :end]
f = int(1.5 * SR)
mix[:, -f:] *= np.linspace(1, 0, f)

out = os.path.join(ROOT, 'assets', 'score.wav')
import wave
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{TOTAL:.1f}s')
