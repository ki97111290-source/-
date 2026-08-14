/**
 * 시즌은 한국 시간(KST) 기준 매달 1일 00:00에 바뀐다.
 * 한국은 서머타임이 없어 UTC+9 고정이므로 오프셋만 더하면 정확하다.
 * (브라우저의 로컬 시간대와 무관하게 같은 순간에 시즌이 넘어간다)
 */
export const KST_OFFSET = 9 * 60 * 60 * 1000;

/** "2026-08" 형태의 시즌 id */
export function seasonIdOf(ms: number): string {
	const kst = new Date(ms + KST_OFFSET);
	const year = kst.getUTCFullYear();
	const month = kst.getUTCMonth() + 1;
	return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentSeasonId(now = Date.now()): string {
	return seasonIdOf(now);
}

/** 그 시즌이 시작된 순간(ms epoch) */
export function seasonStartMs(seasonId: string): number {
	const [year, month] = seasonId.split("-").map(Number);
	if (!year || !month) return 0;
	return Date.UTC(year, month - 1, 1, 0, 0, 0) - KST_OFFSET;
}

/** 다음 시즌이 시작되는 순간(ms epoch) */
export function nextSeasonStartMs(now = Date.now()): number {
	const kst = new Date(now + KST_OFFSET);
	const year = kst.getUTCFullYear();
	const month = kst.getUTCMonth();
	return Date.UTC(year, month + 1, 1, 0, 0, 0) - KST_OFFSET;
}

/** 시즌 종료까지 남은 시간(ms) */
export function seasonRemaining(now = Date.now()): number {
	return Math.max(0, nextSeasonStartMs(now) - now);
}

/** 시즌 전체 길이 대비 진행률 0~1 */
export function seasonProgress(now = Date.now()): number {
	const start = seasonStartMs(seasonIdOf(now));
	const end = nextSeasonStartMs(now);
	if (end <= start) return 0;
	return Math.max(0, Math.min(1, (now - start) / (end - start)));
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 시즌 시작 기준 몇 주차인가 (0=1주차, 1=2주차, ...). 마지막 주는 3에서 멈춘다. */
export function seasonWeek(now = Date.now()): number {
	const start = seasonStartMs(seasonIdOf(now));
	return Math.max(0, Math.min(3, Math.floor((now - start) / WEEK_MS)));
}

/** 그 주차가 열리는 순간(ms epoch) */
export function weekStartMs(week: number, now = Date.now()): number {
	return seasonStartMs(seasonIdOf(now)) + week * WEEK_MS;
}

/** 해당 주차 해금까지 남은 시간(ms). 이미 열렸으면 0 */
export function weekUnlockIn(week: number, now = Date.now()): number {
	return Math.max(0, weekStartMs(week, now) - now);
}

export function seasonLabel(seasonId: string): string {
	const [year, month] = seasonId.split("-");
	return `${year}년 ${Number(month)}월 시즌`;
}

/** "12일 4시간 33분" 형태의 남은 시간 */
export function remainingLabel(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
	if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
	return `${minutes}분 ${seconds}초`;
}
