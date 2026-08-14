import { duration, fmt, won } from "../../core/format";
import { remainingLabel, seasonWeekOf, weekUnlockInOf } from "../../core/season";
import type { GameState } from "../../core/types";
import { ACHIEVEMENTS } from "../../game/achievements";
import { TIER_NAMES, UPGRADES, type UpgradeTier, upgradeCost } from "../../game/balance";
import { fameMultiplier, offlineEfficiency } from "../../game/economy";
import { netWorth, upgradeLevel } from "../../game/state";
import { html, raw } from "../dom";

const TIER_HINTS: Record<UpgradeTier, string> = {
	0: "응원석과 화력을 깔아 기반을 만듭니다.",
	1: "응원 속도와 인기 상승을 끌어올리는 본체입니다.",
	2: "마지막 설비. 여기까지 끝내면 남는 건 주식과 경매뿐입니다.",
};

export function renderShop(state: GameState): string {
	const week = seasonWeekOf(state.seasonStartedAt);
	const played = (Date.now() - state.startedAt) / 1000;
	const tiers = ([0, 1, 2] as UpgradeTier[]).map((tier) => tierBlock(state, tier, week)).join("");

	return html`
		<section class="panel">
			<div class="weekbar">
				<b>${week + 1}주차</b>
				<span class="muted">${weekSummary(week)}</span>
			</div>
			${raw(tiers)}

			<h2 class="section-title">도전 과제 ${state.achievements.length} / ${ACHIEVEMENTS.length}</h2>
			<p class="hint">
				과제를 달성하면 <b>명성</b>이 쌓이고, 명성은 이번 시즌 수입을 올려줍니다.
				현재 명성 ${state.fame} · 수입 ×${fameMultiplier(state).toFixed(2)}
			</p>
			<div class="quests">${raw(quests(state))}</div>

			<h2 class="section-title">기록</h2>
			<div class="statrow">
				<div class="stat"><span>총 자산</span><b>${won(netWorth(state))}</b></div>
				<div class="stat"><span>누적 수입</span><b>${won(state.totalEarned)}</b></div>
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

function weekSummary(week: number): string {
	switch (week) {
		case 0:
			return "인프라를 까는 주간입니다.";
		case 1:
			return "핵심 설비가 열렸습니다.";
		case 2:
			return "최종 설비가 열렸습니다.";
		default:
			return "결산 주간 — 더 살 설비가 없습니다. 주식과 경매로 불리세요. (배당 ×1.5)";
	}
}

function tierBlock(state: GameState, tier: UpgradeTier, week: number): string {
	const defs = UPGRADES.filter((u) => u.tier === tier);
	const locked = week < tier;
	const done = defs.filter((d) => upgradeLevel(state, d.id) >= d.maxLevel).length;
	const complete = done === defs.length;

	const head = locked
		? html`<span class="muted">🔒 ${remainingLabel(weekUnlockInOf(state.seasonStartedAt, tier))} 후 해금</span>`
		: html`<span class="${complete ? "up" : "muted"}">${done} / ${defs.length} 완료</span>`;

	const cards = locked
		? ""
		: defs
				.map((def) => {
					const level = upgradeLevel(state, def.id);
					const maxed = level >= def.maxLevel;
					const cost = upgradeCost(def, level);
					const can = !maxed && state.money >= cost;
					return html`
			<article class="upg ${maxed ? "upg--max" : ""}">
				<div class="upg__icon">${def.icon}</div>
				<div class="upg__body">
					<h3>${def.name} <span class="muted">Lv.${level}/${def.maxLevel}</span></h3>
					<p class="muted">${def.desc(level)}</p>
					${raw(maxed ? "" : html`<p class="muted small">다음: ${def.desc(level + 1)}</p>`)}
				</div>
				<button
					class="btn ${can ? "btn--primary" : ""}"
					data-action="upgrade"
					data-id="${def.id}"
					${raw(can ? "" : "disabled")}
				>${maxed ? "MAX" : won(cost)}</button>
			</article>`;
				})
				.join("");

	return html`
		<div class="tierblock ${locked ? "tierblock--locked" : ""}">
			<header class="tierblock__head">
				<h2>${TIER_NAMES[tier]}</h2>
				${raw(head)}
			</header>
			<p class="muted small">${TIER_HINTS[tier]}</p>
			<div class="upgs">${raw(cards)}</div>
		</div>
	`;
}

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
					<span class="muted small">${won(q.money)}</span>
				</div>
			</article>`;
		})
		.join("");
}
