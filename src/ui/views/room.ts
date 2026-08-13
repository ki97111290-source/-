import { fmt, rate } from "../../core/format";
import type { GameState } from "../../core/types";
import { BALANCE } from "../../game/balance";
import {
	cheerMultiplier,
	cheersPerSecond,
	fameMultiplier,
	incomePerSecond,
	popularityPerSecond,
	slotIncome,
} from "../../game/economy";
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
				<div class="stat"><span>초당 수입</span><b>${rate(incomePerSecond(state))}</b></div>
				<div class="stat"><span>응원 속도</span><b>${cheersPerSecond(state).toFixed(1)}회/초</b></div>
				<div class="stat"><span>응원 위력</span><b>×${cheerMultiplier(state).toFixed(2)}</b></div>
				<div class="stat"><span>인기도 상승</span><b>+${fmt(popularityPerSecond(state))}/초</b></div>
			</div>
			<p class="hint">
				이 페이지를 켜두기만 하면 응원이 알아서 돌아갑니다.
				누굴 앉힐지, 번 돈을 <b>주식</b>과 <b>경매</b> 중 어디에 쓸지만 정하면 돼요.
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
				<span title="초당 수입">💰 ${rate(slotIncome(character))}</span>
			</div>
			<button class="btn btn--ghost btn--sm" data-action="open-picker" data-slot="${index}">교체</button>
		</article>
	`;
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
