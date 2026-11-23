# GitHub 무료 영상·모션 도구 20종

인스타그램 게시물(aiscene.kr)의 "채우면, 스튜디오가" 목록 기준.
20개 대부분은 Claude 스킬이 아니라 **오픈소스 라이브러리나 앱**이다. 그래서 두 가지로 나눴다.
- **스킬 있음:** Claude에게 그 도구 쓰는 법을 알려주는 스킬을 `.claude/skills/`에 넣었다.
- **스킬 없음:** Claude가 그냥 그 라이브러리로 코드를 짜면 된다. 앱(OBS 등)은 내 컴퓨터에 직접 설치한다.

| # | 도구 | 용도 | 원본 | 설치된 스킬 (출처) |
|---|---|---|---|---|
| 1 | Anime.js | 글자 튀기기 | juliangarnier/anime | `animejs` (BowTiedSwan/animejs-skills) |
| 2 | Motion | 버튼 튕기기 | motiondivision/motion | `motion-framer` (freshtechbro/claudedesignskills) |
| 3 | Manim | 수학 그래프 | ManimCommunity/manim | `manim-composer`, `manimce-best-practices`, `manimgl-best-practices` (adithya-s-k/manim_skill) |
| 4 | Lottie | AE 애니 재생 | airbnb/lottie-web | `lottie-animator` (obeskay), `lottie-animations` (freshtechbro), `motion-design` (lottiefiles 공식) |
| 5 | Remotion | 코드로 영상 | remotion-dev/remotion | `remotion-*` 13개 (이전에 설치) |
| 6 | Skills | 클로드가 짜기 | anthropics/skills | `skill-creator` (이전에 설치) |
| 7 | LosslessCut | 무손실 자르기 | mifi/lossless-cut | 없음 (데스크톱 앱). 대신 `ffmpeg-skill`로 무손실 자르기 가능 |
| 8 | FFmpeg | 형식 바꾸기 | FFmpeg/FFmpeg | `ffmpeg-skill`, `claude-video-transcode` (이전에 설치) |
| 9 | Blender | 말로 3D | blender/blender | `blender` (digitalsamba/claude-code-video-toolkit) |
| 10 | Three.js | 브라우저 3D | mrdoob/three.js | `threejs-*` 13개 (cloudai-x/threejs-skills) |
| 11 | postprocessing | 빛 번짐 | pmndrs/postprocessing | `threejs-postprocessing`이 다룸 |
| 12 | Pathtracer | 사진 같은 조명 | gkjohnson/three-gpu-pathtracer | 없음 (Three.js 스킬로 코드 작성) |
| 13 | Jolt | 부딪히는 물리 | jrouwe/JoltPhysics (웹: JoltPhysics.js) | 없음 |
| 14 | quarks | 불꽃 입자 | Alchemist0823/three.quarks | 없음 |
| 15 | Tweakpane | 슬라이더 조절 | cocopon/tweakpane | 없음 |
| 16 | ComfyUI | 노드로 이미지 | comfyanonymous/ComfyUI | `comfyui` (내 컴퓨터 ComfyUI 제어, HuangYuChuh), `comfy-*` 12개 (Comfy-Org 공식, Comfy Cloud 계정 필요) |
| 17 | CosyVoice | 목소리 만들기 | FunAudioLLM/CosyVoice | 없음 (GPU 필요) |
| 18 | WhisperX | 단어별 시간 | m-bain/whisperX | 없음. `claude-video-caption`, `claude-shorts`가 내부에서 사용 |
| 19 | librosa | 박자 재기 | librosa/librosa | 없음 (`pip install librosa`) |
| 20 | OBS | 화면 녹화 | obsproject/obs-studio | 없음 (데스크톱 앱, obsproject.com) |

## 쓰는 법 예시
- "Anime.js로 제목 글자가 하나씩 튀어 오르는 HTML 만들어줘" → `animejs`
- "Manim으로 사인 그래프가 그려지는 영상 만들어줘" → `manim-composer`
- "Three.js로 빛나는 회전 큐브 + bloom 효과" → `threejs-*`
- "Blender로 로고를 3D로 돌리는 영상" → `blender` (내 컴퓨터에 Blender 설치 필요)
- "ComfyUI로 이 워크플로 돌려줘" → `comfyui` (ComfyUI 서버가 켜져 있어야 함)

## 참고
- 스킬은 사용법 안내서다. 실제 실행에는 원본 도구(Python 패키지, npm, 앱)가 필요하다. Claude가 필요할 때 설치를 시도한다.
- `comfy-*` 스킬은 원래 이름(help, generate-image 등)이 너무 일반적이라 이름 앞에 `comfy-`를 붙였다.
