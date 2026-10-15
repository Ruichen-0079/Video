#!/usr/bin/env python3
"""《万花行记》PV 第三版「逝水」配乐 —— numpy 逐样本合成，不用任何采样。

每一滴雨、每一滴水都是一个被调过音的水声；斩下是一声金属的鸣响，之后是寂静；
他的水滴是 A，她的是 E；信落水时是一口很低的钟。
事件时间全部来自 assets/events.json（与画面同一份）。
"""
import json, os, math
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV = json.load(open(os.path.join(ROOT, 'assets', 'events.json')))
SR = 48000
BEAT = 60 / EV['bpm']
BAR = BEAT * 4
TOTAL = EV['duration']
N = int(TOTAL * SR) + SR

rng = np.random.default_rng(2026)
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


# ───────────────────────────── 水声
def droplet(f=900.0, dur=0.35, gain=1.0):
    """水滴落水：一个向上滑的短正弦（气泡共振）+ 一点击打噪声"""
    n = int(dur * SR); t = np.arange(n) / SR
    ff = f * (1 + 0.9 * (1 - np.exp(-t * 60)))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    tone = np.sin(ph) * np.exp(-t * 28)
    click = bp(rng.standard_normal(n), 2000, 9000) * np.exp(-t * 400) * 0.4
    return (tone * 0.6 + click) * gain

def harmonic(f, dur=5.0, gain=1.0):
    """琴的泛音：纯、长、像水面上的光"""
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 2) + 0.06 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 4)
    e = np.exp(-t * 0.9) * np.clip(t * 200, 0, 1)
    return s * e * 0.35 * gain

def shing(dur=3.0):
    """刀出：高频金属鸣响 + 嘶声"""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for r, a, d in [(1.0, 1.0, 2.0), (2.31, 0.6, 3.0), (3.67, 0.4, 4.5), (5.12, 0.25, 6.0)]:
        out += a * np.sin(2 * np.pi * 2350 * r * t + rng.uniform(0, 6)) * np.exp(-t * d)
    hiss = bp(rng.standard_normal(n), 3000, 14000) * np.exp(-t * 9) * 0.8
    sweep = bp(rng.standard_normal(n), 600, 6000) * np.exp(-((t - 0.04) / 0.05) ** 2) * 1.2
    return (out * 0.18 + hiss * 0.25 + sweep * 0.5)

def plunge(dur=3.0):
    """剑入水：闷响 + 一串气泡"""
    n = int(dur * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 20)) * t) * np.exp(-t * 6) * 0.9
    sp = bp(rng.standard_normal(n), 300, 4000) * np.exp(-t * 14) * 0.5
    out = thump + sp
    r2 = np.random.default_rng(9)
    for k in range(16):
        tt = 0.05 + r2.random() ** 1.5 * 1.6
        i = int(tt * SR)
        b = droplet(500 + r2.random() * 900, 0.2, 0.12 * (1 - tt / 1.8))
        out[i:i + len(b)] += b[: n - i]
    return out

# ───────────────────────────── 谱
E = EV
A = lambda name: hz(name)
PENTA = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6']

# 底：河的气息（很轻的褐噪声 + 水的嘶声），全程
river = hp(brown(N, 500), 60) * 0.035 + bp(rng.standard_normal(N), 1500, 6000) * 0.004
river *= np.clip(np.arange(N) / (SR * 2.5), 0, 1)
place(river, 0, 0, 1.0, 0.25)

# 第一滴（1.5）
place(droplet(1100, 0.4, 1.0), 1.5, 0.0, 0.8, 0.6)
place(harmonic(A('A5'), 6, 0.9), 1.5, 0.0, 0.7, 0.8)

# 雨：众生。每一滴都是一个水声，音高取五声
r3 = np.random.default_rng(11)
for d in E['rain'][1:]:
    pan = float(np.clip(d['x'] / 1.6, -1, 1)) * 0.8
    f = 700 + r3.random() * 900
    place(droplet(f, 0.3, d['a']), d['t'], pan, 0.55, 0.5)
    if r3.random() < 0.35:
        place(harmonic(A(PENTA[r3.integers(len(PENTA))]), 3, 0.35 * d['a']), d['t'], pan, 0.5, 0.75)
