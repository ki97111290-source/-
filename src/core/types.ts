export type CharacterOrigin = "seed" | "user";

export interface Character {
	id: string;
	name: string;
	agency: string;
	color: string;
	/** data URI (업로드 이미지) 또는 절차적으로 만든 SVG 아바타 */
	avatar: string;
	origin: CharacterOrigin;
	/** 장기 인기도. 응원으로 오르고 시간이 지나면 서서히 식는다. */
	popularity: number;
	/** 단기 화제성. 이슈가 터지면 급등하고 빠르게 사라진다. */
	hype: number;
	/** 발행 주식 수 */
	shares: number;
	/** 현재 주가 */
	price: number;
	/** 스파크라인용 최근 주가 */
	history: number[];
	/** 소유자 표시용 이름. 내가 가진 캐릭터는 OWNER_ME */
	holder: string;
	createdAt: number;
}

export type UpgradeId = "cheerPower" | "autoCheer" | "slot" | "fanCafe" | "broker";

export interface Holding {
	shares: number;
	/** 평균 매입 단가 */
	avgCost: number;
}

export interface AuctionBid {
	bidder: string;
	amount: number;
	at: number;
}

export interface AuctionState {
	characterId: string;
	/** 내가 출품한 경매인가 (낙찰금이 나에게 들어온다) */
	consignedByPlayer: boolean;
	startPrice: number;
	currentBid: number;
	leader: string;
	/** 내가 최고가일 때 묶여 있는 코인 (밀리면 돌려받는다) */
	escrow: number;
	bids: AuctionBid[];
	/** 남은 시간(초) */
	timeLeft: number;
	/** NPC들의 예산 상한 */
	rivals: { name: string; budget: number; nextBidIn: number }[];
}

export interface LogEntry {
	at: number;
	text: string;
	kind: "info" | "good" | "bad" | "market";
}

export interface GameState {
	version: number;
	/** 저장 시각(ms). 오프라인 보상 계산에 쓴다. */
	lastTick: number;
	startedAt: number;

	coins: number;
	totalEarned: number;
	totalCheers: number;

	characters: Record<string, Character>;
	/** 내가 소유한 캐릭터 id */
	owned: string[];
	/** 응원석. null이면 빈 자리 */
	slots: (string | null)[];
	/** 보유 주식 */
	portfolio: Record<string, Holding>;

	upgrades: Record<UpgradeId, number>;

	auction: AuctionState | null;
	/** 다음 경매까지 남은 시간(초) */
	nextAuctionIn: number;
	/** 다음 배당까지 남은 시간(초) */
	nextDividendIn: number;

	log: LogEntry[];
	seed: number;
}
