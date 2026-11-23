# Claude Code 플러그인 5종 사용법

`.claude/settings.json`에 등록되어 있어, 이 저장소에서 Claude Code를 열면 자동으로 켜진다.
처음 열 때 "폴더를 신뢰하시겠습니까?" 창에서 신뢰를 눌러야 플러그인이 로드된다.
켜졌는지 확인: `/plugin` 입력 → Installed 탭.

---

## 1. Claude-Mem (`claude-mem@thedotmack`) — 세션 간 기억
- **하는 일:** 작업 내용을 자동으로 기록·압축해 두었다가, 다음 세션 시작 시 관련 맥락을 다시 넣어 준다. "어제 뭐 했더라"를 다시 설명할 필요가 줄어든다.
- **사용법:** 설치만 하면 자동으로 동작한다(hook 기반).
  - 과거 기록 검색: "지난번에 로그인 버그 어떻게 고쳤지?"처럼 물어보거나 `/claude-mem:mem-search` 사용
  - 웹 뷰어: 세션이 돌고 있을 때 `http://localhost:37777`
- **요구사항:** Node.js 18+. Bun·uv·SQLite는 첫 실행 때 자동 설치된다.
- 출처: https://github.com/thedotmack/claude-mem

## 2. FreeLLMAPI — 무료 LLM API 묶음 (플러그인 아님)
- **하는 일:** Google·Groq·Cerebras 등 여러 회사의 무료 API 할당량을 하나의 OpenAI/Anthropic 호환 주소(`http://localhost:3001/v1`)로 합쳐 주는 **별도 서버 프로그램**이다. Claude Code에 설치하는 플러그인이 아니라 내 컴퓨터에서 따로 실행한다.
- **설치(내 컴퓨터, Docker 필요):**
  ```bash
  curl -fsSL https://freellmapi.co/install.sh | bash
  ```
  또는 데스크톱 앱 / 소스 실행(`npm install && npm run dev`).
- **사용법:**
  1. 대시보드에서 각 회사의 무료 API 키를 등록
  2. 대시보드가 주는 통합 키로 OpenAI 호환 도구에 `http://localhost:3001/v1` 연결
  3. Claude Code를 무료 모델로 돌리려면 `npx freellmapi launch`
- **주의:** Claude Code를 무료 모델로 돌리면 Claude 대신 다른 회사 모델이 답한다. 품질과 도구 사용 능력이 떨어질 수 있다.
- 출처: https://github.com/tashfeenahmed/freellmapi

## 3. Claude Code Setup (`claude-code-setup@claude-plugins-official`) — 자동화 추천
- **하는 일:** Anthropic 공식 플러그인. 저장소를 분석해서 이 프로젝트에 맞는 hook, 스킬, MCP 서버, 서브에이전트를 추천해 준다. 파일을 바꾸지 않고 추천만 한다.
- **사용법:** "이 프로젝트에 맞는 Claude Code 자동화 추천해줘"라고 말하면 `claude-automation-recommender` 스킬이 실행된다.

## 4. Elephant-Goldfish Model (`egm@egm`) — 설계 문서 작성·리뷰
- **하는 일:** Google이 공개한 플러그인. 맥락을 다 아는 에이전트("코끼리")가 설계 문서를 쓰고, 대화를 전혀 모르는 새 에이전트("금붕어")들이 그 문서만 보고 리뷰한다. 코드 짜기 전에 설계 구멍을 찾는 용도다.
- **주요 명령:**
  - `/egm:egm-brainstorm` — 아이디어 정리
  - `/egm:egm-draft` — 설계 문서 초안 작성
  - `/egm:egm-review docs/designs/xxx.md` — 기존 문서를 맥락 없는 리뷰어들이 검토
  - `/egm:egm-review-loop` — 리뷰 → 수정 반복
  - `/egm:egm-resolve` — 리뷰 지적사항 반영
  - `/egm:egm-lite` — 가벼운 버전
  - `/egm:egm-drift-report` — 설계와 실제 코드의 차이 보고
  - `/egm:egm-bootstrap` — 폴더별 README 생성
- **주의:** 리뷰어 에이전트를 여러 개 띄우므로 사용량(토큰)을 많이 쓴다.
- 출처: https://github.com/google/elephant-goldfish-model

## 5. 21st.dev MCP (`21st@21st-dev`) — UI 컴포넌트 검색·생성
- **하는 일:** 21st.dev의 React/Tailwind/shadcn UI 컴포넌트를 검색해서 코드를 가져오거나, 설명대로 새 컴포넌트를 만들어 준다.
- **준비 (API 키 필요):**
  1. https://21st.dev/mcp 에서 API 키 발급 (예전 Magic 콘솔 키는 더 이상 작동하지 않음)
  2. 환경변수로 설정: `export API_KEY_21ST=발급받은키`
     - 클라우드 세션에서는 키를 채팅에 붙이지 말고, 환경 설정의 시크릿 기능으로 넣는다.
- **사용법:** "가격표 섹션 컴포넌트 21st에서 찾아줘", "다크모드 로그인 폼 만들어줘"처럼 요청한다.
- 출처: https://github.com/21st-dev/magic-mcp
