import { duration, fmt, rate, won } from "../../core/format";
import type { GameState, GoodsLine } from "../../core/types";
import { BALANCE } from "../../game/balance";
import { ownedCharacters } from "../../game/characters";
import {
	KITS,
	auctionSalvage,
	auctionSecondsLeft,
	baseRevenue,
	editionRevenue,
	goodsMultiplier,
	goodsRevenue,
	goodsType,
	kitOf,
	kitUnlocked,
	lineOf,
	salvageValue,
	secondsLeft,
	topBid,
} from "../../game/goods";
import { html, raw } from "../dom";

export function renderGoods(state: GameState): string {
	const lines = state.goods.map((line) => lineCard(state, line)).join("");
	const idle = ownedCharacters(state).filter((c) => !lineOf(state, c.id)).length;
	const full = state.goods.length >= BALANCE.maxGoodsLines;

	return html`
		<section class="panel">
			<div class="statrow">
				<div class="stat"><span>굿즈 매출</span><b>${rate(goodsRevenue(state))}</b></div>
				<div class="stat"><span>판매 중</span><b>${state.goods.length} / ${BALANCE.maxGoodsLines}</b></div>
				<div class="stat"><span>공장 배수</span><b>×${goodsMultiplier(state).toFixed(2)}</b></div>
				<div class="stat"><span>대기 중인 캐릭터</span><b>${idle}명</b></div>
			</div>
			<p class="hint">
				이 게임에서 <b>돈이 들어오는 곳은 굿즈</b>입니다. 라인을 열어두면 상시로 조금씩 팔리고,
				<b>키트</b>로 한정판을 찍으면 재고가 빠지는 동안 매출이 크게 뜁니다.
				값은 내가 정하고 <b>한정 수량이 그 값을 검증</b>해요 — 비싸게 내면 천천히 오래,
				싸게 내면 빨리 빠집니다.
			</p>

			${raw(kitRack(state))}

			<div class="panel__head">
				<h2 class="section-title">판매 중인 굿즈</h2>
				<button class="btn btn--primary btn--sm" data-action="open-goods" ${full ? "disabled" : ""}>
					${full ? "라인이 꽉 찼어요" : "＋ 새 라인"}
				</button>
			</div>
			<div class="cards">
				${raw(lines || '<p class="notice">판매 중인 굿즈가 없어요. 수입이 0입니다.</p>')}
			</div>
		</section>
	`;
}

/** 팬심으로 열리는 키트 등급표 */
function kitRack(state: GameState): string {
	const rows = KITS.map((kit) => {
		const on = kitUnlocked(state, kit);
		return html`
			<div class="kit ${on ? "kit--on" : ""}">
				<span class="kit__icon">${kit.icon}</span>
				<span class="kit__name">${kit.name}</span>
				<span class="muted small">${kit.units === 1 ? "단 1개 · 경매" : `${kit.units.toLocaleString("ko-KR")}개 한정`}</span>
				<span class="muted small">${on ? (kit.title ? `칭호 ${kit.title}` : "해금됨") : `팬심 ${fmt(kit.fansNeeded)}`}</span>
			</div>`;
	}).join("");
	return html`
		<h2 class="section-title">제작 키트 · 이번 시즌 팬심으로 해금</h2>
		<div class="kits">${raw(rows)}</div>
	`;
}

