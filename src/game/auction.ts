import { type Rng, pick, range } from "../core/rng";
import type { AuctionState, GameState } from "../core/types";
import { BALANCE, OWNER_ME } from "./balance";
import { RIVAL_NAMES, appraise, createCharacter, pruneCharacters } from "./characters";
import { addMoney } from "./economy";
import { pruneGoods } from "./goods";
import { pushLog, syncSlots } from "./state";

const NO_BID = "유찰 대기";
/** 출품 수수료 */
const CONSIGN_FEE = 0.05;

const DEBUT_NAMES = [
	"미르",
	"아리",
	"소라",
	"청아",
	"두부",
	"레미",
	"별이",
	"차차",
	"유키",
	"단호박",
] as const;
const AGENCIES = ["네온스타", "말랑컴퍼니", "미드나잇", "무소속", "신인 데뷔조"] as const;

export function minimumBid(auction: AuctionState): number {
	return Math.ceil(auction.currentBid * (1 + BALANCE.minRaise));
}

/** 다음 경매를 준비한다. 후보가 없으면 신인을 데뷔시킨다. */
export function startAuction(state: GameState, rng: Rng): void {
	if (state.auction) return;

	const candidates = Object.values(state.characters).filter((c) => !state.owned.includes(c.id));
	let target = candidates.length > 0 ? pick(rng, candidates) : null;

	// 30% 확률로 아예 새 얼굴이 데뷔한다.
	if (!target || rng() < 0.3) {
		const name = `${pick(rng, DEBUT_NAMES)}${Math.floor(rng() * 90 + 10)}`;
		const rookie = createCharacter({
			name,
			agency: pick(rng, AGENCIES),
			origin: "seed",
			popularity: range(rng, 1, 8),
			holder: pick(rng, RIVAL_NAMES),
			rng,
		});
		state.characters[rookie.id] = rookie;
		target = rookie;
	}

	state.auction = makeAuction(state, target.id, false, rng);
	pushLog(
		state,
		`경매 시작: ${target.name} (시작가 ${fmtInt(state.auction.startPrice)}원)`,
		"market",
	);
}

/** 내 캐릭터를 경매에 내놓는다. */
export function consign(state: GameState, characterId: string, rng: Rng): string | null {
	if (state.auction) return "이미 진행 중인 경매가 있어요.";
	if (!state.owned.includes(characterId)) return "내가 가진 캐릭터가 아니에요.";
	if (state.owned.length <= 1) return "마지막 남은 캐릭터는 팔 수 없어요.";

	state.owned = state.owned.filter((id) => id !== characterId);
	state.slots = state.slots.map((id) => (id === characterId ? null : id));
	// 출품하면 그 캐릭터의 굿즈 발매도 함께 내린다.
	pruneGoods(state);
	state.auction = makeAuction(state, characterId, true, rng);

	const character = state.characters[characterId];
	pushLog(state, `${character?.name ?? "캐릭터"}을(를) 경매에 출품했습니다.`, "market");
	return null;
}

function makeAuction(
	state: GameState,
	characterId: string,
	consignedByPlayer: boolean,
	rng: Rng,
): AuctionState {
	const character = state.characters[characterId];
	const value = character ? appraise(character) : 200;
	const startPrice = Math.max(50, Math.floor(value * range(rng, 0.45, 0.65)));

	const rivalCount = 2 + Math.floor(rng() * 3);
	const names = [...RIVAL_NAMES].sort(() => rng() - 0.5).slice(0, rivalCount);

	return {
		characterId,
		consignedByPlayer,
		startPrice,
		currentBid: startPrice,
		leader: NO_BID,
		escrow: 0,
		bids: [],
		timeLeft: BALANCE.auctionDuration,
		rivals: names.map((name) => ({
			name,
			budget: value * range(rng, 0.6, 1.7),
			nextBidIn: range(rng, 2, 10),
		})),
	};
}

