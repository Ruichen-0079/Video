#!/usr/bin/env python3
"""《万花行记》预告片（第四版）配乐与音效。乐器库见 _lib.py（沿用第三版）。

整体不是一种从头到尾的史诗氛围：
- 安静的生活瞬间（草原上的风、海边的浪、雪院里的双人琴）几乎只有环境声和一两件乐器；
- 历史变化的地方（覆灭、复国、清洗、工业与战争）才有鼓、号与弦乐的推进；
- 每个关键动作前后都留出寂静（斩臂、砍伤、重逢）。
"""
import os, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *        # noqa
import _lib

SH = {s['id']: s for s in CUE['shots']}
st = lambda k, dt=0.0: SH[k]['start'] + dt
en = lambda k: SH[k]['end']
A = hz

# ───────────────────────────── 新的声音
def noise(n): return rng.standard_normal(n)
def seg(dur): return int(dur * SR), np.arange(int(dur * SR)) / SR
def fadeio(x, a=0.5, b=0.8):
    n = len(x); e = np.ones(n)
    ia, ib = min(n, int(a * SR)), min(n, int(b * SR))
    e[:ia] = np.linspace(0, 1, ia); e[n - ib:] *= np.linspace(1, 0, ib)
    return x * e

def wind(dur, lo=150, hi=1400, gust=0.6, seed=0):
    n, t = seg(dur)
    x = bp(noise(n), lo, hi)
    m = 0.55 + gust * 0.45 * (np.sin(2 * np.pi * 0.13 * t + seed) * 0.5 + np.sin(2 * np.pi * 0.31 * t + seed * 2) * 0.5)
    return fadeio(x * m * 0.25, 1.0, 1.0)

def insects(dur, f=5200):
    n, t = seg(dur)
    out = np.zeros(n)
    for k in range(6):
        ff = f * (0.85 + 0.3 * rng.random())
        rate = 18 + rng.random() * 14
        gate = (np.sin(2 * np.pi * rate * t + rng.random() * 6) > 0.6) * (np.sin(2 * np.pi * (0.4 + rng.random() * 0.4) * t + rng.random() * 6) > 0)
        out += np.sin(2 * np.pi * ff * t) * lp(gate.astype(float), 300) * 0.02
    return fadeio(out, 0.8, 0.8)

def waves(dur, period=5.0):
    n, t = seg(dur)
    x = noise(n)
    surge = np.clip(np.sin(2 * np.pi * t / period - 1.2), 0, 1) ** 2
    hiss = bp(x, 600, 6000) * surge * 0.22
    body = lp(x, 400) * (0.4 + 0.6 * surge) * 0.25
    return fadeio(hiss + body, 1.0, 1.0)

def rain(dur, amt=1.0):
    n, t = seg(dur)
    x = hp(noise(n), 1500) * 0.08 + bp(noise(n), 300, 1200) * 0.05
    drops = np.zeros(n)
    for k in range(int(dur * 120 * amt)):
        i = rng.integers(0, n - 2000); drops[i:i + 400] += bp(noise(400), 2000, 8000) * np.exp(-np.arange(400) / 60) * 0.15 * rng.random()
    return fadeio((x + drops) * amt, 0.3, 0.6)

def fire(dur, amt=1.0):
    n, t = seg(dur)
    roar = lp(noise(n), 500) * 0.35 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t))
    cr = np.zeros(n)
    for k in range(int(dur * 25 * amt)):
        i = rng.integers(0, n - 800); cr[i:i + 600] += bp(noise(600), 1500, 7000) * np.exp(-np.arange(600) / 40) * rng.random() * 0.6
    return fadeio((roar + cr) * amt, 0.6, 0.8)

def crowd(dur, amt=1.0, roar=False):
    n, t = seg(dur)
    out = np.zeros(n)
    for k in range(10):
        f = 160 + rng.random() * 260
        m = bp(noise(n), f * 0.7, f * 3.0) * (0.5 + 0.5 * np.sin(2 * np.pi * (2 + rng.random() * 3) * t + rng.random() * 6) ** 2)
        out += m
    if roar: out *= 0.6 + 0.6 * np.clip(t / 1.2, 0, 1)
    return fadeio(out * 0.06 * amt, 0.5, 0.8)

