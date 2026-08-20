/**
 * 화면의 설명문을 켜고 끈다.
 * 처음 배울 때는 필요하지만 익숙해지면 자리만 차지하므로, 한 번에 끌 수 있게 했다.
 * 테마와 마찬가지로 세이브와 별개로 보관한다 — "처음부터 다시"로 지워지면 안 된다.
 */
const KEY = "fandom-tycoon:hints";

let shown: boolean | null = null;

export function hintsOn(): boolean {
	if (shown === null) {
		try {
			shown = localStorage.getItem(KEY) !== "off";
		} catch {
			shown = true;
		}
	}
	return shown;
}

export function toggleHints(): boolean {
	shown = !hintsOn();
	try {
		localStorage.setItem(KEY, shown ? "on" : "off");
	} catch {
		// 저장이 막혀도 이번 세션 동안은 적용된다
	}
	return shown;
}
