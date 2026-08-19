import type { SeasonReport } from "../game/season";

export type TabId = "room" | "roster" | "goods" | "auction" | "market" | "season" | "shop";

export interface Toast {
	text: string;
	kind: "info" | "good" | "bad";
	until: number;
}

/** 응원석 선택 패널에 뿌릴 스냅샷 (열린 동안 값이 흔들리지 않게 고정한다) */
export interface PickItem {
	id: string;
	name: string;
	avatar: string;
	popularity: string;
	income: string;
	seated: boolean;
}

/** 굿즈 발매 시트도 열린 시점의 스냅샷으로만 그린다 (매 프레임 다시 그리면 버튼이 눌리지 않는다) */
export interface GoodsSheet {
	picks: { id: string; name: string; avatar: string; typeIcon: string }[];
	selectedId: string;
	selectedName: string;
	/** 이미 내고 있는 굿즈 이름. 없으면 null */
	currentType: string | null;
	types: {
		id: string;
		name: string;
		icon: string;
		desc: string;
		halfLifeHours: number;
		revenue: string;
		cost: string;
		affordable: boolean;
		current: boolean;
	}[];
}

export interface UiState {
	tab: TabId;
	/** 캐릭터 선택 패널이 열린 슬롯 번호 */
	pickerSlot: number | null;
	pickerList: PickItem[] | null;
	uploadOpen: boolean;
	uploadAvatar: string | null;
	uploadError: string | null;
	/** 모달을 다시 그릴 때 되살릴 입력값. 타이핑 중에는 건드리지 않는다. */
	uploadName: string;
	uploadAgency: string;
	/** 굿즈 발매 시트. null이면 닫혀 있다. */
	goodsSheet: GoodsSheet | null;
	bid: string;
	/** 종목별 주문 수량 입력값 */
	qty: Record<string, string>;
	toast: Toast | null;
	/** 시즌이 넘어간 직후 보여줄 결과 */
	seasonReport: SeasonReport | null;
}

export const ui: UiState = {
	tab: "room",
	pickerSlot: null,
	pickerList: null,
	uploadOpen: false,
	uploadAvatar: null,
	uploadError: null,
	uploadName: "",
	uploadAgency: "",
	goodsSheet: null,
	bid: "",
	qty: {},
	toast: null,
	seasonReport: null,
};

export function toast(text: string, kind: Toast["kind"] = "info"): void {
	ui.toast = { text, kind, until: Date.now() + 2600 };
}

export function closeModals(): void {
	ui.pickerSlot = null;
	ui.pickerList = null;
	ui.uploadOpen = false;
	ui.goodsSheet = null;
}

export const TABS: { id: TabId; label: string; icon: string }[] = [
	{ id: "room", label: "응원 룸", icon: "📣" },
	{ id: "roster", label: "캐릭터", icon: "🎀" },
	{ id: "goods", label: "굿즈", icon: "🏭" },
	{ id: "auction", label: "경매장", icon: "🔨" },
	{ id: "market", label: "주식", icon: "📈" },
	{ id: "season", label: "시즌", icon: "🏆" },
	{ id: "shop", label: "상점", icon: "🛠" },
];
