import { fmt } from "../../core/format";
import {
	SEASON_MODE,
	progressOf,
	remainingLabel,
	remainingOf,
	seasonLabel,
	seasonWeekOf,
	weekUnlockInOf,
} from "../../core/season";
import type { GameState } from "../../core/types";
import { TROPHY_TIERS, honorMultiplier, nextTrophy, tierOf, trophyFor } from "../../game/season";
import { html, raw } from "../dom";

export function renderSeason(state: GameState): string {
	const now = Date.now();
	const cheers = state.seasonCheers;
	const current = trophyFor(cheers);
	const next = nextTrophy(cheers);
	const meta = state.meta;

	return html`
		<section class="panel">
			<header class="seasonhead">
				<div>
					<h2>${seasonTitle(state)}</h2>
					<p class="muted">종료까지 ${remainingLabel(remainingOf(state.seasonEndsAt, now))} · ${resetRule()}</p>
				</div>
				<div class="seasonhead__badge ${current ? "" : "seasonhead__badge--none"}"
					style="--tier:${current?.color ?? "#3a4170"}">
					<span class="seasonhead__icon">${current?.icon ?? "—"}</span>
					<span>${current ? current.name : "기록 없음"}</span>
				</div>
			</header>
			<div class="timer"><div class="timer__bar" style="width:${((1 - progressOf(state.seasonStartedAt, state.seasonEndsAt, now)) * 100).toFixed(1)}%"></div></div>

			${raw(weekLine(state))}

			<div class="statrow">
				<div class="stat"><span>시즌 응원</span><b>${fmt(cheers)}회</b></div>
				<div class="stat"><span>명예 보너스</span><b>×${honorMultiplier(meta).toFixed(2)}</b></div>
				<div class="stat"><span>트로피</span><b>${meta.trophies.length}개</b></div>
				<div class="stat"><span>역대 최고</span><b>${fmt(meta.bestCheers)}회</b></div>
			</div>

			${raw(next ? nextGoal(cheers, next) : '<p class="notice notice--good">최고 등급까지 전부 달성했습니다. 이 시즌은 완주!</p>')}

			<h2 class="section-title">등급표</h2>
			<div class="tiers">${raw(TROPHY_TIERS.map((tier) => tierRow(tier.id, cheers)).join(""))}</div>

			<h2 class="section-title">트로피 진열장 ${meta.trophies.length}개</h2>
			<div class="cabinet">${raw(cabinet(state))}</div>

			<p class="hint">
				시즌이 끝나면 <b>코인·업그레이드·주식·인기도</b>는 초기화됩니다.
				남는 것은 <b>트로피</b>와 <b>업로드한 캐릭터 보관함</b>이고, 트로피가 주는
				명예 보너스는 다음 시즌 수입에 그대로 붙습니다.
			</p>
		</section>
	`;
}

/** 지금 시즌 이름. local 모드는 몇 번째 시즌인지로 부른다. */
function seasonTitle(state: GameState): string {
	if (SEASON_MODE === "local") return `시즌 ${state.meta.seasonsPlayed + 1}`;
	return seasonLabel(state.seasonId);
}

function resetRule(): string {
	return SEASON_MODE === "local"
		? "시작한 날로부터 30일 뒤 초기화"
		: "한국시간 매달 1일 00:00 초기화";
}

/** 이번 주차에 무엇이 열려 있고 다음이 언제인지 */
function weekLine(state: GameState): string {
	const week = seasonWeekOf(state.seasonStartedAt);
	const plan = [
		"1주차 · 인프라를 까는 주간",
		"2주차 · 핵심 설비 해금",
		"3주차 · 최종 설비 해금",
		"4주차 · 결산 주간 (배당 ×1.5)",
	];
	const next =
		week < 3
			? html`<span class="muted small">${remainingLabel(weekUnlockInOf(state.seasonStartedAt, week + 1))} 후 ${plan[week + 1]}</span>`
			: '<span class="muted small">더 살 설비가 없습니다. 주식과 경매로 불리세요.</span>';
	return html`
		<div class="weekbar">
			<b>${plan[week]}</b>
			${raw(next)}
		</div>
	`;
}

function nextGoal(
	cheers: number,
	next: { tier: ReturnType<typeof tierOf>; progress: number },
): string {
	const left = Math.max(0, next.tier.need - cheers);
	return html`
		<div class="goal" style="--tier:${next.tier.color}">
			<div class="goal__icon">${next.tier.icon}</div>
			<div class="goal__body">
				<h3>다음 목표 · ${next.tier.name}</h3>
				<div class="goal__bar"><i style="width:${(next.progress * 100).toFixed(1)}%"></i></div>
				<p class="muted small">${fmt(left)}회 더 응원하면 달성 (명예 +${next.tier.points})</p>
			</div>
		</div>
	`;
}

function tierRow(id: string, cheers: number): string {
	const tier = tierOf(id as Parameters<typeof tierOf>[0]);
	const reached = cheers >= tier.need;
	return html`
		<div class="tier ${reached ? "tier--on" : ""}" style="--tier:${tier.color}">
			<span class="tier__icon">${tier.icon}</span>
			<span class="tier__name">${tier.name}</span>
			<span class="muted">응원 ${fmt(tier.need)}회</span>
			<span class="tier__pt">명예 +${tier.points}</span>
		</div>
	`;
}

function cabinet(state: GameState): string {
	const trophies = [...state.meta.trophies].reverse();
	if (trophies.length === 0) {
		return `<p class="muted cabinet__empty">아직 트로피가 없습니다. 이번 시즌이 첫 트로피예요.</p>`;
	}
	return trophies
		.map((trophy) => {
			const tier = tierOf(trophy.tier);
			return html`
			<div class="trophy" style="--tier:${tier.color}" title="${seasonLabel(trophy.seasonId)}">
				<span class="trophy__icon">${tier.icon}</span>
				<b>${tier.name}</b>
				<span class="muted small">${seasonLabel(trophy.seasonId)}</span>
				<span class="muted small">응원 ${fmt(trophy.cheers)}회</span>
			</div>`;
		})
		.join("");
}

/** 시즌이 넘어간 직후 띄우는 결과 시트 */
export function renderSeasonModal(report: {
	endedSeason: string;
	cheers: number;
	trophy: { tier: string } | null;
	newSeason: string;
}): string {
	const tier = report.trophy ? tierOf(report.trophy.tier as Parameters<typeof tierOf>[0]) : null;
	return html`
		<div class="overlay" data-action="close-season">
			<div class="sheet sheet--center" data-stop="1">
				<h2>${seasonLabel(report.endedSeason)} 종료</h2>
				${raw(
					tier
						? html`<div class="bigtrophy" style="--tier:${tier.color}">
								<span>${tier.icon}</span>
								<b>${tier.name} 트로피 획득!</b>
							</div>`
						: '<div class="bigtrophy bigtrophy--none"><span>🕯</span><b>이번엔 트로피를 놓쳤어요</b></div>',
				)}
				<p class="muted">시즌 응원 ${fmt(report.cheers)}회</p>
				<p class="muted small">
					${seasonLabel(report.newSeason)}이 시작됐습니다. 코인과 업그레이드는 초기화됐지만
					트로피와 보관함의 캐릭터는 그대로예요.
				</p>
				<button class="btn btn--primary" data-action="close-season">새 시즌 시작</button>
			</div>
		</div>
	`;
}
