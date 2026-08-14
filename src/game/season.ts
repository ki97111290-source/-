import { type SeasonBounds, newSeasonBounds } from "../core/season";
import type { GameState, MetaState, Trophy, TrophyTierId } from "../core/types";

export interface TrophyTier {
	id: TrophyTierId;
	name: string;
	icon: string;
	/** 이 등급을 받기 위해 필요한 시즌 응원 수 */
	need: number;
	/** 명예 보너스 점수 (다음 시즌부터 수입에 반영) */
	points: number;
	color: string;
}

/**
 * 기준값은 한 달치 시뮬레이션으로 잡았다. 주차 커브(1주 인프라 → 2주 핵심 →
 * 3주 최종 → 4주 주식·경매)를 그대로 따라간 항상 켜둔 플레이어 기준이며,
 * 괄호 안이 그 지점에 닿는 날짜다. 마스터는 한 달을 거의 꽉 채워야 한다.
 */
export const TROPHY_TIERS: readonly TrophyTier[] = [
	// D2
	{ id: "bronze", name: "브론즈", icon: "🥉", need: 100_000, points: 1, color: "#cd7f32" },
	// D9 — 핵심 설비를 올리기 시작할 무렵
	{ id: "silver", name: "실버", icon: "🥈", need: 1_000_000, points: 3, color: "#c0c8d8" },
	// D13 — 핵심 설비 완성 직전
	{ id: "gold", name: "골드", icon: "🥇", need: 5_000_000, points: 7, color: "#ffd66b" },
	// D17 — 최종 설비 중반
	{ id: "platinum", name: "플래티넘", icon: "💠", need: 13_000_000, points: 14, color: "#67e8f9" },
	// D23 — 결산 주간
	{ id: "diamond", name: "다이아", icon: "💎", need: 24_000_000, points: 25, color: "#a78bfa" },
	// D30 — 시즌을 끝까지 완주해야 닿는다
	{ id: "master", name: "마스터", icon: "👑", need: 36_000_000, points: 45, color: "#ff5c9d" },
] as const;

/** 시즌 응원 수로 받을 등급. 기준 미달이면 null(무관). */
export function trophyFor(cheers: number): TrophyTier | null {
	let earned: TrophyTier | null = null;
	for (const tier of TROPHY_TIERS) {
		if (cheers >= tier.need) earned = tier;
	}
	return earned;
}

/** 다음 등급과 거기까지의 진행률 */
export function nextTrophy(cheers: number): { tier: TrophyTier; progress: number } | null {
	const current = trophyFor(cheers);
	const index = current ? TROPHY_TIERS.findIndex((t) => t.id === current.id) + 1 : 0;
	const tier = TROPHY_TIERS[index];
	if (!tier) return null;
	const floor = current?.need ?? 0;
	return { tier, progress: Math.max(0, Math.min(1, (cheers - floor) / (tier.need - floor))) };
}

export function tierOf(id: TrophyTierId): TrophyTier {
	return TROPHY_TIERS.find((t) => t.id === id) ?? (TROPHY_TIERS[0] as TrophyTier);
}

/** 트로피가 주는 명예 점수 합계 */
export function honorPoints(meta: MetaState): number {
	return meta.trophies.reduce((sum, t) => sum + tierOf(t.tier).points, 0);
}

/** 명예 보너스 배수. 시즌이 초기화돼도 이 배수는 남는다. */
export function honorMultiplier(meta: MetaState): number {
	return 1 + honorPoints(meta) * 0.02;
}

export function emptyMeta(): MetaState {
	return { trophies: [], roster: [], seasonsPlayed: 0, bestCheers: 0 };
}

export interface SeasonReport {
	endedSeason: string;
	cheers: number;
	trophy: Trophy | null;
	newSeason: string;
}

/**
 * 시즌이 끝났으면 정산하고 판을 새로 깐다.
 * 종료 판정은 state.seasonEndsAt 하나로만 하므로 local/calendar 모드가 같은 코드를 쓴다.
 * state를 그 자리에서 갈아끼우므로 Engine이 들고 있는 참조는 그대로 살아 있다.
 */
export function rolloverIfNeeded(
	state: GameState,
	rebuild: (meta: MetaState, bounds: SeasonBounds, now: number) => GameState,
	now = Date.now(),
): SeasonReport | null {
	if (!Number.isFinite(state.seasonEndsAt) || now < state.seasonEndsAt) return null;

	const ended = state.seasonId;
	const cheers = state.seasonCheers;
	const meta = state.meta;

	const tier = trophyFor(cheers);
	let trophy: Trophy | null = null;
	if (tier) {
		trophy = { seasonId: ended, tier: tier.id, cheers, awardedAt: now };
		meta.trophies.push(trophy);
	}
	meta.seasonsPlayed += 1;
	meta.bestCheers = Math.max(meta.bestCheers, cheers);

	const bounds = newSeasonBounds(now);
	const fresh = rebuild(meta, bounds, now);
	// 참조를 유지해야 하므로 새 객체로 바꾸지 않고 내용만 갈아끼운다.
	for (const key of Object.keys(state)) {
		delete (state as unknown as Record<string, unknown>)[key];
	}
	Object.assign(state, fresh);

	return { endedSeason: ended, cheers, trophy, newSeason: bounds.id };
}
