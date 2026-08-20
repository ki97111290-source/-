import type { UpgradeId } from "../core/types";

export const OWNER_ME = "나";

export const BALANCE = {
	/** 시뮬레이션 1스텝 길이(초) */
	step: 0.2,
	/** 응원석 하나가 만들어내는 기본 코인/초 */
	baseIncome: 1.2,
	/** 인기도가 수입에 반영되는 정도: 1 + pop * incomeFromPopularity */
	incomeFromPopularity: 0.008,
	/** 시즌 시작 시 지급하는 시드머니(원) */
	seedMoney: 1_000_000,
	/** 팬심은 응원 1회당 (1 + 인기도 × 이 값)만큼 쌓인다 */
	fanFromPopularity: 0.02,
	/** 응원 1회가 올려주는 인기도 */
	cheerPopularity: 0.9,
	/** 인기도 소프트캡. 클수록 인기도가 빨리 정체된다. */
	popularitySoftcap: 0.06,
	/** 한정판이 없을 때도 상시로 팔리는 비율. 방치해도 이만큼은 계속 들어온다. */
	goodsBaseShare: 0.7,
	/** 판매 성향 곡선의 양 끝 (burst 0 → min, burst 1 → max) */
	goodsRevenueMin: 0.8,
	goodsRevenueMax: 2.2,
	goodsPaceMin: 0.6,
	goodsPaceMax: 2.2,
	/** 굿즈 디자인 보관함 상한 (저장 용량 보호) */
	maxGoodsDesigns: 12,
	/** 한정판을 완판하면 키트값의 몇 배가 되는가 (적정가 기준) */
	goodsMarkup: 2.5,
	/** 가격 탄력성. 값을 올릴수록 비싸게 팔 때 더 안 팔린다. */
	goodsElasticity: 1.4,
	/** 남은 재고를 떨이로 넘길 때 받는 비율 */
	goodsSalvage: 0.4,
	/** 굿즈 공장 레벨당 굿즈 매출·배당 배수 */
	goodsFactoryPerLevel: 0.2,
	/** 굿즈 라인 최대 개수 */
	maxGoodsLines: 8,
	/** 새 라인 발매비 = 그 라인의 유행 만땅 매출 × 이 초 */
	goodsOpenSeconds: 1800,
	/** 재발매비 = 그 라인의 유행 만땅 매출 × 이 초 */
	goodsRerunSeconds: 480,
	/** 응원 1회가 주는 코인 = 그 캐릭터의 초당 수입 * 이 배수 */
	cheerBurst: 1.2,
	/** 업그레이드 없이도 돌아가는 기본 응원 속도(회/초) */
	baseCheerRate: 1,
	/** 응원 속도 업그레이드 레벨당 추가 회/초 */
	cheerRatePerLevel: 1.2,
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
	/** 4주차(결산 주간) 배당 배수 */
	finalWeekDividend: 1.5,
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

/** 업그레이드가 열리는 주차 (0=1주차부터, 1=2주차부터, 2=3주차부터) */
export type UpgradeTier = 0 | 1 | 2;

export const TIER_NAMES: Record<UpgradeTier, string> = {
	0: "1주차 · 인프라",
	1: "2주차 · 핵심 설비",
	2: "3주차 · 최종 설비",
};

export interface UpgradeDef {
	id: UpgradeId;
	name: string;
	desc: (level: number) => string;
	baseCost: number;
	growth: number;
	maxLevel: number;
	icon: string;
	tier: UpgradeTier;
}

/**
 * 한 시즌(한 달)에 걸쳐 열리도록 3단계로 나눴다.
 * 1주차에 인프라를 깔고, 2주차에 핵심 설비를 채우고, 3주차에 최종 설비까지
 * 끝내면 4주차에는 살 것이 없다 — 그때부터는 주식과 경매로 자산을 불린다.
 * 비용은 시뮬레이션으로 각 주차 안에 딱 맞게 끝나도록 맞췄다.
 */
export const UPGRADES: readonly UpgradeDef[] = [
	// ── 1주차: 인프라 ──────────────────────────────
	{
		id: "slot",
		name: "응원석 증설",
		icon: "🪑",
		tier: 0,
		baseCost: 15_000,
		growth: 5,
		maxLevel: 5,
		desc: (l) => `응원석 ${1 + l}자리`,
	},
	{
		id: "cheerPower",
		name: "응원 화력",
		icon: "🔦",
		tier: 0,
		baseCost: 2_000,
		growth: 1.62,
		maxLevel: 20,
		desc: (l) => `응원 1회 위력 ×${(1 + l * 0.5).toFixed(2)}`,
	},
	{
		id: "fanCafe",
		name: "팬카페 운영",
		icon: "☕",
		tier: 0,
		baseCost: 3_000,
		growth: 1.9,
		maxLevel: 11,
		desc: (l) => `오프라인 효율 ${Math.round((BALANCE.offlineBase + l * 0.05) * 100)}%`,
	},

	// ── 2주차: 핵심 설비 ───────────────────────────
	{
		id: "autoCheer",
		name: "응원 속도",
		icon: "🤖",
		tier: 1,
		baseCost: 10e6,
		growth: 1.23,
		maxLevel: 18,
		desc: (l) =>
			`초당 응원 ${(BALANCE.baseCheerRate + l * BALANCE.cheerRatePerLevel).toFixed(1)}회`,
	},
	{
		id: "promo",
		name: "홍보 대행사",
		icon: "📣",
		tier: 1,
		baseCost: 11e6,
		growth: 1.26,
		maxLevel: 15,
		desc: (l) => `인기도 상승 ×${(1 + l * 0.3).toFixed(2)}`,
	},
	{
		id: "broker",
		name: "전속 증권사",
		icon: "📈",
		tier: 1,
		baseCost: 8.5e6,
		growth: 1.25,
		maxLevel: 15,
		desc: (l) => `배당 +${l * 12}%, 수수료 -${Math.min(80, l * 6)}%`,
	},

	// ── 3주차: 최종 설비 ───────────────────────────
	{
		id: "hq",
		name: "팬덤 본부",
		icon: "🏛",
		tier: 2,
		baseCost: 2.4e9,
		growth: 1.36,
		maxLevel: 10,
		desc: (l) => `전체 수입 ×${(1 + l * 0.6).toFixed(2)}`,
	},
	{
		id: "global",
		name: "글로벌 송출",
		icon: "🛰",
		tier: 2,
		baseCost: 2.7e9,
		growth: 1.46,
		maxLevel: 8,
		desc: (l) => `인기도 한계 ×${(1 + l * 0.35).toFixed(2)}`,
	},
	{
		id: "goods",
		name: "굿즈 공장",
		icon: "🏭",
		tier: 2,
		baseCost: 2.1e9,
		growth: 1.36,
		maxLevel: 10,
		desc: (l) => `굿즈 매출·배당 ×${(1 + l * BALANCE.goodsFactoryPerLevel).toFixed(2)}`,
	},
] as const;

export function upgradeCost(def: UpgradeDef, level: number): number {
	return Math.floor(def.baseCost * def.growth ** level);
}

export function upgradeById(id: UpgradeId): UpgradeDef | undefined {
	return UPGRADES.find((u) => u.id === id);
}
