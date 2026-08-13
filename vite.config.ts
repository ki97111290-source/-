import { defineConfig } from "vite";

// base를 상대경로로 두면 GitHub Pages, itch.io 등 어느 하위 경로에 올려도 동작한다.
export default defineConfig({
	base: "./",
	build: {
		target: "es2022",
		outDir: "dist",
	},
});
