import { type Rng, range, uid } from "../core/rng";
import type {
	Character,
	GameState,
	GoodsAuction,
	GoodsBid,
	GoodsLine,
	GoodsTypeId,
	KitGrade,
} from "../core/types";
import { BALANCE } from "./balance";
import { RIVAL_NAMES } from "./characters";
import { bonusMultiplier, cheerPush, slotIncome } from "./room";
import { pushLog, upgradeLevel } from "./state";
import { awardTitle } from "./titles";
import { traitOf } from "./traits";

export interface GoodsType {
	id: GoodsTypeId;
	name: string;
	icon: string;
	/** 한정판 매출 배수 */
	revenue: number;
	/** 팔려나가는 속도. 클수록 빨리 소진된다. */
	pace: number;
	desc: string;
}

/**
 * 굿즈 종류는 "시간당 매출"과 "한 판이 얼마나 오래 가는가"를 맞바꾼다.
 * 자주 못 들여다보는 사람은 키링을, 자주 챙길 사람은 인형을 고르면 된다.
 */
export const GOODS_TYPES: readonly GoodsType[] = [
	{
		id: "keyring",
		name: "키링",
		icon: "🔑",
		revenue: 0.8,
		pace: 0.6,
		desc: "한 판이 오래 간다. 방치할수록 유리",
	},
	{
		id: "acrylic",
		name: "아크릴 스탠드",
		icon: "🧊",
		revenue: 1.2,
		pace: 1,
		desc: "무난한 기본형",
	},
	{
		id: "photobook",
		name: "화보집",
		icon: "📖",
		revenue: 1.6,
		pace: 1.5,
		desc: "매출이 크지만 금방 빠진다",
	},
	{
		id: "plush",
		name: "인형",
		icon: "🧸",
		revenue: 2.2,
		pace: 2.2,
		desc: "폭발적. 자주 다시 찍어야 한다",
	},
] as const;

export interface KitDef {
	id: KitGrade;
	name: string;
	icon: string;
	/** 발행 수량. 등급이 높을수록 적게 찍는다 — 희소성이 값을 만든다. */
	units: number;
	/** 적정가로 팔았을 때 한 판이 가는 시간(시간). 종류의 pace로 나뉜다. */
	hours: number;
	/** 한정판 매출 배수 */
	power: number;
	/** 이 키트를 쓰려면 필요한 이번 시즌 팬심 */
	fansNeeded: number;
	/** 이 등급에만 붙는 칭호. 없으면 null */
	title: string | null;
	/** 1개뿐이라 흘려 팔 수 없고 경매에 올린다 */
	auctioned?: boolean;
}

/**
 * 키트 등급. 위로 갈수록 적게 찍고 비싸게 팔리며, 이번 시즌 팬심으로 잠금이 풀린다.
 * 팬심은 여전히 쓰이지 않는다 — 소비가 아니라 "살 자격"으로만 쓴다.
 * 그래서 방치로 쌓은 응원이 굿즈 시장 접근권으로 이어진다.
 */
export const KITS: readonly KitDef[] = [
	{
		id: "bronze",
		name: "브론즈 키트",
		icon: "🥉",
		units: 500,
		hours: 4,
		power: 0.6,
		fansNeeded: 0,
		title: null,
	},
	{
		id: "silver",
		name: "실버 키트",
		icon: "🥈",
		units: 300,
		hours: 8,
		power: 0.9,
		fansNeeded: 15_000_000,
		title: null,
	},
	{
		id: "gold",
		name: "골드 키트",
		icon: "🥇",
		units: 200,
		hours: 14,
		power: 1.3,
		fansNeeded: 200_000_000,
		title: null,
	},
	{
		id: "limited",
		name: "한정판 키트",
		icon: "🏅",
		units: 100,
		hours: 20,
		power: 1.7,
		fansNeeded: 1_200_000_000,
		title: "한정판",
	},
	{
		id: "unique",
		name: "유일본 키트",
		icon: "👑",
		units: 1,
		hours: 8,
		power: 2.4,
		fansNeeded: 3_200_000_000,
		title: "유일본",
		auctioned: true,
	},
] as const;

/** 판매가 선택지. 적정가를 1로 두고 배수로 고른다. */
export const PRICE_STEPS: readonly { factor: number; label: string }[] = [
	{ factor: 0.6, label: "떨이" },
	{ factor: 1, label: "적정가" },
	{ factor: 1.6, label: "고가" },
	{ factor: 2.5, label: "프리미엄" },
] as const;

export function goodsType(id: GoodsTypeId): GoodsType {
	return GOODS_TYPES.find((t) => t.id === id) ?? (GOODS_TYPES[1] as GoodsType);
}