def step(gain=0.3, soft=False):
    n, t = seg(0.18)
    return lp(noise(n), 400 if soft else 900) * np.exp(-t * 35) * gain

def clink(gain=0.12):
    n, t = seg(0.5)
    f = 2400 + rng.random() * 1800
    return (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 2.7 * t)) * np.exp(-t * 14) * gain

def horn(f, dur, gain=1.0):
    n, t = seg(dur)
    v = 0.12 * np.sin(2 * np.pi * 4.8 * t) * np.clip(t - 0.4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * 2 ** (v / 12)) / SR
    saw = sum(np.sin(ph * k) / k for k in range(1, 14))
    e = env_adsr(n, 0.35, 0.3, 0.85, 0.6, dur)
    return (lp(saw, 900) * (1 - e) + lp(saw, 2300) * e) * e * 0.18 * gain

def heartbeat(gain=1.0):
    n, t = seg(0.5)
    b = np.sin(2 * np.pi * 52 * t) * np.exp(-t * 18)
    b2 = np.roll(b, int(0.18 * SR)) * 0.7
    return lp(b + b2, 200) * gain

def slash(gain=1.0):
    n, t = seg(0.6)
    sw = bp(noise(n), 1500, 9000) * np.exp(-((t - 0.08) / 0.06) ** 2) * 1.2
    return (sw + shing(0.6)[:n] * 0.5) * gain

def thunder(dur=4.0, gain=1.0):
    n, t = seg(dur)
    x = lp(noise(n), 160) * (np.exp(-t * 0.9) * np.clip(t * 8, 0, 1)) * 2.2
    crack = bp(noise(n), 800, 5000) * np.exp(-t * 12) * 0.8
    return (x + crack) * gain

def musket(gain=1.0):
    n, t = seg(1.6)
    crack = bp(noise(n), 400, 6000) * np.exp(-t * 30) * 1.2
    boom = lp(noise(n), 250) * np.exp(-t * 4) * 1.3
    return (crack + boom) * gain

def cannon(gain=1.0):
    n, t = seg(4.0)
    return (lp(noise(n), 120) * np.exp(-t * 1.1) * 3 + bp(noise(n), 200, 2000) * np.exp(-t * 6)) * gain

def clank(f=180, gain=0.5):
    n, t = seg(1.2)
    out = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 6), (2.4, 0.6, 9), (3.9, 0.4, 12), (5.6, 0.3, 16)])
    return (out + bp(noise(n), 1000, 6000) * np.exp(-t * 50) * 0.5) * gain * 0.3

def whoosh(dur=0.8, gain=0.5):
    n, t = seg(dur)
    e = np.sin(np.pi * t / dur) ** 2
    f = 400 + 3000 * t / dur
    return bp(noise(n), 300, 5000) * e * gain * 0.4

def scratch(dur=2.5):
    n, t = seg(dur)
    strokes = (np.sin(2 * np.pi * 1.8 * t) > 0.2).astype(float)
    return bp(noise(n), 2500, 8000) * lp(strokes, 30) * 0.04

def pluck(f, dur=0.8, gain=1.0): return pipa(f, dur) * gain

def melody(notes, t0, inst, beat=0.5, pan=0.0, gain=1.0, rev=0.5, **kw):
    """notes: [(音名, 起拍, 时值拍)]"""
    for nm, b, d in notes:
        if nm is None: continue
        place(inst(A(nm), d * beat + 1.5, **kw) if inst in (qin, pipa) else inst(A(nm), d * beat + 0.4, **kw), t0 + b * beat, pan, gain, rev)

def bed(sig, t0, gain=1.0, pan=0.0, rev=0.2): place(sig, t0, pan, gain, rev)

# ───────────────────────────── 谱
# 引子 · 万花洲：风吹草浪，虫声；对白时只留风
bed(wind(en('grassB') - st('grassA') + 1, 180, 1500, 0.7), 0, 1.0)
bed(insects(10.5), 0, 0.8)
place(harmonic(A('E5'), 6, 0.6), st('grassA', 0.8), 0.2, 0.25, 0.8)
place(harmonic(A('B4'), 6, 0.5), st('grassA', 3.0), -0.2, 0.2, 0.8)
place(step(0.12, True), st('grassB', 0.2), 0.3, 1, 0.2)
place(qin(A('A3'), 5, bright=0.7), st('grassB', 2.6), 0.0, 0.35, 0.6)      # 「美貌也是有代价的」下面一声低弦
place(qin(A('E4'), 5, bright=0.7), st('grassB', 2.7), 0.1, 0.25, 0.6)

