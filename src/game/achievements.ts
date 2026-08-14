import type { GameState } from "../core/types";
import { UPGRADES, type UpgradeTier } from "./balance";
import { pushLog } from "./state";
import { isRare, traitOf } from "./traits";

export interface Achievement {
	id: string;
	name: string;
	desc: string;
	icon: string;
	/** 달성 시 주는 명성(전체 수입 보너스) */
	fame: number;
	/** 달성 시 주는 코인 */
	coins: number;
	done: (state: GameState) => boolean;
	/** 진행도 0~1 (진행바 표시용) */
	progress: (state: GameState) => number;
}

function ratio(current: number, goal: number): number {
	return Math.max(0, Math.min(1, current / goal));
}

function topPopularity(state: GameState): number {
	let best = 0;
	for (const id of state.owned) {
		const c = state.characters[id];
		if (c && c.popularity > best) best = c.popularity;
	}
	return best;
}

function filledSeats(state: GameState): number {
	return state.slots.filter(Boolean).length;
}

function tierLevels(state: GameState, tier: UpgradeTier) {
	const defs = UPGRADES.filter((u) => u.tier === tier);
	const have = defs.reduce((sum, d) => sum + Math.min(state.upgrades[d.id] ?? 0, d.maxLevel), 0);
	const need = defs.reduce((sum, d) => sum + d.maxLevel, 0);
	return { have, need };
}

function tierDone(state: GameState, tier: UpgradeTier): boolean {
	const { have, need } = tierLevels(state, tier);
	return have >= need;
}

function tierProgress(state: GameState, tier: UpgradeTier): number {
	const { have, need } = tierLevels(state, tier);
	return ratio(have, need);
}

function heldStocks(state: GameState): number {
	return Object.values(state.portfolio).filter((h) => h.shares > 0).length;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
	{
		id: "cheer-100",
		name: "첫 화력",
		desc: "응원 100회",
		icon: "📣",
		fame: 1,
		coins: 500,
		done: (s) => s.totalCheers >= 100,
		progress: (s) => ratio(s.totalCheers, 100),
	},
	{
		id: "cheer-5000",
		name: "화력 지원",
		desc: "응원 5,000회",
		icon: "🎆",
		fame: 3,
		coins: 20_000,
		done: (s) => s.totalCheers >= 5000,
		progress: (s) => ratio(s.totalCheers, 5000),
	},
	{
		id: "seats-3",
		name: "무인 방송국",
		desc: "응원석 3자리를 채우기",
		icon: "🪑",
		fame: 2,
		coins: 3_000,
		done: (s) => filledSeats(s) >= 3,
		progress: (s) => ratio(filledSeats(s), 3),
	},
	{
		id: "tier-0",
		name: "인프라 완성",
		desc: "1주차 설비 전부 MAX",
		icon: "🏗",
		fame: 3,
		coins: 20_000,
		done: (s) => tierDone(s, 0),
		progress: (s) => tierProgress(s, 0),
	},
	{
		id: "tier-1",
		name: "핵심 설비 완성",
		desc: "2주차 설비 전부 MAX",
		icon: "⚙️",
		fame: 6,
		coins: 5_000_000,
		done: (s) => tierDone(s, 1),
		progress: (s) => tierProgress(s, 1),
	},
	{
		id: "tier-2",
		name: "최종 설비 완성",
		desc: "3주차 설비 전부 MAX",
		icon: "🏛",
		fame: 10,
		coins: 500_000_000,
		done: (s) => tierDone(s, 2),
		progress: (s) => tierProgress(s, 2),
	},
	{
		id: "upload-1",
		name: "내 최애 데뷔",
		desc: "캐릭터를 직접 등록",
		icon: "🎀",
		fame: 2,
		coins: 2_000,
		done: (s) => Object.values(s.characters).some((c) => c.origin === "user"),
		progress: (s) => (Object.values(s.characters).some((c) => c.origin === "user") ? 1 : 0),
	},
	{
		id: "own-3",
		name: "소속사 사장님",
		desc: "캐릭터 3명 보유",
		icon: "🏢",
		fame: 2,
		coins: 5_000,
		done: (s) => s.owned.length >= 3,
		progress: (s) => ratio(s.owned.length, 3),
	},
	{
		id: "own-6",
		name: "대형 기획사",
		desc: "캐릭터 6명 보유",
		icon: "🏙",
		fame: 5,
		coins: 60_000,
		done: (s) => s.owned.length >= 6,
		progress: (s) => ratio(s.owned.length, 6),
	},
	{
		id: "auction-1",
		name: "첫 낙찰",
		desc: "경매에서 캐릭터 낙찰",
		icon: "🔨",
		fame: 2,
		coins: 4_000,
		done: (s) => s.auctionWins >= 1,
		progress: (s) => ratio(s.auctionWins, 1),
	},
	{
		id: "auction-5",
		name: "경매장 단골",
		desc: "경매 5회 낙찰",
		icon: "🏆",
		fame: 4,
		coins: 40_000,
		done: (s) => s.auctionWins >= 5,
		progress: (s) => ratio(s.auctionWins, 5),
	},
	{
		id: "stock-3",
		name: "분산 투자",
		desc: "3개 종목 동시 보유",
		icon: "📊",
		fame: 3,
		coins: 10_000,
		done: (s) => heldStocks(s) >= 3,
		progress: (s) => ratio(heldStocks(s), 3),
	},
	{
		id: "pop-100",
		name: "인기 절정",
		desc: "내 캐릭터 인기도 100",
		icon: "🔥",
		fame: 4,
		coins: 25_000,
		done: (s) => topPopularity(s) >= 100,
		progress: (s) => ratio(topPopularity(s), 100),
	},
	{
		id: "pop-300",
		name: "전설이 된 최애",
		desc: "내 캐릭터 인기도 300",
		icon: "💫",
		fame: 8,
		coins: 200_000,
		done: (s) => topPopularity(s) >= 300,
		progress: (s) => ratio(topPopularity(s), 300),
	},
	{
		id: "legend-own",
		name: "레전드 영입",
		desc: "희귀 성격(👑) 캐릭터 보유",
		icon: "👑",
		fame: 6,
		coins: 80_000,
		done: (s) =>
			s.owned.some((id) => {
				const c = s.characters[id];
				return c ? isRare(traitOf(c)) : false;
			}),
		progress: (s) =>
			s.owned.some((id) => {
				const c = s.characters[id];
				return c ? isRare(traitOf(c)) : false;
			})
				? 1
				: 0,
	},
	{
		id: "coins-1m",
		name: "억대 팬덤",
		desc: "누적 수입 100만 C",
		icon: "💰",
		fame: 5,
		coins: 100_000,
		done: (s) => s.totalEarned >= 1_000_000,
		progress: (s) => ratio(s.totalEarned, 1_000_000),
	},
] as const;

/** 달성한 과제를 정산한다. 매 스텝 호출되므로 가볍게 유지한다. */
export function checkAchievements(state: GameState): void {
	for (const achievement of ACHIEVEMENTS) {
		if (state.achievements.includes(achievement.id)) continue;
		if (!achievement.done(state)) continue;

		state.achievements.push(achievement.id);
		state.fame += achievement.fame;
		state.coins += achievement.coins;
		state.totalEarned += achievement.coins;
		pushLog(
			state,
			`도전 과제 달성: ${achievement.icon} ${achievement.name} (명성 +${achievement.fame})`,
			"good",
		);
	}
}