export function kitOf(id: KitGrade): KitDef {
	return KITS.find((k) => k.id === id) ?? (KITS[0] as KitDef);
}

/** 이번 시즌 팬심으로 이 키트가 열렸는가 */
export function kitUnlocked(state: GameState, kit: KitDef): boolean {
	return state.seasonFans >= kit.fansNeeded;
}

/** 굿즈 공장이 주는 매출 배수 */
export function goodsMultiplier(state: GameState): number {
	return 1 + upgradeLevel(state, "goods") * BALANCE.goodsFactoryPerLevel;
}

/**
 * 캐릭터 한 명의 굿즈 판매력. 응원 화력에서 나오므로, 응원석에 앉혀
 * 응원을 몰아줘야 굿즈가 팔린다. 자리에서 빼면 기본 판매력만 남는다.
 * (굿즈 종류는 여기 들어가지 않는다 — 종류는 한정판에만 영향을 준다)
 */
export function salesPower(state: GameState, character: Character): number {
	return (
		slotIncome(character) *
		cheerPush(state, character.id) *
		traitOf(character).dividend *
		goodsMultiplier(state) *
		bonusMultiplier(state)
	);
}

/** 한정판 없이도 늘 들어오는 상시 매출 */
export function baseRevenue(state: GameState, line: GoodsLine): number {
	const character = state.characters[line.characterId];
	if (!character) return 0;
	return salesPower(state, character) * BALANCE.goodsBaseShare;
}

/** 한정판이 팔리는 동안 추가로 들어오는 초당 매출 */
export function editionRevenue(line: GoodsLine): number {
	const edition = line.edition;
	if (!edition || edition.stock <= 0) return 0;
	return edition.demand * edition.price;
}

export function lineRevenue(state: GameState, line: GoodsLine): number {
	return baseRevenue(state, line) + editionRevenue(line);
}

/** 모든 굿즈 라인의 초당 매출 합계. 이 게임의 초당 수입이다. */
export function goodsRevenue(state: GameState): number {
	let total = 0;
	for (const line of state.goods) total += lineRevenue(state, line);
	return total;
}

export function lineOf(state: GameState, characterId: string): GoodsLine | undefined {
	return state.goods.find((line) => line.characterId === characterId);
}

export function openCost(state: GameState, character: Character): number {
	return Math.ceil(salesPower(state, character) * BALANCE.goodsOpenSeconds);
}

/** 한정판 한 판이 팔려나가는 데 걸리는 시간(초). 적정가 기준. */
export function editionSeconds(type: GoodsType, kit: KitDef): number {
	return (kit.hours * 3600) / type.pace;
}

/** 적정가로 완판했을 때의 총 매출 */
export function editionTotal(power: number, type: GoodsType, kit: KitDef): number {
	return power * type.revenue * kit.power * editionSeconds(type, kit);
}

/** 개당 적정가 */
export function fairPrice(power: number, type: GoodsType, kit: KitDef): number {
	return editionTotal(power, type, kit) / kit.units;
}

/** 키트 값. 완판하면 이 값의 goodsMarkup 배가 돌아온다. */
export function kitCost(
	state: GameState,
	character: Character,
	line: GoodsLine,
	kit: KitDef,
): number {
	const power = salesPower(state, character);
	return Math.ceil(editionTotal(power, goodsType(line.type), kit) / BALANCE.goodsMarkup);
}

/**
 * 남은 재고를 떨이로 넘겼을 때 받는 돈.
 * 판매가가 아니라 **원가(키트값)** 기준이다. 판매가 기준으로 하면 비싸게 내놓고
 * 곧바로 정리하는 것만으로 키트값보다 많이 돌려받는 돈복사가 된다.
 */
export function salvageValue(line: GoodsLine): number {
	const edition = line.edition;
	if (!edition || edition.total <= 0) return 0;
	return Math.floor((edition.stock / edition.total) * edition.cost * BALANCE.goodsSalvage);
}

/** 지금 속도라면 완판까지 남은 시간(초) */
export function secondsLeft(line: GoodsLine): number {
	const edition = line.edition;
	if (!edition || edition.demand <= 0) return 0;
	return edition.stock / edition.demand;
}

/** 유일본 경매가 도는 시간(초). 한정판이 다 팔려나가는 시간과 같은 기준을 쓴다. */
export function auctionSeconds(type: GoodsType, kit: KitDef): number {
	return editionSeconds(type, kit);
}

