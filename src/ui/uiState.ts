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

/**
 * 굿즈 만들기 시트. 이름·사진은 입력값이라 ui에 붙들어 두고,
 * 비용 같은 실시간 수치는 열린 시점의 스냅샷만 쓴다.
 * (매 프레임 다시 그리면 타이핑 중인 값과 한글 조합이 날아간다)
 */
export interface GoodsSheet {
	picks: { id: string; name: string; avatar: string; hasLine: boolean }[];
	selectedId: string;
	selectedName: string;
	/** 이미 내고 있는 굿즈 이름. 없으면 null */
	currentName: string | null;
	cost: string;
	affordable: boolean;
	/** 판매 성향별 미리보기 */
	steps: { value: number; label: string; desc: string; preview: string }[];
	/** 보관함에 저장해 둔 디자인 */
	saved: { name: string; image: string | null; burst: number }[];
}

/** 한정판 찍기 시트. 등급 × 가격 조합의 결과를 미리 계산해 보여준다. */
export interface KitSheet {
	lineId: string;
	title: string;
	/** 지금 팔던 재고를 떨이로 넘기고 시작한다면 얼마를 돌려받는지 */
	salvage: string;
	priceSteps: { factor: number; label: string }[];
	factor: number;
	kits: {
		id: string;
		name: string;
		icon: string;
		units: string;
		/** 이 등급에 붙는 칭호 */
		title: string | null;
		/** 유일본은 흘려 파는 대신 경매에 올린다 */
		auctioned: boolean;
		locked: boolean;
		lockLabel: string;
		cost: string;
		affordable: boolean;
		price: string;
		revenue: string;
		lasts: string;
		total: string;
	}[];
}

/**
 * 세이브를 글로 주고받는 시트.
 * 파일을 내려받거나 고를 수 없는 환경(아티팩트 뷰어)에서의 통로다.
 */
export interface SaveSheet {
	mode: "export" | "import";
	/** 내보내기일 때만 채운다 — 불러오기는 붙여넣을 빈칸으로 연다 */
	text: string;
	error: string | null;
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
	/** 굿즈 만들기 시트. null이면 닫혀 있다. */
	goodsSheet: GoodsSheet | null;
	/** 만들고 있는 굿즈의 이름·사진·판매 성향 (입력 중에도 살아남아야 한다) */
	goodsName: string;
	goodsImage: string | null;
	goodsBurst: number;
	goodsError: string | null;
	/** 한정판 찍기 시트 */
	kitSheet: KitSheet | null;
	/** 세이브를 글로 주고받는 시트 */
	saveSheet: SaveSheet | null;
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
	goodsName: "",
	goodsImage: null,
	goodsBurst: 0,
	goodsError: null,
	kitSheet: null,
	saveSheet: null,
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
	ui.goodsError = null;
	ui.kitSheet = null;
	ui.saveSheet = null;
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
