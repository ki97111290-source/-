import { seasonWeek } from "../core/season";
import type { GameState, UpgradeId } from "../core/types";
import { TIER_NAMES, UPGRADES, upgradeCost } from "./balance";
import { BALANCE } from "./balance";
import { createCharacter } from "./characters";
import { pushLog, syncSlots, upgradeLevel } from "./state";

export interface ActionResult {
	ok: boolean;
	message: string;
}

/** 내 최애를 새로 등록한다. 등록 즉시 응원석/주식시장에 올라간다. */
export function uploadCharacter(
	state: GameState,
	input: { name: string; agency: string; avatar?: string },
): ActionResult {
	if (!input.name.trim()) return { ok: false, message: "이름을 입력해주세요." };
	if (state.meta.roster.length >= BALANCE.maxUserCharacters) {
		return {
			ok: false,
			message: `업로드는 최대 ${BALANCE.maxUserCharacters}명까지 가능해요.`,
		};
	}

	const character = createCharacter({
		name: input.name,
		agency: input.agency,
		avatar: input.avatar,
		origin: "user",
		popularity: 1.5,
	});
	state.characters[character.id] = character;
	state.owned.push(character.id);
	// 보관함에 남겨 두면 시즌이 바뀌어도 같은 캐릭터로 다시 데뷔한다.
	state.meta.roster.push({
		name: character.name,
		agency: character.agency,
		avatar: character.avatar,
		trait: character.trait,
	});

	syncSlots(state);
	const idx = state.slots.indexOf(null);
	if (idx >= 0) state.slots[idx] = character.id;

	pushLog(state, `${character.name} 데뷔! 응원석에 앉히면 인기도가 오릅니다.`, "good");
	return { ok: true, message: `${character.name}을(를) 등록했어요.` };
}

export function buyUpgrade(state: GameState, id: UpgradeId, now = Date.now()): ActionResult {
	const def = UPGRADES.find((u) => u.id === id);
	if (!def) return { ok: false, message: "없는 업그레이드예요." };
	if (seasonWeek(now) < def.tier) {
		return { ok: false, message: `${TIER_NAMES[def.tier]}에 열립니다.` };
	}
	const level = upgradeLevel(state, id);
	if (level >= def.maxLevel) return { ok: false, message: "이미 최대 레벨이에요." };

	const cost = upgradeCost(def, level);
	if (state.coins < cost) return { ok: false, message: "코인이 부족해요." };

	state.coins -= cost;
	state.upgrades[id] = level + 1;
	if (id === "slot") syncSlots(state);
	return { ok: true, message: `${def.name} Lv.${level + 1}` };
}

/** 응원석에 캐릭터를 앉힌다. 이미 다른 자리에 있으면 자리를 바꾼다. */
export function seat(
	state: GameState,
	slotIndex: number,
	characterId: string | null,
): ActionResult {
	syncSlots(state);
	if (slotIndex < 0 || slotIndex >= state.slots.length) {
		return { ok: false, message: "없는 자리예요." };
	}
	if (characterId && !state.owned.includes(characterId)) {
		return { ok: false, message: "내가 가진 캐릭터가 아니에요." };
	}

	if (characterId) {
		const prev = state.slots.indexOf(characterId);
		if (prev >= 0) state.slots[prev] = state.slots[slotIndex] ?? null;
	}
	state.slots[slotIndex] = characterId;
	return { ok: true, message: characterId ? "응원석을 배치했어요." : "자리를 비웠어요." };
}