export function placePlayerBid(state: GameState, amount: number): string | null {
	const auction = state.auction;
	if (!auction) return "진행 중인 경매가 없어요.";
	if (auction.consignedByPlayer) return "내가 출품한 경매에는 입찰할 수 없어요.";
	if (auction.leader === OWNER_ME) return "이미 내가 최고가예요.";

	const bid = Math.floor(amount);
	const min = minimumBid(auction);
	if (bid < min) return `최소 ${fmtInt(min)}원 이상 불러야 해요.`;
	if (state.money < bid) return "돈이 부족해요.";

	state.money -= bid;
	auction.escrow = bid;
	auction.currentBid = bid;
	auction.leader = OWNER_ME;
	auction.bids.unshift({ bidder: OWNER_ME, amount: bid, at: Date.now() });
	// 스나이핑 방지: 막판 입찰이면 시간을 조금 연장한다.
	auction.timeLeft = Math.max(auction.timeLeft, 8);
	return null;
}

export function tickAuction(state: GameState, dt: number, rng: Rng): void {
	if (!state.auction) {
		state.nextAuctionIn -= dt;
		if (state.nextAuctionIn <= 0) {
			state.nextAuctionIn = BALANCE.auctionPeriod;
			startAuction(state, rng);
		}
		return;
	}

	const auction = state.auction;
	auction.timeLeft -= dt;

	for (const rival of auction.rivals) {
		rival.nextBidIn -= dt;
		if (rival.nextBidIn > 0) continue;
		rival.nextBidIn = range(rng, 3, 11);
		if (auction.leader === rival.name) continue;

		const next = Math.ceil(auction.currentBid * (1 + BALANCE.minRaise + rng() * 0.14));
		if (next > rival.budget) continue;

		// 내가 최고가였다면 묶였던 코인을 돌려준다.
		if (auction.leader === OWNER_ME && auction.escrow > 0) {
			state.money += auction.escrow;
			auction.escrow = 0;
			pushLog(state, `${rival.name}에게 밀렸습니다. 입찰금을 돌려받았어요.`, "bad");
		}
		auction.currentBid = next;
		auction.leader = rival.name;
		auction.bids.unshift({ bidder: rival.name, amount: next, at: Date.now() });
		if (auction.bids.length > 12) auction.bids.length = 12;
		auction.timeLeft = Math.max(auction.timeLeft, 6);
	}

	if (auction.timeLeft <= 0) settle(state);
}

function settle(state: GameState): void {
	const auction = state.auction;
	if (!auction) return;
	const character = state.characters[auction.characterId];
	const name = character?.name ?? "캐릭터";
	const hadBid = auction.leader !== NO_BID;

	if (auction.consignedByPlayer) {
		if (hadBid) {
			const net = auction.currentBid * (1 - CONSIGN_FEE);
			addMoney(state, net);
			if (character) character.holder = auction.leader;
			pushLog(state, `${name} 낙찰! ${fmtInt(net)}원을 정산받았습니다.`, "good");
		} else {
			// 유찰: 캐릭터를 그대로 돌려받는다.
			state.owned.push(auction.characterId);
			if (character) character.holder = OWNER_ME;
			pushLog(state, `${name}이(가) 유찰되어 돌아왔습니다.`, "info");
		}
	} else if (auction.leader === OWNER_ME) {
		state.owned.push(auction.characterId);
		if (character) character.holder = OWNER_ME;
		auction.escrow = 0;
		state.auctionWins += 1;
		pushLog(
			state,
			`축하합니다! ${name}을(를) ${fmtInt(auction.currentBid)}원에 낙찰받았습니다.`,
			"good",
		);
		autoSeat(state, auction.characterId);
	} else if (hadBid) {
		if (character) character.holder = auction.leader;
		pushLog(state, `${name}은(는) ${auction.leader}에게 넘어갔습니다.`, "info");
	} else {
		pushLog(state, `${name} 경매가 유찰됐습니다.`, "info");
	}

	state.auction = null;
	state.nextAuctionIn = BALANCE.auctionPeriod;
	pruneCharacters(state);
	pruneGoods(state);
}

/** 빈 응원석이 있으면 새 캐릭터를 바로 앉힌다. */
function autoSeat(state: GameState, characterId: string): void {
	syncSlots(state);
	const idx = state.slots.indexOf(null);
	if (idx >= 0) state.slots[idx] = characterId;
}

function fmtInt(n: number): string {
	return Math.floor(n).toLocaleString("ko-KR");
}
