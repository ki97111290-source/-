import { html, raw } from "../dom";
import type { GoodsSheet, KitSheet, PickItem } from "../uiState";
import { ui } from "../uiState";

/**
 * 모달은 본문 뷰와 달리 매 프레임 다시 그리지 않는다. 다시 그리면 입력 중이던 값과
 * 한글 조합이 날아가고, 버튼이 눌리는 순간 교체되어 탭이 씹힌다.
 * 그래서 마크업이 실시간 수치에 의존하지 않도록 열린 시점의 스냅샷만 사용한다.
 */
export function renderModal(): string {
	if (ui.pickerSlot !== null && ui.pickerList) return picker(ui.pickerSlot, ui.pickerList);
	if (ui.uploadOpen) return uploadForm();
	if (ui.kitSheet) return kitSheet(ui.kitSheet);
	if (ui.goodsSheet) return goodsSheet(ui.goodsSheet);
	return "";
}

function kitSheet(snap: KitSheet): string {
	const steps = snap.priceSteps
		.map(
			(step) => html`
			<button class="chip ${step.factor === snap.factor ? "chip--on" : ""}"
				data-action="kit-price" data-factor="${step.factor}">
				<span>${step.label}</span>
				<span class="muted small">×${step.factor}</span>
			</button>`,
		)
		.join("");

	const kits = snap.kits
		.map(
			(kit) => html`
			<div class="gtype ${kit.locked ? "gtype--locked" : ""}">
				<div class="gtype__icon">${kit.icon}</div>
				<div class="gtype__body">
					<h3>${kit.name} · ${kit.auctioned ? "단 1개" : `${kit.units}개 한정`}</h3>
					${raw(kit.title ? html`<span class="badge">칭호 ${kit.title}</span>` : "")}
					${raw(
						kit.locked
							? html`<p class="muted small">${kit.lockLabel}</p>`
							: kit.auctioned
								? html`<p class="muted small">시작가 ${kit.price} · ${kit.lasts} 동안 경매</p>
									<div class="kv"><span class="muted">수집가가 시작가를 넘겨야 팔립니다. 유찰되면 원가 일부만 회수돼요.</span></div>`
								: html`<p class="muted small">개당 ${kit.price} · 완판까지 약 ${kit.lasts}</p>
									<div class="kv"><span>매출 <b>${kit.revenue}</b></span><span>완판 총액 <b>${kit.total}</b></span></div>`,
					)}
				</div>
				<button class="btn btn--primary btn--sm" data-action="print-edition"
					data-id="${snap.lineId}" data-grade="${kit.id}"
					${kit.locked || !kit.affordable ? "disabled" : ""}>
					${kit.locked ? "잠김" : kit.cost}
				</button>
			</div>`,
		)
		.join("");

	return sheet(
		snap.title,
		html`
			<p class="muted small">
				판매가를 고르세요. 비싸게 내면 천천히 팔려 오래 가고, 싸게 내면 빨리 빠집니다.
				${snap.salvage}
			</p>
			<div class="chips">${raw(steps)}</div>
			<div class="gtypes">${raw(kits)}</div>
		`,
		"close-kit",
	);
}

function goodsSheet(snap: GoodsSheet): string {
	if (snap.picks.length === 0) {
		return sheet(
			"굿즈 발매",
			'<p class="notice">굿즈를 낼 캐릭터가 없어요. 경매장에서 데려오거나 새로 등록해보세요.</p>',
		);
	}

	const picks = snap.picks
		.map(
			(c) => html`
			<button class="chip ${c.id === snap.selectedId ? "chip--on" : ""}" data-action="goods-pick" data-id="${c.id}">
				<img class="ava" src="${c.avatar}" alt="" />
				<span>${c.name}</span>
				<span class="muted small">${c.typeIcon}</span>
			</button>`,
		)
		.join("");

	const types = snap.types
		.map(
			(type) => html`
			<div class="gtype ${type.current ? "gtype--on" : ""}">
				<div class="gtype__icon">${type.icon}</div>
				<div class="gtype__body">
					<h3>${type.name}${type.current ? " · 판매 중" : ""}</h3>
					<p class="muted small">${type.desc}</p>
					<div class="kv"><span>한정판 매출 <b>${type.power}</b></span><span>한 판 <b>${type.lasts}</b></span></div>
				</div>
				<button class="btn btn--primary btn--sm" data-action="release-goods"
					data-id="${snap.selectedId}" data-type="${type.id}"
					${type.current || !type.affordable ? "disabled" : ""}>
					${type.current ? "판매 중" : type.cost}
				</button>
			</div>`,
		)
		.join("");

	return sheet(
		snap.currentType ? "굿즈 종류 바꾸기" : "새 굿즈 라인",
		html`
			<div class="chips">${raw(picks)}</div>
			<p class="muted small">
				${
					snap.currentType
						? `${snap.selectedName}은(는) 지금 ${snap.currentType}을(를) 내고 있어요. 종류를 바꾸면 팔던 재고는 떨이로 정리됩니다.`
						: `${snap.selectedName}의 인기도가 높을수록 매출도 개설비도 함께 올라갑니다.`
				}
			</p>
			<div class="gtypes">${raw(types)}</div>
		`,
	);
}

function sheet(title: string, body: string, close = "close-goods"): string {
	return html`
		<div class="overlay" data-action="${close}">
			<div class="sheet" data-stop="1">
				<header class="sheet__head">
					<h2>${title}</h2>
					<button class="btn btn--ghost btn--sm" data-action="${close}">닫기</button>
				</header>
				${raw(body)}
			</div>
		</div>
	`;
}

function picker(slotIndex: number, list: PickItem[]): string {
	const items = list
		.map(
			(c) => html`
			<button class="pick" data-action="seat" data-slot="${slotIndex}" data-id="${c.id}">
				<img class="ava" src="${c.avatar}" alt="" />
				<span class="pick__name">${c.name}</span>
				<span class="muted">🔥 ${c.popularity} · 판매력 ${c.income}${c.seated ? " · 응원 중" : ""}</span>
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
