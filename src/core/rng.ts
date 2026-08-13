/** mulberry32 — 저장/복원 가능한 경량 시드 난수기 */
export function makeRng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type Rng = () => number;

export function pick<T>(rng: Rng, list: readonly T[]): T {
	return list[Math.floor(rng() * list.length)] as T;
}

export function range(rng: Rng, min: number, max: number): number {
	return min + rng() * (max - min);
}

/** 평균 0, 표준편차 1에 가까운 값 (Box-Muller) */
export function gaussian(rng: Rng): number {
	const u = Math.max(rng(), 1e-9);
	const v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function uid(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
