"""Generate narration.mp3 + timings.json from lines.json with edge-tts (InJoon, documentary tone)."""
import asyncio, json, os, subprocess, sys
from pathlib import Path
import edge_tts

HERE = Path(__file__).parent
VOICE, RATE, PITCH = "ko-KR-HyunsuMultilingualNeural", "+5%", "+0Hz"
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")


async def synth(text: str, out: Path) -> list[dict]:
    words = []
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, proxy=PROXY, boundary="WordBoundary")
    with open(out, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"text": chunk["text"], "start": chunk["offset"] / 1e7,
                              "end": (chunk["offset"] + chunk["duration"]) / 1e7})
    return words


def duration(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(p)]).decode().strip())


async def main():
    lines = json.loads((HERE / "lines.json").read_text())
    tmp = HERE / "parts"; tmp.mkdir(exist_ok=True)
    t, timings, concat = 0.0, [], []
    for i, line in enumerate(lines):
        mp3, wav = tmp / f"{i}.mp3", tmp / f"{i}.wav"
        words = await synth(line["text"], mp3)
        a = max(0.0, words[0]["start"] - 0.04)          # trim TTS padding to the spoken words
        b = words[-1]["end"] + 0.12
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
                        "-ar", "48000", "-ac", "1", str(wav)], check=True)
        d = duration(wav)
        timings.append({"scene": line["scene"], "text": line["text"], "start": round(t, 3), "end": round(t + d, 3),
                        "words": [{**w, "start": round(t + w["start"] - a, 3), "end": round(t + w["end"] - a, 3)} for w in words]})
        concat.append(wav)
        gap = line.get("pause", 0.25)
        sil = tmp / f"{i}_sil.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
                        "-t", str(gap), str(sil)], check=True)
        concat.append(sil)
        t += d + gap
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in concat))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c:a", "pcm_s16le", str(HERE / "narration.wav")], check=True)
    (HERE / "timings.json").write_text(json.dumps({"total": round(t, 3), "lines": timings}, ensure_ascii=False, indent=1))
    print(f"total {t:.2f}s, {len(timings)} lines")


if __name__ == "__main__":
    asyncio.run(main())
