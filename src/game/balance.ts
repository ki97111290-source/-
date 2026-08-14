import type { UpgradeId } from "../core/types";

export const OWNER_ME = "나";

export const BALANCE = {
	/** 시뮬레이션 1스텝 길이(초) */
	step: 0.2,
	/** 응원석 하나가 만들어내는 기본 코인/초 */
	baseIncome: 1.2,
	/** 인기도가 수입에 반영되는 정도: 1 + pop * incomeFromPopularity */
	incomeFromPopularity: 0.02,
	/** 응원 1회가 올려주는 인기도 */
	cheerPopularity: 0.9,
	/** 응원 1회가 주는 코인 = 그 캐릭터의 초당 수입 * 이 배수 */
	cheerBurst: 2.5,
	/** 업그레이드 없이도 돌아가는 기본 응원 속도(회/초) */
	baseCheerRate: 1,
	/** 응원 속도 업그레이드 레벨당 추가 회/초 */
	cheerRatePerLevel: 0.6,
	/** 명성 1점당 전체 수입 보너스 */
	famePerPoint: 0.03,
	/** 인기도 자연 감소(초당 비율) */
	popularityDecay: 0.0009,
	/** 화제성 자연 감소(초당 비율) */
	hypeDecay: 0.02,
	/** 오프라인 기본 효율 */
	offlineBase: 0.35,
	/** 오프라인 인정 최대 시간(초) */
	offlineCap: 8 * 3600,
	/** 배당 주기(초) */
	dividendPeriod: 90,
	/** 배당률: 주가 * 이 비율 */
	dividendRate: 0.012,
	/** 경매 등장 주기(초) */
	auctionPeriod: 100,
	/** 경매 제한 시간(초) */
	auctionDuration: 45,
	/** 입찰 시 최소 인상률 */
	minRaise: 0.08,
	/** 거래 수수료 */
	tradeFee: 0.01,
	/** 캐릭터 1주 발행 기본 수 */
	baseShares: 1000,
	/** 시장에 유지하는 캐릭터 수 상한. 넘으면 관심 없는 캐릭터부터 정리한다. */
	marketSize: 26,
	/** 업로드 가능한 내 캐릭터 최대 수 (저장 용량 보호) */
	maxUserCharacters: 24,
	/** 로그 최대 보관 수 */
	maxLog: 60,
	maxSlots: 6,
} as const;

export interface UpgradeDef {
	id: UpgradeId;
	name: string;
	desc: (level: number) => string;
	baseCost: number;
	growth: number;
	maxLevel: number;
	icon: string;
}

export const UPGRADES: readonly UpgradeDef[] = [
	{
		id: "cheerPower",
		name: "응원 화력",
		icon: "🔦",
		baseCost: 60,
		growth: 1.18,
		maxLevel: 200,
		desc: (l) => `응원 1회 위력 ×${(1 + l * 0.35).toFixed(2)}`,
	},
	{
		id: "autoCheer",
		name: "응원 속도",
		icon: "🤖",
		baseCost: 240,
		growth: 1.26,
		maxLevel: 100,
		desc: (l) =>
			`초당 응원 ${(BALANCE.baseCheerRate + l * BALANCE.cheerRatePerLevel).toFixed(1)}회`,
	},
	{
		id: "slot",
		name: "응원석 증설",
		icon: "🪑",
		baseCost: 900,
		growth: 3.4,
		maxLevel: 5,
		desc: (l) => `응원석 ${1 + l}자리`,
	},
	{
		id: "fanCafe",
		name: "팬카페 운영",
		icon: "☕",
		baseCost: 500,
		growth: 1.5,
		maxLevel: 12,
		desc: (l) => `오프라인 효율 ${Math.round((BALANCE.offlineBase + l * 0.05) * 100)}%`,
	},
	{
		id: "broker",
		name: "전속 증권사",
		icon: "📈",
		baseCost: 1500,
		growth: 1.6,
		maxLevel: 20,
		desc: (l) => `배당 +${l * 8}%, 수수료 -${Math.min(80, l * 5)}%`,
	},
] as const;

export function upgradeCost(def: UpgradeDef, level: number): number {
	return Math.floor(def.baseCost * def.growth ** level);
}
