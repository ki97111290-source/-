import { makeRng } from "../core/rng";
import type { GameState, LogEntry, UpgradeId } from "../core/types";
import { BALANCE, OWNER_ME } from "./balance";
import { createCharacter, seedCharacters } from "./characters";

export const SAVE_VERSION = 1;

export function createNewGame(): GameState {
	const seed = (Math.random() * 2 ** 32) >>> 0;
	const rng = makeRng(seed);
	const now = Date.now();

	const state: GameState = {
		version: SAVE_VERSION,
		lastTick: now,
		startedAt: now,
		coins: 0,
		totalEarned: 0,
		totalCheers: 0,
		characters: {},
		owned: [],
		slots: [null],
		portfolio: {},
		upgrades: { cheerPower: 0, autoCheer: 0, slot: 0, fanCafe: 0, broker: 0 },
		auction: null,
		nextAuctionIn: 25,
		nextDividendIn: BALANCE.dividendPeriod,
		log: [],
		seed,
	};

	for (const character of seedCharacters(rng)) {
		state.characters[character.id] = character;
	}

	// 시작 캐릭터 하나는 손에 쥐여준다.
	const starter = createCharacter({
		name: "새싹",
		agency: "내 채널",
		origin: "seed",
		popularity: 2,
		holder: OWNER_ME,
	});
	state.characters[starter.id] = starter;
	state.owned.push(starter.id);
	state.slots[0] = starter.id;

	pushLog(state, "응원 룸이 열렸습니다. 최애를 응원해 코인을 모아보세요!", "good");
	pushLog(state, "‘캐릭터’ 탭에서 내 최애를 직접 업로드할 수 있어요.", "info");
	return state;
}

export function pushLog(state: GameState, text: string, kind: LogEntry["kind"] = "info"): void {
	state.log.unshift({ at: Date.now(), text, kind });
	if (state.log.length > BALANCE.maxLog) state.log.length = BALANCE.maxLog;
}

export function upgradeLevel(state: GameState, id: UpgradeId): number {
	return state.upgrades[id] ?? 0;
}

export function slotCount(state: GameState): number {
	return 1 + upgradeLevel(state, "slot");
}

/** 응원석 배열 길이를 업그레이드 레벨에 맞춘다. */
export function syncSlots(state: GameState): void {
	const want = Math.min(BALANCE.maxSlots, slotCount(state));
	while (state.slots.length < want) state.slots.push(null);
	if (state.slots.length > want) state.slots.length = want;
}

export function netWorth(state: GameState): number {
	let total = state.coins;
	for (const [id, holding] of Object.entries(state.portfolio)) {
		const character = state.characters[id];
		if (character) total += holding.shares * character.price;
	}
	return total;
}
