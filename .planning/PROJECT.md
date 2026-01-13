# StreamGo MPV/V5 Integration Cleanup

## What This Is

A cleanup project to completely remove the community V5 webview and MPV player integration from StreamGo, restoring the app to use its original player implementation. The MPV integration became messy and difficult to maintain, so we're reverting to a clean, stable build with the original player.

## Core Value

Complete removal of all MPV/V5 integration traces AND stable original player working perfectly after cleanup. Both are equally critical - the codebase must be clean and the app must function flawlessly.

## Requirements

### Validated

- ✓ Plugin/theme system with mod loading — existing
- ✓ Discord Rich Presence integration — existing
- ✓ Settings UI and Plus Page — existing
- ✓ Electron wrapper around web.stremio.com — existing
- ✓ Streaming server with FFmpeg support — existing
- ✓ Original player implementation (untouched) — existing

### Active

- [ ] Remove all MPV player integration code and files
- [ ] Remove community V5 webview integration code and files
- [ ] Remove "native player" subpage from Plus Page UI
- [ ] Remove MPV-related npm dependencies from package.json
- [ ] Verify original player loads and plays content
- [ ] Ensure app builds without errors (npm run dev, npm run dist)
- [ ] Confirm zero MPV/native-player/V5 references remain in codebase

### Out of Scope

- Modifying or optimizing the original player — don't touch it, it works
- Removing or changing other StreamGo features (plugins, themes, Discord RPC) — keep intact
- Adding new features or improvements — pure removal only
- Refactoring unrelated code — focus only on MPV cleanup

## Context

StreamGo is an Electron-based desktop client that wraps the Stremio web player (web.stremio.com) and adds plugin/theme support, Discord Rich Presence, and other enhancements.

**Previous integration work:**
- Added community V5 webview integration (Windows)
- Attempted to implement MPV-based native player inside the app
- Integration was toggled via "native player" subpage in Plus Page settings
- Integration became messy and too difficult to maintain

**Current state:**
- Original player still exists underneath the MPV layer
- Removing MPV/V5 code will automatically restore original player functionality
- Reference implementation available in: `stremio-community-v5-webview-windows/`

**Key integration points to investigate:**
- Plus Page contains "native player" subpage for toggling MPV
- Files/directories likely related: `src/components/native-player-*`, `src/utils/Mpv*`, `src/core/NativePlayerConfig.ts`
- Package.json may have MPV-specific dependencies
- Main.ts, preload.ts may have initialization logic for MPV

## Constraints

- **Verification**: Must compare against `stremio-community-v5-webview-windows/` reference directory to confirm what was brought in and what needs to be removed
- **Testing**: App must build (`npm run dist`) and run (`npm run dev`) successfully after each major removal
- **Completeness**: Use grep/search to verify zero references to MPV, native-player, or V5 integration remain
- **Safety**: Only remove integration-related code - preserve all other StreamGo functionality

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remove MPV/V5 integration completely | Integration became too messy and difficult to maintain | — Pending |
| Keep original player untouched | Original player still works underneath MPV layer | — Pending |
| Remove native player subpage from Plus Page | No need for toggle once MPV is gone | — Pending |
| Clean up dependencies in same effort | Complete cleanup includes package.json | — Pending |

---
*Last updated: 2026-01-14 after initialization*
