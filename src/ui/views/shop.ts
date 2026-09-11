import { won } from "../../core/format";
import { remainingLabel, seasonWeekOf, weekUnlockInOf } from "../../core/season";
import type { GameState } from "../../core/types";
import { ACHIEVEMENTS } from "../../game/achievements";
import { TIER_NAMES, UPGRADES, type UpgradeTier, upgradeCost } from "../../game/balance";
import { ownedCharacters } from "../../game/characters";
import { fameMultiplier } from "../../game/economy";
import { upgradeLevel } from "../../game/state";
import { html, raw } from "../dom";
import { hint } from "../parts";

const TIER_HINTS: Record<UpgradeTier, string> = {
	0: "응원석과 화력을 깔아 기반을 만듭니다.",
	1: "응원 속도와 인기 상승을 끌어올리는 본체입니다.",
	2: "마지막 설비. 여기까지 끝내면 남는 건 주식과 경매뿐입니다.",
};

export function renderShop(state: GameState): string {
	const week = seasonWeekOf(state.seasonStartedAt);
	const tiers = ([0, 1, 2] as UpgradeTier[]).map((tier) => tierBlock(state, tier, week)).join("");

	return html`
		<section class="panel">
			<div class="weekbar">
				<b>${week + 1}주차</b>
				<span class="muted">${weekSummary(week)}</span>
			</div>
			${raw(tiers)}

			<h2 class="section-title">
				도전 과제 ${state.achievements.length} / ${ACHIEVEMENTS.length}
				<span class="muted">· 명성 ${state.fame} · 수입 ×${fameMultiplier(state).toFixed(2)}</span>
			</h2>
			<div class="quests">${raw(quests(state))}</div>

		</section>
	`;
}

/**
 * 지금 사면 헛돈이 되는 업그레이드에만 한 줄 붙인다.
 * 자리를 늘려도 앉힐 캐릭터가 없으면 빈 자리는 아무것도 하지 않는다.
 */
function warnFor(state: GameState, id: string, level: number): string {
	if (id !== "slot") return "";
	const owned = ownedCharacters(state).length;
	if (owned > level + 1) return "";
	return html`<p class="err small">앉힐 캐릭터가 ${owned}명뿐이라 늘린 자리는 비어 있게 돼요 — 경매장에서 먼저 데려오세요.</p>`;
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
					${raw(warnFor(state, def.id, level))}
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

	// 잠긴 주차는 언제 열리는지 한 줄로만 알린다. 설비 목록까지 깔 이유가 없다.
	if (locked) {
		return html`
			<div class="tierblock tierblock--locked">
				<header class="tierblock__head">
					<h2>${TIER_NAMES[tier]}</h2>
					${raw(head)}
				</header>
			</div>
		`;
	}

	return html`
		<div class="tierblock">
			<header class="tierblock__head">
				<h2>${TIER_NAMES[tier]}</h2>
				${raw(head)}
			</header>
			${raw(hint(TIER_HINTS[tier]))}
			<div class="upgs">${raw(cards)}</div>
		</div>
	`;
}

/**
 * 곧 달성할 과제 몇 개만 보여준다.
 * 16개를 다 펼치면 화면 세 판을 넘어가고, 그 대부분은 지금 할 일이 아니다.
 */
const QUEST_SHOWN = 4;

function quests(state: GameState): string {
	const open = ACHIEVEMENTS.filter((q) => !state.achievements.includes(q.id)).sort(
		(a, b) => b.progress(state) - a.progress(state),
	);
	const shown = open.slice(0, QUEST_SHOWN);
	const restOpen = open.length - shown.length;
	const done = state.achievements.length;
	const tail =
		restOpen > 0 || done > 0
			? html`<p class="muted small questmore">${[
					restOpen > 0 ? `남은 과제 ${restOpen}개` : "",
					done > 0 ? `달성 ${done}개` : "",
				]
					.filter(Boolean)
					.join(" · ")}</p>`
			: "";

	return (
		shown
			.map((q) => {
				const done = state.achievements.includes(q.id);
				const p = done ? 1 : q.progress(state);
				return html`
			<article class="quest">
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
			.join("") + tail
	);
}
