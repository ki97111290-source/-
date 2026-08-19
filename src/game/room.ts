import type { Character, GameState } from "../core/types";
import { BALANCE } from "./balance";
import { honorMultiplier } from "./season";
import { upgradeLevel } from "./state";
import { traitOf } from "./traits";

/**
 * 응원 룸의 기본 수치들. 응원(economy)과 굿즈(goods)가 함께 쓰기 때문에
 * 두 모듈이 서로를 참조하지 않도록 여기로 빼두었다.
 */

export function occupiedSlots(state: GameState): string[] {
	return state.slots.filter((id): id is string => Boolean(id));
}

/**
 * 캐릭터 한 명의 기본 "굿즈 판매력". 인기도와 성격이 반영된다.
 * 돈은 굿즈에서만 나오므로 이 값은 그 캐릭터가 얼마나 팔릴 재목인지를 뜻한다.
 */
export function slotIncome(character: Character): number {
	return (
		BALANCE.baseIncome *
		(1 + character.popularity * BALANCE.incomeFromPopularity) *
		traitOf(character).income
	);
}

export function cheerMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "cheerPower") * 0.5;
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

/**
 * 응원석에 앉은 캐릭터가 받는 화력 배수.
 * 응원이 몰릴수록 그 캐릭터의 굿즈가 잘 팔린다. 자리에 없으면 배수가 없다.
 */
export function cheerPush(state: GameState, characterId: string): number {
	if (!state.slots.includes(characterId)) return 1;
	return 1 + BALANCE.cheerBurst * cheersPerSlot(state) * cheerMultiplier(state);
}

/** 이번 시즌에 쌓은 명성이 주는 수입 배수 (시즌이 끝나면 사라진다) */
export function fameMultiplier(state: GameState): number {
	return 1 + state.fame * BALANCE.famePerPoint;
}

/** 팬덤 본부(3주차 설비)가 주는 전체 수입 배수 */
export function hqMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "hq") * 0.6;
}

/** 명성(시즌) × 명예(트로피, 영구) × 팬덤 본부를 합친 전체 수입 배수 */
export function bonusMultiplier(state: GameState): number {
	return fameMultiplier(state) * honorMultiplier(state.meta) * hqMultiplier(state);
}
