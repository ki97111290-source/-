export type Theme = "light" | "dark";

/** 테마 선택은 세이브와 별개로 보관한다. "처음부터 다시"로 지워지면 안 되니까. */
const KEY = "fandom-tycoon:theme";

function systemTheme(): Theme {
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** 사용자가 직접 고른 테마. 고른 적이 없으면 null(=시스템 설정을 따름) */
export function storedTheme(): Theme | null {
	try {
		const value = localStorage.getItem(KEY);
		return value === "light" || value === "dark" ? value : null;
	} catch {
		return null;
	}
}

/** 지금 실제로 보이는 테마 */
export function effectiveTheme(): Theme {
	return storedTheme() ?? systemTheme();
}

/**
 * 고른 적이 있을 때만 <html>에 도장을 찍는다.
 * 안 찍으면 CSS의 prefers-color-scheme 경로가 그대로 동작한다.
 */
export function initTheme(): void {
	const stored = storedTheme();
	if (stored) document.documentElement.dataset.theme = stored;
}

export function toggleTheme(): Theme {
	const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem(KEY, next);
	} catch {
		// 저장이 막혀도 이번 세션 동안은 적용된다
	}
	return next;
}
