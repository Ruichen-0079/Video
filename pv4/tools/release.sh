#!/bin/bash
# 交付：把 out/final/pv4.mp4 压到 100 MB 以内（两遍编码），另出 540p 预览、海报帧和分镜总览
set -e
cd "$(dirname "$0")/.."
SRC=${1:-out/final/pv4.mp4}
mkdir -p release out/rel
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
# 目标约 92 MB：音频 256 kb/s，其余给视频
VB=$(python3 -c "print(int((92e6 * 8 / $DUR - 256e3) / 1000))")
echo "duration $DUR s, video ${VB} kb/s"
ffmpeg -v error -y -i "$SRC" -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile out/rel/x264 -x264-params aq-mode=2 -an -f mp4 /dev/null
ffmpeg -v error -y -i "$SRC" -c:v libx264 -preset slow -b:v ${VB}k -pass 2 -passlogfile out/rel/x264 -x264-params aq-mode=2 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -movflags +faststart release/wanhua_pv4_1080p.mp4
ffmpeg -v error -y -i "$SRC" -vf scale=960:540:flags=lanczos -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart release/wanhua_pv4_preview_540p.mp4
# 海报帧：周朝麦田里两人对峙的那一刻
ffmpeg -v error -y -ss ${POSTER_T:-78.6} -i "$SRC" -frames:v 1 -q:v 2 release/poster.jpg
python3 tools/board.py "$SRC" release/storyboard.jpg 4
ls -la release/
