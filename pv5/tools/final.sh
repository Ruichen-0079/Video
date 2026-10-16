#!/bin/bash
# 成片：渲染 1920×1080 正片（160 秒）→ 接第三版的河面结尾（7.5 秒）→ 混入配乐
set -e
cd "$(dirname "$0")/.."
W=${W:-1920}; H=${H:-1080}; OUT=${OUT:-out/final}; WORKERS=${WORKERS:-4}; CRF=${CRF:-15}
mkdir -p "$OUT"
[ -n "$SKIP_MAIN" ] || node render/render.mjs --w $W --h $H --workers $WORKERS --crf $CRF --audio none --out "$OUT/main.mp4"
# 第三版的结尾（信纸、河面、片名）：25.0–32.5 秒，裁成 2.35:1 宽银幕，与本片同一画框
V3=../pv3/release/wanhua_pv3_1080p.mp4
ffmpeg -v error -y -ss 25.0 -t 7.5 -i "$V3" -vf "crop=1920:816:0:132,scale=$W:$((W * 816 / 1920)),pad=$W:$H:0:(oh-ih)/2:black,fps=30,format=yuv420p" \
  -an -c:v libx264 -preset slow -crf $CRF -x264-params aq-mode=2:deblock=1,1 "$OUT/river.mp4"
printf "file '%s'\nfile '%s'\n" "$PWD/$OUT/main.mp4" "$PWD/$OUT/river.mp4" > "$OUT/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/list.txt" -i assets/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT/pv5.mp4"
ffprobe -v error -count_packets -show_entries stream=codec_type,width,height,r_frame_rate,nb_read_packets -show_entries format=duration -of compact "$OUT/pv5.mp4"
