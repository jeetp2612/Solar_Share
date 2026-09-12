import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as Slot, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as ArrowDownRight, c as QrCode, d as LoaderCircle, f as Link2, g as ArrowUpRight, h as Check, i as Unplug, l as MapPin, m as Copy, n as X, o as Sun, p as Gauge, r as Wallet, s as SunMedium, t as Zap, u as LogOut, v as Activity } from "../_libs/lucide-react.mjs";
import { a as DialogOverlay$1, i as DialogDescription$1, n as DialogClose, o as DialogPortal, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { a as Root2, i as Portal2, n as Item2, o as Separator2, r as Label2, s as Trigger, t as Content2 } from "../_libs/@radix-ui/react-dropdown-menu+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { i as SliderTrack, n as SliderRange, r as SliderThumb, t as Slider$1 } from "../_libs/@radix-ui/react-slider+[...].mjs";
import { a as Line, c as Tooltip, i as Area, n as YAxis, o as CartesianGrid, r as XAxis, s as ResponsiveContainer, t as ComposedChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BVibeLto.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var USER_ADDRESS = "0x7F3a91C2E1b4d890Ab33C4De";
var GENESIS = Date.UTC(2026, 8, 11, 12, 0, 0);
var SEED_BLOCK = 19204331;
var NEIGHBORS = [
	{
		name: "Chen Rooftop",
		address: "0x3A91bC82e4D14F7A12c8B0E1"
	},
	{
		name: "Rivera Solar",
		address: "0x8B12d90aF33C71e6A4b2D908"
	},
	{
		name: "Oak Street Co-op",
		address: "0x1C77A4e90B12D33f88E1a0C4"
	},
	{
		name: "Patel Residence",
		address: "0x9D04c18B77A2e1F0C3d5A691"
	},
	{
		name: "Lakeside Array",
		address: "0x52E8b01C94a7D3f6B2e0A118"
	},
	{
		name: "Nguyen Household",
		address: "0x6F11c0A83D29e4B7a1C5E902"
	},
	{
		name: "Westside Commons",
		address: "0xA03e91C4b8D27F5a6E10B334"
	},
	{
		name: "Garcia Barn",
		address: "0x4B88d12A09c3E7f1B6a0D245"
	},
	{
		name: "Harbor Microgrid",
		address: "0xC21a70E8d4B39F6c5A12e087"
	},
	{
		name: "Kim Family",
		address: "0x0E55b19C82a4D7F3c6A1B098"
	}
];
var SEED_ORDERS = [
	{
		id: "ord_01",
		side: "ask",
		peer: "Chen Rooftop",
		address: "0x3A91bC82e4D14F7A12c8B0E1",
		kwh: 8.4,
		price: .108,
		distanceKm: .4,
		source: "rooftop-pv"
	},
	{
		id: "ord_02",
		side: "ask",
		peer: "Lakeside Array",
		address: "0x52E8b01C94a7D3f6B2e0A118",
		kwh: 22,
		price: .111,
		distanceKm: 1.6,
		source: "community-array"
	},
	{
		id: "ord_03",
		side: "ask",
		peer: "Rivera Solar",
		address: "0x8B12d90aF33C71e6A4b2D908",
		kwh: 5.2,
		price: .114,
		distanceKm: .7,
		source: "rooftop-pv"
	},
	{
		id: "ord_04",
		side: "ask",
		peer: "Oak Street Co-op",
		address: "0x1C77A4e90B12D33f88E1a0C4",
		kwh: 14.8,
		price: .117,
		distanceKm: 1.1,
		source: "community-array"
	},
	{
		id: "ord_05",
		side: "ask",
		peer: "Garcia Barn",
		address: "0x4B88d12A09c3E7f1B6a0D245",
		kwh: 9.6,
		price: .121,
		distanceKm: 2.4,
		source: "rooftop-pv"
	},
	{
		id: "ord_06",
		side: "ask",
		peer: "Kim Family",
		address: "0x0E55b19C82a4D7F3c6A1B098",
		kwh: 3.1,
		price: .126,
		distanceKm: .3,
		source: "home-battery"
	},
	{
		id: "ord_07",
		side: "bid",
		peer: "Patel Residence",
		address: "0x9D04c18B77A2e1F0C3d5A691",
		kwh: 6,
		price: .104,
		distanceKm: .9,
		source: "home-battery"
	},
	{
		id: "ord_08",
		side: "bid",
		peer: "Nguyen Household",
		address: "0x6F11c0A83D29e4B7a1C5E902",
		kwh: 4.5,
		price: .101,
		distanceKm: 1.3,
		source: "rooftop-pv"
	},
	{
		id: "ord_09",
		side: "bid",
		peer: "Westside Commons",
		address: "0xA03e91C4b8D27F5a6E10B334",
		kwh: 18,
		price: .097,
		distanceKm: 2.1,
		source: "community-array"
	},
	{
		id: "ord_10",
		side: "bid",
		peer: "Harbor Microgrid",
		address: "0xC21a70E8d4B39F6c5A12e087",
		kwh: 11.2,
		price: .094,
		distanceKm: 3,
		source: "community-array"
	}
];
var SEED_TRANSACTIONS = [
	{
		id: "tx_15",
		txHash: "0x8f2c1a90b3d47e6c12a0f88b91c3d5e7a4b6c8d0e1f23456789abcde01",
		from: "0x3A91bC82e4D14F7A12c8B0E1",
		fromName: "Chen Rooftop",
		to: "0x9D04c18B77A2e1F0C3d5A691",
		toName: "Patel Residence",
		kwh: 5,
		price: .112,
		block: 19204328,
		timestamp: GENESIS + 2052e4,
		status: "confirmed"
	},
	{
		id: "tx_14",
		txHash: "0xa11c0e83d29f4b7a1c5e9026f11c0a83d29e4b7a1c5e9026f11c0a83d2",
		from: "0x52E8b01C94a7D3f6B2e0A118",
		fromName: "Lakeside Array",
		to: "0x6F11c0A83D29e4B7a1C5E902",
		toName: "Nguyen Household",
		kwh: 12.4,
		price: .109,
		block: 19204322,
		timestamp: GENESIS + 1962e4,
		status: "confirmed"
	},
	{
		id: "tx_13",
		txHash: "0xb03e91c4b8d27f5a6e10b334a03e91c4b8d27f5a6e10b334a03e91c4b8",
		from: "0x8B12d90aF33C71e6A4b2D908",
		fromName: "Rivera Solar",
		to: "0xA03e91C4b8D27F5a6E10B334",
		toName: "Westside Commons",
		kwh: 3.8,
		price: .115,
		block: 19204315,
		timestamp: GENESIS + 1872e4,
		status: "confirmed"
	},
	{
		id: "tx_12",
		txHash: "0xc21a70e8d4b39f6c5a12e087c21a70e8d4b39f6c5a12e087c21a70e8d4",
		from: "0x1C77A4e90B12D33f88E1a0C4",
		fromName: "Oak Street Co-op",
		to: "0xC21a70E8d4B39F6c5A12e087",
		toName: "Harbor Microgrid",
		kwh: 9,
		price: .107,
		block: 19204301,
		timestamp: GENESIS + 1764e4,
		status: "confirmed"
	},
	{
		id: "tx_11",
		txHash: "0xd04c18b77a2e1f0c3d5a6919d04c18b77a2e1f0c3d5a6919d04c18b77a",
		from: "0x4B88d12A09c3E7f1B6a0D245",
		fromName: "Garcia Barn",
		to: "0x0E55b19C82a4D7F3c6A1B098",
		toName: "Kim Family",
		kwh: 2.6,
		price: .119,
		block: 19204288,
		timestamp: GENESIS + 1638e4,
		status: "confirmed"
	},
	{
		id: "tx_10",
		txHash: "0xe55b19c82a4d7f3c6a1b0980e55b19c82a4d7f3c6a1b0980e55b19c82a",
		from: "0x52E8b01C94a7D3f6B2e0A118",
		fromName: "Lakeside Array",
		to: "0x9D04c18B77A2e1F0C3d5A691",
		toName: "Patel Residence",
		kwh: 7.5,
		price: .11,
		block: 19204274,
		timestamp: GENESIS + 1512e4,
		status: "confirmed"
	},
	{
		id: "tx_09",
		txHash: "0xf3a91c2e1b4d890ab33c4de7f3a91c2e1b4d890ab33c4de7f3a91c2e1b",
		from: "0x3A91bC82e4D14F7A12c8B0E1",
		fromName: "Chen Rooftop",
		to: "0x6F11c0A83D29e4B7a1C5E902",
		toName: "Nguyen Household",
		kwh: 4.2,
		price: .113,
		block: 19204261,
		timestamp: GENESIS + 1386e4,
		status: "confirmed"
	},
	{
		id: "tx_08",
		txHash: "0x012c8b0e13a91bc82e4d14f7a12c8b0e13a91bc82e4d14f7a12c8b0e13",
		from: "0x0E55b19C82a4D7F3c6A1B098",
		fromName: "Kim Family",
		to: "0xA03e91C4b8D27F5a6E10B334",
		toName: "Westside Commons",
		kwh: 1.8,
		price: .122,
		block: 19204249,
		timestamp: GENESIS + 126e5,
		status: "confirmed"
	}
];
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/** Austin CDT = UTC-5. */
function austinDecimalHour(ts) {
	const d = new Date(ts);
	return (d.getUTCHours() - 5 + 24) % 24 + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}
function irradianceAt(ts, rand = () => .5) {
	const hour = austinDecimalHour(ts);
	if (hour < 6.2 || hour > 19.4) return .02 + rand() * .015;
	const t = (hour - 6.2) / 13.2;
	return Math.pow(Math.sin(t * Math.PI), 1.12) * (.92 + rand() * .08);
}
function congestionFrom(supply, demand) {
	const load = demand / Math.max(supply, 1);
	if (load > 1.12) return "high";
	if (load > .88) return "medium";
	return "low";
}
function buildPriceHistory(endTs, points = 72) {
	const rand = mulberry32(20260911);
	const step = 3e5;
	const start = endTs - points * step;
	const out = [];
	let price = .142;
	for (let i = 0; i <= points; i += 1) {
		const t = start + i * step;
		const irr = irradianceAt(t, rand);
		const supply = 40 + irr * 220 + rand() * 8;
		const hour = austinDecimalHour(t);
		const evening = hour > 16 && hour < 21 ? (hour - 16) / 5 : 0;
		const morning = hour > 6 && hour < 9 ? (9 - hour) / 3 : 0;
		const demand = 95 + evening * 90 + morning * 35 + (1 - irr) * 28 + rand() * 10;
		const target = .118 + (demand - supply) / Math.max(supply + demand, 1) * .09;
		price = price + (target - price) * .22 + (rand() - .5) * .003;
		price = Math.min(.22, Math.max(.072, price));
		out.push({
			t,
			price: Number(price.toFixed(4)),
			supply: Number(supply.toFixed(1)),
			demand: Number(demand.toFixed(1)),
			irradiance: Number(irr.toFixed(3))
		});
	}
	return out;
}
function snapshotFromHistory(history) {
	const last = history[history.length - 1];
	const prev = history[history.length - 2] ?? last;
	return {
		price: last.price,
		priceDelta: last.price - prev.price,
		supplyKwh: last.supply,
		demandKwh: last.demand,
		irradiance: last.irradiance,
		congestion: congestionFrom(last.supply, last.demand)
	};
}
var SEED_HISTORY = buildPriceHistory(GENESIS + 216e5);
var SEED_SNAPSHOT = snapshotFromHistory(SEED_HISTORY);
var SEED_TRADED = SEED_TRANSACTIONS.reduce((sum, tx) => sum + tx.kwh, 0) + 184.6;
function formatUsd(value, digits = 3) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(value);
}
function formatKwh(value, digits = 1) {
	return `${value.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	})} kWh`;
}
function formatCompact(value, digits = 1) {
	return value.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
}
function shortAddr(address) {
	if (address.length < 12) return address;
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
function formatClock(ts) {
	return new Intl.DateTimeFormat("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: "America/Chicago"
	}).format(new Date(ts));
}
function mockTxHash() {
	const bytes = /* @__PURE__ */ new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function mockOrderId() {
	return `ord_${crypto.randomUUID().slice(0, 8)}`;
}
var MODE_KEY = "solarshare-mode";
var WALLET_KEY = "solarshare-wallet";
function cloneOrders(source) {
	return source.map((o) => ({ ...o }));
}
function cloneTxs(source) {
	return source.map((t) => ({ ...t }));
}
function nextNeighbor(exclude) {
	const pool = NEIGHBORS.filter((n) => n.address !== exclude);
	return pool[Math.floor(Math.random() * pool.length)] ?? NEIGHBORS[0];
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function fillAgainst(book, side, kwh, limit) {
	const sorted = book.filter((o) => o.side === side).sort((a, b) => side === "ask" ? a.price - b.price : b.price - a.price);
	const fills = [];
	let remaining = kwh;
	const consumed = /* @__PURE__ */ new Map();
	for (const order of sorted) {
		if (remaining <= .001) break;
		if (limit != null) {
			if (side === "ask" && order.price > limit + 1e-9) continue;
			if (side === "bid" && order.price < limit - 1e-9) continue;
		}
		const take = Math.min(order.kwh, remaining);
		fills.push({
			order,
			kwh: take,
			price: order.price
		});
		consumed.set(order.id, take);
		remaining -= take;
	}
	const next = book.map((o) => {
		const take = consumed.get(o.id);
		if (!take) return o;
		const left = Number((o.kwh - take).toFixed(2));
		if (left <= .05) return null;
		return {
			...o,
			kwh: left
		};
	}).filter((o) => o != null);
	return {
		fills,
		remaining: Number(remaining.toFixed(2)),
		next
	};
}
var useMarket = create((set, get) => ({
	live: false,
	mode: "consumer",
	wallet: null,
	connectOpen: false,
	price: SEED_SNAPSHOT.price,
	priceDelta: SEED_SNAPSHOT.priceDelta,
	congestion: SEED_SNAPSHOT.congestion,
	totalTradedKwh: SEED_TRADED,
	irradiance: SEED_SNAPSHOT.irradiance,
	supplyKwh: SEED_SNAPSHOT.supplyKwh,
	demandKwh: SEED_SNAPSHOT.demandKwh,
	orders: cloneOrders(SEED_ORDERS),
	txs: cloneTxs(SEED_TRANSACTIONS),
	history: SEED_HISTORY,
	block: SEED_BLOCK,
	pending: false,
	selectedOrderId: null,
	startLive: () => {
		if (get().live) return;
		const now = Date.now();
		const history = buildPriceHistory(now);
		const snap = snapshotFromHistory(history);
		let mode = "consumer";
		let wallet = null;
		try {
			const savedMode = localStorage.getItem(MODE_KEY);
			if (savedMode === "prosumer" || savedMode === "consumer") mode = savedMode;
			const savedWallet = localStorage.getItem(WALLET_KEY);
			if (savedWallet) wallet = JSON.parse(savedWallet);
		} catch {}
		const delta = snap.price - SEED_SNAPSHOT.price;
		set({
			live: true,
			history,
			...snap,
			mode,
			wallet,
			orders: cloneOrders(SEED_ORDERS).map((o) => ({
				...o,
				price: Number(Math.max(.05, o.price + delta).toFixed(3))
			})),
			txs: cloneTxs(SEED_TRANSACTIONS).map((tx, i) => ({
				...tx,
				timestamp: now - (i + 1) * 95e3,
				price: Number(Math.max(.05, tx.price + delta).toFixed(3))
			}))
		});
	},
	tick: () => {
		const state = get();
		if (!state.live) return;
		const now = Date.now();
		const last = state.history[state.history.length - 1] ?? {
			t: now,
			price: state.price,
			supply: state.supplyKwh,
			demand: state.demandKwh,
			irradiance: state.irradiance
		};
		const irr = irradianceAt(now, Math.random);
		const supply = Math.max(18, last.supply + (irr - last.irradiance) * 80 + (Math.random() - .5) * 6);
		const hour = new Date(now).getUTCHours() - 5;
		const evening = hour >= 16 && hour <= 21 ? 1 : 0;
		const demand = Math.max(40, last.demand + (Math.random() - .48) * 5 + evening * .4 - irr * .8);
		const target = .118 + (demand - supply) / Math.max(supply + demand, 1) * .09;
		const price = Number(Math.min(.22, Math.max(.072, last.price + (target - last.price) * .18 + (Math.random() - .5) * .0024)).toFixed(4));
		const point = {
			t: now,
			price,
			supply: Number(supply.toFixed(1)),
			demand: Number(demand.toFixed(1)),
			irradiance: Number(irr.toFixed(3))
		};
		const history = [...state.history.slice(-71), point];
		let orders = state.orders.map((o) => ({
			...o,
			fresh: false
		}));
		let txs = state.txs.map((t) => ({
			...t,
			fresh: false,
			status: "confirmed"
		}));
		let totalTradedKwh = state.totalTradedKwh;
		let block = state.block + (Math.random() > .45 ? 1 : 0);
		if (Math.random() > .55) {
			const side = Math.random() > .48 ? "ask" : "bid";
			const peer = nextNeighbor();
			const mid = price;
			orders = [{
				id: mockOrderId(),
				side,
				peer: peer.name,
				address: peer.address,
				kwh: Number((1.5 + Math.random() * 12).toFixed(1)),
				price: Number((mid + (side === "ask" ? .002 : -.004) + (Math.random() - .5) * .01).toFixed(3)),
				distanceKm: Number((.2 + Math.random() * 3.2).toFixed(1)),
				source: Math.random() > .7 ? "community-array" : "rooftop-pv",
				fresh: true
			}, ...orders].slice(0, 14);
		}
		if (Math.random() > .62 && orders.length > 4) {
			const seller = nextNeighbor();
			const buyer = nextNeighbor(seller.address);
			const kwh = Number((1.2 + Math.random() * 6).toFixed(1));
			const tradePrice = Number((price + (Math.random() - .5) * .008).toFixed(3));
			totalTradedKwh = Number((totalTradedKwh + kwh).toFixed(1));
			block += 1;
			txs = [{
				id: `tx_${mockOrderId()}`,
				txHash: mockTxHash(),
				from: seller.address,
				fromName: seller.name,
				to: buyer.address,
				toName: buyer.name,
				kwh,
				price: tradePrice,
				block,
				timestamp: now,
				status: "pending",
				fresh: true
			}, ...txs].slice(0, 24);
		}
		const wallet = state.wallet ? {
			...state.wallet,
			surplusKwh: state.mode === "prosumer" ? Number(Math.min(48, state.wallet.surplusKwh + irr * .08).toFixed(2)) : state.wallet.surplusKwh
		} : null;
		set({
			price,
			priceDelta: price - last.price,
			congestion: congestionFrom(supply, demand),
			irradiance: point.irradiance,
			supplyKwh: point.supply,
			demandKwh: point.demand,
			history,
			orders,
			txs,
			totalTradedKwh,
			block,
			wallet
		});
	},
	setMode: (mode) => {
		set({
			mode,
			selectedOrderId: null
		});
		try {
			localStorage.setItem(MODE_KEY, mode);
		} catch {}
	},
	openConnect: (open) => set({ connectOpen: open }),
	connectWallet: async (provider) => {
		await sleep(640);
		const wallet = {
			provider,
			address: USER_ADDRESS,
			usd: 52.4,
			kwhCredits: 2.6,
			surplusKwh: 14.8
		};
		set({
			wallet,
			connectOpen: false
		});
		try {
			localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
		} catch {}
	},
	disconnectWallet: () => {
		set({
			wallet: null,
			selectedOrderId: null
		});
		try {
			localStorage.removeItem(WALLET_KEY);
		} catch {}
	},
	selectOrder: (id) => set({ selectedOrderId: id }),
	buy: async (kwh, limitPrice) => {
		const state = get();
		if (state.pending) return {
			ok: false,
			message: "A settlement is already in flight.",
			reason: "pending"
		};
		if (!state.wallet) {
			set({ connectOpen: true });
			return {
				ok: false,
				message: "Connect a wallet to buy energy.",
				reason: "wallet"
			};
		}
		if (kwh <= 0) return {
			ok: false,
			message: "Enter a volume greater than zero.",
			reason: "liquidity"
		};
		const selected = state.orders.find((o) => o.id === state.selectedOrderId && o.side === "ask");
		const { fills, remaining, next } = fillAgainst(selected ? [selected, ...state.orders.filter((o) => o.id !== selected.id)] : state.orders, "ask", kwh, limitPrice);
		if (fills.length === 0) return {
			ok: false,
			message: "No asks available at that price.",
			reason: "liquidity"
		};
		const cost = fills.reduce((sum, f) => sum + f.kwh * f.price, 0);
		if (cost > state.wallet.usd + 1e-9) return {
			ok: false,
			message: "Insufficient USD balance for this fill.",
			reason: "funds"
		};
		set({ pending: true });
		await sleep(780);
		const now = Date.now();
		const filledKwh = Number((kwh - remaining).toFixed(2));
		const avg = cost / filledKwh;
		const block = state.block + 1;
		const newTxs = fills.map((f, i) => ({
			id: `tx_user_${mockOrderId()}`,
			txHash: mockTxHash(),
			from: f.order.address,
			fromName: f.order.peer,
			to: USER_ADDRESS,
			toName: "You",
			kwh: f.kwh,
			price: f.price,
			block: block + i,
			timestamp: now,
			status: "pending",
			fresh: true
		}));
		let orders = next;
		if (remaining > .05 && limitPrice != null) orders = [{
			id: mockOrderId(),
			side: "bid",
			peer: "You",
			address: USER_ADDRESS,
			kwh: remaining,
			price: limitPrice,
			distanceKm: 0,
			source: "home-battery",
			fresh: true
		}, ...orders];
		const wallet = {
			...state.wallet,
			usd: Number((state.wallet.usd - cost).toFixed(2)),
			kwhCredits: Number((state.wallet.kwhCredits + filledKwh).toFixed(2))
		};
		set({
			pending: false,
			wallet,
			orders,
			txs: [...newTxs, ...state.txs].slice(0, 24),
			totalTradedKwh: Number((state.totalTradedKwh + filledKwh).toFixed(1)),
			block: block + fills.length - 1,
			selectedOrderId: null
		});
		try {
			localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
		} catch {}
		const leftover = remaining > .05 ? ` Resting bid for ${remaining.toFixed(1)} kWh.` : "";
		return {
			ok: true,
			message: `Bought ${filledKwh.toFixed(1)} kWh at ${avg.toFixed(3)} USD/kWh.${leftover}`
		};
	},
	sell: async (kwh, limitPrice) => {
		const state = get();
		if (state.pending) return {
			ok: false,
			message: "A settlement is already in flight.",
			reason: "pending"
		};
		if (!state.wallet) {
			set({ connectOpen: true });
			return {
				ok: false,
				message: "Connect a wallet to sell surplus.",
				reason: "wallet"
			};
		}
		if (kwh <= 0) return {
			ok: false,
			message: "Enter a volume greater than zero.",
			reason: "liquidity"
		};
		if (kwh > state.wallet.surplusKwh + 1e-9) return {
			ok: false,
			message: "Not enough surplus solar to list or sell.",
			reason: "surplus"
		};
		const selected = state.orders.find((o) => o.id === state.selectedOrderId && o.side === "bid");
		const { fills, remaining, next } = fillAgainst(selected ? [selected, ...state.orders.filter((o) => o.id !== selected.id)] : state.orders, "bid", kwh, limitPrice);
		set({ pending: true });
		await sleep(780);
		const now = Date.now();
		const filledKwh = Number((kwh - remaining).toFixed(2));
		const proceeds = fills.reduce((sum, f) => sum + f.kwh * f.price, 0);
		const block = state.block + 1;
		const newTxs = fills.map((f, i) => ({
			id: `tx_user_${mockOrderId()}`,
			txHash: mockTxHash(),
			from: USER_ADDRESS,
			fromName: "You",
			to: f.order.address,
			toName: f.order.peer,
			kwh: f.kwh,
			price: f.price,
			block: block + i,
			timestamp: now,
			status: "pending",
			fresh: true
		}));
		let orders = next;
		if (remaining > .05) {
			const askPrice = limitPrice ?? Number((state.price + .004).toFixed(3));
			orders = [{
				id: mockOrderId(),
				side: "ask",
				peer: "You",
				address: USER_ADDRESS,
				kwh: remaining,
				price: askPrice,
				distanceKm: 0,
				source: "rooftop-pv",
				fresh: true
			}, ...orders];
		}
		const wallet = {
			...state.wallet,
			usd: Number((state.wallet.usd + proceeds).toFixed(2)),
			surplusKwh: Number((state.wallet.surplusKwh - kwh).toFixed(2))
		};
		set({
			pending: false,
			wallet,
			orders,
			txs: [...newTxs, ...state.txs].slice(0, 24),
			totalTradedKwh: Number((state.totalTradedKwh + filledKwh).toFixed(1)),
			block: block + Math.max(fills.length, 1) - 1,
			selectedOrderId: null
		});
		try {
			localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
		} catch {}
		if (filledKwh < .05) return {
			ok: true,
			message: `Listed ${kwh.toFixed(1)} kWh on the local book.`
		};
		const leftover = remaining > .05 ? ` Listed remaining ${remaining.toFixed(1)} kWh.` : "";
		return {
			ok: true,
			message: `Sold ${filledKwh.toFixed(1)} kWh for $${proceeds.toFixed(2)}.${leftover}`
		};
	}
}));
function LogoMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 32 32",
		className: cn("size-8", className),
		"aria-hidden": "true",
		fill: "none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "32",
				height: "32",
				rx: "9",
				className: "fill-primary"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "16",
				cy: "16",
				r: "5.2",
				className: "fill-primary-foreground"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				className: "stroke-primary-foreground",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 5.5v3.2M16 23.3v3.2M5.5 16h3.2M23.3 16h3.2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.6 8.6l2.3 2.3M21.1 21.1l2.3 2.3M8.6 23.4l2.3-2.3M21.1 10.9l2.3-2.3" })]
			})
		]
	});
}
function Wordmark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("font-display text-lg font-semibold tracking-tight text-foreground", className),
		children: "SolarShare"
	});
}
var badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide", {
	variants: { variant: {
		default: "border-transparent bg-primary/15 text-primary",
		accent: "border-transparent bg-accent/15 text-accent",
		warn: "border-transparent bg-warn/15 text-warn",
		danger: "border-transparent bg-destructive/15 text-destructive",
		outline: "border-border text-muted-foreground",
		muted: "border-transparent bg-secondary text-muted-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,opacity,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:not-disabled:scale-[0.96]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:opacity-90",
			accent: "bg-accent text-accent-foreground hover:opacity-90",
			outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
			secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			ghost: "text-foreground hover:bg-secondary",
			destructive: "bg-destructive text-background hover:opacity-90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 rounded-sm px-3 text-xs",
			lg: "h-12 rounded-lg px-5",
			icon: "size-11"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
var DropdownMenu = Root2;
var DropdownMenuTrigger = Trigger;
function DropdownMenuContent({ className, sideOffset = 8, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
		sideOffset,
		className: cn("z-50 min-w-48 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-card-hover)]", className),
		...props
	}) });
}
function DropdownMenuItem({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item2, {
		className: cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none select-none", "focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-40", className),
		...props
	});
}
function DropdownMenuSeparator({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator2, {
		className: cn("my-1 h-px bg-border", className),
		...props
	});
}
function DropdownMenuLabel({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label2, {
		className: cn("px-2.5 py-1.5 text-xs text-muted-foreground", className),
		...props
	});
}
function Header() {
	const mode = useMarket((s) => s.mode);
	const setMode = useMarket((s) => s.setMode);
	const wallet = useMarket((s) => s.wallet);
	const openConnect = useMarket((s) => s.openConnect);
	const disconnectWallet = useMarket((s) => s.disconnectWallet);
	function copyAddress() {
		if (!wallet) return;
		navigator.clipboard.writeText(wallet.address);
		toast.success("Address copied");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				href: "/",
				className: "flex min-w-0 items-center gap-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogoMark, { className: "size-8 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { className: "block leading-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden text-[10px] tracking-wide text-muted-foreground sm:block",
						children: "Local energy exchange"
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ml-auto flex items-center gap-2 sm:gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex rounded-lg bg-secondary p-1",
					role: "group",
					"aria-label": "Trading mode",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeChip, {
						active: mode === "consumer",
						onClick: () => setMode("consumer"),
						icon: Zap,
						label: "Consumer"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeChip, {
						active: mode === "prosumer",
						onClick: () => setMode("prosumer"),
						icon: Sun,
						label: "Prosumer"
					})]
				}), wallet ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						className: "min-w-0 gap-2 pl-2 pr-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-7 items-center justify-center rounded-sm bg-primary/15 font-mono text-[10px] text-primary",
							children: "0x"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "hidden text-left sm:block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block font-mono text-xs leading-none",
								children: shortAddr(wallet.address)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-0.5 block text-[10px] text-muted-foreground tabular",
								children: formatUsd(wallet.usd, 2)
							})]
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
					align: "end",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuLabel, { children: ["Connected · ", wallet.provider] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
							onSelect: copyAddress,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), "Copy address"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
							onSelect: () => disconnectWallet(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4" }), "Disconnect"]
						})
					]
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => openConnect(true),
					className: "gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Unplug, { className: "size-4" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden sm:inline",
							children: "Connect wallet"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sm:hidden",
							children: "Connect"
						})
					]
				})]
			})]
		})
	});
}
function ModeChip({ active, onClick, icon: Icon, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		"aria-pressed": active,
		className: cn("flex h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-[background-color,color] duration-150 ease-out sm:px-3", active ? "bg-background text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: cn("size-3.5", active && (label === "Prosumer" ? "text-primary" : "text-accent")) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden sm:inline",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sm:hidden",
				children: label === "Prosumer" ? "Sell" : "Buy"
			})
		]
	});
}
function StatusBar() {
	const irradiance = useMarket((s) => s.irradiance);
	const block = useMarket((s) => s.block);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "border-b border-border/80",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-2 text-[11px] text-muted-foreground sm:px-6 lg:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: "default",
					className: "shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "live-dot size-1.5 rounded-full bg-primary" }), "Live"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden shrink-0 sm:inline",
					children: "Eastside Microgrid · Austin"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "shrink-0",
					children: [47, " nodes"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "shrink-0 tabular",
					children: [
						"Irradiance ",
						(irradiance * 100).toFixed(0),
						"%"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-auto hidden shrink-0 font-mono sm:inline",
					children: "EnergyPool 0xE41c…D6e7"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "hidden shrink-0 font-mono tabular md:inline",
					children: ["Block ", block.toLocaleString()]
				})
			]
		})
	});
}
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-2xl bg-card text-card-foreground shadow-[var(--shadow-card)]", className),
		...props
	});
}
function CardHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex items-start justify-between gap-3 p-5 pb-0", className),
		...props
	});
}
function CardTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: cn("font-display text-sm font-semibold tracking-tight text-foreground", className),
		...props
	});
}
function CardDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: cn("text-xs text-muted-foreground", className),
		...props
	});
}
function CardContent({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("p-5", className),
		...props
	});
}
function OverviewCards() {
	const price = useMarket((s) => s.price);
	const priceDelta = useMarket((s) => s.priceDelta);
	const congestion = useMarket((s) => s.congestion);
	const totalTradedKwh = useMarket((s) => s.totalTradedKwh);
	const wallet = useMarket((s) => s.wallet);
	const mode = useMarket((s) => s.mode);
	const openConnect = useMarket((s) => s.openConnect);
	const irradiance = useMarket((s) => s.irradiance);
	const supplyKwh = useMarket((s) => s.supplyKwh);
	const demandKwh = useMarket((s) => s.demandKwh);
	const up = priceDelta >= 0;
	const congestionMeta = {
		low: {
			label: "Low",
			hint: "Local solar is covering the feeder",
			className: "text-primary"
		},
		medium: {
			label: "Medium",
			hint: "Some packets routing via the utility",
			className: "text-warn"
		},
		high: {
			label: "High",
			hint: "Grid constrained — local fills preferred",
			className: "text-destructive"
		}
	}[congestion];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "stagger-in grid grid-cols-2 gap-3 lg:grid-cols-4",
		"aria-label": "Market overview",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				icon: Activity,
				label: "Local energy price",
				value: formatUsd(price, 3),
				unit: "/kWh",
				hint: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: cn("tabular", up ? "text-primary" : "text-destructive"),
					children: [
						up ? "+" : "",
						(priceDelta * 100).toFixed(2),
						"¢"
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				icon: Gauge,
				label: "Grid congestion",
				value: congestionMeta.label,
				hint: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: congestionMeta.className,
					children: congestionMeta.hint
				}),
				meter: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CongestionMeter, { level: congestion })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				icon: SunMedium,
				label: "Energy traded today",
				value: formatCompact(totalTradedKwh, 1),
				unit: "kWh",
				hint: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"Supply ",
					formatCompact(supplyKwh, 0),
					" · Demand ",
					formatCompact(demandKwh, 0)
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				icon: Wallet,
				label: mode === "prosumer" ? "Surplus & wallet" : "Wallet balance",
				value: wallet ? formatUsd(wallet.usd, 2) : "—",
				hint: wallet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: mode === "prosumer" ? `${formatKwh(wallet.surplusKwh)} surplus · ${(irradiance * 2.6).toFixed(1)} kW now` : `${formatKwh(wallet.kwhCredits)} credits on hand` }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => openConnect(true),
					className: "text-primary hover:underline",
					children: "Connect to trade"
				})
			})
		]
	});
}
function StatCard({ icon: Icon, label, value, unit, hint, meter }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4 sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] font-medium tracking-wide uppercase",
					children: label
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 flex items-baseline gap-1.5 font-display",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-2xl font-semibold tracking-tight text-foreground tabular sm:text-3xl",
					children: value
				}), unit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: unit
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 text-xs text-muted-foreground",
				children: hint
			}),
			meter
		]
	});
}
function CongestionMeter({ level }) {
	const active = level === "low" ? 1 : level === "medium" ? 2 : 3;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 flex gap-1",
		"aria-hidden": "true",
		children: [
			1,
			2,
			3
		].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("h-1 flex-1 rounded-full", n <= active ? n === 3 ? "bg-destructive" : n === 2 ? "bg-warn" : "bg-primary" : "bg-secondary") }, n))
	});
}
function OrderBook() {
	const orders = useMarket((s) => s.orders);
	const selectedOrderId = useMarket((s) => s.selectedOrderId);
	const selectOrder = useMarket((s) => s.selectOrder);
	const mode = useMarket((s) => s.mode);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const visible = (0, import_react.useMemo)(() => {
		return [...filter === "all" ? orders : orders.filter((o) => o.side === filter)].sort((a, b) => {
			if (a.side !== b.side) return a.side === "ask" ? -1 : 1;
			return a.side === "ask" ? a.price - b.price : b.price - a.price;
		});
	}, [orders, filter]);
	const asks = orders.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price);
	const bids = orders.filter((o) => o.side === "bid").sort((a, b) => b.price - a.price);
	const bestAsk = asks[0];
	const bestBid = bids[0];
	const spread = bestAsk && bestBid ? bestAsk.price - bestBid.price : 0;
	const mid = bestAsk && bestBid ? (bestAsk.price + bestBid.price) / 2 : bestAsk?.price ?? bestBid?.price ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex min-h-0 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Marketplace" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardDescription, { children: "Live order book for rooftop lots on this feeder." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex rounded-md bg-secondary p-0.5",
			children: [
				"all",
				"ask",
				"bid"
			].map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setFilter(key),
				className: cn("h-8 rounded-sm px-2.5 text-[11px] font-medium capitalize transition-colors duration-150", filter === key ? "bg-background text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground"),
				children: key === "ask" ? "Asks" : key === "bid" ? "Bids" : "All"
			}, key))
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "pt-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Best ask",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-primary tabular",
							children: bestAsk ? formatUsd(bestAsk.price, 3) : "—"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Best bid",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-accent tabular",
							children: bestBid ? formatUsd(bestBid.price, 3) : "—"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular",
						children: [
							"Spread ",
							formatUsd(Math.max(0, spread), 3),
							" · Mid ",
							formatUsd(mid, 3)
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "max-h-80 overflow-auto rounded-xl bg-background",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[520px] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-[11px] tracking-wide text-muted-foreground uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Peer"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Dist."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Size"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Price"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium text-right",
									children: "Action"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: visible.map((order) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderRow, {
						order,
						selected: selectedOrderId === order.id,
						prefer: mode === "consumer" ? "ask" : "bid",
						onSelect: () => selectOrder(selectedOrderId === order.id ? null : order.id)
					}, order.id)) })]
				})
			})]
		})]
	});
}
function OrderRow({ order, selected, prefer, onSelect }) {
	const isAsk = order.side === "ask";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
		className: cn("border-b border-border/70 last:border-0", order.fresh && "row-fresh", selected && "bg-secondary/80"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-2.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold", isAsk ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"),
						children: order.peer.slice(0, 1)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm leading-tight text-foreground",
						children: order.peer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block font-mono text-[10px] text-muted-foreground",
						children: [
							order.address.slice(0, 6),
							"…",
							order.address.slice(-4)
						]
					})] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-2.5 text-xs text-muted-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-3" }), order.distanceKm < 1 ? `${Math.round(order.distanceKm * 1e3)} m` : `${order.distanceKm.toFixed(1)} km`]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
				className: "px-3 py-2.5 font-mono text-xs tabular",
				children: [order.kwh.toFixed(1), " kWh"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
				className: "px-3 py-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("font-mono text-xs tabular", isAsk ? "text-primary" : "text-accent"),
					children: formatUsd(order.price, 3)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: "muted",
					className: "ml-2 hidden capitalize lg:inline-flex",
					children: order.side
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-2.5 text-right",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: selected ? "default" : prefer === order.side ? "secondary" : "outline",
					className: "h-11 sm:h-9",
					onClick: onSelect,
					children: selected ? "Selected" : isAsk ? "Buy" : "Fill"
				})
			})
		]
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-150 ease-out placeholder:text-subtle focus-visible:border-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50", className),
		...props
	});
}
function Slider({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Slider$1, {
		className: cn("relative flex h-11 w-full touch-none items-center select-none", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderTrack, {
			className: "relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRange, { className: "absolute h-full bg-primary" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderThumb, { className: "block size-4 rounded-full bg-primary shadow-[var(--shadow-card)] transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline-none" })]
	});
}
function QuickTrade() {
	const mode = useMarket((s) => s.mode);
	const price = useMarket((s) => s.price);
	const orders = useMarket((s) => s.orders);
	const selectedOrderId = useMarket((s) => s.selectedOrderId);
	const wallet = useMarket((s) => s.wallet);
	const pending = useMarket((s) => s.pending);
	const buy = useMarket((s) => s.buy);
	const sell = useMarket((s) => s.sell);
	const openConnect = useMarket((s) => s.openConnect);
	const selected = orders.find((o) => o.id === selectedOrderId) ?? null;
	const action = selected ? selected.side === "ask" ? "buy" : "sell" : mode === "prosumer" ? "sell" : "buy";
	const maxKwh = (0, import_react.useMemo)(() => {
		if (action === "sell") return Number((wallet?.surplusKwh ?? 12).toFixed(1));
		if (selected?.side === "ask") return selected.kwh;
		return 20;
	}, [
		action,
		selected,
		wallet
	]);
	const [kwh, setKwh] = (0, import_react.useState)(5);
	const [limitOn, setLimitOn] = (0, import_react.useState)(false);
	const [limit, setLimit] = (0, import_react.useState)(Number(price.toFixed(3)));
	(0, import_react.useEffect)(() => {
		setKwh((v) => Math.min(Math.max(.5, v), Math.max(.5, maxKwh)));
	}, [maxKwh]);
	(0, import_react.useEffect)(() => {
		if (selected) {
			setLimit(selected.price);
			setKwh(Math.min(selected.kwh, maxKwh));
		} else setLimit(Number(price.toFixed(3)));
	}, [
		selected,
		price,
		maxKwh
	]);
	const quotePrice = selected?.price ?? (limitOn ? limit : price);
	const notional = kwh * quotePrice;
	async function submit() {
		if (!wallet) {
			openConnect(true);
			return;
		}
		const limitPrice = limitOn || selected ? quotePrice : void 0;
		const result = action === "buy" ? await buy(kwh, limitPrice) : await sell(kwh, limitPrice);
		if (result.ok) toast.success(result.message);
		else if (result.reason !== "wallet") toast.error(result.message);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: action === "buy" ? "Quick buy" : "Quick sell" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardDescription, { children: selected ? `Filled against ${selected.peer}` : action === "buy" ? "Sweep cheapest local asks" : "Hit bids or list surplus on the book" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", action === "buy" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"),
			children: [action === "buy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3.5" }), action === "buy" ? "Consumer fill" : "Prosumer offer"]
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "flex flex-1 flex-col gap-4 pt-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-xs font-medium text-muted-foreground",
					children: ["Volume", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							min: .5,
							max: maxKwh,
							step: .1,
							value: kwh,
							onChange: (e) => setKwh(Number(e.target.value)),
							className: "font-mono tabular"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 text-xs text-muted-foreground",
							children: "kWh"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					min: .5,
					max: Math.max(.5, maxKwh),
					step: .1,
					value: [kwh],
					onValueChange: (v) => setKwh(v[0] ?? .5)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setLimitOn((v) => !v),
						className: cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150", limitOn ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"),
						children: limitOn ? "Limit" : "Market"
					}), limitOn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-xs text-muted-foreground",
						children: ["USD/kWh", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							min: .05,
							max: .4,
							step: .001,
							value: limit,
							onChange: (e) => setLimit(Number(e.target.value)),
							className: "h-9 w-24 font-mono tabular"
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-xs text-muted-foreground tabular",
						children: ["Ref ", formatUsd(price, 3)]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-auto space-y-2 rounded-xl bg-background p-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: "Est. price",
							value: formatUsd(quotePrice, 3) + "/kWh"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: "Notional",
							value: formatUsd(notional, 2)
						}),
						wallet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: action === "buy" ? "USD remaining" : "Surplus after",
							value: action === "buy" ? formatUsd(Math.max(0, wallet.usd - notional), 2) : formatKwh(Math.max(0, wallet.surplusKwh - kwh))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: "Wallet",
							value: "Not connected"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "lg",
					variant: action === "buy" ? "accent" : "default",
					disabled: pending,
					onClick: () => void submit(),
					className: "w-full",
					children: [pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, pending ? "Awaiting settlement…" : wallet ? `${action === "buy" ? "Buy" : "Sell"} ${kwh.toFixed(1)} kWh` : "Connect to trade"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] leading-relaxed text-muted-foreground",
					children: "Settlement is atomic on EnergyPool — kWh and USD move in one transaction once the matcher clears."
				})
			]
		})]
	});
}
function Row({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "font-mono text-xs tabular text-foreground",
			children: value
		})]
	});
}
function PriceChart() {
	const history = useMarket((s) => s.history);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setMounted(true);
	}, []);
	const data = history.map((p) => ({
		...p,
		time: formatClock(p.t)
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex min-h-0 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Dynamic local price" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardDescription, { children: "Price tracks rooftop supply (sunlight) against neighborhood demand in real time." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Legend, {})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, {
			className: "pt-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-64 w-full sm:h-72",
				children: mounted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ComposedChart, {
						data,
						margin: {
							top: 8,
							right: 8,
							left: 0,
							bottom: 0
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
								id: "supplyFill",
								x1: "0",
								y1: "0",
								x2: "0",
								y2: "1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
									offset: "0%",
									stopColor: "var(--color-primary)",
									stopOpacity: .28
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
									offset: "100%",
									stopColor: "var(--color-primary)",
									stopOpacity: 0
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
								id: "demandFill",
								x1: "0",
								y1: "0",
								x2: "0",
								y2: "1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
									offset: "0%",
									stopColor: "var(--color-accent)",
									stopOpacity: .22
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
									offset: "100%",
									stopColor: "var(--color-accent)",
									stopOpacity: 0
								})]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								stroke: "var(--color-border)",
								vertical: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "time",
								tick: {
									fill: "var(--color-muted-foreground)",
									fontSize: 10,
									fontFamily: "IBM Plex Mono"
								},
								tickLine: false,
								axisLine: false,
								minTickGap: 28
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								yAxisId: "price",
								orientation: "right",
								tick: {
									fill: "var(--color-muted-foreground)",
									fontSize: 10,
									fontFamily: "IBM Plex Mono"
								},
								tickLine: false,
								axisLine: false,
								width: 52,
								tickFormatter: (v) => `$${v.toFixed(2)}`,
								domain: ["auto", "auto"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								yAxisId: "energy",
								hide: true,
								domain: [0, "auto"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
								content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartTooltip, {}),
								cursor: {
									stroke: "var(--color-subtle)",
									strokeDasharray: "3 3"
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
								yAxisId: "energy",
								type: "monotone",
								dataKey: "supply",
								stroke: "var(--color-primary)",
								strokeWidth: 1.25,
								fill: "url(#supplyFill)",
								isAnimationActive: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
								yAxisId: "energy",
								type: "monotone",
								dataKey: "demand",
								stroke: "var(--color-accent)",
								strokeWidth: 1.25,
								fill: "url(#demandFill)",
								isAnimationActive: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
								yAxisId: "price",
								type: "monotone",
								dataKey: "price",
								stroke: "var(--color-foreground)",
								strokeWidth: 2,
								dot: false,
								isAnimationActive: false
							})
						]
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full w-full rounded-xl bg-secondary/60" })
			})
		})]
	});
}
function Legend() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
		className: "hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px w-4 bg-foreground" }), "Price"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-primary" }), "Supply"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-accent" }), "Demand"]
			})
		]
	});
}
function ChartTooltip({ active, payload }) {
	if (!active || !payload?.[0]) return null;
	const row = payload[0].payload;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-card-hover)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mb-1 font-mono text-muted-foreground",
				children: [row.time, " CT"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "tabular text-foreground",
				children: ["Price ", formatUsd(row.price, 3)]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "tabular text-primary",
				children: [
					"Supply ",
					row.supply.toFixed(0),
					" kWh"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "tabular text-accent",
				children: [
					"Demand ",
					row.demand.toFixed(0),
					" kWh"
				]
			})
		]
	});
}
function ContractFeed() {
	const txs = useMarket((s) => s.txs);
	const [copied, setCopied] = (0, import_react.useState)(null);
	function copyHash(hash) {
		navigator.clipboard.writeText(hash);
		setCopied(hash);
		toast.success("Transaction hash copied");
		window.setTimeout(() => setCopied((c) => c === hash ? null : c), 1200);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex min-h-0 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Smart contract feed" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardDescription, { children: "Immutable EnergyPool settlements on the local matcher." })] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, {
			className: "pt-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "max-h-72 space-y-1 overflow-y-auto pr-1",
				children: txs.map((tx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: cn("rounded-xl px-3 py-2.5", tx.fresh ? "row-fresh bg-secondary/40" : "bg-background"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "min-w-0 text-sm leading-snug",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-foreground",
									children: tx.fromName
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: " sold "
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono tabular text-primary",
									children: [tx.kwh.toFixed(1), " kWh"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: " to "
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-foreground",
									children: tx.toName
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 font-mono text-[10px] text-muted-foreground tabular",
							children: formatClock(tx.timestamp)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono tabular",
								children: [formatUsd(tx.price, 3), "/kWh"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono",
								children: ["blk ", tx.block.toLocaleString()]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => copyHash(tx.txHash),
								className: "inline-flex items-center gap-1 font-mono text-accent hover:text-foreground",
								children: [copied === tx.txHash ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3" }), shortAddr(tx.txHash)]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("ml-auto inline-flex items-center gap-1", tx.status === "confirmed" ? "text-primary" : "text-warn"),
								children: tx.status === "confirmed" ? "Confirmed" : "Pending"
							})
						]
					})]
				}, tx.id))
			})
		})]
	});
}
var Dialog = Dialog$1;
function DialogOverlay({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
		className: cn("fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
		...props
	});
}
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 text-card-foreground shadow-[var(--shadow-card-hover)]", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 rounded-sm p-2 text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mb-4 space-y-1 pr-8", className),
		...props
	});
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("font-display text-lg font-semibold tracking-tight", className),
		...props
	});
}
function DialogDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
		className: cn("text-sm text-muted-foreground", className),
		...props
	});
}
var PROVIDERS = [
	{
		id: "injected",
		label: "Browser wallet",
		hint: "MetaMask, Rabby, Brave",
		icon: Wallet
	},
	{
		id: "walletconnect",
		label: "WalletConnect",
		hint: "Scan with any mobile wallet",
		icon: QrCode
	},
	{
		id: "coinbase",
		label: "Coinbase Wallet",
		hint: "Smart wallet or extension",
		icon: Link2
	}
];
function WalletDialog() {
	const open = useMarket((s) => s.connectOpen);
	const openConnect = useMarket((s) => s.openConnect);
	const connectWallet = useMarket((s) => s.connectWallet);
	const [busy, setBusy] = (0, import_react.useState)(null);
	async function onPick(id) {
		setBusy(id);
		await connectWallet(id);
		setBusy(null);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: openConnect,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Connect wallet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Sign in to the Eastside microgrid to trade surplus solar. Demo wallets settle against a simulated EnergyPool contract." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col gap-2",
			children: PROVIDERS.map((p) => {
				const Icon = p.icon;
				const loading = busy === p.id;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled: busy != null,
					onClick: () => void onPick(p.id),
					className: cn("flex h-14 items-center gap-3 rounded-xl bg-secondary px-3.5 text-left transition-[background-color,transform] duration-150 ease-out", "hover:bg-surface-2 active:scale-[0.98] disabled:opacity-60"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-9 items-center justify-center rounded-md bg-background text-primary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-sm font-medium text-foreground",
							children: p.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-xs text-muted-foreground",
							children: loading ? "Waiting for signature…" : p.hint
						})]
					})]
				}, p.id);
			})
		})] })
	});
}
function Dashboard() {
	const startLive = useMarket((s) => s.startLive);
	const tick = useMarket((s) => s.tick);
	(0, import_react.useEffect)(() => {
		startLive();
		const id = window.setInterval(() => tick(), 2200);
		return () => window.clearInterval(id);
	}, [startLive, tick]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "app-canvas min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 pb-10 sm:px-6 sm:py-6 lg:px-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OverviewCards, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBook, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuickTrade, {})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChart, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContractFeed, {})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletDialog, {})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, {});
}
//#endregion
export { Home as component };
