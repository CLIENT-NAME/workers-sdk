/**
 * `dev` verb handler for the `cf-wrangler` delegate binary.
 *
 * Long-running dev-server subprocess entry. Inherits stdio from the
 * parent process (which inherits from the user's terminal — so
 * wrangler/Miniflare own the TTY directly), and forwards SIGINT /
 * SIGTERM to `devEnv.teardown()`.
 *
 * Subprocess contract:
 * - Invoked as `<pkgRoot>/bin/cf-wrangler dev [user-argv...]`.
 * - bin/cf-wrangler strips the leading `dev` subcommand-discriminator
 *   token before calling us.
 * - Exit code 0 on clean teardown; 128+sig on signal-triggered exit.
 *
 * Reference flow: wsdk:packages/wrangler/src/dev.ts:296-303 (the
 * `await events.once(devEnv, "teardown")` block) plus
 * wsdk:packages/wrangler/src/dev/start-dev.ts:setupDevEnv. We
 * deliberately DO NOT call `unstable_dev` — that returns once the
 * server is ready, but we need to block until teardown.
 *
 * Namespace import only: `import * as wrangler from "wrangler"`. The
 * vite-plugin AGENTS.md enforces this via eslint and we follow the
 * same convention here.
 */
import events from "node:events";
import * as wrangler from "wrangler";
import { ArgParseError, parseArgs } from "./args.js";
import { buildInput } from "./input.js";

/**
 * Run the bundler-based dev server. Returns the desired exit code;
 * the bin shim is responsible for `process.exit()`.
 *
 * Long-running. Returns when the user hits Ctrl+C (or a SIGTERM
 * arrives), at which point the dev server has fully torn down.
 */
export async function runDev(argv: string[]): Promise<number> {
	let parsed;
	try {
		parsed = parseArgs(argv);
	} catch (err) {
		if (err instanceof ArgParseError) {
			process.stderr.write(`Error: ${err.message}\n`);
			return 2;
		}
		throw err;
	}

	const input = buildInput(parsed);

	// Construct DevEnv directly — `unstable_dev` resolves once the
	// server is ready, but we need to block until teardown like
	// wrangler's own `dev` command does at dev.ts:299.
	const devEnv = new wrangler.unstable_DevEnv();

	// Signal forwarding. Map signals to the conventional 128+sig exit
	// code so the parent process observes a clean signal-triggered
	// exit.
	let signalled: NodeJS.Signals | null = null;
	const onSignal = (sig: NodeJS.Signals) => {
		signalled = sig;
		// Fire-and-forget; we await teardown via `events.once` below.
		// If teardown fails the unhandledRejection handler will surface
		// it. The DevEnv emits "teardown" regardless of outcome.
		void devEnv.teardown().catch((err) => {
			process.stderr.write(`teardown error: ${err}\n`);
		});
	};
	const onSigInt = () => onSignal("SIGINT");
	const onSigTerm = () => onSignal("SIGTERM");
	process.on("SIGINT", onSigInt);
	process.on("SIGTERM", onSigTerm);

	try {
		// throwErrors=true so config-validation failures surface as
		// thrown errors here instead of being swallowed and emitted
		// asynchronously as ErrorEvent. This keeps the "wrangler.jsonc
		// is missing" / "main is invalid" failure modes unambiguous.
		await devEnv.config.set(
			input as Parameters<typeof devEnv.config.set>[0],
			true
		);

		// Block on teardown. `events.once` resolves when the EventEmitter
		// emits "teardown" — either user-triggered (Ctrl+C → onSignal)
		// or internal (fatal error from a controller).
		await events.once(devEnv, "teardown");
	} finally {
		process.off("SIGINT", onSigInt);
		process.off("SIGTERM", onSigTerm);
	}

	// Map signal-triggered teardown to the conventional 128+sig exit
	// code so the user-visible exit code is identical whether they
	// Ctrl+C in this binary directly or via a parent process that
	// delegates to it.
	if (signalled === "SIGINT") return 130;
	if (signalled === "SIGTERM") return 143;
	return 0;
}