# 一 · 旧世：御道上的仪仗——低音、礼钟、脚步与镣铐
T1 = st('procA'); T1e = en('procC')
place(bowed(A('D2'), T1e - T1 + 1.5, att=2, rel=2), T1, 0, 0.35, 0.4)
place(pad([A('D3'), A('A3')], T1e - T1 + 1, att=2.5, rel=2, cutoff=700), T1, 0, 0.2, 0.6)
bed(wind(T1e - T1 + 1, 120, 900, 0.4), T1, 0.6)
for k in range(int((T1e - T1) / 1.75) + 1):
    place(bell(A('D3'), 5, 0.4), T1 + 0.4 + k * 1.75, -0.1, 0.22, 0.7)
for k in range(int((en('procB') - T1) / 0.58)):
    place(step(0.25), T1 + 0.2 + k * 0.58, 0.2, 1, 0.15)
    if k % 2 == 0: place(clink(0.08), T1 + 0.25 + k * 0.58, 0.25, 1, 0.3)
# 藏起特征：一阵细碎的、向上的泛音
for k, nm in enumerate(['A5', 'D6', 'E6', 'A6']):
    place(harmonic(A(nm), 3, 0.5), st('procC', 1.6 + k * 0.45), 0.3 - k * 0.2, 0.35, 0.85)
# 宫中：夜，空的回廊；一支很慢的琴
Tc = st('corridor')
bed(lp(noise(int(7 * SR)), 300) * 0.04, Tc, 1.0, 0, 0.5)
melody([('D4', 0, 2), ('F4', 2, 1), ('E4', 3, 1), ('D4', 4, 2), ('A3', 6, 3), ('C4', 9, 1.5), ('D4', 10.5, 3)], Tc + 0.3, qin, beat=0.55, pan=-0.1, gain=0.5, rev=0.7)
place(pad([A('D3'), A('F3'), A('A3')], 6.6, att=2, rel=1.5, cutoff=600), Tc, 0, 0.18, 0.7)
# 海边：浪；摸头的那一刻是一段暖的旋律
Ts = st('seaside')
bed(waves(7.6, 5.2), Ts, 1.0)
melody([('E4', 0, 1), ('G4', 1, 1), ('A4', 2, 2), ('C5', 4, 1), ('B4', 5, 1), ('A4', 6, 3)], Ts + 4.0, qin, beat=0.42, pan=0.1, gain=0.5, rev=0.7)
place(pad([A('A2'), A('E3'), A('C4')], 4.0, att=1.2, rel=2, cutoff=900), Ts + 3.8, 0, 0.22, 0.7)
for k in range(5): place(step(0.08, True), Ts + 0.2 + k * 0.62, -0.3, 1, 0.2)

# 二 · 断裂：鼓起，火，号；龙旗倒下时一声大锣
Tg = st('siegeA'); Tge = en('siegeC')
bed(fire(Tge - Tg + 1, 0.6), Tg, 0.7, 0.2)
bed(crowd(en('siegeB') - Tg, 0.7, roar=True), Tg, 0.8, -0.2)
place(bowed(A('A1'), Tge - Tg, att=1, rel=1.5), Tg, 0, 0.5, 0.4)
place(bowed(A('E2'), Tge - Tg, att=2, rel=1.5), Tg + 0.5, 0.1, 0.35, 0.4)
pat = [0, 0.75, 1.5, 1.875, 2.25, 3.0, 3.375, 3.75]
for bar in range(5):
    for k, b in enumerate(pat):
        tt = Tg + 0.6 + bar * 4.0 * 0.6 + b * 0.6
        if tt > st('siegeC', 2.4): break
        place(taiko(1.2, 120, 50, 0.4 + 0.12 * bar), tt, 0, 0.55, 0.35)
