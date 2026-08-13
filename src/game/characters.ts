import { type Rng, range, uid } from "../core/rng";
import type { Character, GameState, TraitId } from "../core/types";
import { colorFor, makeAvatar } from "./avatar";
import { BALANCE, OWNER_ME } from "./balance";
import { rollTrait, traitOf } from "./traits";

interface SeedDef {
	name: string;
	agency: string;
	popularity: number;
}

/** 게임 시작 시 시장에 존재하는 NPC 캐릭터들 */
const SEEDS: readonly SeedDef[] = [
	{ name: "루미나", agency: "네온스타", popularity: 22 },
	{ name: "하늘", agency: "네온스타", popularity: 14 },
	{ name: "코코넛", agency: "말랑컴퍼니", popularity: 9 },
	{ name: "블랙캣", agency: "미드나잇", popularity: 31 },
	{ name: "포션", agency: "말랑컴퍼니", popularity: 6 },
	{ name: "은하", agency: "미드나잇", popularity: 18 },
	{ name: "라온", agency: "무소속", popularity: 4 },
	{ name: "시엘", agency: "네온스타", popularity: 27 },
	{ name: "모카", agency: "무소속", popularity: 11 },
	{ name: "네뷸라", agency: "미드나잇", popularity: 44 },
] as const;

export const RIVAL_NAMES: readonly string[] = [
	"익명의 큰손",
	"베테랑 컬렉터",
	"신규 투자자",
	"팬덤 연합",
	"해외 바이어",
	"데이터 트레이더",
	"소액 주주 모임",
	"전설의 뒷굽",
] as const;

/** 인기도를 적정 주가로 환산한다. 인기도가 높을수록 체감 증가폭이 커진다. */
export function fairPrice(character: Character): number {
	const base = 8 + character.popularity ** 1.22 * 1.35;
	return base * (1 + character.hype * 0.05);
}

/** 캐릭터 전체를 통째로 사고팔 때의 감정가 (경매 기준가) */
export function appraise(character: Character): number {
	return Math.max(
		120,
		fairPrice(character) * character.shares * 0.28 * traitOf(character).appraisal,
	);
}

export function createCharacter(init: {
	name: string;
	agency?: string;
	avatar?: string;
	origin?: Character["origin"];
	popularity?: number;
	holder?: string;
	trait?: TraitId;
	rng?: Rng;
}): Character {
	const name = init.name.trim().slice(0, 16) || "이름없는 신인";
	const popularity = init.popularity ?? 1;
	const character: Character = {
		id: uid("ch"),
		name,
		agency: (init.agency ?? "무소속").trim().slice(0, 16) || "무소속",
		color: colorFor(name),
		avatar: init.avatar ?? makeAvatar(name),
		origin: init.origin ?? "user",
		trait: init.trait ?? rollTrait(init.rng ?? Math.random),
		popularity,
		hype: 0,
		shares: BALANCE.baseShares,
		price: 0,
		history: [],
		holder: init.holder ?? OWNER_ME,
		createdAt: Date.now(),
	};
	character.price = fairPrice(character);
	character.history = [character.price];
	return character;
}

export function seedCharacters(rng: Rng): Character[] {
	return SEEDS.map((seed, i) =>
		createCharacter({
			name: seed.name,
			agency: seed.agency,
			origin: "seed",
			popularity: seed.popularity * range(rng, 0.85, 1.15),
			holder: RIVAL_NAMES[i % RIVAL_NAMES.length] ?? "익명의 큰손",
			rng,
		}),
	);
}

export function ownedCharacters(state: GameState): Character[] {
	return state.owned.map((id) => state.characters[id]).filter((c): c is Character => Boolean(c));
}

export function allCharacters(state: GameState): Character[] {
	return Object.values(state.characters);
}

export function isOwned(state: GameState, id: string): boolean {
	return state.owned.includes(id);
}

/** 내가 업로드한 캐릭터 수 */
export function userCharacterCount(state: GameState): number {
	return allCharacters(state).filter((c) => c.origin === "user").length;
}
