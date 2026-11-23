# 은행 터는 법 쇼츠 Implementation Plan

> **For agentic workers:** executed natively (superpowers:executing-plans).

**Goal:** 30초 안팎 세로 개그 쇼츠 MP4 한 편.
**Architecture:** edge-tts로 문장별 음성+단어 타이밍 → HyperFrames HTML 컴포지션(장면 7개, 음성 타이밍에 맞춤) → MP4 렌더 → ffmpeg로 내레이션·합성 배경음·효과음 믹스.
**Tech Stack:** Python edge-tts, ffmpeg, HyperFrames CLI(Chromium), Noto Sans KR.
**Spec:** docs/superpowers/specs/2026-11-23-bank-heist-shorts-design.md

## Global Constraints
- 1080×1920, 30fps, 약 30초 (음성 길이 기준)
- 음성: ko-KR-InJoonNeural, rate -10%, pitch -5Hz
- 반전 단어 "월급"은 마지막 장면 전까지 화면·자막에 나오지 않음
- 컬러 이모지 금지(SVG 도형), 폰트 Noto Sans KR

## Review Focus
- 자막이 음성보다 앞서거나 늦음 → 문장 경계 타이밍으로 장면 배치, 렌더 후 프레임 확인
- 한국어 글자 깨짐(두부) → 폰트 로컬 번들, 스틸 프레임 확인
- 오디오 클리핑/음량 불균형 → loudnorm -14 LUFS
- 반전 장면 너무 짧음 → 마지막 장면 최소 3초 + 여운 1초

---

### Task 1: 내레이션 생성
**Files:** `shorts/bank-heist/narration/lines.json`, `shorts/bank-heist/narration/make_voice.py` → `narration.mp3`, `timings.json`
- [ ] 대본을 장면 7개 문장으로 나눠 lines.json 작성
- [ ] 문장별 edge-tts 합성, 사이 0.25초 무음, 최종 길이·문장 시작/끝 시각을 timings.json으로
- [ ] 확인: `ffprobe narration.mp3` 길이 25~35초

### Task 2: 컴포지션 + 렌더
**Files:** `shorts/bank-heist/video/` (HyperFrames 프로젝트), `index.html`
- [ ] HyperFrames 설치·스캐폴드, timings.json 기반 장면 7개 구현
- [ ] 스틸 프레임 몇 장 뽑아 글자·레이아웃 확인 후 MP4 렌더

### Task 3: 사운드 믹스 + 최종본
**Files:** `shorts/bank-heist/audio/make_sfx.sh`, 결과 `shorts/bank-heist/out/bank-heist.mp4`
- [ ] ffmpeg로 저음 드론·도장·사이렌 합성, 내레이션과 믹스, -14 LUFS
- [ ] 영상과 합쳐 최종본, 프레임·길이 확인 후 커밋
