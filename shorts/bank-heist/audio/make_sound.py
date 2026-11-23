"""Synthesize bed + SFX with numpy and mix with narration -> video/assets/audio/mix.wav (48 kHz stereo, -14 LUFS).
All sounds are generated here (no third-party audio)."""
import subprocess, wave
from pathlib import Path
import numpy as np

SR = 48000
TOTAL = 39.5
REVEAL = 35.78
HERE = Path(__file__).parent
ROOT = HERE.parent
OUT = ROOT / "video" / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(425)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=0.3):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)
    return e


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def lowpass(x, alpha):
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)):  # small signals only
        acc += alpha * (x[k] - acc); y[k] = acc
    return y


bed = np.zeros(int(TOTAL * SR)); sfx = np.zeros_like(bed)

# tense documentary drone until the reveal (slow swell, cut dead at reveal)
t = t_axis(REVEAL)
drone = (0.5 * np.sin(2 * np.pi * 55 * t) + 0.3 * np.sin(2 * np.pi * 82.5 * t + 0.3) + 0.15 * np.sin(2 * np.pi * 110.4 * t))
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.22 * t)
pulse = (np.sin(2 * np.pi * 1.1 * t) > 0.92).astype(float)  # heartbeat-ish pulse
pulse_sig = np.convolve(pulse, np.sin(2 * np.pi * 48 * t_axis(0.12)) * env(int(0.12 * SR), 0.002, 0.04), mode="same")
swell = np.clip(t / REVEAL, 0, 1) ** 1.5
bed[: len(t)] += (drone * (0.35 + 0.4 * swell) + pulse_sig * 0.6 * swell)
fade = np.ones(len(t)); fade[: int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR))
bed[: len(t)] *= fade

# siren 0–2.0 s (two-tone sweep, phase-integrated)
ts = t_axis(2.0)
f0, dev, rate = 760, 260, 1.6
phase = 2 * np.pi * (f0 * ts - dev / (2 * np.pi * rate) * np.cos(2 * np.pi * rate * ts))
siren = np.sign(np.sin(phase)) * 0.25 + np.sin(phase) * 0.5
siren *= np.linspace(1, 0.3, len(ts))
place(sfx, siren, 0.0, 0.18)

def thud(big=False):
    d = 0.6 if big else 0.4
    tt = t_axis(d)
    f = 70 * np.exp(-tt * 6) + 40
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.001, 0.18 if big else 0.12)
    click = rng.standard_normal(len(tt)) * env(len(tt), 0.0005, 0.012)
    return body + click * 0.5

def whoosh(d=0.35):
    n = rng.standard_normal(int(d * SR))
    shape = np.sin(np.linspace(0, np.pi, len(n))) ** 2
    return lowpass(n, 0.08) * shape * 3

def blip(freq=1500, d=0.09):
    tt = t_axis(d)
    return np.sin(2 * np.pi * freq * tt) * env(len(tt), 0.001, 0.03)

def coin():
    tt = t_axis(0.5)
    return (np.sin(2 * np.pi * 1975 * tt) + 0.6 * np.sin(2 * np.pi * 2960 * tt)) * env(len(tt), 0.001, 0.12) * 0.5

def chime():
    tt = t_axis(1.6)
    notes = [(1046.5, 0), (1318.5, 0.12), (1568, 0.24)]
    out = np.zeros(len(tt))
    for f, d in notes:
        i = int(d * SR)
        seg = tt[: len(tt) - i]
        out[i:] += (np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(4 * np.pi * f * seg)) * env(len(seg), 0.002, 0.45)
    return out * 0.35

# hits on visible actions
for at in (2.6, 4.75, 5.8):           # cliché rows slide in
    place(sfx, whoosh(0.3), at - 0.1, 0.25)
place(sfx, whoosh(0.2), 7.0, 0.35); place(sfx, whoosh(0.2), 7.22, 0.35)   # X strokes
place(sfx, thud(), 7.7, 0.9)                                            # 하수의 방법 stamp
place(sfx, whoosh(0.5), 9.3, 0.2)
for at in (11.7, 12.95, 15.1):
    place(sfx, blip(900, 0.08), at, 0.35)
place(sfx, whoosh(0.3), 20.7, 0.25)                                    # contract in
for k, at in enumerate((24.2, 24.7, 25.2)):
    place(sfx, coin(), at, 0.45)                                       # coins land
for at in (28.6, 29.25, 29.9):
    place(sfx, blip(1700, 0.1), at, 0.4)                               # ticks
place(sfx, thud(), 30.65, 0.9)                                         # 완벽한 범죄 stamp
place(sfx, thud(True), REVEAL + 0.2, 1.1)                              # 월급 slam
place(sfx, chime(), REVEAL + 0.25, 1.0)                                # bright office chime


def read_mono(p):
    with wave.open(str(p)) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
        assert w.getframerate() == SR
    return a


voice = np.zeros_like(bed)
vp = HERE / "voice_proc.wav"   # compress + level the narration before mixing
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(ROOT / "narration" / "narration.wav"), "-af",
                "acompressor=threshold=-22dB:ratio=3:attack=8:release=150:makeup=2,loudnorm=I=-15:TP=-2:LRA=7",
                "-ar", str(SR), "-ac", "1", str(vp)], check=True)
v = read_mono(vp); vp.unlink()
voice[: min(len(v), len(voice))] = v[: len(voice)]

sfx = np.tanh(sfx * 1.5) / 1.5          # soft-clip transient peaks
mix = (voice * 1.0 + bed * 0.12 + sfx * 0.35) * 0.55
mix = np.clip(mix, -0.99, 0.99)
stereo = np.stack([mix, mix], axis=1)
raw = OUT / "mix_raw.wav"
with wave.open(str(raw), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", "alimiter=limit=0.84:level=false",
                "-ar", str(SR), str(OUT / "mix.wav")], check=True)
raw.unlink()
print("wrote", OUT / "mix.wav")
