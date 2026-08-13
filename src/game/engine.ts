import { type Rng, makeRng } from "../core/rng";
import type { GameState } from "../core/types";
import { checkAchievements } from "./achievements";
import { tickAuction } from "./auction";
import { BALANCE } from "./balance";
import { addCoins, incomePerSecond, offlineEfficiency, tickEconomy } from "./economy";
import { tickMarket } from "./market";
import { saveGame } from "./save";
import { syncSlots } from "./state";

const MAX_FRAME = 0.25;
/** 이보다 오래 프레임이 멈췄으면 탭이 백그라운드였다고 보고 요약 정산한다. */
const IDLE_GAP = 3;
const AUTOSAVE = 5;

export class Engine {
	readonly state: GameState;
	private rng: Rng;
	private acc = 0;
	private saveTimer = 0;
	private last = performance.now();
	private running = false;

	constructor(state: GameState) {
		this.state = state;
		this.rng = makeRng((state.seed ^ Date.now()) >>> 0);
		syncSlots(state);
	}

	start(onFrame: () => void): void {
		if (this.running) return;
		this.running = true;
		this.last = performance.now();

		const loop = (now: number) => {
			if (!this.running) return;
			const dt = (now - this.last) / 1000;
			this.last = now;
			this.advance(dt);
			onFrame();
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	}

	stop(): void {
		this.running = false;
	}

	private advance(dt: number): void {
		if (!Number.isFinite(dt) || dt <= 0) return;

		if (dt > IDLE_GAP) {
			// 백그라운드 탭: 매 스텝 돌리는 대신 오프라인 효율로 한 번에 정산한다.
			const seconds = Math.min(dt, BALANCE.offlineCap);
			addCoins(this.state, incomePerSecond(this.state) * seconds * offlineEfficiency(this.state));
			this.step(BALANCE.step);
			this.persist(AUTOSAVE);
			return;
		}

		this.acc += Math.min(dt, MAX_FRAME);
		let guard = 0;
		while (this.acc >= BALANCE.step && guard++ < 10) {
			this.acc -= BALANCE.step;
			this.step(BALANCE.step);
		}
		this.persist(dt);
	}

	private step(dt: number): void {
		tickEconomy(this.state, dt);
		tickMarket(this.state, dt, this.rng);
		tickAuction(this.state, dt, this.rng);
		checkAchievements(this.state);
	}

	private persist(dt: number): void {
		this.saveTimer += dt;
		if (this.saveTimer < AUTOSAVE) return;
		this.saveTimer = 0;
		saveGame(this.state);
	}

	saveNow(): boolean {
		return saveGame(this.state);
	}
}
