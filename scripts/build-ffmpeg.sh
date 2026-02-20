#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG_DIR="$ROOT_DIR/vendor/ffmpeg"
PREFIX_DIR="$FFMPEG_DIR/build"

if [[ ! -d "$FFMPEG_DIR" ]]; then
  echo "FFmpeg submodule not found at $FFMPEG_DIR"
  echo "Run: npm run submodules:init"
  exit 1
fi

cd "$FFMPEG_DIR"

./configure \
  --prefix="$PREFIX_DIR" \
  --disable-debug \
  --disable-doc \
  --disable-ffplay \
  --enable-gpl

make -j"$(nproc)"
make install

echo "FFmpeg build complete."
echo "Set FFMPEG_BIN=$PREFIX_DIR/bin/ffmpeg"
