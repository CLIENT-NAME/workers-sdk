---
"@cloudflare/wrangler-bundler": minor
---

Add `@cloudflare/wrangler-bundler` — esbuild-based dev server for Cloudflare Workers, extracted from `wrangler dev`

A new prerelease package for projects that cannot migrate to Vite. The recommended path remains [`@cloudflare/vite-plugin`](https://www.npmjs.com/package/@cloudflare/vite-plugin); `wrangler-bundler` is a thin adapter over wrangler's `unstable_dev` API that ships a `cf-wrangler` delegate binary. The binary dispatches on a leading subcommand verb (today only `dev`; future verbs like `build` and `deploy` will follow the same shape):

```sh
npx cf-wrangler dev
```

Remote bindings (`remote = true` on individual resources in `wrangler.json`) are supported, as is the standard interactive hotkey UI (`b`/`d`/`e`/`r`/`l`/`c`/`x`/`q`) — both are inherited from wrangler's `unstable_dev`. Accepted flags are deliberately minimal: `--config`, `--mode` (named environment), `--port`, `--host`, `--local`. Everything else belongs in the user's `wrangler.jsonc`. Pages/Sites, multi-worker dev, whole-worker remote dev (`wrangler dev --remote`), and container image-uri pulling are out of scope for v1.
