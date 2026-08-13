import type { Character, GameState } from "../core/types";
import { BALANCE } from "./balance";
import { upgradeLevel } from "./state";
import { traitOf } from "./traits";

/** 응원석에 앉은 캐릭터 한 명이 벌어들이는 초당 코인 (명성 보너스 제외) */
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

/** 현재 응원 룸 전체의 초당 수입 */
export function incomePerSecond(state: GameState): number {
	let total = 0;
	for (const id of state.slots) {
		if (!id) continue;
		const character = state.characters[id];
		if (character) total += slotIncome(character);
	}
	return total * fameMultiplier(state);
}

export function cheerMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "cheerPower") * 0.35;
}

/** 연속 응원으로 붙는 배수 (최대 ×3) */
export function comboMultiplier(state: GameState, now = Date.now()): number {
	if (state.combo.until < now) return 1;
	return 1 + Math.min(state.combo.count, BALANCE.comboMax) * BALANCE.comboStep;
}

export function comboActive(state: GameState, now = Date.now()): boolean {
	return state.combo.until > now && state.combo.count > 0;
}

export function autoCheersPerSecond(state: GameState): number {
	return upgradeLevel(state, "autoCheer") * 0.5;
}

export function offlineEfficiency(state: GameState): number {
	return Math.min(1, BALANCE.offlineBase + upgradeLevel(state, "fanCafe") * 0.05);
}

export function addCoins(state: GameState, amount: number): void {
	state.coins += amount;
	if (amount > 0) state.totalEarned += amount;
}

/**
 * 응원 1회. 코인이 즉시 들어오고 캐릭터의 인기도/화제성이 오른다.
 * 인기도가 높을수록 같은 응원의 체감 효과는 줄어든다(소프트 캡).
 */
export function cheer(state: GameState, characterId: string, power = 1): void {
	const character = state.characters[characterId];
	if (!character) return;
	const trait = traitOf(character);
	const mult = cheerMultiplier(state) * power;

	const gain = (BALANCE.cheerPopularity * mult * trait.popGain) / (1 + character.popularity * 0.02);
	character.popularity += gain;
	character.hype += 0.12 * mult;

	addCoins(state, slotIncome(character) * BALANCE.cheerBurst * mult * fameMultiplier(state));
	state.totalCheers += power;
}

/** 손으로 누른 응원. 콤보가 쌓이고 그만큼 배수가 붙는다. */
export function tapCheer(state: GameState, characterId: string, now = Date.now()): number {
	const before = state.coins;
	if (state.combo.until >= now) state.combo.count += 1;
	else state.combo.count = 1;
	state.combo.until = now + BALANCE.comboWindow * 1000;
	if (state.combo.count > state.bestCombo) state.bestCombo = state.combo.count;

	cheer(state, characterId, comboMultiplier(state, now));
	return state.coins - before;
}

/** 매 시뮬레이션 스텝마다 도는 기본 경제 로직 */
export function tickEconomy(state: GameState, dt: number, now = Date.now()): void {
	addCoins(state, incomePerSecond(state) * dt);
	if (state.combo.until < now && state.combo.count !== 0) state.combo.count = 0;

	// 자동 응원은 응원석에 앉은 캐릭터에게 골고루 들어간다. (콤보는 붙지 않는다)
	const occupied = state.slots.filter((id): id is string => Boolean(id));
	const autoCheers = autoCheersPerSecond(state) * dt;
	if (autoCheers > 0 && occupied.length > 0) {
		const each = autoCheers / occupied.length;
		for (const id of occupied) cheer(state, id, each * 0.6);
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

/** 접속하지 않은 동안의 수입을 정산한다. */
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
