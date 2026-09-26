# BM God's Eye Runtime Deployment

This fork is intended to remain a specialist runtime behind the BM AI OS shell.
The user-facing path is `/modules/gods-eye/`; BM Core remains the owner of auth, the Ontario 511 developer key, and the `/api/ops/ontario511` normalized feed.

## Runtime contract

Required runtime values:

```bash
HOST=0.0.0.0
PORT=4173
BM_MODULE_BASE=/modules/gods-eye/
```

Start command:

```bash
npm run start:bm
```

Health endpoint:

```text
GET /__bm_health
```

Expected response contains `ok: true`, `service: bm-gods-eye`, and the configured module base.

## Container deployment

A deployable container definition is included as `Dockerfile.bm`.

```bash
docker build -f Dockerfile.bm -t bm-gods-eye .
docker run --rm -p 4173:4173 \
  -e BM_MODULE_BASE=/modules/gods-eye/ \
  bm-gods-eye
```

Provider-specific keys such as Cesium, OpenSky, TomTom, AISStream, FIRMS, or OpenAI remain optional and must be supplied only when those original God's Eye capabilities are enabled. Never put the Ontario 511 developer key in this runtime.

## Why this runtime is not `vite preview`

The original God's Eye provider stack is implemented as Vite server middleware. A plain static `vite preview` deployment would not preserve the complete provider API behavior. `scripts/bm-runtime.mjs` therefore starts Vite in middleware mode behind a normal Node HTTP server so the original provider plugins remain active while the module is hosted remotely.

## BM Core gateway

BM Core must set:

```text
BM_GODS_EYE_URL=https://<runtime-origin>
```

The BM shell rewrites `/modules/gods-eye/*` to that runtime. Browser requests made by God's Eye to its original `/api/*` provider paths are namespaced to `/modules/gods-eye/api/*` before they leave the browser, preventing collisions with BM Core APIs.

The BM-owned Ontario feed is deliberately excluded from this rewrite:

```text
/api/ops/ontario511
```

That route stays same-origin on BM Core and requires the normal BM session.

## Verification gate

Do not merge this integration until all of the following are true:

1. `GET /__bm_health` succeeds on the deployed runtime.
2. BM Core has `BM_GODS_EYE_URL` configured for Preview.
3. `/modules/gods-eye/` loads through BM Core, not as a separate user-facing site.
4. Native God's Eye feeds still work through the namespaced provider APIs.
5. Ontario 511 camera rows appear in the native CCTV layer.
6. An Ontario camera opens a real public image URL when the upstream view is available.
7. `ontario-events` displays verified road incidents/closures from BM Core.
8. Missing/unavailable upstream data is labeled unavailable rather than simulated.
9. The Ontario 511 key is absent from the God's Eye browser bundle and runtime environment.
10. Production `main` remains unchanged until the Preview chain is visually verified.
