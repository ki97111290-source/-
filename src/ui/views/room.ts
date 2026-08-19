import { fmt, rate } from "../../core/format";
import type { GameState } from "../../core/types";
import { BALANCE } from "../../game/balance";
import {
	cheerMultiplier,
	cheersPerSecond,
	fameMultiplier,
	fansPerSecond,
	incomePerSecond,
} from "../../game/economy";
import { lineOf, lineRevenue } from "../../game/goods";
import { slotCount } from "../../game/state";
import { traitOf } from "../../game/traits";
import { html, raw } from "../dom";

export function renderRoom(state: GameState): string {
	const slots = state.slots
		.map((id, index) => (id ? filledSlot(state, id, index) : emptySlot(index)))
		.join("");

	// 잠긴 자리는 "다음 한 칸"만 보여준다. 전부 깔면 화면이 자물쇠로 뒤덮인다.
	const remaining = Math.max(0, BALANCE.maxSlots - slotCount(state));
	const lockedCard = remaining
		? `<article class="slot slot--locked">
				<div class="slot__lock">🔒</div>
				<p class="muted">상점의 <b>응원석 증설</b>로 열 수 있어요</p>
				<p class="muted small">남은 자리 ${remaining}칸</p>
			</article>`
		: "";

	return html`
		<section class="panel">
			<div class="statrow">
				<div class="stat"><span>굿즈 매출</span><b>${rate(incomePerSecond(state))}</b></div>
				<div class="stat"><span>응원 속도</span><b>${cheersPerSecond(state).toFixed(1)}회/초</b></div>
				<div class="stat"><span>응원 위력</span><b>×${cheerMultiplier(state).toFixed(2)}</b></div>
				<div class="stat"><span>팬심 상승</span><b>💜 +${fmt(fansPerSecond(state))}/초</b></div>
			</div>
			<p class="hint">
				응원은 <b>💜 팬심</b>(시즌 성적)과 <b>인기도</b>를 올립니다. 돈은 응원에서 바로 나오지 않고,
				<b>굿즈</b>가 그 인기도를 원으로 바꿔요. 팬심은 쓰이지 않고 쌓이기만 합니다.
				명성 보너스 ×${fameMultiplier(state).toFixed(2)} 적용 중.
			</p>
			<div class="slots">${raw(slots)}${raw(lockedCard)}</div>
		</section>
	`;
}

function filledSlot(state: GameState, id: string, index: number): string {
	const character = state.characters[id];
	if (!character) return emptySlot(index);
	const trait = traitOf(character);
	return html`
		<article class="slot slot--live" data-slot-id="${character.id}" style="--accent:${character.color}">
			<div class="slot__glow"></div>
			<img class="ava ava--lg" src="${character.avatar}" alt="${character.name}" draggable="false" />
			<h3 class="slot__name">${character.name}</h3>
			<p class="muted">${trait.icon} ${trait.name}</p>
			<div class="slot__stats">
				<span title="인기도">🔥 ${fmt(character.popularity)}</span>
				${raw(goodsStat(state, character.id))}
			</div>
			<button class="btn btn--ghost btn--sm" data-action="open-picker" data-slot="${index}">교체</button>
		</article>
	`;
}

/** 굿즈를 내고 있으면 매출을, 아니면 발매하러 가라고 알려준다. */
function goodsStat(state: GameState, characterId: string): string {
	const line = lineOf(state, characterId);
	if (!line) {
		return html`<span title="굿즈 미발매"><a class="slot__link" data-action="tab" data-id="goods">🏭 굿즈 없음</a></span>`;
	}
	return html`<span title="굿즈 매출">💰 ${rate(lineRevenue(state, line))}</span>`;
}

function emptySlot(index: number): string {
	return html`
		<article class="slot slot--empty">
			<div class="slot__lock">＋</div>
			<p class="muted">빈 응원석</p>
			<p class="muted small">비어 있으면 그만큼 수입이 줄어요</p>
			<button class="btn btn--sm" data-action="open-picker" data-slot="${index}">캐릭터 배치</button>
		</article>
	`;
}
