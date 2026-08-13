import { html, raw } from "../dom";
import type { PickItem } from "../uiState";
import { ui } from "../uiState";

/**
 * 모달은 본문 뷰와 달리 매 프레임 다시 그리지 않는다.
 * (다시 그리면 입력 중이던 값과 한글 조합이 날아간다)
 * 그래서 마크업이 실시간 수치에 의존하지 않도록 열린 시점의 스냅샷만 사용한다.
 */
export function renderModal(): string {
	if (ui.pickerSlot !== null && ui.pickerList) return picker(ui.pickerSlot, ui.pickerList);
	if (ui.uploadOpen) return uploadForm();
	return "";
}

function picker(slotIndex: number, list: PickItem[]): string {
	const items = list
		.map(
			(c) => html`
			<button class="pick" data-action="seat" data-slot="${slotIndex}" data-id="${c.id}">
				<img class="ava" src="${c.avatar}" alt="" />
				<span class="pick__name">${c.name}</span>
				<span class="muted">🔥 ${c.popularity} · ${c.income} C/초${c.seated ? " · 응원 중" : ""}</span>
			</button>`,
		)
		.join("");

	return html`
		<div class="overlay" data-action="close-picker">
			<div class="sheet" data-stop="1">
				<header class="sheet__head">
					<h2>${slotIndex + 1}번 응원석</h2>
					<button class="btn btn--ghost btn--sm" data-action="close-picker">닫기</button>
				</header>
				<div class="picks">${raw(items || '<p class="muted">배치할 캐릭터가 없어요.</p>')}</div>
				<button class="btn btn--ghost" data-action="seat" data-slot="${slotIndex}" data-id="">자리 비우기</button>
			</div>
		</div>
	`;
}

function uploadForm(): string {
	const preview = ui.uploadAvatar
		? html`<img class="ava ava--lg" src="${ui.uploadAvatar}" alt="미리보기" />`
		: '<div class="ava ava--lg ava--ph">🖼</div>';

	return html`
		<div class="overlay" data-action="close-upload">
			<form class="sheet" data-stop="1" id="upload-form">
				<header class="sheet__head">
					<h2>최애 등록</h2>
					<button type="button" class="btn btn--ghost btn--sm" data-action="close-upload">닫기</button>
				</header>
				<div class="upload">
					<label class="upload__pic">
						${raw(preview)}
						<input type="file" id="upload-file" accept="image/*" hidden />
						<span class="btn btn--ghost btn--sm">이미지 선택</span>
					</label>
					<div class="upload__fields">
						<label>이름
							<input id="upload-name" type="text" maxlength="16" placeholder="예: 새벽별"
								autocomplete="off" value="${ui.uploadName}" />
						</label>
						<label>소속
							<input id="upload-agency" type="text" maxlength="16" placeholder="예: 무소속"
								autocomplete="off" value="${ui.uploadAgency}" />
						</label>
					</div>
				</div>
				${raw(ui.uploadError ? html`<p class="err">${ui.uploadError}</p>` : "")}
				<p class="muted small">이미지는 이 브라우저에만 저장되며 어디에도 전송되지 않아요. 넣지 않으면 이름으로 아바타를 만들어 줍니다.</p>
				<button class="btn btn--primary" type="submit" data-action="submit-upload">데뷔시키기</button>
			</form>
		</div>
	`;
}
