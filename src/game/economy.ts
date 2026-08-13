import type { Character, GameState } from "../core/types";
import { BALANCE } from "./balance";
import { upgradeLevel } from "./state";
import { traitOf } from "./traits";

/** 응원석에 앉은 캐릭터 한 명의 기본 초당 코인 (명성·응원 제외) */
export function slotIncome(character: Character): number {
	return (
		BALANCE.baseIncome *
		(1 + character.popularity * BALANCE.incomeFromPopularity) *
		traitOf(character).income
	);
}

/** 도전 과제로 쌓은 명성이 주는 전체 수입 배수 */
export function fameMultiplier(state: GameState): number {
	return 1 + state.fame * BALANCE.famePerPoint;
}

export function occupiedSlots(state: GameState): string[] {
	return state.slots.filter((id): id is string => Boolean(id));
}

/** 응원석에 앉아 있기만 해도 들어오는 초당 코인 */
export function passiveIncome(state: GameState): number {
	let total = 0;
	for (const id of occupiedSlots(state)) {
		const character = state.characters[id];
		if (character) total += slotIncome(character);
	}
	return total * fameMultiplier(state);
}

export function cheerMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "cheerPower") * 0.35;
}

/** 룸 전체의 초당 응원 횟수. 업그레이드 없이도 기본값만큼 돌아간다. */
export function cheersPerSecond(state: GameState): number {
	return BALANCE.baseCheerRate + upgradeLevel(state, "autoCheer") * BALANCE.cheerRatePerLevel;
}

/** 캐릭터 한 명이 초당 받는 응원 횟수 */
export function cheersPerSlot(state: GameState): number {
	const count = occupiedSlots(state).length;
	return count === 0 ? 0 : cheersPerSecond(state) / count;
}

/** 자동 응원이 만들어내는 초당 코인 */
export function cheerIncome(state: GameState): number {
	const perSlot = cheersPerSlot(state);
	if (perSlot <= 0) return 0;
	let total = 0;
	for (const id of occupiedSlots(state)) {
		const character = state.characters[id];
		if (character) total += slotIncome(character) * BALANCE.cheerBurst * perSlot;
	}
	return total * cheerMultiplier(state) * fameMultiplier(state);
}

/** 화면에 보여주는 실제 총 초당 수입 */
export function incomePerSecond(state: GameState): number {
	return passiveIncome(state) + cheerIncome(state);
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

function popularityGain(state: GameState, character: Character, power: number): number {
	return (
		(BALANCE.cheerPopularity * cheerMultiplier(state) * power * traitOf(character).popGain) /
		(1 + character.popularity * 0.02)
	);
}

export function offlineEfficiency(state: GameState): number {
	return Math.min(1, BALANCE.offlineBase + upgradeLevel(state, "fanCafe") * 0.05);
}

export function addCoins(state: GameState, amount: number): void {
	state.coins += amount;
	if (amount > 0) state.totalEarned += amount;
}

/**
 * 응원. power는 "응원 몇 회분인가"를 뜻하며 소수도 들어온다.
 * 인기도가 높을수록 같은 응원의 체감 효과는 줄어든다(소프트 캡).
 */
export function cheer(state: GameState, characterId: string, power = 1): void {
	const character = state.characters[characterId];
	if (!character) return;
	const mult = cheerMultiplier(state) * power;

	character.popularity += popularityGain(state, character, power);
	character.hype += 0.12 * mult;

	addCoins(state, slotIncome(character) * BALANCE.cheerBurst * mult * fameMultiplier(state));
	state.totalCheers += power;
}

/** 매 시뮬레이션 스텝마다 도는 기본 경제 로직 */
export function tickEconomy(state: GameState, dt: number): void {
	addCoins(state, passiveIncome(state) * dt);

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
	coins: number;
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
	const coins = incomePerSecond(state) * seconds * offlineEfficiency(state);

	addCoins(state, coins);
	// 오랫동안 응원이 끊기면 인기도도 그만큼 식는다.
	for (const character of Object.values(state.characters)) {
		const decay = BALANCE.popularityDecay * traitOf(character).decay * seconds * 0.5;
		character.popularity = Math.max(0.5, character.popularity * (1 - decay));
		character.hype *= 1 - Math.min(0.95, BALANCE.hypeDecay * seconds);
	}
	state.lastTick = now;
	return { seconds, coins, capped };
}
