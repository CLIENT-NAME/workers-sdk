/**
 * argv → StartDevWorkerInput translation.
 *
 * Mirrors `setupDevEnv` in wsdk:packages/wrangler/src/dev/start-dev.ts
 * (lines 232-332) but stripped to the local-only case:
 *
 * - No remote bindings codepath (`dev.remote: false`).
 * - Auth hook is a stub that throws — only invoked from
 *   remote-bindings codepaths, so seeing it fire means the user has
 *   `remote = true` on a binding in their wrangler config. The error
 *   message points at the fix.
 * - No service environments (`legacy.useServiceEnvironments: false`,
 *   `env: undefined`). The package targets the new unified config
 *   format, which does not include service environments.
 *   `wrangler.jsonc` files containing `[env.X]` tables parse fine but
 *   are ignored at runtime; the wrapper layer in cli.ts logs a warning.
 * - No Pages assets shim, no Sites (`legacy.site: undefined`).
 * - No tunnel, no multi-worker, no hotkeys.
 * - `dev.enableContainers: false` for v1 — Cloudchamber API auth is
 *   out of scope (containers require a remote auth flow even for
 *   image_uri pulls). Local-built containers would work with this set
 *   to true but we keep it off uniformly to avoid the failure mode
 *   where `image = "..."` works but `image_uri = "..."` errors out.
 */
import { getDefaultDevRegistryPath } from "miniflare";
import type { DevArgs } from "./args.js";

interface KeyValueArray {
	(array?: string[]): Record<string, string>;
}

const collectKeyValues: KeyValueArray = (array) => {
	if (!array) return {};
	const out: Record<string, string> = {};
	for (const entry of array) {
		const idx = entry.indexOf(":");
		if (idx === -1) {
			// Bare key (no `:value`) → empty string. Matches wrangler's
			// `collectKeyValues` semantics: `["FOO"]` → `{FOO: ""}`.
			out[entry] = "";
			continue;
		}
		out[entry.slice(0, idx)] = entry.slice(idx + 1);
	}
	return out;
};

/**
 * `--var KEY:VALUE` flags become hidden plain_text bindings, matching
 * wrangler's `collectPlainTextVars`. Hidden so values don't leak into
 * the dev session's printed binding summary.
 */
const collectPlainTextVars = (array?: string[]) => {
	if (!array) return {};
	const out: Record<string, { type: "plain_text"; value: string; hidden: true }> =
		{};
	for (const entry of array) {
		const idx = entry.indexOf(":");
		const key = idx === -1 ? entry : entry.slice(0, idx);
		const value = idx === -1 ? "" : entry.slice(idx + 1);
		out[key] = { type: "plain_text", value, hidden: true };
	}
	return out;
};

/**
 * Build the `StartDevWorkerInput` object. Untyped on the way out — we
 * intentionally don't import the type so this package's public surface
 * doesn't grow a `wrangler` re-export. The wrapper in cli.ts hands the
 * returned object to `devEnv.config.set(input, true)` where wrangler
 * does its own validation.
 */
export function buildInput(args: DevArgs): Record<string, unknown> {
	return {
		name: args.name,
		config: args.config,
		entrypoint: args.script,
		compatibilityDate: args.compatibilityDate,
		compatibilityFlags: args.compatibilityFlags,
		// No `triggers` — those come from --routes (rejected) or the
		// config file's own routes list (which DevEnv reads itself).
		// Service environments are unsupported; pass undefined so
		// wrangler walks the top-level config only.
		env: undefined,
		envFiles: args.envFile,
		build: {
			bundle: args.noBundle === true ? false : undefined,
			define: collectKeyValues(args.define),
			alias: collectKeyValues(args.alias),
			jsxFactory: args.jsxFactory,
			jsxFragment: args.jsxFragment,
			tsconfig: args.tsconfig,
			minify: args.minify,
		},
		bindings: {
			...collectPlainTextVars(args.var),
		},
		dev: {
			auth: () => {
				// This dev-server is local-only. The auth hook is invoked
				// by wrangler internals only when a remote-bindings
				// codepath needs it — i.e. the user has `remote = true`
				// on a binding. Surface a clear error pointing at the fix.
				throw new Error(
					"@cloudflare/wrangler-bundler is local-only. Remote bindings (`remote = true` in wrangler.jsonc) are not supported here. Use `wrangler dev` directly if you need remote bindings, or set the binding to local-only."
				);
			},
			remote: false,
			server: {
				hostname: args.ip,
				port: args.port,
				secure:
					args.localProtocol === undefined
						? undefined
						: args.localProtocol === "https",
				httpsCertPath: args.httpsCertPath,
				httpsKeyPath: args.httpsKeyPath,
			},
			inspector: {
				hostname: args.inspectorIp,
				port: args.inspectorPort,
			},
			// `origin` is intentionally omitted — it's controlled by
			// --host / --upstream-protocol, both rejected by parseArgs.
			persist: args.persistTo,
			liveReload: args.liveReload,
			testScheduled: args.testScheduled,
			logLevel: args.logLevel,
			// Dev-registry path. We use miniflare's resolver rather than
			// workers-utils' `getRegistryPath` to avoid the latter's
			// xdg-app-paths CJS-shim breakage in pure-ESM consumers.
			// miniflare exposes an equivalent function with the same
			// default fallback path ($XDG_CONFIG_HOME/.wrangler/registry).
			// Honoring different env vars (MINIFLARE_REGISTRY_PATH vs
			// WRANGLER_REGISTRY_PATH) is acceptable — multi-session compat
			// with `wrangler dev` works on the default path; users who
			// override the path explicitly can set both env vars.
			registry: args.disableDevRegistry
				? undefined
				: getDefaultDevRegistryPath(),
			// v1: containers off. See file header for rationale.
			enableContainers: false,
		},
		legacy: {
			// The new unified config format drops service environments.
			// Pass false so wrangler doesn't emit the "service
			// environment" deprecation warning for users who haven't
			// opted into legacy-env semantics.
			useServiceEnvironments: false,
			site: undefined,
		},
		assets: args.assets,
	};
}
