import type { Rng } from "../core/rng";
import type { Character, TraitId } from "../core/types";

export interface TraitDef {
	id: TraitId;
	name: string;
	icon: string;
	desc: string;
	/** 뽑힐 가중치 (클수록 흔하다) */
	weight: number;
	/** 응원석 초당 수입 배수 */
	income: number;
	/** 응원으로 오르는 인기도 배수 */
	popGain: number;
	/** 인기도가 식는 속도 배수 */
	decay: number;
	/** 주가 변동성 배수 */
	volatility: number;
	/** 배당 배수 */
	dividend: number;
	/** 경매 감정가 배수 */
	appraisal: number;
}

const BASE = {
	income: 1,
	popGain: 1,
	decay: 1,
	volatility: 1,
	dividend: 1,
	appraisal: 1,
} as const;

/**
 * 캐릭터마다 성격을 부여해 "누구를 응원석에 앉히고, 누구 주식을 사고,
 * 경매에서 누구에게 돈을 쓸지"가 서로 다른 판단이 되게 한다.
 */
export const TRAITS: readonly TraitDef[] = [
	{
		...BASE,
		id: "gamer",
		name: "게임형",
		icon: "🎮",
		desc: "긴 방송으로 꾸준히 번다. 수입 +30%",
		weight: 10,
		income: 1.3,
	},
	{
		...BASE,
		id: "idol",
		name: "아이돌형",
		icon: "🎤",
		desc: "응원 화력이 곧 인기. 인기도 상승 +45%, 수입 -10%",
		weight: 10,
		popGain: 1.45,
		income: 0.9,
	},
	{
		...BASE,
		id: "asmr",
		name: "힐링형",
		icon: "🌙",
		desc: "팬이 잘 떠나지 않는다. 인기도 감소 -60%",
		weight: 9,
		decay: 0.4,
	},
	{
		...BASE,
		id: "meme",
		name: "밈형",
		icon: "🔥",
		desc: "터질 땐 크게 터진다. 변동성 ×2.2, 감정가 -10%",
		weight: 8,
		volatility: 2.2,
		appraisal: 0.9,
	},
	{
		...BASE,
		id: "dividend",
		name: "굿즈형",
		icon: "💎",
		desc: "굿즈 매출이 주주에게. 배당 +55%",
		weight: 7,
		dividend: 1.55,
	},
	{
		...BASE,
		id: "rookie",
		name: "신인형",
		icon: "🌱",
		desc: "성장이 빠르지만 아직 작다. 인기도 상승 +70%, 수입 -20%",
		weight: 7,
		popGain: 1.7,
		income: 0.8,
	},
	{
		...BASE,
		id: "veteran",
		name: "베테랑",
		icon: "🎖",
		desc: "안정적이다. 변동성 -45%, 배당 +20%",
		weight: 6,
		volatility: 0.55,
		dividend: 1.2,
	},
	{
		...BASE,
		id: "legend",
		name: "레전드",
		icon: "👑",
		desc: "존재만으로 값이 나간다. 수입 +25%, 감정가 +45%, 배당 +25%",
		weight: 2,
		income: 1.25,
		appraisal: 1.45,
		dividend: 1.25,
	},
] as const;

const TOTAL_WEIGHT = TRAITS.reduce((sum, t) => sum + t.weight, 0);

export function rollTrait(rng: Rng): TraitId {
	let roll = rng() * TOTAL_WEIGHT;
	for (const trait of TRAITS) {
		roll -= trait.weight;
		if (roll <= 0) return trait.id;
	}
	return "gamer";
}

const FALLBACK = TRAITS[0] as TraitDef;

export function traitOf(character: Character): TraitDef {
	return TRAITS.find((t) => t.id === character.trait) ?? FALLBACK;
}

export function isRare(trait: TraitDef): boolean {
	return trait.weight <= 2;
}