for k in range(3): place(slash(0.4), st('siegeB', 0.75 + k * 1.43), 0.1, 0.5, 0.4)
place(horn(A('D3'), 3.0), st('siegeB', 0.3), -0.2, 0.6, 0.6)
place(horn(A('A3'), 2.5), st('siegeB', 2.0), 0.2, 0.5, 0.6)
place(taiko(4, 140, 30, 1.6), st('siegeC', 2.4), 0, 0.9, 0.6)
place(gong(9, 55), st('siegeC', 2.4), 0, 0.6, 0.8)
# 草药：不协和的长音，咳嗽，现形的一声尖响，士兵扑上去
Th = st('herb')
for f in ['B2', 'C3', 'F#3']: place(bowed(A(f), 6.6, att=1.5, rel=1.0), Th, 0, 0.18, 0.5)
bed(crowd(6.5, 0.4), Th, 0.6)
for k in range(5): place(lp(noise(int(0.25 * SR)), 1200) * np.exp(-np.arange(int(0.25 * SR)) / SR * 14) * 0.2, Th + 1.4 + k * 0.5 + rng.random() * 0.2, rng.random() - 0.5, 1, 0.3)
place(harmonic(A('A6'), 2.5, 1.2), Th + 2.4, 0, 0.5, 0.8)
place(harmonic(A('A#6'), 2.5, 1.0), Th + 2.5, 0.1, 0.4, 0.8)
place(taiko(1.5, 160, 60, 0.9), Th + 4.3, 0, 0.6, 0.4)
place(crowd(2.0, 1.0, roar=True), Th + 4.0, 0, 0.8, 0.3)
# 复国：号角与鼓；帐中：钱袋落在桌上
Tb = st('bannerA')
place(horn(A('D3'), 2.2), Tb + 0.2, -0.2, 0.7, 0.6); place(horn(A('A3'), 2.0), Tb + 1.6, 0.2, 0.6, 0.6); place(horn(A('D4'), 2.4), Tb + 2.8, 0, 0.6, 0.6)
for k in range(8): place(taiko(1.0, 110, 48, 0.5), Tb + 0.2 + k * 0.55, 0, 0.5, 0.35)
place(crowd(3.0, 1.0, roar=True), Tb + 1.8, 0, 0.8, 0.4)
bed(wind(4.6, 200, 1200, 0.8), Tb, 0.6)
Tn = st('bannerB')
bed(insects(4.6, 4200), Tn, 0.5)
place(bowed(A('D2'), 4.5, att=1, rel=1), Tn, 0, 0.35, 0.5)
place(clink(0.25), Tn + 1.9, 0.1, 1, 0.4); place(clink(0.18), Tn + 1.98, 0.12, 1, 0.4)
# 出逃：雨，心跳，刀光，雷
Te = st('escapeA')
bed(rain(en('escapeB') - Te + 0.5, 1.0), Te, 0.9)
for k in range(9): place(heartbeat(0.7), Te + k * 0.42, 0, 0.8, 0.2)
place(slash(1.0), Te + 2.55, -0.1, 0.9, 0.4)
place(thunder(4, 1.0), Te + 2.62, 0.2, 0.7, 0.6)
place(thunder(3, 0.5), Te + 0.7, -0.4, 0.5, 0.6)
place(xiao(A('E5'), 2.6, att=0.5), st('escapeB', 0.0), 0, 0.3, 0.8)

