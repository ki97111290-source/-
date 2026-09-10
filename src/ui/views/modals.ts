import { html, raw } from "../dom";
import { hintsOn } from "../prefs";
import { effectiveTheme } from "../theme";
import type { GoodsSheet, KitSheet, PickItem, SaveSheet, SettingsSheet } from "../uiState";
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
	if (ui.saveSheet) return saveSheet(ui.saveSheet);
	if (ui.settings) return settingsSheet(ui.settings);
	return "";
}

/** 가끔 한 번 쓰는 것들 — 화면 취향, 기록, 세이브. 본 화면에서는 걷어냈다. */
function settingsSheet(snap: SettingsSheet): string {
	const records = snap.records
		.map((r) => html`<div class="stat"><span>${r.label}</span><b>${r.value}</b></div>`)
		.join("");

	return sheet(
		"설정",
		html`
			<div class="btnrow">
				<button class="btn btn--ghost btn--sm" data-action="hints">
					💬 설명 ${hintsOn() ? "끄기" : "켜기"}
				</button>
				<button class="btn btn--ghost btn--sm" data-action="theme">
					${effectiveTheme() === "dark" ? "☀️ 밝은 화면" : "🌙 어두운 화면"}
				</button>
			</div>

			<h3 class="section-title">기록</h3>
			<div class="statrow">${raw(records)}</div>
			<p class="muted small">
				페이지를 켜두면 수입 100%가 그대로 들어옵니다. 완전히 닫아둔 동안에는
				${snap.offline}가 최대 8시간까지 쌓여요.
			</p>

			<h3 class="section-title">세이브</h3>
			<div class="btnrow">
				<button class="btn btn--ghost btn--sm" data-action="export">내보내기</button>
				<button class="btn btn--ghost btn--sm" data-action="import">불러오기</button>
				<button class="btn btn--ghost btn--sm danger" data-action="reset">처음부터 다시</button>
			</div>
			<p class="muted small">진행 상황은 이 브라우저에만 저장됩니다. 기기를 옮길 땐 내보내세요.</p>
		`,
		"close-settings",
	);
}

/**
 * 세이브를 글로 주고받는 시트.
 * 칸의 내용은 마크업에 다시 넣지 않는다 — 매 프레임 다시 그리면 붙여넣던 글이 날아간다.
 * 누를 때 칸에서 직접 읽는다.
 */
function saveSheet(snap: SaveSheet): string {
	if (snap.mode === "export") {
		return sheet(
			"세이브 내보내기",
			html`
				<p class="muted small">
					이 화면에서는 파일로 내려받을 수 없어요. 아래 내용을 통째로 복사해
					메모장이나 메신저에 붙여 두었다가, 옮길 기기에서 ‘세이브 불러오기’에 붙여넣으세요.
				</p>
				<textarea class="savebox" id="save-text" readonly spellcheck="false">${snap.text}</textarea>
				<button class="btn btn--primary" data-action="copy-save">복사하기</button>
			`,
			"close-save",
		);
	}

	return sheet(
		"세이브 불러오기",
		html`
			<p class="muted small">
				내보낸 세이브를 붙여넣고 불러오세요. <b>지금 진행 상황은 덮어씌워집니다.</b>
			</p>
			<textarea class="savebox" id="save-text" spellcheck="false"
				placeholder="여기에 붙여넣기">${snap.text}</textarea>
			${raw(snap.error ? html`<p class="err">${snap.error}</p>` : "")}
			<div class="btnrow">
				<button class="btn btn--primary" data-action="paste-save">불러오기</button>
				<button class="btn btn--ghost" data-action="pick-save-file">파일에서 고르기</button>
			</div>
		`,
		"close-save",
	);
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
			"굿즈 만들기",
			'<p class="notice">굿즈를 낼 캐릭터가 없어요. 경매장에서 데려오거나 새로 등록해보세요.</p>',
		);
	}

	const picks = snap.picks
		.map(
			(c) => html`
			<button type="button" class="chip ${c.id === snap.selectedId ? "chip--on" : ""}"
				data-action="goods-pick" data-id="${c.id}">
				<img class="ava" src="${c.avatar}" alt="" />
				<span>${c.name}</span>
				<span class="muted small">${c.hasLine ? "판매 중" : "＋"}</span>
			</button>`,
		)
		.join("");

	const steps = snap.steps
		.map(
			(step) => html`
			<button type="button" class="burst ${step.value === ui.goodsBurst ? "burst--on" : ""}"
				data-action="goods-burst" data-value="${step.value}">
				<b>${step.label}</b>
				<span class="muted small">${step.desc}</span>
				<span class="muted small">${step.preview}</span>
			</button>`,
		)
		.join("");

	const saved = snap.saved
		.map(
			(d) => html`
			<button type="button" class="chip" data-action="goods-load" data-name="${d.name}">
				${raw(d.image ? html`<img class="ava" src="${d.image}" alt="" />` : "<span>🏷</span>")}
				<span>${d.name}</span>
			</button>`,
		)
		.join("");

	const preview = ui.goodsImage
		? html`<img class="ava ava--lg" src="${ui.goodsImage}" alt="미리보기" />`
		: '<div class="ava ava--lg ava--ph">🏷</div>';

	return sheet(
		snap.currentName ? "굿즈 바꾸기" : "굿즈 만들기",
		html`
			<div class="chips">${raw(picks)}</div>
			${raw(
				snap.currentName
					? html`<p class="muted small">${snap.selectedName}은(는) 지금 ‘${snap.currentName}’을(를) 팔고 있어요. 새로 만들면 팔던 재고는 떨이로 정리됩니다.</p>`
					: html`<p class="muted small">${snap.selectedName}의 굿즈를 직접 만들어 보세요. 이름과 사진은 자유입니다.</p>`,
			)}

			<div class="upload">
				<label class="upload__pic">
					${raw(preview)}
					<input type="file" id="goods-file" accept="image/*" hidden />
					<span class="btn btn--ghost btn--sm">사진 올리기</span>
				</label>
				<div class="upload__fields">
					<label>굿즈 이름
						<input id="goods-name" type="text" maxlength="16" placeholder="예: 응원봉, 아크릴 키링, 인형"
							autocomplete="off" value="${ui.goodsName}" />
					</label>
					${raw(
						saved
							? html`<div class="savedrow"><span class="muted small">보관함</span><div class="chips">${raw(saved)}</div></div>`
							: "",
					)}
				</div>
			</div>

			<h3 class="section-title">판매 성향</h3>
			<div class="bursts">${raw(steps)}</div>

			${raw(ui.goodsError ? html`<p class="err">${ui.goodsError}</p>` : "")}
			<p class="muted small">사진은 이 브라우저에만 저장되며 어디에도 전송되지 않아요. 만든 디자인은 보관함에 남아 다음 시즌에도 씁니다.</p>
			<button class="btn btn--primary" data-action="create-goods" ${snap.affordable ? "" : "disabled"}>
				${snap.currentName ? "바꾸기" : "만들기"} · 개설비 ${snap.cost}
			</button>
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
