#!/usr/bin/env python3
"""生成全片的事件表 assets/events.json —— 画面与配乐共用同一份。

单位：秒、米。水面是 y=0 平面，x 向右，z 向下游。
"""
import json, os, random, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = random.Random(1773)

E = {
    "fps": 30,
    "duration": 33.0,
    "bpm": 80,
    "depth": 0.8,                 # 河深
    "domain": 6.0,                # 波动模拟覆盖的水面边长
    "current": 0.06,              # 水流速度（米/秒，沿 +z）
    "cut": {"t0": 9.0, "t1": 9.28, "p0": [-1.5, -0.95], "p1": [1.5, 0.75]},
    "sword": {"drop": 9.55, "pos": [0.32, -0.18], "settle": 11.6, "angle": 0.62},
    "his": {"pos": [0.04, 0.22], "t0": 12.0, "dt": 1.5, "t1": 28.6},
    "her": {"pos": [-0.62, -0.42], "t0": 18.75, "dt": 1.5, "t1": 23.3},
    "letter": {"t": 24.45, "fall": 1.3, "pos": [0.33, -0.19], "angle": -0.35},
    "herLight": [18.3, 19.2, 23.3, 24.3],
    "title": {"t0": 27.4},
    "fadeOut": [31.2, 33.0],
}

# 雨：众生。先疏后密，到斩之前最密；斩下那一刻戛然而止。
rain = []
t = 1.5
rain.append({"t": 1.5, "x": 0.0, "z": 0.12, "a": 1.0})      # 第一滴
t = 2.3
while t < E["cut"]["t0"]:
    u = (t - 2.3) / (E["cut"]["t0"] - 2.3)
    rate = 2.0 + 85 * u ** 2.0          # 每秒滴数
    t += R.expovariate(rate)
    if t >= E["cut"]["t0"]:
        break
    rain.append({"t": round(t, 4), "x": round(R.uniform(-1.6, 1.6), 3), "z": round(R.uniform(-1.4, 1.9), 3), "a": round(R.uniform(0.45, 1.0), 3)})
E["rain"] = rain

# 两处滴水：他从 t0 起每 dt 秒一滴；她错开半拍
E["hisDrops"] = [round(E["his"]["t0"] + k * E["his"]["dt"], 4) for k in range(100) if E["his"]["t0"] + k * E["his"]["dt"] <= E["his"]["t1"]]
E["herDrops"] = [round(E["her"]["t0"] + k * E["her"]["dt"], 4) for k in range(100) if E["her"]["t0"] + k * E["her"]["dt"] <= E["her"]["t1"]]

# 书页：《永乐大典》的火焰中随风飘去——烧着的书页落到河上
pages = []
for i in range(9):
    land = 6.2 + i * 0.31 + R.uniform(-0.1, 0.1)
    pages.append({"land": round(land, 3), "fall": round(R.uniform(2.2, 3.0), 3), "h0": round(R.uniform(0.8, 1.55), 3),
                  "x": round(R.uniform(-0.95, 0.95), 3), "z": round(R.uniform(-0.25, 1.0), 3),
                  "rot": round(R.uniform(0, 6.283), 3), "spin": round(R.uniform(-1.2, 1.2), 3),
                  "size": round(R.uniform(0.07, 0.12), 3), "aspect": round(R.uniform(0.65, 0.95), 3),
                  "seed": round(R.uniform(0, 10), 3), "burn0": round(R.uniform(0.0, 0.14), 3)})
E["pages"] = sorted(pages, key=lambda p: p["land"])

# 花瓣：相遇之后从空中落下，几簇几簇地顺流漂走（落花流水）
petals = []
centers = [(-0.55, -0.85), (0.15, -0.95), (-0.95, -0.35), (0.45, -0.55), (-0.25, -0.45), (-0.70, 0.05)]
for i in range(60):
    cx, cz = centers[i % len(centers)]
    tt = 19.3 + (i % len(centers)) * 0.55 + R.uniform(0, 1.6)
    kind = 5 if R.random() < 0.1 else R.choice([0, 0, 0, 1, 1, 2, 2, 3, 4])
    petals.append({"t": round(tt, 3), "x": round(cx + R.gauss(0, 0.13), 3), "z": round(cz + R.gauss(0, 0.13), 3),
                   "kind": kind, "rot": round(R.uniform(0, 6.283), 3), "spin": round(R.uniform(-0.6, 0.6), 3),
                   "s": round(R.uniform(0.8, 1.3), 3), "fall": round(R.uniform(1.0, 1.6), 3), "h0": round(R.uniform(0.45, 0.85), 3)})
E["petals"] = sorted(petals, key=lambda p: p["t"])

os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
json.dump(E, open(os.path.join(ROOT, "assets", "events.json"), "w"), indent=1)
print(len(rain), "rain drops;", len(E["hisDrops"]), "his;", len(E["herDrops"]), "hers;", len(petals), "petals;", len(pages), "pages")
