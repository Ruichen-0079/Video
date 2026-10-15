#!/bin/bash
# 成片：按段渲染 1920×1080（可只重渲某一段）→ 接第三版的河面结尾 → 混入配乐
# 用法：tools/final.sh [段号 ...]      不给段号 = 全部
set -e
cd "$(dirname "$0")/.."
W=${W:-1920}; H=${H:-1080}; OUT=${OUT:-out/final}; WORKERS=${WORKERS:-4}; CRF=${CRF:-16}
mkdir -p "$OUT"
# 段落边界（秒），与 src/edit.js 的段落一致
B=(0 21.5 35 47.5 63 77 92 104.5 117.5 132 143 160)
segs=("$@"); [ ${#segs[@]} -eq 0 ] && segs=($(seq 0 $((${#B[@]} - 2))))
for k in "${segs[@]}"; do
  f=${B[$k]}; t=${B[$((k + 1))]}
  echo "== seg $k  $f – $t"
  node render/render.mjs --w $W --h $H --workers $WORKERS --crf $CRF --audio none --from $f --to $t --out "$OUT/seg$(printf %02d $k).mp4"
done
# 第三版的结尾（信纸、河面、片名）：25.0–32.5 秒，裁成 2.35:1 宽银幕，与本片同一画框
V3=../pv3/release/wanhua_pv3_1080p.mp4
if [ ! -f "$OUT/river.mp4" ]; then
  ffmpeg -v error -y -ss 25.0 -t 7.5 -i "$V3" -vf "crop=1920:816:0:132,scale=$W:$((W * 816 / 1920)),pad=$W:$H:0:(oh-ih)/2:black,fps=30,format=yuv420p" \
    -an -c:v libx264 -preset slow -crf $CRF -x264-params aq-mode=2:deblock=1,1 "$OUT/river.mp4"
fi
ls "$OUT"/seg*.mp4 | sort | sed "s|.*|file '$PWD/&'|" > "$OUT/list.txt"
echo "file '$PWD/$OUT/river.mp4'" >> "$OUT/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/list.txt" -i assets/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT/pv4.mp4"
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$OUT/pv4.mp4"