/** 지금까지 나온 최고 입찰 */
export function topBid(auction: GoodsAuction): GoodsBid | null {
	return auction.revealed > 0 ? (auction.schedule[auction.revealed - 1] ?? null) : null;
}

export function auctionSecondsLeft(auction: GoodsAuction, now = Date.now()): number {
	return Math.max(0, (auction.endsAt - now) / 1000);
}

/** 유찰됐을 때 돌려받는 돈 */
export function auctionSalvage(auction: GoodsAuction): number {
	return Math.floor(auction.cost * BALANCE.goodsSalvage);
}

/**
 * 수집가들의 입찰 일정을 미리 뽑아둔다.
 * 시작가가 비쌀수록 지갑이 닿는 수집가가 줄어 유찰 위험이 커진다.
 * 시작 시점에 전부 정해두므로 페이지를 닫아둬도 같은 결과가 나온다.
 */
function buildSchedule(fair: number, startPrice: number, seconds: number, rng: Rng): GoodsBid[] {
	const names = [...RIVAL_NAMES].sort(() => rng() - 0.5);
	// 수집가 지갑은 적정가 근처에 몰려 있고 위로 얇게 늘어진다(rng^3).
	// 그래서 적정가는 대체로 팔리고, 프리미엄은 가끔만 터지는 도박이 된다.
	const budgets = names
		.slice(0, 4)
		.map((name) => ({ name, budget: fair * (0.5 + 2.5 * rng() ** 3) }))
		.filter((r) => r.budget >= startPrice)
		.sort((a, b) => a.budget - b.budget);

	const bids: GoodsBid[] = [];
	let current = startPrice;
	// 늦게 들어온 입찰일수록 값이 올라가도록 시간순으로 정렬한다
	const times = budgets.map(() => range(rng, 0.05, 0.98) * seconds).sort((a, b) => a - b);
	budgets.forEach((rival, i) => {
		// 첫 입찰은 시작가 그대로, 그 뒤로는 최소 인상률만큼 올려 부른다
		const next = i === 0 ? startPrice : current * (1 + BALANCE.minRaise + rng() * 0.25);
		if (next > rival.budget) return;
		current = next;
		bids.push({ bidder: rival.name, amount: Math.ceil(next), at: times[i] ?? 0 });
	});
	return bids;
}

export interface GoodsResult {
	ok: boolean;
	message: string;
}

/**
 * 굿즈 라인을 연다. 캐릭터 한 명당 하나뿐이라,
 * 이미 내고 있는 캐릭터에게 다른 종류를 내면 그 자리에서 갈아탄다.
 */
export function releaseGoods(
	state: GameState,
	characterId: string,
	type: GoodsTypeId,
	now = Date.now(),
): GoodsResult {
	const character = state.characters[characterId];
	if (!character || !state.owned.includes(characterId)) {
		return { ok: false, message: "내가 가진 캐릭터가 아니에요." };
	}
	const existing = lineOf(state, characterId);
	if (existing?.type === type) {
		return { ok: false, message: "이미 같은 굿즈를 내고 있어요." };
	}
	if (!existing && state.goods.length >= BALANCE.maxGoodsLines) {
		return { ok: false, message: `굿즈 라인은 ${BALANCE.maxGoodsLines}개까지 열 수 있어요.` };
	}
	const cost = openCost(state, character);
	if (state.money < cost) return { ok: false, message: "개설비가 부족해요." };

	state.money -= cost;
	const def = goodsType(type);
	if (existing) {
		// 종류를 바꾸면 팔던 재고는 떨이로 정리한다.
		const salvage = salvageValue(existing);
		if (salvage > 0) state.money += salvage;
		existing.type = type;
		existing.edition = null;
		pushLog(state, `${character.name}의 굿즈를 ${def.name}(으)로 바꿨어요.`, "info");
		return { ok: true, message: `${character.name} ${def.name}(으)로 교체` };
	}

	state.goods.push({
		id: uid("gd"),
		characterId,
		type,
		createdAt: now,
		editions: 0,
		soldOut: 0,
		edition: null,
		auction: null,
		revenue: 0,
	});
	pushLog(state, `${character.name} ${def.name} 판매를 시작했습니다. ${def.icon}`, "good");
	return { ok: true, message: `${character.name} ${def.name} 개설` };
}

/**
 * 키트로 한정판을 찍는다. 팔던 재고가 남아 있으면 떨이로 정리하고 새로 찍는다.
 * 가격은 제작자가 정하고, 한정 수량이 그 가격을 검증한다 — 비싸게 내면
 * 천천히 팔려 오래 가고, 싸게 내면 빨리 빠진다.
 */
