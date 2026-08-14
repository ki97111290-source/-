import { makeRng } from "../core/rng";
import { type SeasonBounds, newSeasonBounds } from "../core/season";
import type { GameState, LogEntry, MetaState, UpgradeId } from "../core/types";
import { BALANCE, OWNER_ME } from "./balance";
import { createCharacter, seedCharacters } from "./characters";
import { emptyMeta } from "./season";

export const SAVE_VERSION = 3;

/**
 * 새 시즌판을 깐다. meta(트로피·업로드 캐릭터 보관함)는 그대로 넘겨받고,
 * 코인·업그레이드·주식·인기도 같은 시즌 자산은 전부 처음부터 시작한다.
 */
export function createNewGame(
	meta: MetaState = emptyMeta(),
	bounds: SeasonBounds = newSeasonBounds(),
	now: number = Date.now(),
): GameState {
	const seed = (Math.random() * 2 ** 32) >>> 0;
	const rng = makeRng(seed);

	const state: GameState = {
		version: SAVE_VERSION,
		lastTick: now,
		startedAt: now,
		seasonId: bounds.id,
		seasonStartedAt: bounds.startMs,
		seasonEndsAt: bounds.endMs,
		seasonCheers: 0,
		meta,
		coins: 0,
		totalEarned: 0,
		totalCheers: 0,
		characters: {},
		owned: [],
		slots: [null],
		portfolio: {},
		upgrades: {
			cheerPower: 0,
			autoCheer: 0,
			slot: 0,
			fanCafe: 0,
			broker: 0,
			promo: 0,
			hq: 0,
			global: 0,
			goods: 0,
		},
		auction: null,
		nextAuctionIn: 25,
		nextDividendIn: BALANCE.dividendPeriod,
		achievements: [],
		fame: 0,
		auctionWins: 0,
		log: [],
		seed,
	};

	for (const character of seedCharacters(rng)) {
		state.characters[character.id] = character;
	}

	// 내가 업로드해 둔 캐릭터들은 매 시즌 다시 데뷔한다.
	for (const entry of meta.roster) {
		const character = createCharacter({
			name: entry.name,
			agency: entry.agency,
			avatar: entry.avatar,
			trait: entry.trait,
			origin: "user",
			popularity: 1.5,
			holder: OWNER_ME,
			rng,
		});
		state.characters[character.id] = character;
		state.owned.push(character.id);
	}

	// 업로드해 둔 캐릭터가 없을 때만 기본 캐릭터를 준다.
	if (state.owned.length === 0) {
		const starter = createCharacter({
			name: "새싹",
			agency: "내 채널",
			origin: "seed",
			popularity: 2,
			holder: OWNER_ME,
			trait: "rookie",
			rng,
		});
		state.characters[starter.id] = starter;
		state.owned.push(starter.id);
	}
	state.slots[0] = state.owned[0] ?? null;

	pushLog(state, "응원 룸이 열렸습니다. 켜두기만 하면 응원이 알아서 돌아가요.", "good");
	if (meta.roster.length > 0) {
		pushLog(state, `보관함의 캐릭터 ${meta.roster.length}명이 다시 데뷔했습니다.`, "info");
	} else {
		pushLog(state, "‘캐릭터’ 탭에서 내 최애를 직접 업로드할 수 있어요.", "info");
	}
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
