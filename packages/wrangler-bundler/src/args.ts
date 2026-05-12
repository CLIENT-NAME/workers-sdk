/**
 * Argv parser for `cf-wrangler dev [args...]`.
 *
 * Mirrors the local-relevant subset of `wrangler dev`'s flag list (see
 * wsdk:packages/wrangler/src/dev.ts:47-267). Remote-mode flags (--remote,
 * --routes, --host, --upstream-protocol, --tunnel) and service-environment
 * flags (--env) are explicitly rejected at parse time so the user gets a
 * clear error pointing at `wrangler dev` instead of a confusing fallback.
 *
 * The dev-server subprocess contract leaves argv parsing entirely to the
 * impl: the parent process forwards whatever the user typed verbatim.
 * yargs-parser is sufficient because we don't need yargs's command/help
 * machinery — we only need to coerce types and reject unknowns.
 */
import yargsParser from "yargs-parser";

export interface DevArgs {
	// Config / entry
	config?: string;
	script?: string;
	name?: string;

	// Network
	ip?: string;
	port?: number;
	inspectorIp?: string;
	inspectorPort?: number;
	localProtocol?: "http" | "https";
	httpsKeyPath?: string;
	httpsCertPath?: string;

	// Runtime
	compatibilityDate?: string;
	compatibilityFlags?: string[];

	// Bindings / build
	var?: string[];
	define?: string[];
	alias?: string[];
	jsxFactory?: string;
	jsxFragment?: string;
	tsconfig?: string;
	noBundle?: boolean;
	minify?: boolean;

	// Persistence / DX
	persistTo?: string;
	liveReload?: boolean;
	testScheduled?: boolean;
	logLevel?: "none" | "error" | "warn" | "info" | "log" | "debug";
	envFile?: string[];

	// Assets
	assets?: string;

	// Debug escape hatch (NOT exposed in --help; the long-running
	// dev-server contract requires registry registration in normal
	// operation).
	disableDevRegistry?: boolean;
}

const KEBAB_OPTIONS = {
	string: [
		"config",
		"script",
		"name",
		"ip",
		"inspector-ip",
		"local-protocol",
		"https-key-path",
		"https-cert-path",
		"compatibility-date",
		"jsx-factory",
		"jsx-fragment",
		"tsconfig",
		"persist-to",
		"log-level",
		"assets",
	],
	number: ["port", "inspector-port"],
	boolean: [
		"no-bundle",
		"minify",
		"live-reload",
		"test-scheduled",
		"disable-dev-registry",
	],
	array: ["compatibility-flags", "var", "define", "alias", "env-file"],
} as const;

const REJECTED_FLAGS: Record<string, string> = {
	remote:
		"--remote is not supported by @cloudflare/wrangler-bundler. Use `wrangler dev --remote` directly, or use remote bindings via the `remote = true` field on individual resources in your wrangler config.",
	routes:
		"--routes is not supported by @cloudflare/wrangler-bundler (deploy-only flag).",
	host: "--host is a remote-mode flag and is not supported by @cloudflare/wrangler-bundler.",
	"upstream-protocol":
		"--upstream-protocol is a remote-mode flag and is not supported by @cloudflare/wrangler-bundler.",
	tunnel:
		"--tunnel is not supported by @cloudflare/wrangler-bundler. Use `wrangler dev --tunnel` directly.",
	env: "--env (service environments) is not supported by @cloudflare/wrangler-bundler. The new unified config format does not include service environments. If your wrangler config has [env.X] tables they will be ignored at runtime (a warning will print).",
};

export class ArgParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ArgParseError";
	}
}

export function parseArgs(argv: string[]): DevArgs {
	// Detect rejected flags before yargs-parser swallows them. We check the
	// raw argv so partial matches and `=value` forms are caught.
	for (const token of argv) {
		if (!token.startsWith("--")) {
			continue;
		}
		// Strip --no- prefix and --flag=value form for the lookup.
		const stripped = token
			.replace(/^--(no-)?/, "")
			.replace(/=.*$/, "");
		const reason = REJECTED_FLAGS[stripped];
		if (reason) {
			throw new ArgParseError(reason);
		}
	}

	const parsed = yargsParser(argv, {
		string: [...KEBAB_OPTIONS.string],
		number: [...KEBAB_OPTIONS.number],
		boolean: [...KEBAB_OPTIONS.boolean],
		array: [...KEBAB_OPTIONS.array],
		configuration: {
			"camel-case-expansion": true,
			"strip-aliased": true,
			// Don't blow up on unknown flags here — the dev-server
			// subprocess contract expects argv to be passed through
			// verbatim, including flags we don't recognise (which usually
			// means the user mistyped). We surface the unknown via
			// wrangler/DevEnv's own errors.
			"unknown-options-as-args": false,
		},
	});

	const out: DevArgs = {};

	if (typeof parsed.config === "string") out.config = parsed.config;
	if (typeof parsed.script === "string") out.script = parsed.script;
	if (typeof parsed.name === "string") out.name = parsed.name;

	if (typeof parsed.ip === "string") out.ip = parsed.ip;
	if (typeof parsed.port === "number") out.port = parsed.port;
	if (typeof parsed.inspectorIp === "string")
		out.inspectorIp = parsed.inspectorIp;
	if (typeof parsed.inspectorPort === "number")
		out.inspectorPort = parsed.inspectorPort;
	if (parsed.localProtocol === "http" || parsed.localProtocol === "https") {
		out.localProtocol = parsed.localProtocol;
	}
	if (typeof parsed.httpsKeyPath === "string")
		out.httpsKeyPath = parsed.httpsKeyPath;
	if (typeof parsed.httpsCertPath === "string")
		out.httpsCertPath = parsed.httpsCertPath;

	if (typeof parsed.compatibilityDate === "string")
		out.compatibilityDate = parsed.compatibilityDate;
	if (Array.isArray(parsed.compatibilityFlags))
		out.compatibilityFlags = parsed.compatibilityFlags.map(String);

	if (Array.isArray(parsed.var)) out.var = parsed.var.map(String);
	if (Array.isArray(parsed.define)) out.define = parsed.define.map(String);
	if (Array.isArray(parsed.alias)) out.alias = parsed.alias.map(String);
	if (typeof parsed.jsxFactory === "string") out.jsxFactory = parsed.jsxFactory;
	if (typeof parsed.jsxFragment === "string")
		out.jsxFragment = parsed.jsxFragment;
	if (typeof parsed.tsconfig === "string") out.tsconfig = parsed.tsconfig;
	if (typeof parsed.noBundle === "boolean") out.noBundle = parsed.noBundle;
	if (typeof parsed.minify === "boolean") out.minify = parsed.minify;

	if (typeof parsed.persistTo === "string") out.persistTo = parsed.persistTo;
	if (typeof parsed.liveReload === "boolean")
		out.liveReload = parsed.liveReload;
	if (typeof parsed.testScheduled === "boolean")
		out.testScheduled = parsed.testScheduled;
	if (
		parsed.logLevel === "none" ||
		parsed.logLevel === "error" ||
		parsed.logLevel === "warn" ||
		parsed.logLevel === "info" ||
		parsed.logLevel === "log" ||
		parsed.logLevel === "debug"
	) {
		out.logLevel = parsed.logLevel;
	}
	if (Array.isArray(parsed.envFile)) out.envFile = parsed.envFile.map(String);

	if (typeof parsed.assets === "string") out.assets = parsed.assets;

	if (typeof parsed.disableDevRegistry === "boolean")
		out.disableDevRegistry = parsed.disableDevRegistry;

	return out;
}
