export function esc(value: unknown): string {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** 값을 이스케이프하는 템플릿 태그. 배열은 이어붙인다. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
	let out = strings[0] ?? "";
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		out += Array.isArray(v) ? v.join("") : esc(v);
		out += strings[i + 1] ?? "";
	}
	return out;
}

/** 이스케이프하지 않고 그대로 끼워 넣을 조각 */
export function raw(markup: string): string[] {
	return [markup];
}

interface FocusSnapshot {
	id: string;
	start: number | null;
	end: number | null;
}

function snapshotFocus(root: HTMLElement): FocusSnapshot | null {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !active.id || !root.contains(active)) return null;
	const field = active as HTMLInputElement;
	return {
		id: active.id,
		start: typeof field.selectionStart === "number" ? field.selectionStart : null,
		end: typeof field.selectionEnd === "number" ? field.selectionEnd : null,
	};
}

function restoreFocus(root: HTMLElement, snap: FocusSnapshot | null): void {
	if (!snap) return;
	const next = root.querySelector<HTMLElement>(`#${CSS.escape(snap.id)}`);
	if (!next) return;
	next.focus({ preventScroll: true });
	if (
		snap.start !== null &&
		(next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)
	) {
		try {
			next.setSelectionRange(snap.start, snap.end ?? snap.start);
		} catch {
			// number 타입 input 등은 selectionRange를 지원하지 않는다.
		}
	}
}

/** innerHTML 교체 시 포커스와 캐럿 위치, 스크롤을 지켜준다. */
export function paint(container: HTMLElement, markup: string): void {
	if (container.dataset.markup === markup) return;
	const snap = snapshotFocus(container);
	const scroll = container.scrollTop;
	container.innerHTML = markup;
	container.dataset.markup = markup;
	container.scrollTop = scroll;
	restoreFocus(container, snap);
}

/**
 * 같은 그림은 다시 만들지 않는다.
 * 화면은 초당 열 번 다시 그리는데 주가 이력은 4초에 한 번만 쌓이므로,
 * 스물여섯 줄치 점 좌표를 매 프레임 새로 계산할 이유가 없다.
 * (적정가 선은 계속 움직이지만, 유효숫자 네 자리면 화면에서 같은 자리다)
 */
const sparkCache = new WeakMap<number[], { key: string; svg: string }>();

/** fair를 주면 적정가 위치에 점선을 그어 고평가/저평가가 눈에 보이게 한다. */
export function sparkline(values: number[], color: string, fair?: number): string {
	if (values.length < 2) return `<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"></svg>`;

	const key = `${values.length}|${values[values.length - 1]}|${color}|${
		fair !== undefined && Number.isFinite(fair) ? fair.toPrecision(4) : ""
	}`;
	const hit = sparkCache.get(values);
	if (hit && hit.key === key) return hit.svg;
	const withFair = fair !== undefined && Number.isFinite(fair) ? [...values, fair] : values;
	const min = Math.min(...withFair);
	const max = Math.max(...withFair);
	const span = max - min || 1;
	const points = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * 100;
			const y = 26 - ((v - min) / span) * 24;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	const fairLine =
		fair !== undefined && Number.isFinite(fair)
			? `<line x1="0" x2="100" y1="${(26 - ((fair - min) / span) * 24).toFixed(1)}" y2="${(26 - ((fair - min) / span) * 24).toFixed(1)}" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.45"/>`
			: "";
	const svg = `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
		${fairLine}
		<polyline points="${points}" fill="none" stroke="${esc(color)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
	</svg>`;
	sparkCache.set(values, { key, svg });
	return svg;
}
