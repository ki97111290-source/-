import { duration, fans, fmt, rate, won } from "../core/format";
import { remainingLabel, remainingOf } from "../core/season";
import type { GameState } from "../core/types";
import { buyUpgrade, seat, uploadCharacter } from "../game/actions";
import { consign, placePlayerBid } from "../game/auction";
import { fileToAvatar } from "../game/avatar";
import { BALANCE } from "../game/balance";
import { ownedCharacters } from "../game/characters";
import { cheersPerSlot, incomePerSecond, offlineEfficiency, slotIncome } from "../game/economy";
import type { Engine } from "../game/engine";
import {
	BURST_STEPS,
	KITS,
	type KitDef,
	PRICE_STEPS,
	acceptTopBid,
	auctionSeconds,
	cancelAuction,
	closeGoods,
	editionSeconds,
	fairPrice,
	kitCost,
	kitUnlocked,
	lineOf,
	lineRevenue,
	openCost,
	printEdition,
	releaseGoods,
	revenueOf,
	salesPower,
	salvageValue,
	scrapEdition,
} from "../game/goods";
import { buyShares, maxBuyable, sellShares, tradeFee } from "../game/market";
import { clearSave, exportSave, importSave, lockSave, saveGame } from "../game/save";
import { netWorth } from "../game/state";
import { html, paint, raw } from "./dom";
import { copyText, inArtifactFrame, saveViaHost } from "./host";
import { toggleHints, toggleWatchOnly } from "./prefs";
import { toggleTheme } from "./theme";
import {
	type GoodsSheet,
	type KitSheet,
	type PickItem,
	type SettingsSheet,
	TABS,
	type TabId,
	closeModals,
	toast,
	ui,
} from "./uiState";
import { renderGoods } from "./views/goods";
import { renderMarket } from "./views/market";
import { renderModal } from "./views/modals";
import { renderRoom } from "./views/room";
import { renderRoster } from "./views/roster";
import { renderSeason, renderSeasonModal } from "./views/season";
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

	engine.onSeasonEnd = (report) => {
		ui.seasonReport = report;
		closeModals();
		ui.tab = "season";
	};

	let lastRender = 0;
	engine.start(() => {
		const now = performance.now();
		if (now - lastRender < RENDER_INTERVAL) return;
		lastRender = now;
		render(refs, engine.state);
		spawnIdleGains(refs.view, engine.state, Date.now());
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
			<div class="brand">
				<span class="brand__mark">✦</span> 버츄얼 팬덤 타이쿤
				<span class="brand__season">${seasonLabelShort(state)} · ${remainingLabel(remainingOf(state.seasonEndsAt))} 남음</span>
			</div>
			<div class="hud__right">
				<button
					class="iconbtn"
					type="button"
					data-action="open-settings"
					title="설정"
					aria-label="설정 열기"
				>⚙</button>
				<div class="wallet">
					<div class="wallet__coin">${won(state.money)}</div>
					<div class="wallet__sub">
						${rate(incomePerSecond(state))} · <span class="wallet__fans">💜 ${fans(state.seasonFans)}</span>
					</div>
				</div>
			</div>
		`,
	);

	paint(
		refs.tabs,
		TABS.map((t) => {
			// 경매는 캐릭터 탭 안에 있다. 매물이 올라오면 점으로 알린다.
			const live = t.id === "roster" && state.auction;
			return html`<button class="tab ${ui.tab === t.id ? "tab--on" : ""}" data-action="tab" data-id="${t.id}">
				<span aria-hidden="true">${t.icon}</span>${t.label}${raw(live ? '<i class="tab__dot" title="경매 진행 중"></i>' : "")}
			</button>`;
		}).join(""),
	);

	paint(refs.view, renderView(state));
	paint(refs.modal, ui.seasonReport ? renderSeasonModal(ui.seasonReport) : renderModal());

	paint(
		refs.log,
		state.log
			// 아래 띠는 두 줄까지만. 그 위는 소식이 아니라 벽이 된다.
			.slice(0, 2)
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
		case "goods":
			return renderGoods(state);
		case "market":
			return renderMarket(state);
		case "season":
			return renderSeason(state);
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

/**
 * 수량·입찰가 칸은 type="text"다. number 칸은 캐럿 위치를 알려주지 않아
 * (selectionStart가 null) 다시 그릴 때마다 커서가 맨 앞으로 튀어
 * "1000"이 "0001"로 뒤집힌다. 대신 숫자가 아닌 글자는 여기서 걸러낸다.
 */
function onInput(event: Event): void {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const role = target.dataset.role;
	if (role !== "bid" && role !== "qty") return;

	const digits = target.value.replace(/[^0-9]/g, "");
	if (digits !== target.value) target.value = digits;
	if (role === "bid") ui.bid = digits;
	else if (target.dataset.id) ui.qty[target.dataset.id] = digits;
}

async function onChange(event: Event): Promise<void> {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const file = target.files?.[0];
	if (!file) return;

	// 미리보기가 바뀌면 모달을 다시 그리므로, 입력 중이던 값을 먼저 붙잡아 둔다.
	if (target.id === "upload-file") {
		captureUploadFields();
		try {
			ui.uploadAvatar = await fileToAvatar(file);
			ui.uploadError = null;
		} catch (err) {
			ui.uploadError = err instanceof Error ? err.message : "이미지를 처리하지 못했어요.";
		}
		return;
	}
	if (target.id === "goods-file") {
		captureGoodsFields();
		try {
			ui.goodsImage = await fileToAvatar(file);
			ui.goodsError = null;
		} catch (err) {
			ui.goodsError = err instanceof Error ? err.message : "이미지를 처리하지 못했어요.";
		}
	}
}

function seasonLabelShort(state: GameState): string {
	if (state.seasonId.startsWith("local-")) return `시즌 ${state.meta.seasonsPlayed + 1}`;
	const month = Number(state.seasonId.split("-")[1] ?? 0);
	return month ? `${month}월 시즌` : "시즌";
}

function fieldValue(id: string): string {
	const field = document.getElementById(id);
	if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field.value;
	return "";
}

function captureUploadFields(): void {
	ui.uploadName = fieldValue("upload-name");
	ui.uploadAgency = fieldValue("upload-agency");
}

/** 굿즈 시트를 다시 그리기 전에 타이핑 중이던 이름을 붙잡아 둔다. */
function captureGoodsFields(): void {
	if (!ui.goodsSheet) return;
	ui.goodsName = fieldValue("goods-name");
}

/** 설정 시트 스냅샷. 열린 동안 숫자가 흔들리면 버튼이 손가락 밑에서 교체된다. */
function snapshotSettings(state: GameState): SettingsSheet {
	const played = (Date.now() - state.startedAt) / 1000;
	return {
		records: [
			{ label: "총 자산", value: won(netWorth(state)) },
			{ label: "누적 수입", value: won(state.totalEarned) },
			{ label: "누적 응원", value: `${fmt(state.totalCheers)}회` },
			{ label: "플레이 시간", value: duration(played) },
		],
		offline: `${Math.round(offlineEfficiency(state) * 100)}%`,
	};
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

/** 굿즈 만들기 시트 스냅샷. 열 때와 캐릭터를 고를 때만 다시 만든다. */
function snapshotGoods(state: GameState, characterId: string | null): GoodsSheet {
	const owned = ownedCharacters(state);
	const selected = owned.find((c) => c.id === characterId) ?? owned[0];
	const current = selected ? lineOf(state, selected.id) : undefined;
	const cost = selected ? openCost(state, selected) : 0;
	const power = selected ? salesPower(state, selected) : 0;
	const bronze = KITS[0] as KitDef;

	return {
		picks: owned.map((c) => ({
			id: c.id,
			name: c.name,
			avatar: c.avatar,
			hasLine: Boolean(lineOf(state, c.id)),
		})),
		selectedId: selected?.id ?? "",
		selectedName: selected?.name ?? "",
		currentName: current ? current.design.name : null,
		cost: won(cost),
		affordable: state.money >= cost,
		steps: BURST_STEPS.map((step) => ({
			value: step.value,
			label: step.label,
			desc: step.desc,
			// 브론즈 키트 기준으로 "한 판이 얼마나 가는지"를 미리 보여준다
			preview: `한 판 ${duration(editionSeconds(step.value, bronze))} · 매출 ${rate(power * revenueOf(step.value) * bronze.power)}`,
		})),
		saved: state.meta.goodsDesigns.map((d) => ({ ...d })),
	};
}

/** 한정판 찍기 시트 스냅샷. 등급 × 지금 고른 가격의 결과를 미리 계산한다. */
function snapshotKit(state: GameState, lineId: string, factor: number): KitSheet | null {
	const line = state.goods.find((l) => l.id === lineId);
	const character = line ? state.characters[line.characterId] : undefined;
	if (!line || !character) return null;

	const burst = line.design.burst;
	const power = salesPower(state, character);
	const salvage = salvageValue(line);

	return {
		lineId,
		title: `${character.name} ‘${line.design.name}’ 한정판`,
		salvage: salvage > 0 ? `팔던 재고는 떨이로 정리되어 ${won(salvage)}이 돌아옵니다.` : "",
		priceSteps: PRICE_STEPS.map((s) => ({ ...s })),
		factor,
		kits: KITS.map((kit) => {
			const cost = kitCost(state, character, line, kit);
			const fair = fairPrice(power, burst, kit);
			// 비싸게 낼수록 덜 팔린다. 총액은 늘지만 완판까지 오래 걸린다.
			const demand = (kit.units / editionSeconds(burst, kit)) * factor ** -BALANCE.goodsElasticity;
			const common = {
				id: kit.id,
				name: kit.name,
				icon: kit.icon,
				units: kit.units.toLocaleString("ko-KR"),
				title: kit.title,
				locked: !kitUnlocked(state, kit),
				lockLabel: `시즌 팬심 ${fmt(kit.fansNeeded)} 필요`,
				cost: won(cost),
				affordable: state.money >= cost,
			};
			// 유일본은 흘려 파는 게 아니라 경매다. 시작가와 마감 시간을 보여준다.
			if (kit.auctioned) {
				return {
					...common,
					auctioned: true,
					price: won(fair * factor),
					revenue: "경매",
					lasts: duration(auctionSeconds(burst, kit)),
					total: won(fair * factor),
				};
			}
			return {
				...common,
				auctioned: false,
				price: won(fair * factor),
				revenue: rate(demand * fair * factor),
				lasts: duration(kit.units / demand),
				total: won(kit.units * fair * factor),
			};
		}),
	};
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

		case "open-picker":
			ui.pickerSlot = Number(actionEl.dataset.slot ?? "0");
			ui.pickerList = snapshotOwned(state);
			break;

		case "close-picker":
			closeModals();
			break;

		case "close-season":
			ui.seasonReport = null;
			break;

		case "theme":
			toast(toggleTheme() === "dark" ? "어두운 화면" : "밝은 화면");
			break;

		case "open-settings":
			ui.settings = snapshotSettings(state);
			break;

		case "close-settings":
			closeModals();
			break;

		case "hints":
			toast(toggleHints() ? "설명을 다시 켰어요" : "설명을 숨겼어요");
			break;

		case "watch-only":
			toast(toggleWatchOnly() ? "관심 종목만 봅니다" : "전체 종목을 봅니다");
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
				ui.tab = "roster";
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

		case "pick-row":
			// 스물여섯 줄에 주문 칸을 전부 깔지 않는다. 누른 줄에만 열어 준다.
			ui.tradeRow = ui.tradeRow === id ? null : id;
			break;

		case "max-buy": {
			const character = state.characters[id];
			if (!character) break;
			const max = maxBuyable(state, character);
			if (max <= 0) {
				toast("현금의 절반으로는 한 주도 살 수 없어요.", "bad");
				break;
			}
			ui.qty[id] = String(max);
			toast(`최대 ${fmt(max)}주 · ${won(max * character.price * (1 + tradeFee(state)))}`);
			break;
		}

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

		// 라인 카드에서 열었으면 그 캐릭터를 미리 골라둔다
		case "open-goods": {
			const line = id ? lineOf(state, id) : undefined;
			ui.goodsName = line?.design.name ?? "";
			ui.goodsImage = line?.design.image ?? null;
			ui.goodsBurst = line?.design.burst ?? 0;
			ui.goodsError = null;
			ui.goodsSheet = snapshotGoods(state, id || null);
			break;
		}

		case "close-goods":
			closeModals();
			break;

		case "goods-pick":
			captureGoodsFields();
			ui.goodsSheet = snapshotGoods(state, id);
			break;

		case "goods-burst":
			captureGoodsFields();
			ui.goodsBurst = Number(actionEl.dataset.value ?? "0");
			break;

		case "goods-load": {
			const saved = state.meta.goodsDesigns.find((d) => d.name === actionEl.dataset.name);
			if (saved) {
				ui.goodsName = saved.name;
				ui.goodsImage = saved.image;
				ui.goodsBurst = saved.burst;
			}
			break;
		}

		case "create-goods": {
			captureGoodsFields();
			const target = ui.goodsSheet?.selectedId ?? "";
			const res = releaseGoods(state, target, {
				name: ui.goodsName,
				image: ui.goodsImage,
				burst: ui.goodsBurst,
			});
			if (res.ok) {
				closeModals();
				if (!engine.saveNow()) {
					toast("저장 공간이 가득 찼어요. 사진이 큰 굿즈나 캐릭터를 정리해주세요.", "bad");
				} else {
					toast(res.message, "good");
				}
			} else {
				ui.goodsError = res.message;
			}
			break;
		}

		case "reprint": {
			// 지난번과 같은 등급·가격으로 한 번에 다시 찍는다
			const line = state.goods.find((l) => l.id === id);
			if (!line?.lastKit) break;
			const res = printEdition(state, line.id, line.lastKit, line.lastFactor);
			toast(res.message, res.ok ? "good" : "bad");
			break;
		}

		case "open-kit":
			ui.kitSheet = snapshotKit(state, id, 1);
			break;

		case "close-kit":
			closeModals();
			break;

		case "kit-price":
			if (ui.kitSheet) {
				ui.kitSheet = snapshotKit(
					state,
					ui.kitSheet.lineId,
					Number(actionEl.dataset.factor ?? "1"),
				);
			}
			break;

		case "print-edition": {
			const grade = actionEl.dataset.grade as Parameters<typeof printEdition>[2];
			const res = printEdition(state, id, grade, ui.kitSheet?.factor ?? 1);
			toast(res.message, res.ok ? "good" : "bad");
			if (res.ok) closeModals();
			break;
		}

		case "accept-bid": {
			const res = acceptTopBid(state, id);
			toast(res.message, res.ok ? "good" : "bad");
			break;
		}

		case "cancel-auction": {
			const res = cancelAuction(state, id);
			toast(res.message, res.ok ? "info" : "bad");
			break;
		}

		case "scrap": {
			const res = scrapEdition(state, id);
			toast(res.message, res.ok ? "info" : "bad");
			break;
		}

		case "close-goods-line": {
			const res = closeGoods(state, id);
			toast(res.message, res.ok ? "info" : "bad");
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
			void exportToFile(state);
			break;

		case "import":
			// 뷰어 안에서는 파일 선택 창이 열리지 않을 수 있어, 붙여넣기 칸을 함께 연다.
			if (inArtifactFrame()) ui.saveSheet = { mode: "import", text: "", error: null };
			else pickSaveFile();
			break;

		case "close-save":
			// 설정 시트에서 열었다면 그리로 되돌아간다 (renderModal이 그다음으로 그린다)
			ui.saveSheet = null;
			break;

		case "copy-save":
			void copySave();
			break;

		case "paste-save":
			applySave(fieldValue("save-text"));
			break;

		case "pick-save-file":
			pickSaveFile();
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

/** 화면 좌표에 코인 획득량을 띄운다. */
function floatGain(x: number, y: number, amount: number): void {
	if (amount <= 0) return;
	const el = document.createElement("span");
	el.className = "floatgain";
	el.textContent = `+${won(amount)}`;
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;
	document.body.appendChild(el);
	el.addEventListener("animationend", () => el.remove());
}

/** 응원석 위로 자동 응원 수입이 계속 떠오르게 한다. 방치형의 유일한 "손맛". */
const nextFloatAt = new Map<string, number>();

function spawnIdleGains(view: HTMLElement, state: GameState, now: number): void {
	if (ui.tab !== "room" || document.hidden) return;
	const perSlot = cheersPerSlot(state);
	if (perSlot <= 0) return;

	// 응원이 아무리 빨라져도 화면은 초당 2회 정도만 갱신한다.
	const interval = Math.max(500, 1000 / Math.min(perSlot, 2));
	for (const el of view.querySelectorAll<HTMLElement>(".slot--live")) {
		const id = el.dataset.slotId;
		if (!id) continue;
		const due = nextFloatAt.get(id);
		// 처음 본 카드는 시각만 잡아두고 다음 주기부터 띄운다.
		if (due === undefined) {
			nextFloatAt.set(id, now + interval);
			continue;
		}
		if (now < due) continue;
		nextFloatAt.set(id, now + interval);

		// 돈은 굿즈에서 나오므로, 굿즈를 내고 있는 캐릭터 위에만 매출이 떠오른다.
		const line = lineOf(state, id);
		if (!line) continue;
		const perSecond = lineRevenue(state, line);
		const rect = el.getBoundingClientRect();
		floatGain(
			rect.left + rect.width / 2 + (Math.random() * 44 - 22),
			rect.top + rect.height * 0.38,
			perSecond * (interval / 1000),
		);
	}
}

async function exportToFile(state: GameState): Promise<void> {
	const json = exportSave(state);
	const filename = `fandom-tycoon-${new Date().toISOString().slice(0, 10)}.json`;

	// 아티팩트 뷰어 안에서는 <a download>가 조용히 무시된다.
	// 내려받은 척하지 말고, 뷰어의 저장 창을 쓰거나 글로 띄운다.
	if (inArtifactFrame()) {
		switch (await saveViaHost(filename, json)) {
			case "saved":
				toast("세이브를 내려받았어요.", "good");
				return;
			case "declined":
				toast("저장을 취소했어요.");
				return;
			case "busy":
				toast("저장 창이 이미 열려 있어요.", "bad");
				return;
			default:
				ui.saveSheet = { mode: "export", text: json, error: null };
				return;
		}
	}

	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	toast("세이브를 내려받았어요.", "good");
}

async function copySave(): Promise<void> {
	const text = ui.saveSheet?.text ?? "";
	if (await copyText(text)) {
		toast("복사했어요. 안전한 곳에 붙여넣어 두세요.", "good");
		return;
	}
	// 클립보드가 막힌 환경 — 직접 긁어 복사하도록 전부 선택해 준다.
	const box = document.getElementById("save-text");
	if (box instanceof HTMLTextAreaElement) {
		box.focus();
		box.select();
	}
	toast("직접 복사해주세요. 전부 선택해 뒀어요.", "bad");
}

function pickSaveFile(): void {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "application/json,.json";
	input.addEventListener("change", async () => {
		const file = input.files?.[0];
		if (!file) return;
		applySave(await file.text());
	});
	input.click();
}

function applySave(text: string): void {
	if (!text.trim()) {
		toast("붙여넣은 내용이 없어요.", "bad");
		return;
	}
	try {
		const state = importSave(text);
		if (!saveGame(state)) throw new Error("저장 공간이 부족해 불러오지 못했어요.");
		lockSave();
		toast("불러왔어요. 새로고침합니다.", "good");
		setTimeout(() => location.reload(), 600);
	} catch (err) {
		const message = err instanceof Error ? err.message : "세이브를 읽지 못했어요.";
		// 시트가 열려 있으면 붙여넣은 글을 지우지 않고 그대로 되돌려 놓는다.
		if (ui.saveSheet?.mode === "import") ui.saveSheet = { mode: "import", text, error: message };
		toast(message, "bad");
	}
}
