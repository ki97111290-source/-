import { coin, duration } from "./core/format";
import { applyOffline } from "./game/economy";
import { Engine } from "./game/engine";
import { loadGame } from "./game/save";
import { pushLog } from "./game/state";
import "./styles.css";
import { mountApp } from "./ui/app";

const root = document.getElementById("app");
if (!root) throw new Error("#app 을 찾지 못했습니다");

const { state, fresh } = loadGame();

if (!fresh) {
	const report = applyOffline(state);
	if (report && report.coins >= 1) {
		pushLog(
			state,
			`자리를 비운 ${duration(report.seconds)} 동안 ${coin(report.coins)}가 쌓였어요.${
				report.capped ? " (최대 8시간까지 인정)" : ""
			}`,
			"good",
		);
	}
}

mountApp(root, new Engine(state));
