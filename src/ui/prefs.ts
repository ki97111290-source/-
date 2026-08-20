/**
 * 화면 취향값. 세이브와 따로 보관한다 —
 * "처음부터 다시"로 지워지면 안 되고, 다음에 켤 때도 그대로 남아야 한다.
 */

const cache = new Map<string, boolean>();

function read(name: string, fallback: boolean): boolean {
	const hit = cache.get(name);
	if (hit !== undefined) return hit;
	let value = fallback;
	try {
		const saved = localStorage.getItem(`fandom-tycoon:${name}`);
		if (saved !== null) value = saved === "on";
	} catch {
		// 저장소가 막혀 있으면 기본값으로 간다
	}
	cache.set(name, value);
	return value;
}

function flip(name: string, fallback: boolean): boolean {
	const next = !read(name, fallback);
	cache.set(name, next);
	try {
		localStorage.setItem(`fandom-tycoon:${name}`, next ? "on" : "off");
	} catch {
		// 저장이 막혀도 이번 세션 동안은 적용된다
	}
	return next;
}

/**
 * 설명문을 보여줄지. 처음 배울 때는 필요하지만 익숙해지면 자리만 차지하므로
 * 헤더의 💬 버튼으로 한 번에 끌 수 있게 했다.
 */
export function hintsOn(): boolean {
	return read("hints", true);
}

export function toggleHints(): boolean {
	return flip("hints", true);
}

/**
 * 주식 탭에서 관심 종목(보유 중이거나 응원석에 앉은 것)만 볼지.
 * 기본은 꺼짐 — 처음 온 사람에게는 살 수 있는 종목이 다 보여야 한다.
 */
export function watchOnly(): boolean {
	return read("watch", false);
}

export function toggleWatchOnly(): boolean {
	return flip("watch", false);
}
