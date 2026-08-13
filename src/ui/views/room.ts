import { fmt, rate } from "../../core/format";
import type { GameState } from "../../core/types";
import { BALANCE } from "../../game/balance";
import {
	autoCheersPerSecond,
	cheerMultiplier,
	comboActive,
	comboMultiplier,
	fameMultiplier,
	incomePerSecond,
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
				<div class="stat"><span>응원 위력</span><b>×${cheerMultiplier(state).toFixed(2)}</b></div>
				<div class="stat"><span>자동 응원</span><b>${autoCheersPerSecond(state).toFixed(1)}/초</b></div>
				<div class="stat"><span>명성 보너스</span><b>×${fameMultiplier(state).toFixed(2)}</b></div>
			</div>
			${raw(comboBanner(state))}
			<p class="hint">카드를 빠르게 연타하면 <b>콤보</b>가 붙습니다. 인기도는 수입과 주가를 함께 끌어올려요.</p>
			<div class="slots">${raw(slots)}${raw(lockedCard)}</div>
		</section>
	`;
}

function comboBanner(state: GameState): string {
	const now = Date.now();
	if (!comboActive(state, now)) {
		return html`<div class="combo combo--idle">
			<span class="muted">연타해서 콤보를 쌓아보세요 · 최고 ${state.bestCombo} 콤보</span>
		</div>`;
	}
	const left = Math.max(0, (state.combo.until - now) / (BALANCE.comboWindow * 1000));
	return html`
		<div class="combo combo--on">
			<div class="combo__num">${state.combo.count} <span>COMBO</span></div>
			<div class="combo__mult">×${comboMultiplier(state, now).toFixed(2)}</div>
			<div class="combo__bar"><i style="width:${(left * 100).toFixed(0)}%"></i></div>
		</div>
	`;
}

function filledSlot(state: GameState, id: string, index: number): string {
	const character = state.characters[id];
	if (!character) return emptySlot(index);
	return html`
		<article class="slot slot--live" data-action="cheer" data-id="${character.id}" style="--accent:${character.color}">
			<div class="slot__glow"></div>
			<img class="ava ava--lg" src="${character.avatar}" alt="${character.name}" draggable="false" />
			<h3 class="slot__name">${character.name}</h3>
			<p class="muted">${traitOf(character).icon} ${traitOf(character).name}</p>
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
			<button class="btn btn--sm" data-action="open-picker" data-slot="${index}">캐릭터 배치</button>
		</article>
	`;
}
