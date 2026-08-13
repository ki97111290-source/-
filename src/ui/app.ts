import { coin, fmt, rate } from "../core/format";
import type { GameState } from "../core/types";
import { buyUpgrade, seat, uploadCharacter } from "../game/actions";
import { consign, placePlayerBid } from "../game/auction";
import { fileToAvatar } from "../game/avatar";
import { ownedCharacters } from "../game/characters";
import { incomePerSecond, slotIncome, tapCheer } from "../game/economy";
import type { Engine } from "../game/engine";
import { buyShares, sellShares } from "../game/market";
import { clearSave, exportSave, importSave, saveGame } from "../game/save";
import { netWorth } from "../game/state";
import { html, paint } from "./dom";
import { type PickItem, TABS, type TabId, closeModals, toast, ui } from "./uiState";
import { renderAuction } from "./views/auctionView";
import { renderMarket } from "./views/market";
import { renderModal } from "./views/modals";
import { renderRoom } from "./views/room";
import { renderRoster } from "./views/roster";
import { renderShop } from "./views/shop";

const RENDER_INTERVAL = 100;

export function mountApp(root: HTMLElement, engine: Engine): void {
	root.innerHTML = `
		<div class="shell">
			<header class="hud" id="hud"></header>
			<nav class="tabs" id="tabs"></nav>
			<main class="view" id="view"></main>
			<footer class="logbar" id="logbar"></footer>
		</div>
		<div class="modalroot" id="modalroot"></div>
		<div class="toastwrap" id="toastwrap"></div>
	`;

	const refs = {
		hud: must(root, "hud"),
		tabs: must(root, "tabs"),
		view: must(root, "view"),
		log: must(root, "logbar"),
		modal: must(root, "modalroot"),
		toast: must(root, "toastwrap"),
	};

	bindEvents(root, engine);

	let lastRender = 0;
	engine.start(() => {
		const now = performance.now();
		if (now - lastRender < RENDER_INTERVAL) return;
		lastRender = now;
		render(refs, engine.state);
	});
	render(refs, engine.state);
	// 첫 진입 직후 탭을 닫아도 진행이 남도록 한 번 저장해 둔다.
	engine.saveNow();

	window.addEventListener("beforeunload", () => engine.saveNow());
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") engine.saveNow();
	});
}

type Refs = Record<"hud" | "tabs" | "view" | "log" | "modal" | "toast", HTMLElement>;

function must(root: HTMLElement, id: string): HTMLElement {
	const el = root.querySelector<HTMLElement>(`#${id}`);
	if (!el) throw new Error(`#${id} 를 찾지 못했습니다`);
	return el;
}

function render(refs: Refs, state: GameState): void {
	paint(
		refs.hud,
		html`
			<div class="brand"><span class="brand__mark">✦</span> 버츄얼 팬덤 타이쿤</div>
			<div class="wallet">
				<div class="wallet__coin">${coin(state.coins)}</div>
				<div class="wallet__sub">${rate(incomePerSecond(state))} · 자산 ${coin(netWorth(state))}</div>
			</div>
		`,
	);

	paint(
		refs.tabs,
		TABS.map(
			(
				t,
			) => html`<button class="tab ${ui.tab === t.id ? "tab--on" : ""}" data-action="tab" data-id="${t.id}">
				<span aria-hidden="true">${t.icon}</span>${t.label}
			</button>`,
		).join(""),
	);

	paint(refs.view, renderView(state));
	paint(refs.modal, renderModal());

	paint(
		refs.log,
		state.log
			.slice(0, 4)
			.map((entry) => html`<p class="log log--${entry.kind}">${entry.text}</p>`)
			.join("") || '<p class="log muted">여기에 소식이 표시됩니다.</p>',
	);

	const t = ui.toast;
	paint(
		refs.toast,
		t && t.until > Date.now() ? html`<div class="toast toast--${t.kind}">${t.text}</div>` : "",
	);
}

function renderView(state: GameState): string {
	switch (ui.tab) {
		case "room":
			return renderRoom(state);
		case "roster":
			return renderRoster(state);
		case "auction":
			return renderAuction(state);
		case "market":
			return renderMarket(state);
		case "shop":
			return renderShop(state);
	}
}

function bindEvents(root: HTMLElement, engine: Engine): void {
	root.addEventListener("click", (event) => onClick(event, engine));
	root.addEventListener("input", onInput);
	root.addEventListener("change", (event) => void onChange(event));
	root.addEventListener("submit", (event) => {
		event.preventDefault();
		submitUpload(engine);
	});
}

function onInput(event: Event): void {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	if (target.dataset.role === "bid") ui.bid = target.value;
	if (target.dataset.role === "qty" && target.dataset.id) {
		ui.qty[target.dataset.id] = target.value;
	}
}

async function onChange(event: Event): Promise<void> {
	const target = event.target;
	if (!(target instanceof HTMLInputElement) || target.id !== "upload-file") return;
	const file = target.files?.[0];
	if (!file) return;
	// 미리보기가 바뀌면 모달을 다시 그리므로, 입력 중이던 값을 먼저 붙잡아 둔다.
	captureUploadFields();
	try {
		ui.uploadAvatar = await fileToAvatar(file);
		ui.uploadError = null;
	} catch (err) {
		ui.uploadError = err instanceof Error ? err.message : "이미지를 처리하지 못했어요.";
	}
}

