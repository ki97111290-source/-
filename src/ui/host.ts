/**
 * 아티팩트 뷰어(claude.ai) 안에서 돌 때의 예외 처리.
 *
 * 뷰어는 페이지가 스스로 시작하는 다운로드를 막는다. `<a download>`를 눌러도
 * 아무 일이 일어나지 않고, 실패했다는 신호조차 오지 않는다 —
 * 그래서 "내려받았어요"라고 거짓말을 하게 된다.
 * 뷰어가 열어 주는 저장 창(downloads 기능)을 대신 쓰고, 그것도 없으면
 * 부르는 쪽에서 세이브를 글로 띄워 복사하게 한다.
 */

interface Downloads {
	save(request: { filename: string; data: string }): Promise<{ status: "saved" }>;
}

interface ClaudeHost {
	use?(name: string): Promise<unknown>;
}

function host(): ClaudeHost | null {
	if (typeof window === "undefined") return null;
	return (window as unknown as { claude?: ClaudeHost }).claude ?? null;
}

/** 아티팩트 뷰어 안인지. 이 안에서는 평범한 다운로드가 통하지 않는다. */
export function inArtifactFrame(): boolean {
	return host() !== null;
}

export type SaveOutcome = "saved" | "declined" | "busy" | "unavailable";

/** 뷰어의 저장 창으로 파일을 건넨다. 뷰어가 확인 창을 띄우고, 거절할 수 있다. */
export async function saveViaHost(filename: string, data: string): Promise<SaveOutcome> {
	const claude = host();
	if (!claude || typeof claude.use !== "function") return "unavailable";

	let downloads: Downloads | null = null;
	try {
		downloads = (await claude.use("downloads")) as Downloads | null;
	} catch {
		return "unavailable";
	}
	if (!downloads || typeof downloads.save !== "function") return "unavailable";

	try {
		await downloads.save({ filename, data });
		return "saved";
	} catch (err) {
		const code = (err as { code?: string } | null)?.code;
		if (code === "declined") return "declined";
		if (code === "rate_limited") return "busy";
		return "unavailable";
	}
}

/** 클립보드에 복사한다. 막혀 있으면 false — 부르는 쪽이 직접 긁어 복사하게 안내한다. */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