# 低音铺底随雨而起，在斩之前绷紧
cut = E['cut']['t0']
place(bowed(A('A1'), cut - 2.5 + 0.05, att=4, rel=0.05), 2.5, 0, 0.5, 0.4)
place(bowed(A('E2'), cut - 5.0 + 0.05, att=3, rel=0.05), 5.0, 0.15, 0.35, 0.4)
place(pad([A('A2'), A('E3'), A('C4')], cut - 4.0 + 0.05, att=3, rel=0.05, cutoff=900), 4.0, 0, 0.35, 0.6)
# 火：噼啪声与渐快的鼓
fire = bp(rng.standard_normal(int((cut - 5.5) * SR)), 300, 3500)
tt = np.arange(len(fire)) / SR
fire *= np.clip(tt / 2.5, 0, 1) * (0.4 + 0.6 * np.abs(np.sin(tt * 7.1) * np.sin(tt * 2.9))) * 0.05
place(fire, 5.5, 0.2, 1.0, 0.4)
for k, tb in enumerate([6.0, 6.75, 7.35, 7.85, 8.25, 8.55, 8.78]):
    place(taiko(1.4, 110, 45, 0.45 + k * 0.08), tb, 0, 0.65, 0.4)
place(swell(cut - 7.3, 2000, 14000, 3.0), 7.3, 0, 0.8, 0.4)
# 书页：《永乐大典》的火里飘下来的书页，落水「嗤」的一声熄灭
for p in E['pages']:
    n = int(0.9 * SR); tq = np.arange(n) / SR
    hiss = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-tq * 5) * np.clip(tq * 80, 0, 1) * 0.2
    pan = float(np.clip(p['x'] / 1.2, -1, 1)) * 0.7
    place(hiss, p['land'], pan, 0.8, 0.45)
    place(droplet(560 + 30 * p['seed'], 0.25, 0.45), p['land'], pan, 0.5, 0.5)

# 斩（9.0）：一声鸣响，然后什么都没有
place(shing(3.5), cut, 0.1, 1.0, 0.65)
place(taiko(4.5, 150, 32, 1.5), cut, 0, 0.9, 0.6)
place(gong(9, 58) * 0.6, cut, 0, 0.5, 0.8)
# 剑入水（9.55）、沉底（11.6）
place(plunge(3.0), E['sword']['drop'], 0.15, 0.9, 0.5)
n = int(2.2 * SR); t2 = np.arange(n) / SR
sink = np.sin(2 * np.pi * (180 - 60 * t2 / 2.2) * t2) * np.exp(-t2 * 0.8) * np.clip(t2 * 4, 0, 1) * 0.12
place(sink, E['sword']['drop'] + 0.1, 0.1, 1.0, 0.7)
place(taiko(2.0, 60, 40, 0.35), E['sword']['settle'], 0.1, 0.6, 0.6)

# 守（12.0–）：他的水滴，A。月下的长音
for k, d in enumerate(E['hisDrops']):
    place(droplet(880, 0.35, 0.8), d, -0.15, 0.5, 0.6)
    late = d > E['letter']['t']
    place(harmonic(A('A4') if not late else A('A3') * 2, 5.5, 0.9), d, -0.15, 0.32, 0.8)
place(pad([A('A2'), A('E3')], 18.5 - 11.8, att=3, rel=2.5, cutoff=600), 11.8, 0, 0.16, 0.7)
place(bowed(A('A1'), 18.5 - 11.8, att=3, rel=2.5), 11.8, 0, 0.15, 0.5)

# 遇（18.75–）：她的水滴，E；和声转暖；花落水的轻响；一支箫
for d in E['herDrops']:
    place(droplet(1320, 0.35, 0.8), d, 0.3, 0.5, 0.6)
    place(harmonic(A('E5'), 5.5, 0.9), d, 0.3, 0.3, 0.8)
