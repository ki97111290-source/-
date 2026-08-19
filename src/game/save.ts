import { makeRng } from "../core/rng";
import { SEASON_MODE, newSeasonBounds } from "../core/season";
import type { GameState, MetaState } from "../core/types";
import { pruneGoods } from "./goods";
import { emptyMeta } from "./season";
import { SAVE_VERSION, createNewGame, openStarterLine, syncSlots } from "./state";
import { rollTrait } from "./traits";

/** 더 이상 존재하지 않는 과제 id (콤보 제거 · 주차 커브 도입) */
const RETIRED_ACHIEVEMENTS = new Set(["combo-30", "combo-50", "income-100", "income-2000"]);

/**
 * 시즌 이전 세이브에는 meta가 없다. 그동안 업로드해 둔 캐릭터를 잃지 않도록
 * 현재 판에 있는 내 업로드 캐릭터를 보관함으로 옮겨준다.
 */
function normalizeMeta(raw: MetaState | undefined, state: GameState): MetaState {
	const meta = emptyMeta();
	if (raw && typeof raw === "object") {
		meta.trophies = (Array.isArray(raw.trophies) ? raw.trophies : []).map((t) => ({
			...t,
			// 팬심 도입 이전 트로피는 응원 수가 기록돼 있다
			fans: Number.isFinite(t.fans) ? t.fans : ((t as { cheers?: number }).cheers ?? 0),
		}));
		meta.roster = Array.isArray(raw.roster) ? raw.roster : [];
		meta.seasonsPlayed = Number.isFinite(raw.seasonsPlayed) ? raw.seasonsPlayed : 0;
		meta.bestFans = Number.isFinite(raw.bestFans)
			? raw.bestFans
			: // 팬심 도입 이전 세이브는 응원 수를 그대로 옮겨 담는다
				((raw as { bestCheers?: number }).bestCheers ?? 0);
		return meta;
	}
	for (const character of Object.values(state.characters ?? {})) {
		if (character.origin !== "user") continue;
		meta.roster.push({
			name: character.name,
			agency: character.agency,
			avatar: character.avatar,
			trait: character.trait,
		});
	}
	return meta;
}

/**
 * 시즌 범위를 맞춘다. 시즌 이전 세이브에는 아예 없고, local ↔ calendar 모드를
 * 바꾼 직후에는 예전 기준이 남아 있다. 둘 다 지금 기준으로 다시 잡아준다.
 * (온라인 전환 시 이 경로를 타고 모두가 달력 시즌으로 옮겨간다)
 */
function applySeasonBounds(state: GameState, raw: Partial<GameState>): void {
	const id = typeof raw.seasonId === "string" ? raw.seasonId : "";
	const isLocalId = id.startsWith("local-");
	const modeMatches = id !== "" && isLocalId === (SEASON_MODE === "local");
	const hasBounds = Number.isFinite(raw.seasonStartedAt) && Number.isFinite(raw.seasonEndsAt);

	if (modeMatches && hasBounds) {
		state.seasonId = id;
		state.seasonStartedAt = raw.seasonStartedAt as number;
		state.seasonEndsAt = raw.seasonEndsAt as number;
		return;
	}
	const bounds = newSeasonBounds();
	state.seasonId = bounds.id;
	state.seasonStartedAt = bounds.startMs;
	state.seasonEndsAt = bounds.endMs;
}

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
		goods: Array.isArray(raw.goods) ? raw.goods : [],
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

	state.meta = normalizeMeta(raw.meta, state);
	// 원 도입 이전 세이브는 coins에 잔액이 들어 있다
	const legacyMoney = (raw as { coins?: number }).coins;
	if (!Number.isFinite(raw.money) && Number.isFinite(legacyMoney)) {
		state.money = legacyMoney as number;
	}
	state.seasonFans = Number.isFinite(raw.seasonFans) ? (raw.seasonFans as number) : 0;
	state.seasonCheers = Number.isFinite(raw.seasonCheers)
		? (raw.seasonCheers as number)
		: (state.totalCheers ?? 0);
	applySeasonBounds(state, raw);
	state.achievements = Array.isArray(raw.achievements)
		? raw.achievements.filter((id) => !RETIRED_ACHIEVEMENTS.has(id))
		: [];
	state.fame = Number.isFinite(raw.fame) ? (raw.fame as number) : 0;
	state.auctionWins = Number.isFinite(raw.auctionWins) ? (raw.auctionWins as number) : 0;
	// 콤보 시스템이 사라졌으므로 예전 세이브의 흔적을 지운다.
	for (const key of ["combo", "bestCombo"]) {
		delete (state as unknown as Record<string, unknown>)[key];
	}
	state.money = Number.isFinite(state.money) ? state.money : 0;
	state.lastTick = Number.isFinite(state.lastTick) ? state.lastTick : Date.now();
	syncSlots(state);
	// 굿즈 도입 이전 세이브에는 라인이 없다. 그대로 두면 수입이 0이 되므로
	// 응원석의 첫 캐릭터에게 라인을 하나 열어주고 시작한다.
	pruneGoods(state);
	openStarterLine(state);
	return state;
}
