import type { Character, GameState } from "../core/types";
import { BALANCE } from "./balance";
import { goodsRevenue, tickGoods } from "./goods";
import { cheerMultiplier, cheersPerSlot, occupiedSlots } from "./room";
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

/**
 * 오프라인 정산을 쪼개는 단위(초). 한 번에 몰아서 계산하면 감쇠·성장이 어긋나고,
 * 너무 잘게 쪼개면 8시간치가 수만 번 돈다. 10초면 8시간이 천 번 남짓이다.
 */
const OFFLINE_STEP = 10;

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

	/**
	 * 닫아둔 시간을 "효율만큼 느리게 돌아간 시간"으로 보고 평소 루프를 그대로 돌린다.
	 *
	 * 예전에는 감쇠를 한 번에 몰아서 곱했는데(`인기도 × (1 − 감쇠율 × 경과초)`),
	 * 37분이 넘으면 괄호 안이 음수가 되어 **모든 캐릭터 인기도가 0.5로 무너졌다.**
	 * 40분만 닫아둬도 인기도 1216 → 0.5, 수입 466/초 → 44/초.
	 * 게다가 응원 횟수와 팬심은 쌓아주면서 그 응원이 인기도에는 반영되지 않아
	 * 앞뒤도 맞지 않았다. 나눠서 돌리면 응원·감쇠·굿즈 재고가 한 규칙으로 정리된다.
	 */
	const before = state.money;
	const total = seconds * efficiency;
	for (let left = total; left > 0; left -= OFFLINE_STEP) {
		tickEconomy(state, Math.min(OFFLINE_STEP, left));
	}
	const money = state.money - before;

	state.lastTick = now;
	return { seconds, money, capped };
}
