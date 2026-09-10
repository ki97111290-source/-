import { clock, fmt, won } from "../../core/format";
import type { GameState } from "../../core/types";
import { minimumBid } from "../../game/auction";
import { BALANCE, OWNER_ME } from "../../game/balance";
import { appraise } from "../../game/characters";
import { isRare, traitOf } from "../../game/traits";
import { html, raw } from "../dom";
import { ui } from "../uiState";

/**
 * 매물이 없을 때는 화면 한 칸을 통째로 비워 두지 않고 한 줄만 남긴다.
 * 100초에 한 번 열리는 일이라, 없을 때 크게 알릴 이유가 없다.
 */
export function renderAuction(state: GameState): string {
	const auction = state.auction;
	if (!auction) {
		return html`
			<div class="listbar">
				<span class="muted small">🔨 다음 경매 매물 ${clock(state.nextAuctionIn)} 후</span>
				<span class="muted small">내 캐릭터를 출품하면 바로 열려요</span>
			</div>
		`;
	}

	const character = state.characters[auction.characterId];
	if (!character)
		return '<section class="panel"><p class="muted">매물 정보를 불러오지 못했어요.</p></section>';

	const min = minimumBid(auction);
	const leading = auction.leader === OWNER_ME;
	const progress = Math.max(0, Math.min(1, auction.timeLeft / BALANCE.auctionDuration));

	const bids = auction.bids
		.slice(0, 8)
		.map(
			(b) => html`<li class="${b.bidder === OWNER_ME ? "bid bid--me" : "bid"}">
				<span>${b.bidder}</span><b>${won(b.amount)}</b>
			</li>`,
		)
		.join("");

	return html`
		<section class="panel">
			<article class="lot" style="--accent:${character.color}">
				<img class="ava ava--xl" src="${character.avatar}" alt="${character.name}" />
				<div class="lot__info">
					<h2>${character.name}</h2>
					<p class="muted">
						<span class="trait ${isRare(traitOf(character)) ? "trait--rare" : ""}">
							${traitOf(character).icon} ${traitOf(character).name}
						</span>
						${character.agency} · 현 소유자 ${character.holder}
					</p>
					<p class="muted small">${traitOf(character).desc}</p>
					<div class="kv">
						<span>인기도 <b>${fmt(character.popularity)}</b></span>
						<span>감정가 <b>${won(appraise(character))}</b></span>
						<span>시작가 <b>${won(auction.startPrice)}</b></span>
					</div>
					<div class="lot__bid">
						<span class="muted">현재가</span>
						<strong class="price">${won(auction.currentBid)}</strong>
						<span class="${leading ? "tag tag--live" : "tag"}">${auction.leader}</span>
					</div>
					<div class="timer"><div class="timer__bar" style="width:${(progress * 100).toFixed(1)}%"></div></div>
					<p class="muted">남은 시간 ${clock(auction.timeLeft)}</p>
				</div>
			</article>

			${raw(auction.consignedByPlayer ? consignNotice() : bidBox(state, min, leading))}

			<h3 class="section-title">입찰 현황</h3>
			<ul class="bids">${raw(bids || '<li class="muted">아직 입찰이 없습니다.</li>')}</ul>
		</section>
	`;
}

function consignNotice(): string {
	return `<p class="notice">내가 출품한 매물입니다. 낙찰되면 수수료 5%를 뗀 금액이 정산돼요.</p>`;
}

function bidBox(state: GameState, min: number, leading: boolean): string {
	if (leading) {
		return `<p class="notice notice--good">현재 내가 최고가입니다. 이대로 끝나면 낙찰!</p>`;
	}
	const affordable = state.money >= min;
	return html`
		<div class="bidbox">
			<input
				id="bid-input"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				placeholder="${min}"
				value="${ui.bid}"
				data-role="bid"
			/>
			<button class="btn" data-action="bid-min" data-amount="${min}">최소 ${won(min)}</button>
			<button class="btn btn--primary" data-action="bid" ${raw(affordable ? "" : "disabled")}>입찰</button>
		</div>
		${raw(affordable ? "" : '<p class="err">코인이 부족해 최소 입찰가를 넣을 수 없어요.</p>')}
	`;
}
