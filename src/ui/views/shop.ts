import { coin, duration, fmt } from "../../core/format";
import type { GameState } from "../../core/types";
import { UPGRADES, upgradeCost } from "../../game/balance";
import { offlineEfficiency } from "../../game/economy";
import { netWorth, upgradeLevel } from "../../game/state";
import { html, raw } from "../dom";

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

			<h2 class="section-title">기록</h2>
			<div class="statrow">
				<div class="stat"><span>총 자산</span><b>${coin(netWorth(state))}</b></div>
				<div class="stat"><span>누적 수입</span><b>${coin(state.totalEarned)}</b></div>
				<div class="stat"><span>보유 캐릭터</span><b>${state.owned.length}명</b></div>
				<div class="stat"><span>플레이 시간</span><b>${duration(played)}</b></div>
			</div>
			<p class="hint">
				자리를 비워도 초당 수입의 ${Math.round(offlineEfficiency(state) * 100)}%가 최대 8시간까지 쌓입니다.
				누적 응원 ${fmt(state.totalCheers)}회.
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