# 三 · 武学：同一个动机，换三种音色——箫、琵琶加木鱼、雨中的弦
mot = [('A4', 0, 1), ('C5', 1, 0.5), ('D5', 1.5, 0.5), ('E5', 2, 1.5), ('D5', 3.5, 1)]
melody(mot, st('line0', 0.2), xiao, beat=0.45, pan=-0.1, gain=0.6, rev=0.6)
bed(wind(2.6, 120, 800, 0.4), st('line0'), 0.5)
melody(mot, st('line1', 0.2), pipa, beat=0.45, pan=0.1, gain=0.8, rev=0.4)
for k in range(4): place(tick(0.5), st('line1', 0.25 + k * 0.45), 0, 1, 0.2)
place(rain(2.6, 0.6), st('line2'), 0, 0.7, 0.2)
for nm, b, d in mot: place(bowed(A(nm) / 2, d * 0.45 + 0.6, att=0.1, rel=0.4), st('line2', 0.2 + b * 0.45), 0, 0.5, 0.5)
place(whoosh(0.9, 0.9), st('line2', 1.0), 0, 1, 0.4)
# 周：风，寂静，斩，一声大鼓；特写里只剩低音
Td = st('duelA')
Tc = Td + 3.4                     # 斩
bed(wind(6.5, 200, 1600, 0.6), Td, 0.8)
place(step(0.2), Tc - 1.25, -0.3, 1, 0.2)
for k in range(5): place(step(0.3), Tc - 1.15 + k * 0.24, -0.3 + k * 0.12, 1, 0.2); place(step(0.3), Tc - 1.05 + k * 0.24, 0.3 - k * 0.12, 1, 0.2)
place(slash(1.2), Tc - 0.03, 0, 1.0, 0.5)
place(taiko(4, 150, 30, 1.6), Tc, 0, 0.9, 0.6)
place(gong(7, 62), Tc + 0.05, 0, 0.45, 0.8)
place(bowed(A('D2'), 3.0, att=0.4, rel=1.5), Tc + 0.6, 0, 0.4, 0.6)
place(bell(A('D3'), 6, 0.6), Tc + 1.0, 0, 0.3, 0.8)
# 负伤流派：整齐划一的木击与低鼓
Tsc = st('school')
for k in range(4): place(clank(420, 0.7), Tsc + 0.5 + k * 1.0, 0, 0.6, 0.3); place(taiko(1.0, 90, 45, 0.6), Tsc + 0.5 + k * 1.0, 0, 0.6, 0.3)
place(bowed(A('D2'), 4.0, att=0.6, rel=1.0), Tsc, 0, 0.35, 0.4)
# 清洗：火，低弦的悔恨，钟
Tp = st('purge')
bed(fire(4.6, 0.9), Tp, 0.8)
for nm, b, d in [('D3', 0, 1.2), ('C3', 1.2, 1.0), ('A2', 2.2, 2.4)]: place(bowed(A(nm), d + 0.8, att=0.3, rel=0.8), Tp + 0.2 + b, 0, 0.6, 0.6)
place(bell(A('D2'), 7, 0.4), Tp + 2.4, 0, 0.45, 0.85)
for k in range(6): place(step(0.15, True), Tp + 0.3 + k * 0.62, 0, 1, 0.3)
# 夫妻：雪院里两把琴（三度）；一个人时只剩一把
Tq = st('coupleA')
duo = [('G4', 0, 1), ('A4', 1, 1), ('B4', 2, 1.5), ('D5', 3.5, 0.5), ('B4', 4, 1), ('A4', 5, 2)]
melody(duo, Tq + 0.2, qin, beat=0.5, pan=-0.25, gain=0.5, rev=0.6)
melody([(n.replace('4', '3').replace('5', '4'), b, d) for n, b, d in duo], Tq + 0.25, qin, beat=0.5, pan=0.25, gain=0.42, rev=0.6)
place(pad([A('G2'), A('D3'), A('B3')], 4.0, att=1, rel=1.5, cutoff=800), Tq, 0, 0.18, 0.7)
Tr = st('coupleB')
melody(duo[:5], Tr + 0.2, qin, beat=0.62, pan=0, gain=0.45, rev=0.75)
bed(wind(4.2, 300, 2000, 0.3), Tr, 0.35)
# 剑圣堂：烛，三声钟
Tt = st('tablets')
for k in range(3): place(bell(A('A2'), 6, 0.5), Tt + 0.3 + k * 1.4, -0.3 + k * 0.3, 0.35, 0.85)
place(bowed(A('A1'), 4.6, att=1, rel=1), Tt, 0, 0.3, 0.5)

