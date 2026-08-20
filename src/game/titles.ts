import type { GameState } from "../core/types";
import { pushLog } from "./state";

export interface TitleDef {
	id: string;
	name: string;
	icon: string;
	desc: string;
}

/**
 * 칭호는 트로피처럼 시즌을 넘어 남는다. 다만 트로피가 "얼마나 응원했나"라면
 * 칭호는 "무엇을 만들어 팔았나"에 붙는다. 높은 등급 키트로만 얻을 수 있다.
 */
export const TITLES: readonly TitleDef[] = [
	{
		id: "limited",
		name: "한정판 작가",
		icon: "🏅",
		desc: "한정판 100개를 완판시켰다",
	},
	{
		id: "unique",
		name: "유일본 작가",
		icon: "👑",
		desc: "세상에 하나뿐인 굿즈를 경매에서 낙찰시켰다",
	},
	{
		id: "soldout",
		name: "완판 신화",
		icon: "🔥",
		desc: "한 시즌에 굿즈를 20번 완판시켰다",
	},
] as const;

export function titleOf(id: string): TitleDef | undefined {
	return TITLES.find((t) => t.id === id);
}

export function hasTitle(state: GameState, id: string): boolean {
	return state.meta.titles.includes(id);
}

/** 칭호를 준다. 이미 있으면 아무 일도 없다. */
export function awardTitle(state: GameState, id: string): boolean {
	const def = titleOf(id);
	if (!def || hasTitle(state, id)) return false;
	state.meta.titles.push(id);
	pushLog(state, `${def.icon} 칭호 획득 — ${def.name}! ${def.desc}`, "good");
	return true;
}
