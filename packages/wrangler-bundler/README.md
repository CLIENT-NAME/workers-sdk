# @cloudflare/wrangler-bundler

esbuild-based dev server for Cloudflare Workers — extracted from
`wrangler dev` for projects that can't migrate to Vite.

> **Use [`@cloudflare/vite-plugin`](https://www.npmjs.com/package/@cloudflare/vite-plugin)
> instead** if your project uses Vite. The Vite plugin is the
> recommended JavaScript/TypeScript dev-server impl going forward.
> `@cloudflare/wrangler-bundler` is provided for legacy projects whose
> build pipeline depends on esbuild semantics.

## What this package is

A small adapter (~150 lines) over wrangler's `unstable_DevEnv` API.
It ships a `cf-wrangler` delegate binary that exposes a small CLI
dispatched on a leading subcommand verb. Today it accepts only `dev`
(long-running esbuild + Miniflare); future verbs (`build`, `deploy`)
will follow the same shape.

A parent CLI (typically a project's chosen tool) is expected to
discover this package in `devDependencies` and spawn the
`cf-wrangler dev` subcommand on its behalf. You can also invoke
`./node_modules/.bin/cf-wrangler dev` directly.

## Installation

```sh
npm install --save-dev @cloudflare/wrangler-bundler
```

A parent CLI that knows how to spawn `cf-wrangler` will pick it up
automatically the next time you start a dev session in the project
directory.

## What it supports

- `wrangler.jsonc` / `wrangler.toml` config files
- esbuild-based bundling
- Miniflare + workerd local runtime
- Dev registry registration (multi-session dev)
- `--var`, `--define`, `--alias`, `--compatibility-date`,
  `--compatibility-flags`, JSX overrides, `--tsconfig`, `--no-bundle`,
  `--minify`, `--persist-to`, `--live-reload`, `--test-scheduled`,
  `--log-level`, `--env-file`, `--assets`

## What it does NOT support

- `--remote` and remote bindings (`remote = true` in config)
- `--tunnel` (use `wrangler dev --tunnel` directly)
- Service environments (`--env`, `[env.X]` tables — ignored)
- Cloudflare Pages and Sites
- Multi-worker dev sessions
- Container image-uri pulling

For any of these, run `wrangler dev` directly until they land here.
