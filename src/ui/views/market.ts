import { coin, fmt, pct } from "../../core/format";
import type { Character, GameState } from "../../core/types";
import { BALANCE } from "../../game/balance";
import {
	changeRate,
	dividendMultiplier,
	floatingShares,
	holdingValue,
	tradeFee,
} from "../../game/market";
import { html, raw, sparkline } from "../dom";
import { ui } from "../uiState";

export function renderMarket(state: GameState): string {
	const entries = Object.entries(state.portfolio);
	let value = 0;
	let cost = 0;
	for (const [id, holding] of entries) {
		value += holdingValue(state, id);
		cost += holding.avgCost * holding.shares;
	}
	const profit = value - cost;

	const rows = Object.values(state.characters)
		.sort((a, b) => b.popularity - a.popularity)
		.map((c) => row(state, c))
		.join("");

	return html`
		<section class="panel">
			<div class="statrow">
				<div class="stat"><span>평가액</span><b>${coin(value)}</b></div>
				<div class="stat"><span>평가손익</span><b class="${profit >= 0 ? "up" : "down"}">${coin(profit)}</b></div>
				<div class="stat"><span>다음 배당</span><b>${Math.ceil(state.nextDividendIn)}초</b></div>
				<div class="stat"><span>배당 배수</span><b>×${dividendMultiplier(state).toFixed(2)}</b></div>
			</div>
			<p class="hint">
				주가는 인기도를 따라갑니다. 응원해서 인기를 올린 뒤 주식을 모으면 배당이 커져요.
				(수수료 ${(tradeFee(state) * 100).toFixed(2)}%, ${BALANCE.dividendPeriod}초마다 배당)
			</p>
			<div class="rows">${raw(rows)}</div>
		</section>
	`;
}

function row(state: GameState, c: Character): string {
	const holding = state.portfolio[c.id];
	const change = changeRate(c);
	const qty = ui.qty[c.id] ?? "10";
	const available = floatingShares(state, c);
	const mine = holding?.shares ?? 0;
	const pnl = holding ? (c.price - holding.avgCost) * holding.shares : 0;

	return html`
		<article class="row" style="--accent:${c.color}">
			<img class="ava" src="${c.avatar}" alt="" />
			<div class="row__name">
				<b>${c.name}</b>
				<span class="muted">${c.agency} · 🔥 ${fmt(c.popularity)}</span>
			</div>
			<div class="row__spark">${raw(sparkline(c.history, change >= 0 ? "#4ade80" : "#f87171"))}</div>
			<div class="row__price">
				<b>${coin(c.price)}</b>
				<span class="${change >= 0 ? "up" : "down"}">${pct(change)}</span>
			</div>
			<div class="row__hold">
				${raw(
					mine > 0
						? html`<b>${fmt(mine)}주</b><span class="${pnl >= 0 ? "up" : "down"}">${coin(pnl)}</span>`
						: `<span class="muted">미보유</span><span class="muted">잔량 ${fmt(available)}</span>`,
				)}
			</div>
			<div class="row__trade">
				<input
					id="qty-${c.id}"
					class="qty"
					type="number"
					inputmode="numeric"
					min="1"
					step="1"
					value="${qty}"
					data-role="qty"
					data-id="${c.id}"
					aria-label="${c.name} 주문 수량"
				/>
				<button class="btn btn--sm" data-action="buy" data-id="${c.id}">매수</button>
				<button class="btn btn--sm btn--ghost" data-action="sell" data-id="${c.id}">매도</button>
			</div>
		</article>
	`;
}
