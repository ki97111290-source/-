import { coin, fmt } from "../../core/format";
import type { GameState } from "../../core/types";
import { BALANCE } from "../../game/balance";
import { appraise, ownedCharacters, userCharacterCount } from "../../game/characters";
import { slotIncome } from "../../game/economy";
import { html, raw } from "../dom";

export function renderRoster(state: GameState): string {
	const mine = ownedCharacters(state);
	const cards = mine
		.map((c) => {
			const seated = state.slots.includes(c.id);
			return html`
			<article class="card" style="--accent:${c.color}">
				<img class="ava ava--md" src="${c.avatar}" alt="${c.name}" />
				<div class="card__body">
					<h3>${c.name} ${raw(seated ? '<span class="tag tag--live">응원 중</span>' : "")}</h3>
					<p class="muted">${c.agency} · ${c.origin === "user" ? "내가 등록" : "영입"}</p>
					<div class="kv">
						<span>인기도 <b>${fmt(c.popularity)}</b></span>
						<span>주가 <b>${coin(c.price)}</b></span>
						<span>감정가 <b>${coin(appraise(c))}</b></span>
						<span>수입 <b>${coin(slotIncome(c))}/초</b></span>
					</div>
				</div>
				<div class="card__actions">
					<button class="btn btn--sm" data-action="quick-seat" data-id="${c.id}">응원석에</button>
					<button class="btn btn--ghost btn--sm" data-action="consign" data-id="${c.id}">경매 출품</button>
				</div>
			</article>`;
		})
		.join("");

	return html`
		<section class="panel">
			<header class="panel__head">
				<div>
					<h2>내 캐릭터 ${mine.length}명</h2>
					<p class="muted">업로드 ${userCharacterCount(state)} / ${BALANCE.maxUserCharacters}명</p>
				</div>
				<button class="btn btn--primary" data-action="open-upload">＋ 최애 업로드</button>
			</header>
			<div class="cards">${raw(cards || '<p class="muted">가진 캐릭터가 없어요.</p>')}</div>
		</section>
	`;
}
