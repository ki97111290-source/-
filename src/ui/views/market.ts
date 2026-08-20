import { fmt, pct, won } from "../../core/format";
import type { Character, GameState } from "../../core/types";
import { BALANCE } from "../../game/balance";
import { fairPrice } from "../../game/characters";
import {
	changeRate,
	dividendMultiplier,
	floatingShares,
	holdingValue,
	popularityTrend,
	tradeFee,
	valuation,
} from "../../game/market";
import { isRare, traitOf } from "../../game/traits";
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
				<div class="stat"><span>평가액</span><b>${won(value)}</b></div>
				<div class="stat"><span>평가손익</span><b class="${profit >= 0 ? "up" : "down"}">${won(profit)}</b></div>
				<div class="stat"><span>다음 배당</span><b>${Math.ceil(state.nextDividendIn)}초</b></div>
				<div class="stat"><span>배당 배수</span><b>×${dividendMultiplier(state).toFixed(2)}</b></div>
			</div>
			<p class="hint">
				주가는 <b>인기도</b>를 따라갑니다. 완전 랜덤이 아니라 <b>적정가</b>(점선)로 계속 끌려가요 —
				점선 아래면 싸고, 위면 비쌉니다. 인기도를 올려주는 건 응원뿐이라
				<b>응원석에 앉힌 캐릭터만 ▲ 상승</b>합니다.
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
	const gap = valuation(c);
	// 초당 변화는 너무 작아 눈에 안 띈다. 분당으로 보여준다.
	const trend = popularityTrend(state, c) * 60;

	return html`
		<article class="row" style="--accent:${c.color}">
			<img class="ava" src="${c.avatar}" alt="" />
			<div class="row__name">
				<b>${c.name}</b>
				<span class="muted">
					<span class="trait ${isRare(traitOf(c)) ? "trait--rare" : ""}">${traitOf(c).icon}</span>
					🔥 ${fmt(c.popularity)}
					<span class="sig ${trend > 0 ? "sig--up" : "sig--down"}">${trend > 0 ? "▲" : "▼"} ${fmt(Math.abs(trend))}/분</span>
					${raw(valueTag(gap))}
				</span>
			</div>
			<div class="row__spark">${raw(sparkline(c.history, change >= 0 ? "var(--good)" : "var(--bad)", fairPrice(c)))}</div>
			<div class="row__price">
				<b>${won(c.price)}</b>
				<span class="${change >= 0 ? "up" : "down"}">${pct(change)}</span>
			</div>
			<div class="row__hold">
				${raw(
					mine > 0
						? html`<b>${fmt(mine)}주</b><span class="${pnl >= 0 ? "up" : "down"}">${won(pnl)}</span>`
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

/** 적정가 대비 얼마나 싸고 비싼지. 주가는 결국 적정가로 끌려온다. */
function valueTag(gap: number): string {
	if (gap <= -0.03) return html`<span class="sig sig--cheap">저평가 ${pct(gap, 0)}</span>`;
	if (gap >= 0.03) return html`<span class="sig sig--rich">고평가 ${pct(gap, 0)}</span>`;
	return html`<span class="sig muted">적정가</span>`;
}