# 四 · 命运：夏的民歌（箫），岁月的风声；火把
Tx = st('xiaA')
melody([('D5', 0, 1), ('E5', 1, 1), ('G5', 2, 2), ('E5', 4, 1), ('D5', 5, 1), ('B4', 6, 2)], Tx + 0.2, xiao, beat=0.5, pan=0.1, gain=0.45, rev=0.6)
for tt in [1.6, 3.2]: place(whoosh(1.0, 1.0), Tx + tt - 0.5, 0, 1, 0.5)
bed(wind(4.6, 200, 1200, 0.4), Tx, 0.4)
Txb = st('xiaB')
bed(fire(3.1, 0.4), Txb, 0.6); bed(crowd(3.0, 0.6), Txb, 0.7)
for k in range(5): place(step(0.18), Txb + 0.2 + k * 0.6, 0.2, 1, 0.3)
place(bowed(A('B2'), 3.0, att=0.5, rel=1), Txb, 0, 0.35, 0.5)
# 万花洲：风；「听起来像狗的名字」——一个俏皮的拨弦
Tgc = st('grassC')
bed(wind(5.6, 180, 1500, 0.6), Tgc, 0.9); bed(insects(5.6), Tgc, 0.6)
place(harmonic(A('E5'), 4, 0.5), Tgc + 0.3, 0, 0.25, 0.8)
for nm, b in [('E5', 0), ('G5', 0.18), ('A5', 0.36), ('C6', 0.62)]: place(pipa(A(nm), 0.8), Tgc + 4.05 + b, 0.2, 0.45, 0.4)
# 黄泉：极低的持续音，门的嗡鸣；沉睡时慢慢降下去
Tq2 = st('hqA')
place(bowed(A('C1') * 2, 8.2, att=1.2, rel=2), Tq2, 0, 0.5, 0.6)
for r in [1, 1.5, 2.0, 3.0]: place(harmonic(A('C3') * r, 7.5, 0.5), Tq2 + 0.2, 0, 0.12, 0.9)
for k in range(6): place(step(0.12, True), Tq2 + 0.3 + k * 0.6, -0.2, 1, 0.5)
for k, nm in enumerate(['G4', 'E4', 'C4', 'G3']): place(harmonic(A(nm), 3, 0.6), st('hqB', 0.8 + k * 0.7), 0, 0.25, 0.85)
# 她的几百年：越走越快的弦乐与打击乐；工业、书写、断链、枪炮
Tm = st('ming'); Tme = en('war')
bpm = 108; b8 = 60 / bpm / 2
k = 0
while Tm + k * b8 < Tme:
    tt = Tm + k * b8
    nm = ['A2', 'A2', 'E3', 'A2', 'C3', 'A2', 'G3', 'E3'][k % 8]
    place(bowed(A(nm), b8 * 0.9, att=0.01, rel=0.08), tt, 0, 0.45 + 0.2 * (tt - Tm) / (Tme - Tm), 0.2)
    if k % 4 == 0: place(taiko(0.9, 100, 45, 0.5 + 0.4 * (tt - Tm) / (Tme - Tm)), tt, 0, 0.5, 0.3)
    k += 1
place(pad([A('A2'), A('E3'), A('C4')], Tme - Tm, att=2, rel=0.5, cutoff=1200), Tm, 0, 0.2, 0.5)
for j in range(5): place(clank(140 + j * 30, 0.8), Tm + 0.3 + j * 0.62, 0.3 * (j % 2 * 2 - 1), 0.5, 0.3)
place(lp(noise(int(3 * SR)), 3000) * 0.05 * np.linspace(1, 0, int(3 * SR)), Tm + 0.2, 0, 1, 0.3)
for j in range(6): place(clank(900, 0.7), st('chains', 0.3 + j * 0.42), (j - 2.5) * 0.25, 0.6, 0.3); place(clink(0.2), st('chains', 0.75 + j * 0.42), (j - 2.5) * 0.25, 1, 0.3)
for j in range(14): place(musket(0.6), st('war', 0.8 + (j % 5) * 0.12 + rng.random() * 0.2), (j - 7) * 0.08, 0.6, 0.4)
place(cannon(1.0), st('war', 1.9), -0.4, 0.8, 0.5)
# 重逢：一切落下，只剩一个长和弦
Tu = st('reunion')
place(pad([A('F2'), A('C3'), A('A3'), A('E4')], 5.0, att=0.8, rel=2.5, cutoff=1100), Tu + 0.2, 0, 0.35, 0.8)
place(bell(A('A4'), 6, 0.5), Tu + 2.6, 0, 0.3, 0.85)
place(harmonic(A('E5'), 5, 0.6), Tu + 2.65, 0.2, 0.3, 0.85)
bed(wind(4.6, 300, 2000, 0.3), Tu, 0.3)

