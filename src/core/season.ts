/**
 * 시즌 기준.
 *
 * - "local"  : 가입(=플레이 시작) 시각을 기준으로 개인 시즌을 돌린다.
 *              서버가 없어 모두가 같은 날 시작할 수 없으므로 지금은 이쪽이다.
 * - "calendar": 한국시간(KST) 매달 1일 00:00에 시작해 그 달 마지막 날까지 운영하고,
 *              1일 00:00에 무조건 초기화한다. 온라인 서비스로 돌릴 때 이 값만 바꾸면 된다.
 *
 * 한국은 서머타임이 없어 UTC+9 고정으로 계산하면 정확하고, 플레이어 기기의
 * 시간대와 무관하게 전 세계가 같은 순간에 시즌이 넘어간다.
 */
export type SeasonMode = "local" | "calendar";
export const SEASON_MODE: SeasonMode = "local";

export const KST_OFFSET = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
/** local 모드에서 한 시즌의 길이 (달력 한 달에 해당) */
export const LOCAL_SEASON_DAYS = 30;

export interface SeasonBounds {
	id: string;
	startMs: number;
	endMs: number;
}

/** "2026-08" 형태의 달력 시즌 id */
export function seasonIdOf(ms: number): string {
	const kst = new Date(ms + KST_OFFSET);
	return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentSeasonId(now = Date.now()): string {
	return seasonIdOf(now);
}

/** 그 달력 시즌이 시작된 순간(ms epoch) = KST 1일 00:00 */
export function seasonStartMs(seasonId: string): number {
	const [year, month] = seasonId.split("-").map(Number);
	if (!year || !month) return 0;
	return Date.UTC(year, month - 1, 1, 0, 0, 0) - KST_OFFSET;
}

/** 다음 달 1일 00:00 KST (ms epoch) */
export function nextSeasonStartMs(now = Date.now()): number {
	const kst = new Date(now + KST_OFFSET);
	return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 1, 0, 0, 0) - KST_OFFSET;
}

function localSeasonId(startMs: number): string {
	const kst = new Date(startMs + KST_OFFSET);
	const y = kst.getUTCFullYear();
	const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
	const d = String(kst.getUTCDate()).padStart(2, "0");
	return `local-${y}-${m}-${d}`;
}

/**
 * 지금 시작하는 시즌의 범위.
 * calendar 모드는 이번 달 1일~다음 달 1일, local 모드는 지금부터 30일.
 */
export function newSeasonBounds(now = Date.now()): SeasonBounds {
	if (SEASON_MODE === "calendar") {
		const id = seasonIdOf(now);
		return { id, startMs: seasonStartMs(id), endMs: nextSeasonStartMs(now) };
	}
	return {
		id: localSeasonId(now),
		startMs: now,
		endMs: now + LOCAL_SEASON_DAYS * DAY_MS,
	};
}

/** 시즌 시작 기준 몇 주차인가 (0=1주차). 마지막 주는 3에서 멈춘다. */
export function seasonWeekOf(startMs: number, now = Date.now()): number {
	return Math.max(0, Math.min(3, Math.floor((now - startMs) / WEEK_MS)));
}

/** 해당 주차 해금까지 남은 시간(ms). 이미 열렸으면 0 */
export function weekUnlockInOf(startMs: number, week: number, now = Date.now()): number {
	return Math.max(0, startMs + week * WEEK_MS - now);
}

export function remainingOf(endMs: number, now = Date.now()): number {
	return Math.max(0, endMs - now);
}

/** 시즌 전체 길이 대비 진행률 0~1 */
export function progressOf(startMs: number, endMs: number, now = Date.now()): number {
	if (endMs <= startMs) return 0;
	return Math.max(0, Math.min(1, (now - startMs) / (endMs - startMs)));
}

/** 트로피 등에 붙는 시즌 이름 */
export function seasonLabel(seasonId: string): string {
	if (seasonId.startsWith("local-")) {
		const [, y, m, d] = seasonId.split("-");
		return `${y}.${m}.${d} 시즌`;
	}
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
