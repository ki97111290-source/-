import { uid } from "../core/rng";
import type { Character, GameState, GoodsLine, GoodsTypeId } from "../core/types";
import { BALANCE } from "./balance";
import { bonusMultiplier, cheerPush, slotIncome } from "./room";
import { pushLog, upgradeLevel } from "./state";
import { traitOf } from "./traits";

const HOUR = 3600 * 1000;

export interface GoodsType {
	id: GoodsTypeId;
	name: string;
	icon: string;
	/** 매출 배수 */
	revenue: number;
	/** 유행이 절반으로 식는 데 걸리는 시간(시간) */
	halfLifeHours: number;
	/** 발매비 배수 */
	cost: number;
	desc: string;
}

/**
 * 굿즈 종류는 "매출이 큰가"와 "유행이 오래가는가"를 맞바꾼다.
 * 자주 못 들여다보는 사람은 키링을, 관리할 사람은 인형을 고르면 된다.
 */
export const GOODS_TYPES: readonly GoodsType[] = [
	{
		id: "keyring",
		name: "키링",
		icon: "🔑",
		revenue: 1,
		halfLifeHours: 12,
		cost: 0.7,
		desc: "오래 팔린다. 방치할수록 유리",
	},
	{
		id: "acrylic",
		name: "아크릴 스탠드",
		icon: "🧊",
		revenue: 1.3,
		halfLifeHours: 6,
		cost: 1,
		desc: "무난한 기본형",
	},
	{
		id: "photobook",
		name: "화보집",
		icon: "📖",
		revenue: 1.65,
		halfLifeHours: 3,
		cost: 1.5,
		desc: "매출이 크지만 빨리 식는다",
	},
	{
		id: "plush",
		name: "인형",
		icon: "🧸",
		revenue: 2.15,
		halfLifeHours: 1.5,
		cost: 2.2,
		desc: "폭발적. 자주 재발매해야 한다",
	},
] as const;

export function goodsType(id: GoodsTypeId): GoodsType {
	return GOODS_TYPES.find((t) => t.id === id) ?? (GOODS_TYPES[1] as GoodsType);
}

/** 굿즈 공장이 주는 매출 배수 */
export function goodsMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "goods") * BALANCE.goodsFactoryPerLevel;
}

/**
 * 유행도 0~1. 발매 직후 1이고 종류별 반감기로 식다가 하한에서 멈춘다.
 * 하한이 있어서 완전히 방치해도 매출이 0이 되지는 않는다.
 */
export function trendOf(line: GoodsLine, now = Date.now()): number {
	const floor = BALANCE.goodsTrendFloor;
	const hours = Math.max(0, (now - line.releasedAt) / HOUR);
	const decay = 0.5 ** (hours / goodsType(line.type).halfLifeHours);
	return floor + (1 - floor) * decay;
}

/** 유행을 빼고 계산한 라인의 초당 매출 (재발매 직후의 매출) */
export function peakRevenue(state: GameState, line: GoodsLine): number {
	const character = state.characters[line.characterId];
	if (!character) return 0;
	return peakRevenueOf(state, character, line.type);
}

/**
 * 아직 열지 않은 라인의 매출을 미리 계산한다 (발매비 산정·미리보기용).
 *
 * 판매량은 그 캐릭터가 받는 응원 화력에서 나온다. 응원석에 앉혀 응원을 몰아줘야
 * 굿즈가 팔리고, 자리에서 빼면 기본 판매력만 남는다.
 */
export function peakRevenueOf(state: GameState, character: Character, type: GoodsTypeId): number {
	return (
		slotIncome(character) *
		cheerPush(state, character.id) *
		goodsType(type).revenue *
		traitOf(character).dividend *
		goodsMultiplier(state) *
		bonusMultiplier(state)
	);
}

/** 지금 이 라인이 실제로 벌고 있는 초당 매출 */
export function lineRevenue(state: GameState, line: GoodsLine, now = Date.now()): number {
	return peakRevenue(state, line) * trendOf(line, now);
}

/** 모든 굿즈 라인의 초당 매출 합계. 이 게임의 초당 수입이다. */
export function goodsRevenue(state: GameState, now = Date.now()): number {
	let total = 0;
	for (const line of state.goods) total += lineRevenue(state, line, now);
	return total;
}

