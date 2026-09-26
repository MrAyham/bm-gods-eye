# BM AI OS Integration

This fork is the God's Eye View geospatial module for BM AI OS.

- Upstream: https://github.com/bilawalsidhu/gods-eye-view
- License: MIT
- BM route: /ceo/gods-eye
- Integration mode: BM-managed specialist engine presented through the unified BM shell
- Runtime: Node 24.14+ or 26.x

## BM adaptation targets

- BM visual shell and navigation handoff
- Windsor → London → Mississauga/Toronto regional preset
- Public/legal camera and traffic layers only
- Mission-context handoff from BM AI OS
- Service health and capability status
- Preserve native Cesium/layer architecture rather than rebuilding maps inside BM

## Ontario Operations contract

BM AI OS owns the Ontario 511 credential and upstream API access. God's Eye must not store or expose the Ontario 511 developer key.

The God's Eye fork consumes normalized Ontario operations data from the authenticated BM endpoint:

- `GET /api/ops/ontario511`
- events / incidents
- public roadway cameras and camera views
- alerts
- per-feed status and counts

`src/bmOntarioOps.js` is the client boundary for this contract. It uses `credentials: include` so the user's BM session remains the authorization boundary.

Ontario roadway cameras are merged into the native CCTV catalog through `createBmCompositeCctvSource()`.
Ontario road incidents/closures are rendered through the native `ontario-events` Cesium layer.

## Same-origin module delivery

BM deployment uses:

`BM_MODULE_BASE=/modules/gods-eye/`

The browser namespaces God's Eye provider requests from `/api/*` to `/modules/gods-eye/api/*` while leaving the BM-owned `/api/ops/ontario511` route unchanged.

BM Core proxies `/modules/gods-eye/*` to the configured `BM_GODS_EYE_URL` runtime. This preserves one BM-facing origin and avoids collisions between specialist provider APIs and BM Core APIs.

## Runtime contract

Preferred start command:

`npm run start:bm`

The BM runtime keeps the original Vite provider middleware active and exposes:

`GET /__bm_health`

for runtime health verification.

A container deployment definition is provided in `Dockerfile.bm`. Full deployment and verification requirements are documented in `docs/BM_RUNTIME_DEPLOYMENT.md`.

## Data integrity rules

- Clearly label live, refreshed, estimated, simulated, stale, fallback, and unavailable states.
- Do not present simulated traffic or approximate camera poses as live telemetry.
- Ontario 511 camera imagery must retain its public-source status and attribution.
- Preserve source attribution and provider terms.
- Never put the Ontario 511 developer key in this repository, browser bundle, or God's Eye runtime.

Do not merge this integration until the end-to-end BM Preview chain has been visually verified.