export function printEdition(
	state: GameState,
	lineId: string,
	grade: KitGrade,
	priceFactor: number,
	now = Date.now(),
	rng: Rng = Math.random,
): GoodsResult {
	const line = state.goods.find((l) => l.id === lineId);
	if (!line) return { ok: false, message: "없는 굿즈예요." };
	const character = state.characters[line.characterId];
	if (!character) return { ok: false, message: "캐릭터를 찾지 못했어요." };
	if (line.auction) return { ok: false, message: "유일본 경매가 끝나야 다시 찍을 수 있어요." };

	const kit = kitOf(grade);
	if (!kitUnlocked(state, kit)) {
		return { ok: false, message: `${kit.name}은(는) 시즌 팬심이 더 필요해요.` };
	}
	const cost = kitCost(state, character, line, kit);
	if (state.money < cost) return { ok: false, message: `${kit.name} 값이 부족해요.` };

	const type = goodsType(line.type);
	const power = salesPower(state, character);
	const fair = fairPrice(power, type, kit);
	if (!(fair > 0)) return { ok: false, message: "아직 팔릴 만한 인기가 아니에요." };

	// 남은 재고는 떨이로 넘기고 새 판을 찍는다.
	const salvage = salvageValue(line);
	state.money -= cost;
	if (salvage > 0) state.money += salvage;

	// 유일본은 1개뿐이라 흘려 팔 수 없다. 경매에 올리고 수집가를 기다린다.
	if (kit.auctioned) {
		const seconds = auctionSeconds(type, kit);
		const startPrice = Math.ceil(fair * priceFactor);
		line.edition = null;
		line.auction = {
			grade,
			startPrice,
			cost,
			startedAt: now,
			endsAt: now + seconds * 1000,
			schedule: buildSchedule(fair, startPrice, seconds, rng),
			revealed: 0,
		};
		line.editions += 1;
		pushLog(
			state,
			`${kit.icon} ${character.name} ${type.name} 유일본 경매 시작! 시작가 ${Math.floor(startPrice).toLocaleString("ko-KR")}원`,
			"market",
		);
		return {
			ok: true,
			message: `유일본 경매 시작 · 시작가 ${Math.floor(startPrice).toLocaleString("ko-KR")}원`,
		};
	}

	// 비싸게 내놓을수록 덜 팔린다. 총액은 늘지만 시간이 오래 걸린다.
	const baseDemand = kit.units / editionSeconds(type, kit);
	line.edition = {
		grade,
		total: kit.units,
		stock: kit.units,
		price: fair * priceFactor,
		cost,
		demand: baseDemand * priceFactor ** -BALANCE.goodsElasticity,
		releasedAt: now,
	};
	line.editions += 1;

	pushLog(
		state,
		`${kit.icon} ${character.name} ${type.name} ${kit.units.toLocaleString("ko-KR")}개 한정 발매!`,
		"market",
	);
	return { ok: true, message: `${kit.name} · ${kit.units.toLocaleString("ko-KR")}개 발매` };
}

/**
 * 유일본 경매를 지금 끝내고 최고 입찰을 받는다.
 * 더 기다리면 값이 오를 수도 있지만, 지금 확정할 수도 있다.
 */
export function acceptTopBid(state: GameState, lineId: string, now = Date.now()): GoodsResult {
	const line = state.goods.find((l) => l.id === lineId);
	if (!line?.auction) return { ok: false, message: "진행 중인 경매가 없어요." };
	const bid = topBid(line.auction);
	if (!bid) return { ok: false, message: "아직 입찰이 없어요." };
	settleAuction(state, line, bid, now);
	return {
		ok: true,
		message: `${bid.bidder}에게 낙찰 — ${Math.floor(bid.amount).toLocaleString("ko-KR")}원`,
	};
}

/** 유일본 경매를 접고 원가 일부를 회수한다. */
export function cancelAuction(state: GameState, lineId: string): GoodsResult {
	const line = state.goods.find((l) => l.id === lineId);
	if (!line?.auction) return { ok: false, message: "진행 중인 경매가 없어요." };
	const back = auctionSalvage(line.auction);
	line.auction = null;
	state.money += back;
	return { ok: true, message: `경매를 접고 ${back.toLocaleString("ko-KR")}원 회수` };
}

/** 낙찰 처리. 칭호는 여기서 준다. */
function settleAuction(state: GameState, line: GoodsLine, bid: GoodsBid, now: number): void {
	const character = state.characters[line.characterId];
	state.money += bid.amount;
	state.totalEarned += bid.amount;
	line.revenue += bid.amount;
	line.soldOut += 1;
	line.auction = null;
	pushLog(
		state,
		`👑 ${character?.name ?? "굿즈"} 유일본이 ${bid.bidder}에게 ${Math.floor(bid.amount).toLocaleString("ko-KR")}원에 낙찰됐습니다!`,
		"good",
	);
	awardTitle(state, "unique");
	checkSoldOutTitle(state, now);
}