place(pad([A('C3'), A('G3'), A('E4'), A('A4')], 25.5 - 18.6, att=2.5, rel=3, cutoff=1500), 18.6, 0, 0.22, 0.7)
place(bowed(A('C2'), 25.5 - 18.6, att=2.5, rel=3), 18.6, 0, 0.16, 0.5)
for p in E['petals'][::3]:
    place(harmonic(A(PENTA[int(p['kind']) + 3]) , 2.0, 0.18), p['t'], float(np.clip(p['x'], -1, 1)) * 0.6, 0.5, 0.8)
for name, b, d in [('E5', 0, 1.5), ('D5', 1.5, 0.5), ('C5', 2, 1), ('D5', 3, 1), ('G4', 4, 2.5)]:
    place(xiao(A(name), d * BEAT + 0.5, att=0.4), 19.5 + b * BEAT, 0.1, 0.45, 0.65)

# 放手（24.45）：信落水，一口很低的钟；墨洇开时一条低弦
lt = E['letter']['t']
n = int(0.6 * SR); t3 = np.arange(n) / SR
slap = lp(rng.standard_normal(n), 1200) * np.exp(-t3 * 25) * 0.5
place(slap, lt, 0.2, 0.8, 0.5)
n = int(E['letter']['fall'] * SR); t5 = np.arange(n) / SR
flutter = bp(rng.standard_normal(n), 400, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t5) ** 2) * np.sin(np.pi * t5 / t5[-1]) * 0.05
place(flutter, lt - E['letter']['fall'], 0.25, 1.0, 0.5)
place(bell(A('A2'), 9, 0.7), lt + 0.05, 0, 0.55, 0.8)
place(bowed(A('D2'), 33 - lt - 1.0, att=2.0, rel=3.5), lt + 0.6, 0, 0.16, 0.5)
place(pad([A('D3'), A('A3'), A('F4')], 33 - lt - 1.0, att=3, rel=4, cutoff=800), lt + 0.6, 0, 0.15, 0.7)
# 城：远处的车声
n = int((33 - 25.5) * SR); t4 = np.arange(n) / SR
city = lp(rng.standard_normal(n), 220, 2) * 0.08 * np.clip(t4 / 3, 0, 1) * np.clip((t4[-1] - t4) / 2, 0, 1)
place(city, 25.5, 0, 1.0, 0.3)
# 最后：琴把「逝者如斯夫」的动机拨一遍（第一版以来的同一个动机）
for name, b, d in [('E4', 0, 1.5), ('D4', 1.5, 0.5), ('C4', 2, 1), ('D4', 3, 1), ('A3', 4, 4)]:
    bend = [(0.05, 0), (0.3, 0), (1.0, -0.35), (1.8, 0)] if d >= 4 else None
    place(qin(A(name), d * BEAT + 3, bend=bend, vib=0.12 if d >= 2 else 0), 26.2 + b * BEAT, -0.05, 0.6, 0.6)
place(bell(A('A3'), 8, 0.6), E['title']['t0'] + 1.2, 0, 0.35, 0.85)

# ───────────────────────────── 混响与母带
def make_ir(sec=5.0, sr=SR):
    n = int(sec * sr); t = np.arange(n) / sr
    irs = []
    for ch in range(2):
        nz = rng.standard_normal(n)
        ir = nz * np.exp(-t * 2.6) * 0.5 + lp(nz, 2200) * np.exp(-t * 1.2)
        ir[: int(0.015 * sr)] *= np.linspace(0, 1, int(0.015 * sr))
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs

print('reverb...')
ir = make_ir()
wet2 = hp(wet, 200, 2)
rev = np.stack([fftconvolve(wet2[0], ir[0])[:N], fftconvolve(wet2[1], ir[1])[:N]])
mix = dry + rev * 1.5
mix = hp(mix, 35)
mix = mix - 0.4 * lp(mix, 120, 2)
mix = mix / np.max(np.abs(mix))
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 10 ** (-1.0 / 20)
end = int(TOTAL * SR)
mix = mix[:, :end]
f = int(1.8 * SR); mix[:, -f:] *= np.linspace(1, 0, f)
import wave
out = os.path.join(ROOT, 'assets', 'score.wav')
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{TOTAL:.1f}s')
