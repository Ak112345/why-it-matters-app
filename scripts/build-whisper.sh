#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHISPER_DIR="$ROOT_DIR/vendor/whisper.cpp"
MODEL_NAME="${1:-base.en}"

if [[ ! -d "$WHISPER_DIR" ]]; then
  echo "whisper.cpp submodule not found at $WHISPER_DIR"
  echo "Run: npm run submodules:init"
  exit 1
fi

cd "$WHISPER_DIR"

make -j"$(nproc)"

if [[ -f "models/download-ggml-model.sh" ]]; then
  bash models/download-ggml-model.sh "$MODEL_NAME"
  MODEL_PATH="$WHISPER_DIR/models/ggml-$MODEL_NAME.bin"
else
  echo "Model download script not found."
  echo "See whisper.cpp docs to fetch a model manually."
  MODEL_PATH="<path-to-model>"
fi

echo "Whisper.cpp build complete."
echo "Set WHISPER_CPP_BIN=$WHISPER_DIR/main"
echo "Set WHISPER_CPP_MODEL=$MODEL_PATH"
