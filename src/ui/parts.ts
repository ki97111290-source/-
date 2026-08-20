import { html, raw } from "./dom";
import { hintsOn } from "./prefs";

/**
 * 화면마다 반복되는 조각들.
 * 공통 규칙은 하나다 — **지금 의미가 없는 것은 그리지 않는다.**
 * 값이 0이거나 배수가 1인 칸, 아직 잠긴 목록, 다 읽은 설명문이 화면을 채우면
 * 정작 봐야 할 내용이 아래로 밀려난다.
 */

/** 설명문. 헤더의 ? 버튼으로 끄면 사라진다. */
export function hint(markup: string): string {
	return hintsOn() ? html`<p class="hint">${raw(markup)}</p>` : "";
}

export interface Stat {
	label: string;
	value: string;
	/** false면 이 칸을 아예 그리지 않는다 (기본값이라 볼 필요가 없을 때) */
	show?: boolean;
	tone?: "up" | "down";
}

/** 스탯 줄. 볼 필요 없는 칸은 빼고 그린다. */
export function stats(items: Stat[]): string {
	const cells = items
		.filter((s) => s.show !== false)
		.map(
			(s) => html`<div class="stat">
				<span>${s.label}</span><b class="${s.tone ?? ""}">${s.value}</b>
			</div>`,
		)
		.join("");
	return cells ? html`<div class="statrow">${raw(cells)}</div>` : "";
}

/**
 * 잠긴 목록은 다음 하나만 보여준다.
 * 한 달 뒤에나 열릴 것까지 전부 깔아두면 화면이 자물쇠로 뒤덮인다.
 */
export function untilNextLocked<T>(items: readonly T[], unlocked: (item: T) => boolean): T[] {
	const open = items.filter(unlocked);
	const next = items.find((item) => !unlocked(item));
	return next ? [...open, next] : open;
}