# 五 · 收束：城市的低鸣，车声；琴把「逝者如斯夫」的动机拨一遍
Tz = st('modernA')
n = int((en('modernB') - Tz + 0.5) * SR); tz = np.arange(n) / SR
bed(lp(noise(n), 220, 2) * 0.08 * np.clip(tz / 2, 0, 1), Tz, 1.0)
for k in range(4):
    nn = int(3 * SR); tt = np.arange(nn) / SR
    car = bp(noise(nn), 300, 3000) * np.exp(-((tt - 1.5) / 0.6) ** 2) * 0.12
    place(car, Tz + 0.5 + k * 2.3, (k % 2) * 1.6 - 0.8, 1, 0.4)
for nm, b, d in [('E4', 0, 1.5), ('D4', 1.5, 0.5), ('C4', 2, 1), ('D4', 3, 1), ('A3', 4, 4)]:
    bend = [(0.05, 0), (0.3, 0), (1.0, -0.35), (1.8, 0)] if d >= 4 else None
    place(qin(A(name := nm), d * 0.75 + 3, bend=bend, vib=0.12 if d >= 2 else 0), Tz + 1.0 + b * 0.75, -0.05, 0.55, 0.6)
place(pad([A('A2'), A('E3')], en('modernB') - Tz, att=2, rel=1.5, cutoff=600), Tz, 0, 0.15, 0.6)
# 字卡：每一行下面一个很轻的音
Tk = st('card')
for nm, dt in [('A2', 0.4), ('C3', 2.2), ('E3', 4.0)]:
    place(qin(A(nm), 5, bright=0.6), Tk + dt, 0, 0.45, 0.75)
place(harmonic(A('A4'), 6, 0.5), Tk + 4.1, 0, 0.2, 0.85)

# 河：接第三版的声音（25.0–32.5 秒）
v3 = os.path.join(ROOT, '..', 'pv3', 'assets', 'score.wav')
if os.path.exists(v3):
    with wave.open(v3) as w:
        sr3 = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2).T / 32768.0
    seg3 = a[:, int(25.0 * sr3): int((25.0 + RIVER) * sr3)]
    if sr3 != SR:
        idx = np.linspace(0, seg3.shape[1] - 1, int(seg3.shape[1] * SR / sr3))
        seg3 = np.stack([np.interp(idx, np.arange(seg3.shape[1]), seg3[c]) for c in range(2)])
    seg3 = seg3 * np.clip(np.arange(seg3.shape[1]) / (0.6 * SR), 0, 1)
    i0 = int(CUE['duration'] * SR)
    m = min(seg3.shape[1], N - i0)
    dry[:, i0:i0 + m] += seg3[:, :m] * 0.9
else:
    print('warning: v3 score not found; run pv3/audio/score.py')

# ───────────────────────────── 混响与母带
def make_ir(sec=4.5):
    n = int(sec * SR); t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        nz = rng.standard_normal(n)
        ir = nz * np.exp(-t * 2.8) * 0.5 + lp(nz, 2200) * np.exp(-t * 1.3)
        ir[: int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs

print('reverb...')
ir = make_ir()
wet2 = hp(wet, 200, 2)
rev = np.stack([fftconvolve(wet2[0], ir[0])[:N], fftconvolve(wet2[1], ir[1])[:N]])
mix = dry + rev * 1.4
mix = hp(mix, 32)
mix = mix / np.max(np.abs(mix))
# 抬高整体响度：先 +4.5 dB，再用前视峰值限制器压住瞬态（安静段仍保持安静）
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
mix *= 10 ** (4.5 / 20)
pk = maximum_filter1d(np.max(np.abs(mix), axis=0), int(0.004 * SR))
g = np.minimum(1.0, 0.82 / np.maximum(pk, 1e-6))
W = int(0.02 * SR)
gs = uniform_filter1d(minimum_filter1d(g, 2 * W + 1), W)
mix *= gs
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 10 ** (-1.0 / 20)
end = int(TOTAL * SR)
mix = mix[:, :end]
f = int(1.5 * SR); mix[:, -f:] *= np.linspace(1, 0, f)
out = os.path.join(ROOT, 'assets', 'score.wav')
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{TOTAL:.1f}s')
