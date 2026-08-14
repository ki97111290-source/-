export type CharacterOrigin = "seed" | "user";

export type TraitId =
	| "gamer"
	| "idol"
	| "asmr"
	| "meme"
	| "dividend"
	| "rookie"
	| "veteran"
	| "legend";

export interface Character {
	id: string;
	name: string;
	agency: string;
	color: string;
	/** data URI (업로드 이미지) 또는 절차적으로 만든 SVG 아바타 */
	avatar: string;
	origin: CharacterOrigin;
	/** 캐릭터 성격. 수입·주가·배당·감정가에 서로 다르게 작용한다. */
	trait: TraitId;
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

export type UpgradeId =
	| "cheerPower"
	| "autoCheer"
	| "slot"
	| "fanCafe"
	| "broker"
	| "promo"
	| "hq"
	| "global"
	| "goods";

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

export type TrophyTierId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export interface Trophy {
	seasonId: string;
	tier: TrophyTierId;
	/** 그 시즌에 쌓은 응원 수 */
	cheers: number;
	awardedAt: number;
}

/** 시즌이 바뀌어도 남는 캐릭터 원본 */
export interface RosterEntry {
	name: string;
	agency: string;
	avatar: string;
	trait: TraitId;
}

/** 시즌 리셋을 넘어 계속 유지되는 데이터 */
export interface MetaState {
	trophies: Trophy[];
	/** 내가 업로드한 캐릭터 보관함. 매 시즌 다시 데뷔한다. */
	roster: RosterEntry[];
	seasonsPlayed: number;
	/** 역대 최고 시즌 응원 수 */
	bestCheers: number;
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

	/** 현재 시즌 id ("2026-08"). 바뀌면 시즌이 초기화된다. */
	seasonId: string;
	/** 이번 시즌에 쌓은 응원 수. 트로피 등급을 정한다. */
	seasonCheers: number;
	/** 시즌을 넘어 유지되는 데이터 */
	meta: MetaState;

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

	/** 달성한 도전 과제 id */
	achievements: string[];
	/** 도전 과제로 쌓는 명성. 전체 수입에 영구 보너스를 준다. */
	fame: number;
	/** 경매 낙찰 횟수 */
	auctionWins: number;

	log: LogEntry[];
	seed: number;
}
