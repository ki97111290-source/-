"""Build index.html from index.template.html + narration timings (word-timed captions for scenes 2, 4, 5, 6)."""
import json
from pathlib import Path

HERE = Path(__file__).parent
T = json.loads((HERE.parent.parent / "narration" / "timings.json").read_text())
CAPTION_SCENES = {2, 4, 5, 6}
MAX_CHARS = 11

html, tweens = [], []
for line in T["lines"]:
    if line["scene"] not in CAPTION_SCENES:
        continue
    tokens = line["text"].split()
    words = line["words"]
    assert len(tokens) == len(words), (tokens, [w["text"] for w in words])
    chunks, cur, n = [], [], 0
    for tok, w in zip(tokens, words):
        cur.append((tok.rstrip(",."), w)); n += len(tok)
        if tok.endswith((",", ".")) or n >= MAX_CHARS:
            chunks.append(cur); cur, n = [], 0
    if cur:
        chunks.append(cur)
    for ci, ch in enumerate(chunks):
        start = ch[0][1]["start"]
        end = chunks[ci + 1][0][1]["start"] if ci + 1 < len(chunks) else line["end"] + 0.15
        cid = f"cap-{line['scene']}-{ci}"
        spans = "".join(f'<span id="{cid}-{wi}" class="cw">{t}</span>' for wi, (t, _) in enumerate(ch))
        html.append(f'        <div id="{cid}" class="clip cap" data-start="{start:.3f}" data-duration="{end - start:.3f}" data-track-index="1">{spans}</div>')
        for wi, (_, w) in enumerate(ch):
            tweens.append(f'      tl.fromTo("#{cid}-{wi}", {{ color: "#ffffff" }}, {{ color: "#f4c542", duration: 0.06 }}, {w["start"]:.3f});')

out = (HERE / "index.tpl").read_text()
out = out.replace("<!--CAPTIONS-->", "\n".join(html)).replace("/*CAPTION_TWEENS*/", "\n".join(tweens))
(HERE.parent / "index.html").write_text(out)
print(f"{len(html)} caption chunks")
