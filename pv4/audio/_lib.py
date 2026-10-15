#!/usr/bin/env python3
"""《万花行记》预告片（第四版）配乐与音效 —— numpy 逐样本合成，不用任何采样。

镜头的起止与字幕时间全部来自 assets/cues.json（由 tools/cues.mjs 从剪辑表导出），
每一个声音都对在画面上的一个动作。结尾接第三版的河与它原来的声音。
"""
import json, os, math
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUE = json.load(open(os.path.join(ROOT, 'assets', 'cues.json')))
SR = 48000
BEAT = 60 / 72
BAR = BEAT * 4
RIVER = CUE['river']
TOTAL = CUE['duration'] + RIVER
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
