# AGENTS.md — @cloudflare/wrangler-bundler

## Overview

esbuild-based dev server for Cloudflare Workers, extracted from
`wrangler dev` for projects that can't migrate to Vite. This is a
thin (~150-line) adapter on top of wrangler's `unstable_DevEnv` API —
it is NOT a fork of wrangler internals.

The package ships a `cf-wrangler` delegate binary that dispatches on
a leading subcommand verb. Today the only verb is `dev`
(long-running esbuild + Miniflare + workerd dev server); future verbs
(`build`, `deploy`, etc.) will follow the same shape.

A parent process invokes `<pkgRoot>/bin/cf-wrangler dev [argv...]`,
the binary runs the dev server until Ctrl+C.

## Structure

- `bin/cf-wrangler` — executable shim; dispatches on the first argv
  token (`dev` today) and delegates to the matching handler.
- `src/index.ts` — programmatic API (`runDev`, `DevArgs`).
- `src/cli.ts` — `runDev` main loop: construct `unstable_DevEnv`,
  wire signals, block on teardown.
- `src/args.ts` — `yargs-parser`-based argv parser for the `dev`
  verb.
- `src/input.ts` — argv → `StartDevWorkerInput` translator (the
  setup-DevEnv equivalent, stripped to the local case).

## Conventions

- **Local-only.** Reject `--remote`, `--routes`, `--host`,
  `--upstream-protocol`, `--tunnel`, `--env` at parse time with a
  clear error. The auth hook is a stub that throws; if the user has
  `remote = true` on a binding in `wrangler.jsonc`, that throw fires
  with a clear message pointing at the fix.
- **Namespace-only imports from wrangler.** `import * as wrangler from
  "wrangler"` — same convention as `vite-plugin-cloudflare/AGENTS.md`,
  enforced by eslint there. We follow it here for consistency and so
  a future eslint rule can be applied uniformly.
- **No hotkeys.** wrangler's interactive hotkey UI (`registerDevHotKeys`)
  is intentionally not wired up. The dev session reacts to Ctrl+C
  only. Hotkey UI is wrangler-specific TTY chrome that doesn't fit a
  generic dev-server subprocess (the parent process may itself want
  to own session-level UI).
- **Service environments unsupported.** `legacy.useServiceEnvironments:
  false`, `env: undefined`. The package targets the new unified config
  format, which does not include service environments. If a user's
  `wrangler.jsonc` contains `[env.X]` tables they parse fine but are
  ignored; the wrapper warns at startup (TODO).
- **One-shot fast-path mode (`--fast-path`) not yet implemented.** The
  bin shim detects it and exits with a clear message. Implementation
  is gated on the still-evolving local-bindings work and will land in
  a follow-up.

## Out of scope (v1)

- Pages assets shim (`enablePagesAssetsServiceBinding`).
- Cloudflare Sites (`legacy.site`).
- Multi-worker dev sessions (`MultiworkerRuntimeController`).
- Tunnel sharing (`startTunnel`).
- Container image-uri pulling (`dev.enableContainers: false`).
  Local-built containers would technically work with this enabled,
  but Cloudchamber API auth is required for image_uri pulls — keep
  off uniformly to avoid the inconsistent failure mode.

## Build

- `tsdown` to ESM (`.mjs`) in `dist/`. Same bundler as `vite-plugin-cloudflare`.
- `pnpm build` for one-shot, `pnpm dev` for watch.
- The `bin/cf-wrangler` shim imports from `../dist/index.mjs`
  directly — it's NOT processed by tsdown (it's a tiny entry that
  doesn't need bundling and we want it readable for debugging).

## Testing

- `vitest` (default config, no special harness yet).
- Integration testing happens out-of-package via a parent process
  that spawns the `cf-wrangler` binary against a fixture project;
  that coverage is tracked separately from this repo.
