---
"@cloudflare/wrangler-bundler": minor
---

Add `@cloudflare/wrangler-bundler` — esbuild-based dev server for Cloudflare Workers, extracted from `wrangler dev`

A new prerelease package for projects that cannot migrate to Vite. The recommended path remains [`@cloudflare/vite-plugin`](https://www.npmjs.com/package/@cloudflare/vite-plugin); `wrangler-bundler` is a thin adapter over wrangler's `unstable_DevEnv` API that ships a `cf-wrangler` delegate binary. The binary dispatches on a leading subcommand verb (today only `dev`; future verbs like `build` and `deploy` will follow the same shape):

```sh
npx cf-wrangler dev
```

Scope is intentionally limited to local-only sessions: `--remote`, `--routes`, `--host`, `--upstream-protocol`, `--tunnel`, and `--env` (service environments) are rejected at parse time, and remote bindings (`remote = true` in `wrangler.json`) error with a clear message pointing at `wrangler dev`. Pages/Sites, multi-worker dev, container image-uri pulling, and the interactive hotkey UI are out of scope for v1.
