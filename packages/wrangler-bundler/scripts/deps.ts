/**
 * Dependencies that _are not_ bundled along with @cloudflare/wrangler-bundler.
 *
 * This list is validated by `tools/deployments/validate-package-dependencies.ts`.
 */
export const EXTERNAL_DEPENDENCIES = [
	// `wrangler` itself is the entire reason this package exists —
	// the runtime adapter delegates to `wrangler.unstable_dev`.
	// Bundling wrangler would also drag in workers-utils' tsup
	// CJS-shim output, which uses dynamic `require()`s (e.g.
	// `xdg-app-paths`) that break inside our pure-ESM bundle.
	"wrangler",
];
