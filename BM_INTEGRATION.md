# BM AI OS Integration

This fork is the God's Eye View geospatial module for BM AI OS.

- Upstream: https://github.com/bilawalsidhu/gods-eye-view
- License: MIT
- BM route: /ceo/ops
- Integration mode: independently deployed Vite/Cesium application
- Runtime: Node 24.14+ or 26.x

## BM adaptation targets

- BM visual shell and navigation handoff
- Windsor → London → Mississauga/Toronto regional preset
- Public/legal camera and traffic layers only
- Mission-context handoff from BM AI OS
- Service health and capability status
- Preserve native Cesium/layer architecture rather than rebuilding maps inside BM

## Data integrity rules

- Clearly label live, refreshed, estimated, simulated, stale, fallback, and unavailable states.
- Do not present simulated traffic or approximate camera poses as live telemetry.
- Preserve source attribution and provider terms.
