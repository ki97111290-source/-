import { type Rng, gaussian, pick } from "../core/rng";
import { seasonWeek } from "../core/season";
import type { Character, GameState } from "../core/types";
import { BALANCE } from "./balance";
import { fairPrice } from "./characters";
import { addCoins } from "./economy";
import { pushLog, upgradeLevel } from "./state";
import { traitOf } from "./traits";

const HISTORY_LEN = 48;
const HISTORY_INTERVAL = 4; // 초

let historyTimer = 0;

export function tradeFee(state: GameState): number {
	return BALANCE.tradeFee * (1 - Math.min(0.8, upgradeLevel(state, "broker") * 0.06));
}

export function dividendMultiplier(state: GameState, now = Date.now()): number {
	const broker = 1 + upgradeLevel(state, "broker") * 0.12;
	const goods = 1 + upgradeLevel(state, "goods") * 0.35;
	// 4주차는 결산 주간이다. 더 살 설비가 없으니 배당으로 굴리라는 신호.
	const finalWeek = seasonWeek(now) >= 3 ? BALANCE.finalWeekDividend : 1;
	return broker * goods * finalWeek;
}

/** 시장에 남아 있는(내가 들고 있지 않은) 주식 수 */
export function floatingShares(state: GameState, character: Character): number {
	const held = state.portfolio[character.id]?.shares ?? 0;
	return Math.max(0, character.shares - held);
}

export function holdingValue(state: GameState, id: string): number {
	const holding = state.portfolio[id];
	const character = state.characters[id];
	if (!holding || !character) return 0;
	return holding.shares * character.price;
}

/** 최근 이력 대비 등락률 */
export function changeRate(character: Character): number {
	const first = character.history[0];
	if (!first || first <= 0) return 0;
	return character.price / first - 1;
}

/** 주가를 적정가로 끌어당기면서 노이즈를 얹는다. */
export function tickMarket(state: GameState, dt: number, rng: Rng): void {
	for (const character of Object.values(state.characters)) {
		const fair = fairPrice(character);
		const pull = (fair - character.price) * 0.12 * dt;
		const noise =
			character.price * gaussian(rng) * 0.012 * traitOf(character).volatility * Math.sqrt(dt);
		character.price = Math.max(1, character.price + pull + noise);
	}

	historyTimer += dt;
	if (historyTimer >= HISTORY_INTERVAL) {
		historyTimer = 0;
		for (const character of Object.values(state.characters)) {
			character.history.push(character.price);
			if (character.history.length > HISTORY_LEN) character.history.shift();
		}
	}

	rollEvents(state, dt, rng);
	tickDividend(state, dt);
}

const GOOD_EVENTS = [
	"합방 방송이 화제가 됐습니다",
	"쇼츠가 알고리즘을 탔습니다",
	"신곡 커버가 차트에 올랐습니다",
	"굿즈가 완판됐습니다",
	"대형 기획사와 협업이 발표됐습니다",
] as const;

const BAD_EVENTS = [
	"방송 사고로 시청자가 이탈했습니다",
	"장기 휴방을 공지했습니다",
	"경쟁 스트리머에게 화력을 뺏겼습니다",
	"굿즈 배송이 지연됐습니다",
] as const;

/** 캐릭터에게 무작위로 호재/악재가 터진다. */
function rollEvents(state: GameState, dt: number, rng: Rng): void {
	const characters = Object.values(state.characters);
	if (characters.length === 0) return;
	// 캐릭터 1명 기준 대략 3분에 한 번꼴
	const chance = dt / 180;
	for (const character of characters) {
		if (rng() > chance) continue;
		const good = rng() < 0.6;
		if (good) {
			const boost = 2 + rng() * 8;
			character.hype += boost;
			character.popularity += boost * 0.35;
			notify(state, character, `${character.name}: ${pick(rng, GOOD_EVENTS)}`, "good");
		} else {
			const hit = 1 + rng() * 5;
			character.hype = Math.max(-6, character.hype - hit);
			character.popularity = Math.max(0.5, character.popularity - hit * 0.3);
			notify(state, character, `${character.name}: ${pick(rng, BAD_EVENTS)}`, "bad");
		}
	}
}

/** 내가 관심 있는 캐릭터(보유/주주)일 때만 로그를 남긴다. */
function notify(state: GameState, character: Character, text: string, kind: "good" | "bad"): void {
	const interested =
		state.owned.includes(character.id) || (state.portfolio[character.id]?.shares ?? 0) > 0;
	if (interested) pushLog(state, text, kind);
}

function tickDividend(state: GameState, dt: number): void {
	state.nextDividendIn -= dt;
	if (state.nextDividendIn > 0) return;
	state.nextDividendIn += BALANCE.dividendPeriod;

	let total = 0;
	for (const [id, holding] of Object.entries(state.portfolio)) {
		const character = state.characters[id];
		if (!character || holding.shares <= 0) continue;
		// 인기가 식은 캐릭터는 배당도 줄어든다.
		const health = Math.min(1.5, 0.4 + character.popularity / 60);
		total +=
			holding.shares *
			character.price *
			BALANCE.dividendRate *
			health *
			traitOf(character).dividend;
	}
	total *= dividendMultiplier(state);
	if (total > 0) {
		addCoins(state, total);
		pushLog(
			state,
			`배당금 ${Math.floor(total).toLocaleString("ko-KR")} C가 입금됐습니다.`,
			"market",
		);
	}
}

export interface TradeResult {
	ok: boolean;
	message: string;
}

export function buyShares(state: GameState, id: string, qty: number): TradeResult {
	const character = state.characters[id];
	if (!character) return { ok: false, message: "없는 캐릭터예요." };
	const amount = Math.floor(qty);
	if (amount <= 0) return { ok: false, message: "수량을 확인해주세요." };

	const available = floatingShares(state, character);
	if (available <= 0) return { ok: false, message: "시장에 남은 주식이 없어요." };
	const buying = Math.min(amount, available);
	const cost = buying * character.price * (1 + tradeFee(state));
	if (state.coins < cost) return { ok: false, message: "코인이 부족해요." };

	state.coins -= cost;
	const holding = state.portfolio[id] ?? { shares: 0, avgCost: 0 };
	holding.avgCost =
		(holding.avgCost * holding.shares + character.price * buying) / (holding.shares + buying);
	holding.shares += buying;
	state.portfolio[id] = holding;

	// 매수 압력이 주가를 밀어 올린다.
	character.price *= 1 + (buying / character.shares) * 0.35;
	return { ok: true, message: `${character.name} ${buying.toLocaleString("ko-KR")}주 매수` };
}

export function sellShares(state: GameState, id: string, qty: number): TradeResult {
	const character = state.characters[id];
	const holding = state.portfolio[id];
	if (!character || !holding) return { ok: false, message: "보유하지 않은 종목이에요." };
	const selling = Math.min(Math.floor(qty), holding.shares);
	if (selling <= 0) return { ok: false, message: "팔 주식이 없어요." };

	const proceeds = selling * character.price * (1 - tradeFee(state));
	addCoins(state, proceeds);
	holding.shares -= selling;
	if (holding.shares <= 0) delete state.portfolio[id];

	character.price = Math.max(1, character.price * (1 - (selling / character.shares) * 0.35));
	return { ok: true, message: `${character.name} ${selling.toLocaleString("ko-KR")}주 매도` };
}
