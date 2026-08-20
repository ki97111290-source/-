import type { Character, GameState } from "../core/types";
import { BALANCE } from "./balance";
import { goodsRevenue, tickGoods } from "./goods";
import { cheerMultiplier, cheersPerSecond, cheersPerSlot, occupiedSlots } from "./room";
import { upgradeLevel } from "./state";
import { traitOf } from "./traits";

export {
	bonusMultiplier,
	cheerMultiplier,
	cheerPush,
	cheersPerSecond,
	cheersPerSlot,
	fameMultiplier,
	hqMultiplier,
	occupiedSlots,
	slotIncome,
} from "./room";

/** 홍보 대행사가 주는 인기도 상승 배수 */
export function promoMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "promo") * 0.3;
}

/**
 * 인기도 소프트캡. 글로벌 송출을 올리면 한계가 뒤로 밀린다.
 * (나눠주는 계수가 작아질수록 인기도가 더 높이 올라간다)
 */
export function popularitySoftcap(state: GameState): number {
	return BALANCE.popularitySoftcap / (1 + upgradeLevel(state, "global") * 0.35);
}

/**
 * 화면에 보여주는 실제 총 초당 수입.
 * 응원은 더 이상 돈을 만들지 않는다 — 응원은 인기도를 올리고, 그 인기도를
 * 굿즈가 돈으로 바꾼다. 그래서 수입은 곧 굿즈 매출이다.
 */
export function incomePerSecond(state: GameState): number {
	return goodsRevenue(state);
}

/** 룸 전체에서 초당 오르는 인기도 (응원석에 앉은 캐릭터 합산) */
export function popularityPerSecond(state: GameState): number {
	const perSlot = cheersPerSlot(state);
	if (perSlot <= 0) return 0;
	let total = 0;
	for (const id of occupiedSlots(state)) {
		const character = state.characters[id];
		if (character) total += popularityGain(state, character, perSlot);
	}
	return total;
}

export function popularityGain(state: GameState, character: Character, power: number): number {
	const raw =
		BALANCE.cheerPopularity *
		cheerMultiplier(state) *
		promoMultiplier(state) *
		power *
		traitOf(character).popGain;
	return raw / (1 + character.popularity * popularitySoftcap(state));
}

/** 응원 1회가 쌓는 팬심. 인기도가 높은 캐릭터를 응원할수록 크다. */
export function fanValue(character: Character): number {
	return 1 + character.popularity * BALANCE.fanFromPopularity;
}

/** 룸 전체가 초당 쌓는 팬심 (표시용) */
export function fansPerSecond(state: GameState): number {
	const perSlot = cheersPerSlot(state);
	if (perSlot <= 0) return 0;
	let total = 0;
	for (const id of occupiedSlots(state)) {
		const character = state.characters[id];
		if (character) total += perSlot * fanValue(character);
	}
	return total;
}

export function offlineEfficiency(state: GameState): number {
	return Math.min(1, BALANCE.offlineBase + upgradeLevel(state, "fanCafe") * 0.05);
}

export function addMoney(state: GameState, amount: number): void {
	state.money += amount;
	if (amount > 0) state.totalEarned += amount;
}

/**
 * 응원. power는 "응원 몇 회분인가"를 뜻하며 소수도 들어온다.
 * 인기도가 높을수록 같은 응원의 체감 효과는 줄어든다(소프트 캡).
 * 응원 자체는 돈을 만들지 않는다. 팬심과 인기도만 만든다.
 */
export function cheer(state: GameState, characterId: string, power = 1): void {
	const character = state.characters[characterId];
	if (!character) return;

	character.popularity += popularityGain(state, character, power);
	character.hype += 0.12 * cheerMultiplier(state) * power;

	state.totalCheers += power;
	state.seasonCheers += power;
	// 팬심은 시즌 점수다. 돈과 달리 쓰이지 않고 쌓이기만 한다.
	state.seasonFans += power * fanValue(character);
}

/** 매 시뮬레이션 스텝마다 도는 기본 경제 로직 */
export function tickEconomy(state: GameState, dt: number): void {
	// 돈이 들어오는 유일한 상시 경로: 굿즈 판매
	addMoney(state, tickGoods(state, dt));

	// 응원은 켜두기만 하면 알아서 돌아간다. 응원석에 앉은 캐릭터에게 골고루 들어간다.
	const perSlot = cheersPerSlot(state) * dt;
	if (perSlot > 0) {
		for (const id of occupiedSlots(state)) cheer(state, id, perSlot);
	}

	// 인기도와 화제성은 가만두면 식는다. 성격에 따라 식는 속도가 다르다.
	for (const character of Object.values(state.characters)) {
		const decay = BALANCE.popularityDecay * traitOf(character).decay * dt;
		character.popularity = Math.max(0.5, character.popularity * (1 - decay));
		character.hype *= 1 - BALANCE.hypeDecay * dt;
		if (Math.abs(character.hype) < 0.001) character.hype = 0;
	}
}

export interface OfflineReport {
	seconds: number;
	/** 그동안 벌어들인 원 */
	money: number;
	capped: boolean;
}

/** 페이지를 닫아둔 동안의 수입을 정산한다. (켜둔 동안은 100%, 닫으면 효율 적용) */
export function applyOffline(state: GameState, now = Date.now()): OfflineReport | null {
	const elapsed = (now - state.lastTick) / 1000;
	if (!Number.isFinite(elapsed) || elapsed < 60) {
		state.lastTick = now;
		return null;
	}
	const capped = elapsed > BALANCE.offlineCap;
	const seconds = Math.min(elapsed, BALANCE.offlineCap);
	const efficiency = offlineEfficiency(state);
	// 굿즈 정산 경로를 그대로 쓴다. 그래야 닫아둔 동안 팔린 만큼 재고도 줄어든다.
	const money = tickGoods(state, seconds * efficiency);

	addMoney(state, money);
	// 닫아둔 동안에도 응원 횟수는 같은 효율로 쌓인다. 트로피 진행이 완전히 멈추면
	// "켜두면 되는 게임"이 "24시간 켜둬야 하는 게임"이 되어버린다.
	const offlineCheers = cheersPerSecond(state) * seconds * efficiency;
	state.totalCheers += offlineCheers;
	state.seasonCheers += offlineCheers;
	state.seasonFans += fansPerSecond(state) * seconds * efficiency;

	// 다만 인기도는 오르지 않는다. 오랫동안 응원이 끊기면 오히려 식는다.
	for (const character of Object.values(state.characters)) {
		const decay = BALANCE.popularityDecay * traitOf(character).decay * seconds * 0.5;
		character.popularity = Math.max(0.5, character.popularity * (1 - decay));
		character.hype *= 1 - Math.min(0.95, BALANCE.hypeDecay * seconds);
	}
	state.lastTick = now;
	return { seconds, money, capped };
}
