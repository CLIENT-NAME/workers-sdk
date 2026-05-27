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
	// Externalize wrangler — bundling workers-utils' tsup CJS-shim
	// output into our pure-ESM bundle breaks dynamic require()s
	// (e.g. xdg-app-paths). Letting it resolve at runtime via
	// Node's ESM loader avoids the issue and keeps our dist small.
	// `yargs-parser` is bundled (pure CJS, no shim issues, small).
	external: ["wrangler"],
});
