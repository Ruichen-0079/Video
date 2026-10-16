#!/bin/bash
# 用法：tools/stills.sh 镜头名 输出目录 "名|参数JSON|时间" ...
cd "$(dirname "$0")/.."
shot=$1; dir=$2; shift 2
mkdir -p "$dir"; rm -f "$dir"/*.png
enc() { python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
for spec in "$@"; do IFS='|' read n a tt <<< "$spec"; timeout 900 node render/render.mjs --stills $tt --w ${W:-960} --h ${H:-540} --dir "$dir/tmp" --q "only=$shot&a=$(enc "$a")" 2>&1 | grep -iE "error|exception" | head -5; mv "$dir"/tmp/t*.png "$dir/$n.png" 2>/dev/null; done
rmdir "$dir/tmp" 2>/dev/null
python3 tools/sheet.py "$dir" "$dir.png" ${COLS:-3}
