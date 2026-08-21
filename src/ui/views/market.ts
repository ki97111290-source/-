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
import { hint, stats } from "../parts";
import { watchOnly } from "../prefs";
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

	// 보유 중 → 응원 중 → 나머지 순. 스물여섯 줄을 스크롤해서 내 종목을 찾게 두지 않는다.
	const rank = (c: Character) =>
		watched(state, c) ? ((state.portfolio[c.id]?.shares ?? 0) > 0 ? 0 : 1) : 2;
	const all = Object.values(state.characters).sort(
		(a, b) => rank(a) - rank(b) || b.popularity - a.popularity,
	);

	// 관심 종목이 하나도 없거나 전부 관심 종목이면 걸러낼 것이 없다 — 버튼도 안 그린다.
	const mine = all.filter((c) => watched(state, c));
	const filterable = mine.length > 0 && mine.length < all.length;
	const only = filterable && watchOnly();
	const rows = (only ? mine : all).map((c) => row(state, c)).join("");

	return html`
		<section class="panel">
			${raw(
				stats([
					// 아직 주식을 안 샀으면 평가액·손익 칸은 0원만 보여주는 빈칸이다
					{ label: "평가액", value: won(value), show: entries.length > 0 },
					{
						label: "평가손익",
						value: won(profit),
						tone: profit >= 0 ? "up" : "down",
						show: entries.length > 0,
					},
					{ label: "다음 배당", value: `${Math.ceil(state.nextDividendIn)}초` },
					{
						label: "배당 배수",
						value: `×${dividendMultiplier(state).toFixed(2)}`,
						show: dividendMultiplier(state) > 1,
					},
				]),
			)}
			${raw(
				hint(`주가는 <b>인기도</b>를 따라갑니다. 완전 랜덤이 아니라 <b>적정가</b>(점선)로 계속 끌려가요 —
				점선 아래면 싸고, 위면 비쌉니다. 인기도를 올려주는 건 응원뿐이라
				<b>응원석에 앉힌 캐릭터만 ▲ 상승</b>합니다.
				(수수료 ${(tradeFee(state) * 100).toFixed(2)}%, ${BALANCE.dividendPeriod}초마다 배당)`),
			)}
			${raw(
				filterable
					? html`<div class="listbar">
							<span class="muted small">${only ? `관심 ${mine.length}종` : `전체 ${all.length}종`}</span>
							<button class="btn btn--sm btn--ghost" type="button" data-action="watch-only">
								${only ? `전체 ${all.length}종 보기` : `관심 ${mine.length}종만 보기`}
							</button>
						</div>`
					: "",
			)}
			<div class="rows">${raw(rows)}</div>
		</section>
	`;
}

/** 보유 중이거나 응원석에 앉혀 둔 종목. 내가 실제로 지켜보는 것들이다. */
function watched(state: GameState, c: Character): boolean {
	return (state.portfolio[c.id]?.shares ?? 0) > 0 || state.slots.includes(c.id);
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
						: html`<span class="muted small">잔량 ${fmt(available)}</span>`,
				)}
			</div>
			<div class="row__trade">
				<input
					id="qty-${c.id}"
					class="qty"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					value="${qty}"
					data-role="qty"
					data-id="${c.id}"
					aria-label="${c.name} 주문 수량"
				/>
				<button class="btn btn--sm btn--ghost" data-action="max-buy" data-id="${c.id}"
					title="보유 현금의 절반까지" aria-label="${c.name} 현금 절반으로 살 수 있는 최대 수량">50%</button>
				<button class="btn btn--sm" data-action="buy" data-id="${c.id}">매수</button>
				<button class="btn btn--sm btn--ghost" data-action="sell" data-id="${c.id}">매도</button>
			</div>
		</article>
	`;
}

/**
 * 적정가 대비 얼마나 싸고 비싼지. 주가는 결국 적정가로 끌려온다.
 * 적정가 근처면 아무것도 달지 않는다 — 스물여섯 줄에 전부 배지를 달면
 * 정작 눈에 띄어야 할 저평가·고평가가 묻힌다.
 */
function valueTag(gap: number): string {
	if (gap <= -0.03) return html`<span class="sig sig--cheap">저평가 ${pct(gap, 0)}</span>`;
	if (gap >= 0.03) return html`<span class="sig sig--rich">고평가 ${pct(gap, 0)}</span>`;
	return "";
}
