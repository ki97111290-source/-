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
	if (snap.start !== null && next instanceof HTMLInputElement) {
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

export function sparkline(values: number[], color: string): string {
	if (values.length < 2) return `<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"></svg>`;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const points = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * 100;
			const y = 26 - ((v - min) / span) * 24;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
		<polyline points="${points}" fill="none" stroke="${esc(color)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
	</svg>`;
}