export function lineOf(state: GameState, characterId: string): GoodsLine | undefined {
	return state.goods.find((line) => line.characterId === characterId);
}

export function openCost(state: GameState, character: Character, type: GoodsTypeId): number {
	return Math.ceil(peakRevenueOf(state, character, type) * BALANCE.goodsOpenSeconds);
}

export function rerunCost(state: GameState, line: GoodsLine): number {
	return Math.ceil(peakRevenue(state, line) * BALANCE.goodsRerunSeconds);
}

export interface GoodsResult {
	ok: boolean;
	message: string;
}

/**
 * 새 굿즈를 발매한다. 캐릭터 한 명당 라인은 하나뿐이라,
 * 이미 내고 있는 캐릭터에게 다른 종류를 내면 그 자리에서 갈아탄다.
 */
export function releaseGoods(
	state: GameState,
	characterId: string,
	type: GoodsTypeId,
	now = Date.now(),
): GoodsResult {
	const character = state.characters[characterId];
	if (!character || !state.owned.includes(characterId)) {
		return { ok: false, message: "내가 가진 캐릭터가 아니에요." };
	}
	const existing = lineOf(state, characterId);
	if (existing?.type === type) {
		return { ok: false, message: "이미 같은 굿즈를 내고 있어요." };
	}
	if (!existing && state.goods.length >= BALANCE.maxGoodsLines) {
		return { ok: false, message: `굿즈 라인은 ${BALANCE.maxGoodsLines}개까지 열 수 있어요.` };
	}
	const cost = openCost(state, character, type);
	if (state.money < cost) return { ok: false, message: "발매비가 부족해요." };

	state.money -= cost;
	if (existing) closeGoods(state, existing.id);
	state.goods.push({
		id: uid("gd"),
		characterId,
		type,
		releasedAt: now,
		editions: 0,
		revenue: 0,
	});
	const def = goodsType(type);
	if (existing) {
		const from = goodsType(existing.type);
		pushLog(
			state,
			`${character.name}의 굿즈를 ${from.name}에서 ${def.name}(으)로 바꿨어요.`,
			"info",
		);
		return { ok: true, message: `${character.name} ${def.name}(으)로 교체` };
	}
	pushLog(state, `${character.name} ${def.name} 발매! ${def.icon} 굿즈 매출이 들어옵니다.`, "good");
	return { ok: true, message: `${character.name} ${def.name} 발매` };
}

/** 유행이 식은 라인을 재발매해 다시 1로 되돌린다. */
export function rerunGoods(state: GameState, lineId: string, now = Date.now()): GoodsResult {
	const line = state.goods.find((l) => l.id === lineId);
	if (!line) return { ok: false, message: "없는 굿즈예요." };
	const cost = rerunCost(state, line);
	if (state.money < cost) return { ok: false, message: "재발매비가 부족해요." };

	state.money -= cost;
	line.releasedAt = now;
	line.editions += 1;
	const character = state.characters[line.characterId];
	return {
		ok: true,
		message: `${character?.name ?? "굿즈"} ${goodsType(line.type).name} ${line.editions + 1}차 발매`,
	};
}

/** 라인을 완전히 접는다. (종류만 바꿀 때는 releaseGoods가 알아서 갈아탄다) */
export function closeGoods(state: GameState, lineId: string): GoodsResult {
	const index = state.goods.findIndex((l) => l.id === lineId);
	if (index < 0) return { ok: false, message: "없는 굿즈예요." };
	const [line] = state.goods.splice(index, 1);
	const character = line ? state.characters[line.characterId] : undefined;
	return { ok: true, message: `${character?.name ?? "굿즈"} 발매를 종료했어요.` };
}

/** 캐릭터가 사라지면(정리·경매 낙찰) 그 라인도 같이 접는다. */
export function pruneGoods(state: GameState): void {
	state.goods = state.goods.filter(
		(line) => state.characters[line.characterId] && state.owned.includes(line.characterId),
	);
}

/** 매 스텝 굿즈 매출을 지갑에 넣는다. */
export function tickGoods(state: GameState, dt: number, now = Date.now()): number {
	let total = 0;
	for (const line of state.goods) {
		const earned = lineRevenue(state, line, now) * dt;
		line.revenue += earned;
		total += earned;
	}
	return total;
}