function lineCard(state: GameState, line: GoodsLine): string {
	const character = state.characters[line.characterId];
	if (!character) return "";
	const def = goodsType(line.type);
	const seated = state.slots.includes(line.characterId);
	const edition = line.edition;
	const auction = line.auction;

	return html`
		<article class="card goods" style="--accent:${character.color}">
			<img class="ava ava--md" src="${character.avatar}" alt="${character.name}" />
			<div class="card__body">
				<h3>${def.icon} ${character.name} ${def.name}</h3>
				<div class="kv">
					<span>상시 <b>${rate(baseRevenue(state, line))}</b></span>
					<span>누적 <b>${won(line.revenue)}</b></span>
					<span>인기도 <b>🔥 ${fmt(character.popularity)}</b></span>
					${raw(line.soldOut > 0 ? html`<span>완판 <b>${line.soldOut}회</b></span>` : "")}
				</div>
				${raw(
					auction
						? auctionBox(state, line)
						: edition
							? editionBar(line)
							: '<p class="muted small">한정판을 찍으면 매출이 크게 뜁니다.</p>',
				)}
				${raw(
					seated
						? ""
						: '<p class="muted small">응원석에 없어서 인기도가 식는 중이에요. 매출도 같이 줄어듭니다.</p>',
				)}
			</div>
			<div class="card__actions">
				${raw(
					auction
						? auctionActions(line)
						: html`<button class="btn btn--primary btn--sm" data-action="open-kit" data-id="${line.id}">
								${edition && edition.stock > 0 ? "다시 찍기" : "한정판 찍기"}
							</button>
							${
								edition && edition.stock > 0
									? html`<button class="btn btn--ghost btn--sm" data-action="scrap" data-id="${line.id}">떨이 정리 ${won(salvageValue(line))}</button>`
									: ""
							}
							<button class="btn btn--ghost btn--sm" data-action="open-goods" data-id="${line.characterId}">종류 바꾸기</button>
							<button class="btn btn--ghost btn--sm danger" data-action="close-goods-line" data-id="${line.id}">판매 종료</button>`,
				)}
			</div>
		</article>
	`;
}

/** 한정판 재고 막대 */
function editionBar(line: GoodsLine): string {
	const edition = line.edition;
	if (!edition) return "";
	const kit = kitOf(edition.grade);
	const left = edition.stock / edition.total;

	if (edition.stock <= 0) {
		return html`<p class="notice notice--good">${kit.icon} ${kit.name} ${edition.total.toLocaleString("ko-KR")}개 완판! 다시 찍을 수 있어요.</p>`;
	}
	return html`
		<div class="edition">
			<div class="edition__head">
				<span>${kit.icon} ${kit.name} · 개당 ${won(edition.price)}</span>
				<span class="muted small">${Math.ceil(edition.stock).toLocaleString("ko-KR")} / ${edition.total.toLocaleString("ko-KR")}개</span>
			</div>
			<div class="edition__bar"><i style="width:${(left * 100).toFixed(1)}%"></i></div>
			<span class="muted small">한정판 매출 ${rate(editionRevenue(line))} · 완판까지 약 ${duration(secondsLeft(line))}</span>
		</div>
	`;
}

/** 유일본 경매판 */
function auctionBox(state: GameState, line: GoodsLine): string {
	const auction = line.auction;
	if (!auction) return "";
	const character = state.characters[line.characterId];
	const bid = topBid(auction);
	const left = auctionSecondsLeft(auction);
	const bids = auction.schedule
		.slice(0, auction.revealed)
		.reverse()
		.slice(0, 4)
		.map(
			(b, i) => html`<li class="bid ${i === 0 ? "bid--top" : ""}">
				<span>${b.bidder}</span><b>${won(b.amount)}</b>
			</li>`,
		)
		.join("");

	return html`
		<div class="uniq">
			<div class="uniq__head">
				<span class="badge badge--uniq">👑 유일본</span>
				<span class="muted small">${character?.name ?? ""} · 단 1개</span>
			</div>
			<div class="uniq__price">
				<b>${bid ? won(bid.amount) : won(auction.startPrice)}</b>
				<span class="muted small">${bid ? `${bid.bidder} 최고가` : "아직 입찰 없음 · 시작가"}</span>
			</div>
			<span class="muted small">${left > 0 ? `${duration(left)} 남음` : "마감 정산 중"}</span>
			${raw(bids ? html`<ul class="bids">${raw(bids)}</ul>` : "")}
			${raw(
				bid
					? ""
					: html`<p class="muted small">시작가가 높으면 아무도 못 부르고 유찰됩니다. 유찰되면 ${won(auctionSalvage(auction))}만 돌아와요.</p>`,
			)}
		</div>
	`;
}

function auctionActions(line: GoodsLine): string {
	const auction = line.auction;
	if (!auction) return "";
	const bid = topBid(auction);
	return html`
		<button class="btn btn--primary btn--sm" data-action="accept-bid" data-id="${line.id}" ${bid ? "" : "disabled"}>
			${bid ? `지금 낙찰 ${won(bid.amount)}` : "입찰 대기 중"}
		</button>
		<button class="btn btn--ghost btn--sm danger" data-action="cancel-auction" data-id="${line.id}">경매 접기 ${won(auctionSalvage(auction))}</button>
	`;
}
