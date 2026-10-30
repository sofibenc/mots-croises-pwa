#!/usr/bin/env bash
# Régénère icons/*.png depuis tools/icon.html (nécessite Chrome et ImageMagick, et Internet pour la police).
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

render() { # variante, sortie
  google-chrome --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size=1024,1024 --virtual-time-budget=8000 \
    --user-data-dir="$tmp/profile" --screenshot="$2" "file://$PWD/tools/icon.html?v=$1" 2>/dev/null
}
render any "$tmp/any.png"
render maskable "$tmp/maskable.png"
render apple "$tmp/apple.png"

shrink() { magick "$1" -filter Lanczos -resize "$2x$2" -define png:compression-level=9 "$3"; }
shrink "$tmp/any.png" 192 icons/icon-192.png
shrink "$tmp/any.png" 512 icons/icon-512.png
shrink "$tmp/maskable.png" 192 icons/icon-maskable-192.png
shrink "$tmp/maskable.png" 512 icons/icon-maskable-512.png
# iOS refuse la transparence et arrondit lui-même
magick "$tmp/apple.png" -background "#0a7fb4" -alpha remove -alpha off -filter Lanczos -resize 180x180 icons/apple-touch-icon.png