/** 한 시즌에 완판을 많이 하면 주는 칭호 */
function checkSoldOutTitle(state: GameState, _now: number): void {
	const total = state.goods.reduce((sum, l) => sum + l.soldOut, 0);
	if (total >= 20) awardTitle(state, "soldout");
}

/**
 * 유일본 경매를 시계에 맞춰 진행한다. 페이지를 닫아둬도 흐른 시간만큼
 * 입찰이 공개되고, 끝난 경매는 그 자리에서 정산된다.
 */
export function tickGoodsAuctions(state: GameState, now = Date.now()): void {
	for (const line of state.goods) {
		const auction = line.auction;
		if (!auction) continue;

		const elapsed = (now - auction.startedAt) / 1000;
		while (auction.revealed < auction.schedule.length) {
			const next = auction.schedule[auction.revealed];
			if (!next || next.at > elapsed) break;
			auction.revealed += 1;
			const character = state.characters[line.characterId];
			pushLog(
				state,
				`${next.bidder}이(가) ${character?.name ?? "유일본"}에 ${Math.floor(next.amount).toLocaleString("ko-KR")}원을 불렀습니다.`,
				"market",
			);
		}

		if (now < auction.endsAt) continue;

		const bid = topBid(auction);
		if (bid) {
			settleAuction(state, line, bid, now);
		} else {
			const back = auctionSalvage(auction);
			line.auction = null;
			state.money += back;
			const character = state.characters[line.characterId];
			pushLog(
				state,
				`${character?.name ?? "유일본"} 유일본이 유찰됐습니다. 시작가가 높았어요. (${back.toLocaleString("ko-KR")}원 회수)`,
				"bad",
			);
		}
	}
}

/** 팔던 한정판을 접고 남은 재고를 떨이로 넘긴다. */
export function scrapEdition(state: GameState, lineId: string): GoodsResult {
	const line = state.goods.find((l) => l.id === lineId);
	if (!line?.edition) return { ok: false, message: "팔고 있는 한정판이 없어요." };
	const salvage = salvageValue(line);
	line.edition = null;
	state.money += salvage;
	return {
		ok: true,
		message: `재고를 정리하고 ${Math.floor(salvage).toLocaleString("ko-KR")}원 회수`,
	};
}

/** 라인을 완전히 접는다. */
export function closeGoods(state: GameState, lineId: string): GoodsResult {
	const index = state.goods.findIndex((l) => l.id === lineId);
	if (index < 0) return { ok: false, message: "없는 굿즈예요." };
	const [line] = state.goods.splice(index, 1);
	if (line) state.money += salvageValue(line) + (line.auction ? auctionSalvage(line.auction) : 0);
	const character = line ? state.characters[line.characterId] : undefined;
	return { ok: true, message: `${character?.name ?? "굿즈"} 판매를 종료했어요.` };
}

/** 캐릭터가 사라지면(정리·경매 낙찰) 그 라인도 같이 접는다. */
export function pruneGoods(state: GameState): void {
	state.goods = state.goods.filter(
		(line) => state.characters[line.characterId] && state.owned.includes(line.characterId),
	);
}

/** 매 스텝 굿즈 매출을 지갑에 넣는다. 한정판은 재고가 줄어든다. */
export function tickGoods(state: GameState, dt: number): number {
	let total = 0;
	for (const line of state.goods) {
		let earned = baseRevenue(state, line) * dt;

		const edition = line.edition;
		if (edition && edition.stock > 0) {
			const sold = Math.min(edition.stock, edition.demand * dt);
			edition.stock -= sold;
			earned += sold * edition.price;
			if (edition.stock <= 0) {
				edition.stock = 0;
				line.soldOut += 1;
				if (kitOf(edition.grade).title === "한정판") awardTitle(state, "limited");
				checkSoldOutTitle(state, Date.now());
				const character = state.characters[line.characterId];
				const buyer = RIVAL_NAMES[(line.soldOut + line.editions) % RIVAL_NAMES.length];
				pushLog(
					state,
					`${character?.name ?? "굿즈"} ${goodsType(line.type).name} 완판! 마지막 한 개는 ${buyer}에게 갔습니다.`,
					"good",
				);
			}
		}

		line.revenue += earned;
		total += earned;
	}
	return total;
}
