import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "src/index.ts",
	platform: "node",
	format: "esm",
	outDir: "dist",
	target: "node22",
	dts: true,
	clean: true,
	sourcemap: process.env.NODE_ENV !== "production",
	minify: process.env.NODE_ENV === "production",
	// Externalize all dependencies — bundling workers-utils' tsup
	// CJS-shim output into our pure-ESM bundle breaks dynamic
	// require()s (e.g. xdg-app-paths). Letting them resolve at
	// runtime via Node's ESM loader avoids the issue and keeps
	// our dist small.
	external: ["wrangler", "miniflare", "yargs-parser"],
});
