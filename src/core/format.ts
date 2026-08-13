const UNITS = [
	{ v: 1e16, s: "경" },
	{ v: 1e12, s: "조" },
	{ v: 1e8, s: "억" },
	{ v: 1e4, s: "만" },
] as const;

/** 큰 수를 한국식 단위(만/억/조)로 줄여 표기한다. */
export function fmt(n: number): string {
	if (!Number.isFinite(n)) return "∞";
	const sign = n < 0 ? "-" : "";
	const abs = Math.abs(n);
	if (abs < 1000) {
		return sign + (abs < 10 ? trim(abs.toFixed(1)) : Math.floor(abs).toLocaleString("ko-KR"));
	}
	for (const u of UNITS) {
		if (abs >= u.v) {
			const scaled = abs / u.v;
			return sign + trim(scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)) + u.s;
		}
	}
	return sign + Math.floor(abs).toLocaleString("ko-KR");
}

/** 코인 표기 */
export function coin(n: number): string {
	return `${fmt(n)} C`;
}

/** 초당 수치 표기 */
export function rate(n: number): string {
	return `${fmt(n)}/초`;
}

export function pct(n: number, digits = 1): string {
	return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
}

/** 남은 시간(초)을 0:05 / 1:23:45 형태로 */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

/** 오프라인 경과처럼 사람이 읽는 기간 표기 */
export function duration(seconds: number): string {
	const s = Math.floor(seconds);
	if (s < 60) return `${s}초`;
	if (s < 3600) return `${Math.floor(s / 60)}분`;
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function trim(s: string): string {
	return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
