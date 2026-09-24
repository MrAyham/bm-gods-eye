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

The God’s Eye fork consumes normalized Ontario operations data from the authenticated BM endpoint:

- `GET /api/ops/ontario511`
- events / incidents
- public roadway cameras and camera views
- alerts
- per-feed status and counts

`src/bmOntarioOps.js` is the client boundary for this contract. It uses `credentials: include` so the user’s BM session remains the authorization boundary. When God’s Eye is served from a separate origin during development, set `VITE_BM_SHELL_ORIGIN` to the BM shell origin and configure the BM gateway/rewrite before treating the module as integrated.

## Data integrity rules

- Clearly label live, refreshed, estimated, simulated, stale, fallback, and unavailable states.
- Do not present simulated traffic or approximate camera poses as live telemetry.
- Ontario 511 camera imagery must retain its public-source status and attribution.
- Preserve source attribution and provider terms.
