import numpy as np
import wave
import struct

SR = 44100
DUR = 61.0  # slightly longer than 60s video, trimmed at mux time
N = int(SR * DUR)
master = np.zeros(N)

def t_range(start, end):
    s = int(start * SR)
    e = int(end * SR)
    return s, e, np.linspace(0, end - start, e - s, endpoint=False)

def adsr(n, sr, attack, release):
    env = np.ones(n)
    a = min(int(attack * sr), n // 2)
    r = min(int(release * sr), n // 2)
    if a > 0:
        env[:a] = np.linspace(0, 1, a)
    if r > 0:
        env[-r:] = np.minimum(env[-r:], np.linspace(1, 0, r))
    return env

def add(start_sec, arr):
    s = int(start_sec * SR)
    e = s + len(arr)
    if e > len(master):
        arr = arr[: len(master) - s]
        e = len(master)
    master[s:e] += arr

# ---------- pad chord bed ----------
# chord progression, 4 chords x ~7.5s = 30s per loop, 2 loops = 60s
chords = [
    [220.00, 261.63, 329.63, 392.00],  # Am7 (A3 C4 E4 G4)
    [174.61, 220.00, 261.63, 329.63],  # Fmaj7
    [130.81, 164.81, 196.00, 246.94],  # Cmaj7
    [196.00, 246.94, 293.66, 392.00],  # G
]
chord_len = 7.5
idx = 0
tcur = 0.0
while tcur < DUR:
    freqs = chords[idx % len(chords)]
    s, e, tt = t_range(tcur, min(tcur + chord_len, DUR))
    n = e - s
    tone = np.zeros(n)
    for k, f in enumerate(freqs):
        amp = 0.05 if k == 0 else 0.035
        tone += amp * np.sin(2 * np.pi * f * tt + k)
        tone += amp * 0.25 * np.sin(2 * np.pi * f * 2 * tt)  # soft harmonic
    env = adsr(n, SR, 1.2, 1.8)
    tremolo = 1.0 + 0.03 * np.sin(2 * np.pi * 0.15 * tt)
    add(tcur, tone * env * tremolo)
    tcur += chord_len
    idx += 1

# ---------- soft kick pulse (subtle, every 2 beats @ ~96bpm) ----------
beat = 60 / 96
kick_times = np.arange(0.6, DUR - 0.5, beat * 2)
for kt in kick_times:
    n = int(0.28 * SR)
    tt = np.linspace(0, 0.28, n, endpoint=False)
    pitch = 95 * np.exp(-tt * 18) + 45
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    click = np.sin(phase) * np.exp(-tt * 14)
    add(kt, click * 0.09)

# ---------- soft shaker/hat texture on off-beats ----------
hat_times = np.arange(beat, DUR - 0.5, beat)
rng = np.random.default_rng(7)
for ht in hat_times:
    n = int(0.05 * SR)
    noise = rng.standard_normal(n)
    env = np.exp(-np.linspace(0, 1, n) * 22)
    add(ht, noise * env * 0.012)

# ---------- scene-synced motifs ----------
def arpeggio(start, freqs, note_len=0.16, amp=0.07, direction=1):
    seq = freqs if direction > 0 else freqs[::-1]
    for i, f in enumerate(seq):
        n = int(note_len * SR)
        tt = np.linspace(0, note_len, n, endpoint=False)
        env = np.exp(-tt * 6.5)
        note = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2 * tt)
        add(start + i * note_len, note * env * amp)

def bell(start, freqs, amp=0.09):
    n = int(1.1 * SR)
    tt = np.linspace(0, 1.1, n, endpoint=False)
    env = np.exp(-tt * 3.2)
    tone = np.zeros(n)
    for f in freqs:
        tone += np.sin(2 * np.pi * f * tt)
    add(start, tone * env * amp / len(freqs))

# Scene boundaries: 0 title,4 supply/demand,12 rise,20 fall,28 match,36 news,44 candles,52 ending,60 end
rise_arp = [392.00, 440.00, 523.25, 659.25]      # bright ascending (G A C5 E5)
fall_arp = [392.00, 349.23, 293.66, 246.94]      # descending, slightly darker
match_bell = [523.25, 659.25]                     # clean two-note "ding"

arpeggio(12.1, rise_arp, note_len=0.18, amp=0.075, direction=1)
arpeggio(20.1, fall_arp, note_len=0.20, amp=0.065, direction=1)
bell(28.15, match_bell, amp=0.10)
arpeggio(44.1, [261.63, 329.63, 392.00, 523.25, 392.00, 329.63], note_len=0.14, amp=0.05, direction=1)

# ---------- overall envelope: fade in / fade out ----------
fade_in = int(1.2 * SR)
fade_out = int(2.5 * SR)
master[:fade_in] *= np.linspace(0, 1, fade_in)
master[-fade_out:] *= np.linspace(1, 0, fade_out)

# ---------- normalize & write ----------
peak = np.max(np.abs(master))
if peak > 0:
    master = master / peak * 0.85

pcm = np.clip(master * 32767, -32768, 32767).astype(np.int16)

with wave.open('/tmp/claude-0/-home-user--/110455e8-5c0b-559e-94c7-a0a0235c3b63/scratchpad/stock-video/bgm.wav', 'w') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())

print("BGM written, duration:", DUR, "s")
