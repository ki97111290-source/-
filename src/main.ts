import { duration, won } from "./core/format";
import { seasonLabel } from "./core/season";
import { applyOffline } from "./game/economy";
import { Engine } from "./game/engine";
import { loadGame } from "./game/save";
import { rolloverIfNeeded, tierOf } from "./game/season";
import { createNewGame, pushLog } from "./game/state";
import "./styles.css";
import { mountApp } from "./ui/app";
import { initTheme } from "./ui/theme";
import { ui } from "./ui/uiState";

// 화면이 그려지기 전에 테마를 정해야 깜빡임이 없다
initTheme();

const root = document.getElementById("app");
if (!root) throw new Error("#app 을 찾지 못했습니다");

const { state, fresh } = loadGame();

if (!fresh) {
	// 오프라인 수입을 먼저 정산해야 그 응원까지 지난 시즌 성적에 들어간다.
	const report = applyOffline(state);
	if (report && report.money >= 1) {
		pushLog(
			state,
			`자리를 비운 ${duration(report.seconds)} 동안 ${won(report.money)}이 쌓였어요.${
				report.capped ? " (최대 8시간까지 인정)" : ""
			}`,
			"good",
		);
	}
}

const engine = new Engine(state);
// 닫아둔 사이에 시즌이 넘어갔다면 켜자마자 정산한다.
const seasonReport = rolloverOnLoad(engine);

mountApp(root, engine);
if (seasonReport) ui.seasonReport = seasonReport;

function rolloverOnLoad(engineRef: Engine) {
	const before = engineRef.state.seasonId;
	const result = rolloverIfNeeded(engineRef.state, createNewGame);
	if (result) {
		const tier = result.trophy ? tierOf(result.trophy.tier) : null;
		pushLog(
			engineRef.state,
			tier
				? `${seasonLabel(before)} 종료 — ${tier.icon} ${tier.name} 트로피를 받았습니다.`
				: `${seasonLabel(before)} 종료 — 트로피 기준에 닿지 못했어요.`,
			tier ? "good" : "info",
		);
	}
	return result;
}
