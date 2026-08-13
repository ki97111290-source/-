import { coin, duration, fmt } from "../../core/format";
import type { GameState } from "../../core/types";
import { ACHIEVEMENTS } from "../../game/achievements";
import { UPGRADES, upgradeCost } from "../../game/balance";
import { fameMultiplier, offlineEfficiency } from "../../game/economy";
import { netWorth, upgradeLevel } from "../../game/state";
import { html, raw } from "../dom";

/** 미달성 과제를 진행률 높은 순으로 먼저 보여준다. 달성한 건 아래로 내린다. */
function quests(state: GameState): string {
	const sorted = [...ACHIEVEMENTS].sort((a, b) => {
		const doneA = state.achievements.includes(a.id) ? 1 : 0;
		const doneB = state.achievements.includes(b.id) ? 1 : 0;
		if (doneA !== doneB) return doneA - doneB;
		return b.progress(state) - a.progress(state);
	});

	return sorted
		.map((q) => {
			const done = state.achievements.includes(q.id);
			const p = done ? 1 : q.progress(state);
			return html`
			<article class="quest ${done ? "quest--done" : ""}">
				<div class="quest__icon">${q.icon}</div>
				<div class="quest__body">
					<h3>${q.name} <span class="muted small">${q.desc}</span></h3>
					<div class="quest__bar"><i style="width:${(p * 100).toFixed(0)}%"></i></div>
				</div>
				<div class="quest__reward">
					<b>명성 +${q.fame}</b>
					<span class="muted small">${coin(q.coins)}</span>
				</div>
			</article>`;
		})
		.join("");
}

export function renderShop(state: GameState): string {
	const cards = UPGRADES.map((def) => {
		const level = upgradeLevel(state, def.id);
		const maxed = level >= def.maxLevel;
		const cost = upgradeCost(def, level);
		const can = !maxed && state.coins >= cost;
		return html`
			<article class="upg ${maxed ? "upg--max" : ""}">
				<div class="upg__icon">${def.icon}</div>
				<div class="upg__body">
					<h3>${def.name} <span class="muted">Lv.${level}</span></h3>
					<p class="muted">${def.desc(level)}</p>
					${raw(maxed ? "" : html`<p class="muted small">다음: ${def.desc(level + 1)}</p>`)}
				</div>
				<button
					class="btn ${can ? "btn--primary" : ""}"
					data-action="upgrade"
					data-id="${def.id}"
					${raw(can ? "" : "disabled")}
				>${maxed ? "MAX" : coin(cost)}</button>
			</article>`;
	}).join("");

	const played = (Date.now() - state.startedAt) / 1000;

	return html`
		<section class="panel">
			<h2 class="section-title">업그레이드</h2>
			<div class="upgs">${raw(cards)}</div>

			<h2 class="section-title">도전 과제 ${state.achievements.length} / ${ACHIEVEMENTS.length}</h2>
			<p class="hint">
				과제를 달성하면 <b>명성</b>이 쌓이고, 명성은 전체 수입을 영구히 올려줍니다.
				현재 명성 ${state.fame} · 수입 ×${fameMultiplier(state).toFixed(2)}
			</p>
			<div class="quests">${raw(quests(state))}</div>

			<h2 class="section-title">기록</h2>
			<div class="statrow">
				<div class="stat"><span>총 자산</span><b>${coin(netWorth(state))}</b></div>
				<div class="stat"><span>누적 수입</span><b>${coin(state.totalEarned)}</b></div>
				<div class="stat"><span>누적 응원</span><b>${fmt(state.totalCheers)}회</b></div>
				<div class="stat"><span>플레이 시간</span><b>${duration(played)}</b></div>
			</div>
			<p class="hint">
				페이지를 켜두면 수입 100%가 그대로 들어옵니다. 브라우저 탭이 뒤로 밀려도 마찬가지예요.
				완전히 닫아둔 동안에는 ${Math.round(offlineEfficiency(state) * 100)}%가 최대 8시간까지 쌓입니다.
			</p>

			<h2 class="section-title">데이터</h2>
			<div class="btnrow">
				<button class="btn btn--ghost btn--sm" data-action="export">세이브 내보내기</button>
				<button class="btn btn--ghost btn--sm" data-action="import">세이브 불러오기</button>
				<button class="btn btn--ghost btn--sm danger" data-action="reset">처음부터 다시</button>
			</div>
			<p class="muted small">진행 상황은 이 브라우저에만 저장됩니다. 기기를 옮길 땐 세이브를 내보내세요.</p>
		</section>
	`;
}