function fieldValue(id: string): string {
	return (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
}

function captureUploadFields(): void {
	ui.uploadName = fieldValue("upload-name");
	ui.uploadAgency = fieldValue("upload-agency");
}

function snapshotOwned(state: GameState): PickItem[] {
	return ownedCharacters(state).map((c) => ({
		id: c.id,
		name: c.name,
		avatar: c.avatar,
		popularity: fmt(c.popularity),
		income: fmt(slotIncome(c)),
		seated: state.slots.includes(c.id),
	}));
}

function onClick(event: MouseEvent, engine: Engine): void {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const actionEl = target.closest<HTMLElement>("[data-action]");
	if (!actionEl) return;
	// 시트 안쪽을 눌렀는데 잡힌 액션이 바깥 오버레이라면 무시한다.
	const stop = target.closest("[data-stop]");
	if (stop && !stop.contains(actionEl)) return;

	const state = engine.state;
	const action = actionEl.dataset.action;
	const id = actionEl.dataset.id ?? "";

	switch (action) {
		case "tab":
			ui.tab = id as TabId;
			closeModals();
			break;

		case "cheer": {
			const gained = tapCheer(state, id);
			floatGain(event.clientX, event.clientY, gained, state.combo.count);
			break;
		}

		case "open-picker":
			ui.pickerSlot = Number(actionEl.dataset.slot ?? "0");
			ui.pickerList = snapshotOwned(state);
			break;

		case "close-picker":
			closeModals();
			break;

		case "seat": {
			const slotIndex = Number(actionEl.dataset.slot ?? "0");
			const res = seat(state, slotIndex, id || null);
			if (!res.ok) toast(res.message, "bad");
			closeModals();
			break;
		}

		case "quick-seat": {
			const empty = state.slots.indexOf(null);
			const index = empty >= 0 ? empty : 0;
			const res = seat(state, index, id);
			toast(res.ok ? `${index + 1}번 응원석에 배치했어요.` : res.message, res.ok ? "good" : "bad");
			ui.tab = "room";
			break;
		}

		case "consign": {
			const err = consign(state, id, Math.random);
			if (err) toast(err, "bad");
			else {
				ui.tab = "auction";
				toast("경매장에 출품했어요.", "good");
			}
			break;
		}

		case "bid-min":
			ui.bid = actionEl.dataset.amount ?? "";
			placeBid(state, Number(ui.bid));
			break;

		case "bid":
			placeBid(state, Number(ui.bid || 0));
			break;

		case "buy": {
			const res = buyShares(state, id, qtyOf(id));
			toast(res.message, res.ok ? "good" : "bad");
			break;
		}

		case "sell": {
			const res = sellShares(state, id, qtyOf(id));
			toast(res.message, res.ok ? "good" : "bad");
			break;
		}

		case "upgrade": {
			const res = buyUpgrade(state, id as Parameters<typeof buyUpgrade>[1]);
			toast(res.message, res.ok ? "good" : "bad");
			break;
		}

		case "open-upload":
			ui.uploadOpen = true;
			ui.uploadAvatar = null;
			ui.uploadError = null;
			ui.uploadName = "";
			ui.uploadAgency = "";
			break;

		case "close-upload":
			closeModals();
			break;

		case "submit-upload":
			// form submit 이벤트에서 처리한다.
			return;

		case "export":
			exportToFile(state);
			break;

		case "import":
			importFromFile();
			break;

		case "reset":
			if (confirm("정말 처음부터 다시 시작할까요? 지금까지의 진행은 사라집니다.")) {
				clearSave();
				location.reload();
			}
			break;
	}
}

function qtyOf(id: string): number {
	const raw = Number(ui.qty[id] ?? "10");
	return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function placeBid(state: GameState, amount: number): void {
	if (!Number.isFinite(amount) || amount <= 0) {
		toast("입찰가를 입력해주세요.", "bad");
		return;
	}
	const err = placePlayerBid(state, amount);
	if (err) toast(err, "bad");
	else {
		ui.bid = "";
		toast("입찰했습니다!", "good");
	}
}

function submitUpload(engine: Engine): void {
	if (!ui.uploadOpen) return;
	captureUploadFields();
	const res = uploadCharacter(engine.state, {
		name: ui.uploadName,
		agency: ui.uploadAgency || "무소속",
		avatar: ui.uploadAvatar ?? undefined,
	});
	if (!res.ok) {
		ui.uploadError = res.message;
		return;
	}
	closeModals();
	ui.uploadAvatar = null;
	ui.uploadError = null;
	ui.uploadName = "";
	ui.uploadAgency = "";
	if (!engine.saveNow()) {
		toast("저장 공간이 가득 찼어요. 이미지가 큰 캐릭터를 정리해주세요.", "bad");
	} else {
		toast(res.message, "good");
	}
}

/** 클릭 지점에 코인 획득량을 띄운다. 콤보가 붙으면 더 크고 뜨겁게. */
function floatGain(x: number, y: number, amount: number, combo: number): void {
	if (amount <= 0) return;
	const el = document.createElement("span");
	el.className = combo >= 10 ? "floatgain floatgain--hot" : "floatgain";
	el.textContent = combo >= 2 ? `+${coin(amount)} ×${combo}` : `+${coin(amount)}`;
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;
	document.body.appendChild(el);
	el.addEventListener("animationend", () => el.remove());
}

function exportToFile(state: GameState): void {
	const blob = new Blob([exportSave(state)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `fandom-tycoon-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	toast("세이브를 내려받았어요.", "good");
}

function importFromFile(): void {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "application/json,.json";
	input.addEventListener("change", async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const state = importSave(await file.text());
			if (!saveGame(state)) throw new Error("저장 공간이 부족해 불러오지 못했어요.");
			toast("불러왔어요. 새로고침합니다.", "good");
			setTimeout(() => location.reload(), 600);
		} catch (err) {
			toast(err instanceof Error ? err.message : "세이브를 읽지 못했어요.", "bad");
		}
	});
	input.click();
}
