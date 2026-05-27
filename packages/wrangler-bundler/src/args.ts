/**
 * Argv parser for `cf-wrangler dev [args...]`.
 *
 * Deliberately minimal: only the five flags the cf-dev parent
 * process needs to pass through are accepted. Everything else
 * belongs in the user's `wrangler.jsonc`. Built on `node:util`'s
 * built-in `parseArgs` (strict mode → unknown flags throw).
 *
 * Note: remote *bindings* (per-resource `remote = true` in
 * `wrangler.jsonc`) are fully supported by wrangler-bundler — they
 * just don't need a flag here.
 */
import { parseArgs as nodeParseArgs } from "node:util";

export interface DevArgs {
	// Path to wrangler.jsonc / wrangler.toml.
	config?: string;
	// Named environment from wrangler.jsonc (`[env.X]`). Surfaced as
	// `--mode` rather than `--env` to align with the cf-dev parent
	// process's flag vocabulary; maps to wrangler's `env` option.
	mode?: string;
	// Listen port for the dev server.
	port?: number;
	// Acts-as-origin hostname override. Maps to wrangler's `--host`
	// (`dev.origin.hostname`).
	host?: string;
	// Force local execution even when `dev.remote` is set in config.
	local?: boolean;
}

export class ArgParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ArgParseError";
	}
}

export function parseArgs(argv: string[]): DevArgs {
	let parsed;
	try {
		parsed = nodeParseArgs({
			args: argv,
			options: {
				config: { type: "string" },
				mode: { type: "string" },
				host: { type: "string" },
				// `node:util.parseArgs` has no `number` type; coerce below.
				port: { type: "string" },
				local: { type: "boolean" },
			},
			strict: true,
			allowPositionals: false,
			allowNegative: true,
		});
	} catch (err) {
		throw new ArgParseError(err instanceof Error ? err.message : String(err));
	}

	const out: DevArgs = {};
	if (parsed.values.config !== undefined) {
		out.config = parsed.values.config;
	}
	if (parsed.values.mode !== undefined) {
		out.mode = parsed.values.mode;
	}
	if (parsed.values.host !== undefined) {
		out.host = parsed.values.host;
	}
	if (parsed.values.port !== undefined) {
		const n = Number(parsed.values.port);
		if (!Number.isFinite(n)) {
			throw new ArgParseError(
				`--port expects a number, got "${parsed.values.port}"`
			);
		}
		out.port = n;
	}
	if (parsed.values.local !== undefined) {
		out.local = parsed.values.local;
	}

	return out;
}
