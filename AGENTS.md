# Working in this repo (Base44 sandbox)

## What this app is

Odysee's web frontend: a single Vite + React SPA. There is **no local backend or
database** — the UI reads and writes everything through Odysee's public APIs that
are configured in `.env.defaults`. `web/` is the production Koa/SSR server and is
**not** used for development (`pnpm dev` only runs the Vite dev server).

## Run it

```
docker compose -f docker-compose.base44.yml up -d
```

- One service (`web`) built on `node:22`, source bind-mounted at `/app`, listening
  on host port 3000.
- The container runs `pnpm install --frozen-lockfile` before `pnpm dev` on every
  start, so a fresh checkout installs itself (~60–90 s the first time). Dependencies
  live in the bind-mounted `node_modules` (gitignored).
- `pnpm-lock.yaml` records the `odysee-media-usagi` git dependency with an scp-style
  URL (`git@github.com:...`). The container adds
  `git config --global url."https://github.com/".insteadOf "git@github.com:"` so the
  install works without an SSH key. The lockfile itself is never modified.
- Verify: `docker compose -f docker-compose.base44.yml ps` shows `healthy`, and
  `curl -s localhost:3000 | head` returns the Vite-served `index.html`
  (`/@vite/client` in it). Vite logs `VITE+ v…` and `Local: http://localhost:3000/`.

## Sandbox-only overrides (all gated on `BASE44_PREVIEW_MODE === "1"`)

These exist because the preview runs on a different hostname than odysee.com.
With the flag unset or any other value, `vite.config.ts` behaves exactly as before.

1. **`server.allowedHosts`** — extended with `.<BASE44_SANDBOX_HOST_DOMAIN>` because
   Vite's host check rejects the proxied preview hostname.
2. **`server.proxy`** — the Odysee APIs answer with an origin allowlist
   (`odysee.com`, `localhost` only), so browser calls from the preview hostname fail
   with CORS errors even though the endpoints themselves are healthy. Every API host
   is therefore reached through the dev server at `/__b44/<host>/...`, and the
   `*_API*` env values in `docker-compose.base44.yml` point at those same-origin
   paths. `/$/api/content/v2/get` (the homepage/site content JSON) is proxied to
   `odysee.com` for the same reason. Any new API host must be added to
   `PREVIEW_API_HOSTS` in `vite.config.ts`.

## Known quirks

- `ui/redux/actions/settings.ts` fetches `http://localhost:${WEBPACK_WEB_PORT}/app-strings.json`
  in development; that file is not served by Vite, so the request fails once and the
  app falls back to `https://odysee.com/app-strings/en.json`. Harmless.
- `player.odycdn.com` hotlink-protects `HEAD` requests by `Referer`: they return 401
  for any referer other than `odysee.com`. Byte-range `GET`s work, but the video
  player's duration probe may report `0:00` in the preview.
- The app creates an anonymous user on first load (`POST /user/new`); that call is
  proxied too, so "Could not get a user ID" only appears when the proxy is broken.

## Tests

Playwright specs live in `tests/` (`pnpm test:e2e`). They need browsers installed in
the container (`pnpm exec playwright install chromium`) and the dev server running;
the base URL is `http://localhost:1337` in `playwright.config.ts`, so pass
`--config` overrides or expect the default to miss the dev server on 3000.
