import { fans, fmt } from "../../core/format";
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
import { TITLES } from "../../game/titles";
import { html, raw } from "../dom";
import { hint, stats, untilNextLocked } from "../parts";

export function renderSeason(state: GameState): string {
	const now = Date.now();
	const fanPoints = state.seasonFans;
	const current = trophyFor(fanPoints);
	const next = nextTrophy(fanPoints);
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

			${raw(
				stats([
					{ label: "시즌 팬심", value: `💜 ${fmt(fanPoints)}` },
					// 아직 트로피가 없으면 보너스·기록 칸은 0만 보여준다
					{
						label: "명예 보너스",
						value: `×${honorMultiplier(meta).toFixed(2)}`,
						show: honorMultiplier(meta) > 1,
					},
					{ label: "트로피", value: `${meta.trophies.length}개`, show: meta.trophies.length > 0 },
					{ label: "역대 최고", value: fans(meta.bestFans), show: meta.bestFans > 0 },
				]),
			)}

			${raw(next ? nextGoal(fanPoints, next) : '<p class="notice notice--good">최고 등급까지 전부 달성했습니다. 이 시즌은 완주!</p>')}

			<h2 class="section-title">등급표${raw(tierTail(fanPoints))}</h2>
			<div class="tiers">${raw(
				untilNextLocked(TROPHY_TIERS, (tier) => fanPoints >= tier.need)
					.map((tier) => tierRow(tier.id, fanPoints))
					.join(""),
			)}</div>

			${raw(titleCase(state))}

			${raw(
				meta.trophies.length > 0
					? html`<h2 class="section-title">트로피 진열장 ${meta.trophies.length}개</h2>
						<div class="cabinet">${raw(cabinet(state))}</div>`
					: "",
			)}

			${raw(
				hint(`<b>팬심</b>은 시즌 성적표라 쓰이지 않고 쌓이기만 합니다.
				시즌이 끝나면 <b>원·업그레이드·주식·인기도</b>는 초기화되고,
				남는 것은 <b>트로피·칭호·보관함</b>입니다.`),
			)}
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
	fanPoints: number,
	next: { tier: ReturnType<typeof tierOf>; progress: number },
): string {
	const left = Math.max(0, next.tier.need - fanPoints);
	return html`
		<div class="goal" style="--tier:${next.tier.color}">
			<div class="goal__icon">${next.tier.icon}</div>
			<div class="goal__body">
				<h3>다음 목표 · ${next.tier.name}</h3>
				<div class="goal__bar"><i style="width:${(next.progress * 100).toFixed(1)}%"></i></div>
				<p class="muted small">팬심 ${fmt(left)} 더 쌓으면 달성 (명예 +${next.tier.points})</p>
			</div>
		</div>
	`;
}

function tierRow(id: string, fanPoints: number): string {
	const tier = tierOf(id as Parameters<typeof tierOf>[0]);
	const reached = fanPoints >= tier.need;
	return html`
		<div class="tier ${reached ? "tier--on" : ""}" style="--tier:${tier.color}">
			<span class="tier__icon">${tier.icon}</span>
			<span class="tier__name">${tier.name}</span>
			<span class="muted">팬심 ${fmt(tier.need)}</span>
			<span class="tier__pt">명예 +${tier.points}</span>
		</div>
	`;
}

/** 굿즈로 얻는 칭호 진열장. 트로피와 달리 "무엇을 만들어 팔았나"에 붙는다. */
function titleCase(state: GameState): string {
	const owned = state.meta.titles;
	// 딴 칭호만 진열한다. 못 딴 건 개수만 알리면 충분하다.
	const earned = TITLES.filter((t) => owned.includes(t.id));
	if (earned.length === 0) {
		return html`<h2 class="section-title">칭호 <span class="muted">· 아직 없음 (굿즈 한정판·유일본으로 받습니다)</span></h2>`;
	}
	const rows = earned
		.map(
			(title) => html`
			<div class="titlecard titlecard--on">
				<span class="titlecard__icon">${title.icon}</span>
				<b>${title.name}</b>
				<span class="muted small">${title.desc}</span>
			</div>`,
		)
		.join("");
	return html`
		<h2 class="section-title">칭호 ${earned.length}/${TITLES.length}</h2>
		<div class="titles">${raw(rows)}</div>
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
				<span class="muted small">${fans(trophy.fans)}</span>
			</div>`;
		})
		.join("");
}

/** 시즌이 넘어간 직후 띄우는 결과 시트 */
export function renderSeasonModal(report: {
	endedSeason: string;
	fans: number;
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
				<p class="muted">시즌 팬심 ${fans(report.fans)}</p>
				<p class="muted small">
					${seasonLabel(report.newSeason)}이 시작됐습니다. 시드머니와 함께 다시 시작하고,
					트로피와 보관함의 캐릭터는 그대로예요.
				</p>
				<button class="btn btn--primary" data-action="close-season">새 시즌 시작</button>
			</div>
		</div>
	`;
}

/** 아직 못 본 등급이 몇 개 남았는지 */
function tierTail(fanPoints: number): string {
	const left = TROPHY_TIERS.filter((tier) => fanPoints < tier.need).length - 1;
	return left > 0 ? html` <span class="muted">· 위로 ${left}단계 더</span>` : "";
}
