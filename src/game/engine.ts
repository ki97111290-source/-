import { type Rng, makeRng } from "../core/rng";
import { seasonLabel } from "../core/season";
import type { GameState } from "../core/types";
import { checkAchievements } from "./achievements";
import { tickAuction } from "./auction";
import { BALANCE } from "./balance";
import { addMoney, cheer, cheersPerSlot, occupiedSlots, tickEconomy } from "./economy";
import { tickGoods, tickGoodsAuctions } from "./goods";
import { tickMarket } from "./market";
import { saveGame } from "./save";
import { type SeasonReport, rolloverIfNeeded, tierOf } from "./season";
import { createNewGame, pushLog, syncSlots } from "./state";

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
	/** 시즌이 넘어갔을 때 UI에 알리는 콜백 */
	onSeasonEnd: ((report: SeasonReport) => void) | null = null;

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
			// 브라우저가 백그라운드 탭의 프레임을 늦춘 경우다. 페이지는 켜져 있으므로
			// 감산 없이 100% 정산한다. (효율이 깎이는 건 페이지를 닫았을 때뿐)
			const seconds = Math.min(dt, BALANCE.offlineCap);
			// 라인별 누적 매출까지 함께 남도록 굿즈 정산 경로를 그대로 쓴다.
			addMoney(this.state, tickGoods(this.state, seconds));
			this.growPopularity(seconds);
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

	/** 프레임이 오래 멈춘 구간의 응원(팬심·인기도)을 한 번에 반영한다. */
	private growPopularity(seconds: number): void {
		const perSlot = cheersPerSlot(this.state) * seconds;
		if (perSlot <= 0) return;
		// 응원은 돈을 만들지 않으므로 그대로 한 번에 넣어주면 된다.
		for (const id of occupiedSlots(this.state)) cheer(this.state, id, perSlot);
	}

	private step(dt: number): void {
		tickEconomy(this.state, dt);
		// 유일본 경매는 시계로 돈다. 페이지를 닫아둬도 그동안 입찰이 들어와 있다.
		tickGoodsAuctions(this.state);
		tickMarket(this.state, dt, this.rng);
		tickAuction(this.state, dt, this.rng);
		checkAchievements(this.state);
		this.checkSeason();
	}

	/** 켜둔 채로 한국시간 1일 00:00을 넘기면 그 자리에서 시즌이 바뀐다. */
	private checkSeason(): void {
		const report = rolloverIfNeeded(this.state, createNewGame);
		if (!report) return;

		const fans = Math.floor(report.fans).toLocaleString("ko-KR");
		if (report.trophy) {
			const tier = tierOf(report.trophy.tier);
			pushLog(
				this.state,
				`${seasonLabel(report.endedSeason)} 종료 — ${tier.icon} ${tier.name} 트로피 획득! (시즌 팬심 ${fans})`,
				"good",
			);
		} else {
			pushLog(
				this.state,
				`${seasonLabel(report.endedSeason)} 종료 — 시즌 팬심 ${fans}, 트로피 기준에 닿지 못했어요.`,
				"info",
			);
		}
		this.onSeasonEnd?.(report);
		this.saveNow();
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
