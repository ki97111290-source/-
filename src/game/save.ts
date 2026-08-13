import { makeRng } from "../core/rng";
import type { GameState } from "../core/types";
import { SAVE_VERSION, createNewGame, syncSlots } from "./state";
import { rollTrait } from "./traits";

/** 더 이상 존재하지 않는 과제 id (콤보 시스템 제거) */
const RETIRED_ACHIEVEMENTS = new Set(["combo-30", "combo-50"]);

function hashName(str: string): number {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

const KEY = "fandom-tycoon:save:v1";

export function loadGame(): { state: GameState; fresh: boolean } {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { state: createNewGame(), fresh: true };
		const parsed = JSON.parse(raw) as Partial<GameState>;
		const state = migrate(parsed);
		if (!state) return { state: createNewGame(), fresh: true };
		return { state, fresh: false };
	} catch (err) {
		console.warn("세이브를 읽지 못해 새 게임을 시작합니다.", err);
		return { state: createNewGame(), fresh: true };
	}
}

export function saveGame(state: GameState): boolean {
	try {
		state.lastTick = Date.now();
		localStorage.setItem(KEY, JSON.stringify(state));
		return true;
	} catch (err) {
		// 용량 초과가 대부분이다. 게임은 계속 굴러가야 하므로 조용히 실패를 알린다.
		console.warn("저장 실패", err);
		return false;
	}
}

export function clearSave(): void {
	localStorage.removeItem(KEY);
}

export function exportSave(state: GameState): string {
	return JSON.stringify(state);
}

export function importSave(text: string): GameState {
	const parsed = JSON.parse(text) as Partial<GameState>;
	const state = migrate(parsed);
	if (!state) throw new Error("세이브 형식이 올바르지 않아요.");
	return state;
}

/** 오래된/손상된 세이브를 현재 버전 형태로 맞춘다. */
function migrate(raw: Partial<GameState>): GameState | null {
	if (!raw || typeof raw !== "object" || !raw.characters || !Array.isArray(raw.owned)) return null;

	const base = createNewGame();
	const state: GameState = {
		...base,
		...raw,
		version: SAVE_VERSION,
		upgrades: { ...base.upgrades, ...(raw.upgrades ?? {}) },
		portfolio: raw.portfolio ?? {},
		characters: raw.characters,
		log: Array.isArray(raw.log) ? raw.log : [],
		slots: Array.isArray(raw.slots) ? raw.slots : [null],
	};

	// 참조 무결성: 사라진 캐릭터를 가리키는 슬롯/보유목록/포트폴리오 정리
	state.owned = state.owned.filter((id) => Boolean(state.characters[id]));
	state.slots = state.slots.map((id) => (id && state.characters[id] ? id : null));
	for (const id of Object.keys(state.portfolio)) {
		if (!state.characters[id]) delete state.portfolio[id];
	}
	if (state.auction && !state.characters[state.auction.characterId]) state.auction = null;

	for (const character of Object.values(state.characters)) {
		character.history = Array.isArray(character.history) ? character.history : [character.price];
		character.hype = Number.isFinite(character.hype) ? character.hype : 0;
		// v1 세이브에는 성격이 없다. 이름 기준으로 한 번만 정해 계속 같은 성격이 나오게 한다.
		if (!character.trait) character.trait = rollTrait(makeRng(hashName(character.id)));
	}

	state.achievements = Array.isArray(raw.achievements)
		? raw.achievements.filter((id) => !RETIRED_ACHIEVEMENTS.has(id))
		: [];
	state.fame = Number.isFinite(raw.fame) ? (raw.fame as number) : 0;
	state.auctionWins = Number.isFinite(raw.auctionWins) ? (raw.auctionWins as number) : 0;
	// 콤보 시스템이 사라졌으므로 예전 세이브의 흔적을 지운다.
	for (const key of ["combo", "bestCombo"]) {
		delete (state as unknown as Record<string, unknown>)[key];
	}
	state.coins = Number.isFinite(state.coins) ? state.coins : 0;
	state.lastTick = Number.isFinite(state.lastTick) ? state.lastTick : Date.now();
	syncSlots(state);
	return state;
}
