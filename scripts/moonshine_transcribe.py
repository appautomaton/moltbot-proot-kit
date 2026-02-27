#!/usr/bin/env python3
"""Transcribe one audio file with Moonshine Small Streaming and print text to stdout."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_MODEL_PATH = (
    "/home/dev/ai/moonshine-asr/models/download.moonshine.ai/model/"
    "small-streaming-en/quantized"
)
DEFAULT_MODEL_ARCH = 4


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Moonshine file transcriber for OpenClaw media CLI.")
    parser.add_argument("--audio", required=True, help="Input audio file path.")
    parser.add_argument(
        "--model-path",
        default=DEFAULT_MODEL_PATH,
        help="Moonshine model directory path.",
    )
    parser.add_argument(
        "--model-arch",
        type=int,
        default=DEFAULT_MODEL_ARCH,
        help="Moonshine model architecture id (4 = SMALL_STREAMING).",
    )
    parser.add_argument(
        "--ffmpeg",
        default="/usr/bin/ffmpeg",
        help="ffmpeg executable path.",
    )
    return parser.parse_args()


def convert_to_wav(input_path: Path, ffmpeg_path: str) -> Path:
    tmp_dir = Path(tempfile.mkdtemp(prefix="moonshine-openclaw-"))
    wav_path = tmp_dir / "input.wav"
    cmd = [
        ffmpeg_path,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        str(wav_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    return wav_path


def transcribe_audio(audio_path: Path, model_path: Path, model_arch: int) -> str:
    from moonshine_voice.moonshine_api import ModelArch
    from moonshine_voice.transcriber import Transcriber
    from moonshine_voice.utils import load_wav_file

    audio_data, sample_rate = load_wav_file(audio_path)
    with Transcriber(model_path=str(model_path), model_arch=ModelArch(model_arch)) as transcriber:
        transcript = transcriber.transcribe_without_streaming(audio_data, sample_rate)
    lines = [line.text.strip() for line in transcript.lines if line.text and line.text.strip()]
    return "\n".join(lines).strip()


def main() -> int:
    args = parse_args()

    input_path = Path(args.audio).expanduser()
    model_path = Path(args.model_path).expanduser()

    if not input_path.is_file():
        print(f"Input audio not found: {input_path}", file=sys.stderr)
        return 2
    if not model_path.is_dir():
        print(f"Model path not found: {model_path}", file=sys.stderr)
        return 2
    if not Path(args.ffmpeg).exists():
        print(f"ffmpeg not found: {args.ffmpeg}", file=sys.stderr)
        return 2

    wav_path: Path | None = None
    try:
        wav_path = convert_to_wav(input_path, args.ffmpeg)
        text = transcribe_audio(wav_path, model_path, args.model_arch)
        if text:
            print(text)
        return 0
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if isinstance(exc.stderr, str) else ""
        if stderr:
            print(stderr, file=sys.stderr)
        return 1
    except Exception as exc:  # pragma: no cover - defensive path for CLI operation
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        if wav_path is not None:
            try:
                os.remove(wav_path)
                os.rmdir(wav_path.parent)
            except OSError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
