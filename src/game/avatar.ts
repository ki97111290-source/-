/**
 * 외부 이미지 의존 없이 캐릭터 아바타를 만든다.
 * 절차적 SVG를 data URI로 인코딩하므로 오프라인/정적 배포에서도 깨지지 않는다.
 */

function hash(str: string): number {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

export function initials(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "?";
	// 한글은 첫 글자만, 라틴 문자는 단어별 이니셜 2자까지
	if (/[가-힣]/.test(trimmed)) return trimmed.slice(0, 2);
	const words = trimmed.split(/\s+/).filter(Boolean);
	if (words.length === 1) return trimmed.slice(0, 2).toUpperCase();
	return words
		.slice(0, 2)
		.map((w) => w[0] ?? "")
		.join("")
		.toUpperCase();
}

/** 이름에서 결정적으로 파스텔~네온 계열 색을 뽑는다. */
export function colorFor(name: string): string {
	const h = hash(name) % 360;
	return `hsl(${h} 78% 62%)`;
}

/** 이름 기반 절차적 아바타 (그라디언트 + 이니셜 + 후광) */
export function makeAvatar(name: string, color = colorFor(name)): string {
	const h = hash(`${name}#bg`) % 360;
	const label = escapeXml(initials(name));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h} 70% 30%)"/>
<stop offset="1" stop-color="hsl(${(h + 48) % 360} 70% 16%)"/>
</linearGradient>
<radialGradient id="r" cx="0.5" cy="0.32" r="0.55">
<stop offset="0" stop-color="${color}" stop-opacity="0.85"/>
<stop offset="1" stop-color="${color}" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="128" height="128" fill="url(#g)"/>
<circle cx="64" cy="42" r="46" fill="url(#r)"/>
<text x="64" y="82" text-anchor="middle" font-family="system-ui, sans-serif" font-size="42" font-weight="700" fill="#fff" opacity="0.94">${label}</text>
</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const MAX_EDGE = 320;

/**
 * 업로드 이미지를 정사각형으로 잘라 축소한 뒤 data URI로 만든다.
 * 저장소(localStorage)에 들어가므로 용량을 강하게 제한한다.
 */
export async function fileToAvatar(file: File): Promise<string> {
	if (!file.type.startsWith("image/")) {
		throw new Error("이미지 파일만 올릴 수 있어요.");
	}
	if (file.size > 12 * 1024 * 1024) {
		throw new Error("이미지가 너무 커요. 12MB 이하로 올려주세요.");
	}
	const bitmap = await loadBitmap(file);
	const side = Math.min(bitmap.width, bitmap.height);
	const sx = (bitmap.width - side) / 2;
	const sy = (bitmap.height - side) / 2;

	const canvas = document.createElement("canvas");
	canvas.width = MAX_EDGE;
	canvas.height = MAX_EDGE;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("캔버스를 사용할 수 없어요.");
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, MAX_EDGE, MAX_EDGE);
	if ("close" in bitmap) bitmap.close();

	const webp = canvas.toDataURL("image/webp", 0.78);
	// webp 미지원 브라우저는 toDataURL이 png를 돌려주므로 그때는 jpeg로 재시도
	if (webp.startsWith("data:image/webp")) return webp;
	return canvas.toDataURL("image/jpeg", 0.8);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof createImageBitmap === "function") {
		try {
			return await createImageBitmap(file);
		} catch {
			// 아래 <img> 경로로 폴백
		}
	}
	const url = URL.createObjectURL(file);
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
			img.src = url;
		});
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}
