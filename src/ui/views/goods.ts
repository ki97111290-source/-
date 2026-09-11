import { duration, fmt, rate, won } from "../../core/format";
import type { GameState, GoodsLine } from "../../core/types";
import { BALANCE } from "../../game/balance";
import { ownedCharacters } from "../../game/characters";
import {
	KITS,
	auctionSalvage,
	auctionSecondsLeft,
	baseRevenue,
	burstLabel,
	editionRevenue,
	goodsMultiplier,
	kitOf,
	kitUnlocked,
	lineOf,
	salvageValue,
	secondsLeft,
	topBid,
} from "../../game/goods";
import { html, raw } from "../dom";
import { hint, stats, untilNextLocked } from "../parts";

export function renderGoods(state: GameState): string {
	// 손봐야 하는 줄을 위로. 여덟 줄이 되면 "재고가 빠져 멈춘 줄"을 찾는 게 일이 된다.
	const sorted = [...state.goods].sort(
		(a, b) => attentionRank(state, a) - attentionRank(state, b) || b.revenue - a.revenue,
	);
	const lines = sorted.map((line) => lineCard(state, line)).join("");
	// 지금 눌러서 돈이 되는 줄만 센다. 응원석에서 빠진 줄까지 세면 늘 전부가 "손볼 줄"이 된다.
	const waiting = state.goods.filter((line) => attentionRank(state, line) <= 1).length;
	const idle = ownedCharacters(state).filter((c) => !lineOf(state, c.id)).length;
	const full = state.goods.length >= BALANCE.maxGoodsLines;

	return html`
		<section class="panel">
			${raw(
				stats([
					// 굿즈 매출 = 헤더에 떠 있는 그 숫자다. 두 번 그리지 않는다.
					{ label: "판매 중", value: `${state.goods.length} / ${BALANCE.maxGoodsLines}` },
					// 배수가 1이거나 대기 인원이 없으면 볼 이유가 없다
					{
						label: "공장 배수",
						value: `×${goodsMultiplier(state).toFixed(2)}`,
						show: goodsMultiplier(state) > 1,
					},
					{ label: "대기 중인 캐릭터", value: `${idle}명`, show: idle > 0 },
				]),
			)}
			${raw(
				hint(`이 게임에서 <b>돈이 들어오는 곳은 굿즈</b>입니다. 라인을 열어두면 상시로 조금씩 팔리고,
				<b>키트</b>로 한정판을 찍으면 재고가 빠지는 동안 매출이 크게 뜁니다.
				굿즈의 <b>이름과 사진은 자유</b>예요.`),
			)}

			${raw(kitRack(state))}

			<div class="panel__head">
				<h2 class="section-title">
					판매 중인 굿즈${waiting > 0 ? ` · 다시 찍을 줄 ${waiting}개` : ""}
				</h2>
				<button class="btn btn--primary btn--sm" data-action="open-goods" ${full ? "disabled" : ""}>
					${full ? "라인이 꽉 찼어요" : "＋ 굿즈 만들기"}
				</button>
			</div>
			<div class="cards">
				${raw(lines || '<p class="notice">판매 중인 굿즈가 없어요. 수입이 0입니다.</p>')}
			</div>
		</section>
	`;
}

/**
 * 팬심으로 열리는 키트 등급표.
 * 열린 것과 **바로 다음 하나**만 보여준다. 다섯 개를 다 깔면
 * 한 달 뒤에나 쓸 자물쇠가 화면 절반을 먹는다.
 */
function kitRack(state: GameState): string {
	const visible = untilNextLocked(KITS, (kit) => kitUnlocked(state, kit));
	const hidden = KITS.length - visible.length;
	const rows = visible
		.map((kit) => {
			const on = kitUnlocked(state, kit);
			return html`
			<div class="kit ${on ? "kit--on" : ""}">
				<span class="kit__icon">${kit.icon}</span>
				<span class="kit__name">${kit.name}</span>
				<span class="muted small">${kit.units === 1 ? "단 1개 · 경매" : `${kit.units.toLocaleString("ko-KR")}개 한정`}</span>
				<span class="muted small">${on ? (kit.title ? `칭호 ${kit.title}` : "해금됨") : `팬심 ${fmt(kit.fansNeeded)}`}</span>
			</div>`;
		})
		.join("");
	return html`
		<h2 class="section-title">제작 키트${hidden > 0 ? ` · 그 위로 ${hidden}종 더` : ""}</h2>
		<div class="kits">${raw(rows)}</div>
	`;
}

/**
 * 지금 내 손이 필요한 순서. 낮을수록 위로 올라온다.
 * 방치형에서 "할 일"은 대부분 재고가 빠져 멈춘 줄을 다시 찍는 것이다.
 */
function attentionRank(state: GameState, line: GoodsLine): number {
	// 입찰이 들어온 유일본 경매 — 수락할지 말지 내가 정해야 한다
	if (line.auction) return topBid(line.auction) ? 0 : 3;
	// 재고가 없다 = 한정판 매출이 멈춰 있다
	if (!line.edition || line.edition.stock <= 0) return 1;
	// 응원석에서 빠져 인기도가 식는 중
	if (!state.slots.includes(line.characterId)) return 2;
	return 4;
}

function lineCard(state: GameState, line: GoodsLine): string {
	const character = state.characters[line.characterId];
	if (!character) return "";
	const design = line.design;
	const seated = state.slots.includes(line.characterId);
	const edition = line.edition;
	const auction = line.auction;

	return html`
		<article class="card goods" style="--accent:${character.color}">
			<img class="ava ava--md" src="${design.image ?? character.avatar}" alt="${design.name}" />
			<div class="card__body">
				<h3>${design.name}</h3>
				<p class="muted small">${character.name} · ${burstLabel(design.burst)} 굿즈</p>
				<div class="kv">
					<span>상시 <b>${rate(baseRevenue(state, line))}</b></span>
					<span>누적 <b>${won(line.revenue)}</b></span>
					<span>인기도 <b>🔥 ${fmt(character.popularity)}</b></span>
					${raw(line.soldOut > 0 ? html`<span>완판 <b>${line.soldOut}회</b></span>` : "")}
				</div>
				${raw(auction ? auctionBox(state, line) : edition ? editionBar(line) : "")}
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
							<button class="btn btn--ghost btn--sm" data-action="open-goods" data-id="${line.characterId}">굿즈 바꾸기</button>
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
