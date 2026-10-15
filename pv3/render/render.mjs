#!/usr/bin/env node
// 逐帧渲染：无头 Chromium 画帧 → PNG → ffmpeg。
//
//   node render/render.mjs --w 1920 --h 1080 --fps 30 --workers 4 --out out/pv.mp4
//   node render/render.mjs --stills 12.5,30,61 --w 960 --h 540      （抽帧检查）
//   node render/render.mjs --from 60 --to 70 --w 640 --h 360 --out out/test.mp4
//
// 渲染是确定性的：每帧只依赖时间 t，所以可以把时间轴切成若干段并行渲染再拼接。

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), [])
);
const W = +(args.w || 1920), H = +(args.h || 1080), FPS = +(args.fps || 30);
const WORKERS = +(args.workers || 4);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const { srv, port } = await serve(ROOT);
const url = `http://127.0.0.1:${port}/index.html?w=${W}&h=${H}&fps=${FPS}`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1920), height: Math.min(H, 1080) } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(url);
  const info = await page.evaluate(() => window.PV.ready);
  return { page, info };
}

async function launch() {
  return chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--force-color-profile=srgb'],
  });
}

async function grab(page, t, frame) {
  const data = await page.evaluate(([t, f]) => { window.PV.renderFrame(t, f); return window.PV.grab(); }, [t, frame]);
  return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
}

if (args.stills) {
  const times = String(args.stills).split(',').map(Number);
  const dir = path.join(ROOT, args.dir || 'out/stills');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const { page } = await openPage(browser);
  for (const t of times) {
    const t0 = Date.now();
    const buf = await grab(page, t, Math.round(t * FPS));
    const f = path.join(dir, `t${t.toFixed(2).padStart(7, '0')}.png`);
    fs.writeFileSync(f, buf);
    console.log(f, Date.now() - t0, 'ms');
  }
  await browser.close();
  srv.close();
  process.exit(0);
}

// ── 视频
const browser0 = await launch();
const { info } = await openPage(browser0);
await browser0.close();
const from = +(args.from || 0), to = Math.min(+(args.to || info.duration), info.duration);
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
const N = f1 - f0;
const out = path.join(ROOT, args.out || 'out/pv.mp4');
const tmp = path.join(ROOT, 'out', 'chunks');
fs.mkdirSync(tmp, { recursive: true });
console.log(`render ${W}x${H}@${FPS} frames ${f0}..${f1} (${N}) workers ${WORKERS}`);

const per = Math.ceil(N / WORKERS);
const crf = args.crf || (W >= 1920 ? 14 : 18);
const started = Date.now();
let done = 0;

async function worker(k) {
  const a = f0 + k * per, b = Math.min(f1, a + per);
  if (a >= b) return null;
  const file = path.join(tmp, `c${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-x264-params', 'aq-mode=2:deblock=1,1', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const browser = await launch();
  const { page } = await openPage(browser);
  for (let f = a; f < b; f++) {
    const buf = await grab(page, f / FPS, f);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 30 === 0) {
      const el = (Date.now() - started) / 1000;
      process.stdout.write(`\r${done}/${N}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((N - done) * el / done / 60).toFixed(1)} min   `);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  return file;
}

const files = (await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)))).filter(Boolean);
console.log(`\nframes done in ${((Date.now() - started) / 60000).toFixed(1)} min`);
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
const audio = args.audio === 'none' ? null : path.join(ROOT, args.audio || 'assets/score.wav');
const ffargs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (audio && fs.existsSync(audio)) {
  ffargs.push('-ss', String(from), '-t', String(to - from), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
}
ffargs.push('-c:v', 'copy', '-movflags', '+faststart', out);
await new Promise((r) => spawn('ffmpeg', ffargs, { stdio: 'inherit' }).on('close', r));
console.log('wrote', out);
srv.close();
