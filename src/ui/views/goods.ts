import { fmt, rate, won } from "../../core/format";
import type { GameState, GoodsLine } from "../../core/types";
import { BALANCE } from "../../game/balance";
import { ownedCharacters } from "../../game/characters";
import {
	goodsMultiplier,
	goodsRevenue,
	goodsType,
	lineOf,
	lineRevenue,
	rerunCost,
	trendOf,
} from "../../game/goods";
import { html, raw } from "../dom";

export function renderGoods(state: GameState): string {
	const now = Date.now();
	const lines = state.goods.map((line) => lineCard(state, line, now)).join("");
	const idle = ownedCharacters(state).filter((c) => !lineOf(state, c.id)).length;
	const full = state.goods.length >= BALANCE.maxGoodsLines;

	return html`
		<section class="panel">
			<div class="statrow">
				<div class="stat"><span>굿즈 매출</span><b>${rate(goodsRevenue(state, now))}</b></div>
				<div class="stat"><span>발매 중</span><b>${state.goods.length} / ${BALANCE.maxGoodsLines}</b></div>
				<div class="stat"><span>공장 배수</span><b>×${goodsMultiplier(state).toFixed(2)}</b></div>
				<div class="stat"><span>대기 중인 캐릭터</span><b>${idle}명</b></div>
			</div>
			<p class="hint">
				이 게임에서 <b>돈이 들어오는 곳은 굿즈</b>입니다. 응원은 인기도를 올리고,
				굿즈가 그 인기도를 원으로 바꿔요. 발매 직후가 가장 잘 팔리고
				유행이 식으면 매출이 ${Math.round(BALANCE.goodsTrendFloor * 100)}%까지 떨어집니다.
				식은 굿즈는 <b>재발매</b>로 되살릴 수 있어요.
			</p>
			<div class="panel__head">
				<h2 class="section-title">발매 중인 굿즈</h2>
				<button class="btn btn--primary btn--sm" data-action="open-goods" ${full ? "disabled" : ""}>
					${full ? "라인이 꽉 찼어요" : "＋ 새 굿즈 발매"}
				</button>
			</div>
			<div class="cards">
				${raw(lines || '<p class="notice">발매 중인 굿즈가 없어요. 수입이 0입니다.</p>')}
			</div>
		</section>
	`;
}

function lineCard(state: GameState, line: GoodsLine, now: number): string {
	const character = state.characters[line.characterId];
	if (!character) return "";
	const def = goodsType(line.type);
	const trend = trendOf(line, now);
	const cost = rerunCost(state, line);
	const seated = state.slots.includes(line.characterId);
	// 유행이 다 식은 상태를 0%, 갓 발매한 상태를 100%로 보여준다.
	const shown = (trend - BALANCE.goodsTrendFloor) / (1 - BALANCE.goodsTrendFloor);

	return html`
		<article class="card goods" style="--accent:${character.color}">
			<img class="ava ava--md" src="${character.avatar}" alt="${character.name}" />
			<div class="card__body">
				<h3>${def.icon} ${character.name} ${def.name}${line.editions > 0 ? ` ${line.editions + 1}차` : ""}</h3>
				<div class="kv">
					<span>매출 <b>${rate(lineRevenue(state, line, now))}</b></span>
					<span>누적 <b>${won(line.revenue)}</b></span>
					<span>인기도 <b>🔥 ${fmt(character.popularity)}</b></span>
				</div>
				<div class="trend">
					<div class="trend__bar"><i style="width:${(Math.max(0, shown) * 100).toFixed(1)}%"></i></div>
					<span class="muted small">유행 ${Math.round(trend * 100)}%</span>
				</div>
				${raw(
					seated
						? ""
						: '<p class="muted small">응원석에 없어서 인기도가 식는 중이에요. 매출도 같이 줄어듭니다.</p>',
				)}
			</div>
			<div class="card__actions">
				<button class="btn btn--sm" data-action="rerun" data-id="${line.id}"
					${state.money < cost ? "disabled" : ""}>재발매 ${won(cost)}</button>
				<button class="btn btn--ghost btn--sm" data-action="open-goods" data-id="${line.characterId}">종류 바꾸기</button>
				<button class="btn btn--ghost btn--sm danger" data-action="close-goods-line" data-id="${line.id}">발매 종료</button>
			</div>
		</article>
	`;
}
