# Phase 1 Plan 2: Dependency Mapping Summary

**MPV integration architecture fully mapped with complete dependency graph and phase-by-phase removal strategy**

## Accomplishments

- Mapped all MPV integration dependencies across 5 integration points and 11 core files
- Analyzed Plus Page native player UI integration (280 lines, complete settings page with 13 localStorage keys)
- Created prioritized removal checklist for phases 2-8 with exact line numbers and before/after code examples
- Identified 16+ files/directories for removal and ~461 lines for editing across 5 files
- Documented complete IPC communication surface (20 channels, 10 command handlers, 5 event channels)
- Created visual dependency graph showing clean separation and zero circular dependencies

## Files Created/Modified

- `.planning/phases/01-investigation-mapping/dependency-map.md` - Comprehensive integration dependency graph (11 sections, complete with line numbers and code snippets)
- `.planning/phases/01-investigation-mapping/removal-checklist.md` - Detailed 10-phase removal plan with verification steps, rollback procedures, and success criteria

## Decisions Made

None - documentation phase only

## Issues Encountered

### Issue 1: Complex Plus Page Integration

The native player category is deeply integrated into the Plus Page UI system:
- Category registration in `categoryContent` object
- Dedicated content generator function (181 lines)
- Dedicated controls setup function (92 lines)
- Sidebar item in HTML template (6 lines)
- IPC communication for live settings updates

**Impact on removal:** Requires careful editing across multiple locations in Phase 8. Created detailed before/after examples in removal-checklist.md to guide execution.

### Issue 2: Main Process IPC Handlers Spread Across 93 Lines

The 10 native player IPC handlers in main.ts are concentrated in one section (lines 491-579), but mixed with:
- Initialization logic (on-demand MPV startup)
- Error handling and fallback logic
- Console logging for debugging

**Impact on removal:** Entire section can be removed as a block, but requires careful verification that no other IPC handlers are accidentally deleted. Created clear boundary markers in removal-checklist.md.

### Issue 3: Constants Removal May Affect TypeScript Strict Mode

The constants file exports storage keys and IPC channels as typed constants. Removing them may cause TypeScript errors in:
- Files that import specific constants (already identified in dependency map)
- Any dynamic string references that bypass TypeScript checking

**Mitigation:** Phase 6 removes constants AFTER all usage points are removed (Phases 4-5, 8). Verification step includes TypeScript compilation check.

## Next Phase Readiness

**Phase 2: Core File Removal** - Ready to begin

**Evidence of readiness:**
- Complete dependency map shows all 4 core files have zero reverse dependencies (after Phase 4)
- Removal checklist provides exact file paths and verification steps
- Safe removal order established: Integration points → Core files → Resources

**Removal strategy validated:**
1. Files to remove are self-contained modules
2. All imports identified and will be removed first (Phase 4-5)
3. No circular dependencies exist
4. TypeScript will catch any missed references during compilation

**Concerns:**

### Concern 1: `ini` Package May Become Unused

The `ini` package (v6.0.0) is used ONLY by `NativePlayerConfig.ts` for parsing MPV config files. After removal, this package may be orphaned in package.json.

**Recommendation for Phase 10:**
1. Search codebase for other `ini` package usage: `grep -r "require.*ini\|import.*ini" src/`
2. If ONLY used by NativePlayerConfig: Remove from package.json dependencies
3. Run `npm install` to update package-lock.json
4. Verify app still builds and runs

**Risk if left in place:** Minimal - unused dependency adds ~10KB to node_modules

### Concern 2: User Config Directory Left Behind

User config directory `<user-config>/streamgo/native-player/` will remain on users' systems after removal. Contains:
- MPV config files (mpv.conf, input.conf, stremio-settings.ini)
- Anime4K shader files (9 .glsl files)
- ThumbFast cache files
- User customizations

**Recommendation:**
- Do NOT remove programmatically (respects user data)
- Document in release notes that users can manually delete if desired
- Path varies by platform (see Properties.ts for exact location)

**Risk if left in place:** Minimal - orphaned config directory uses ~5-10MB disk space

### Concern 3: LocalStorage Keys Preserved

13 `nativePlayer*` localStorage keys will remain in users' browser storage after removal. These are harmless but will never be read again.

**Recommendation:**
- Do NOT remove programmatically (allows users to preserve settings if they reinstall)
- Keys are scoped to StreamGo app, won't interfere with other apps
- Total storage impact: <1KB

**Risk if left in place:** None - localStorage keys are harmless

### Concern 4: Platform Build Size Reduction

MPV binaries are large files (~50-100MB per platform). Removal will significantly reduce build size:
- Current: Only win32-x64 binaries exist (~80MB)
- After removal: No MPV binaries (~0MB)
- Net reduction: ~80MB+ (per platform build)

**Impact:** Positive - Smaller installers, faster downloads, reduced storage footprint

**Verification in Phase 10:**
1. Compare installer size before/after removal
2. Verify `release-builds/` does NOT contain `resources/mpv/`
3. Test installer on clean system to confirm app works without MPV

## Statistics

**Files analyzed:** 16+ files across 6 categories
**Lines mapped:** ~2,500+ lines of integration code
**Integration points:** 5 files with embedded references
**Core modules:** 4 self-contained TypeScript files
**UI components:** 2 component directories
**Resources:** 1 binary directory (win32-x64 only)
**Documentation:** 3 markdown/text files
**Reference directory:** 87 C++/Qt files (unused)

**Removal estimates:**
- Files to delete: 16+ files/directories
- Lines to edit: ~461 lines across 5 files
- IPC channels to remove: 20 channels
- LocalStorage keys to remove: 13 keys
- Path properties to remove: 6 properties
- Estimated execution time: ~2 hours (careful, methodical)

**Dependency analysis:**
- Inbound dependencies: 5 integration points
- Outbound dependencies: Node.js APIs, Electron IPC, file system
- Circular dependencies: ZERO (safe removal order confirmed)
- External packages: `ini` (may become unused)

## Key Findings

### Finding 1: Clean Architectural Separation

The MPV integration is a **well-isolated module** with clear boundaries:
- **Inbound:** 5 integration points (main.ts, preload.ts, constants, Properties, plusPage)
- **Outbound:** Standard Node.js/Electron APIs only
- **No circular dependencies:** Removal can proceed in reverse dependency order

**Implication:** Low risk of breaking other features during removal. External player, streaming server, and plugin systems are completely independent.

### Finding 2: IPC Surface is Well-Defined

20 IPC channels provide complete player control:
- 10 command channels (renderer → main)
- 5 event channels (main → renderer)
- All handlers concentrated in main.ts (lines 491-579)

**Implication:** Single-section removal in Phase 4 eliminates entire IPC surface. No scattered handlers to hunt down.

### Finding 3: Plus Page Uses Category System

Native player settings are integrated via the Plus Page category system:
- Sidebar item triggers category activation
- Content generator creates HTML dynamically
- Controls setup binds event handlers
- localStorage provides persistence

**Implication:** Removal requires editing 4 locations in Plus Page code, but system is self-contained. Other categories (Themes, Plugins, etc.) are unaffected.

### Finding 4: On-Demand Initialization Reduces Complexity

MPV is initialized on-demand (when first video is played), not at app startup:
- `mpvManager` starts as `null`
- `initializeNativePlayer()` called from `NATIVE_PLAYER_LOAD` handler
- Graceful fallback on initialization failure

**Implication:** No complex startup dependencies. Removal won't affect app initialization flow.

### Finding 5: Bundled Binaries Only for Windows x64

Only `resources/mpv/win32-x64/` directory exists:
- Missing: darwin-x64, darwin-arm64, linux-x64, linux-arm64
- Suggests incomplete cross-platform implementation

**Implication:** Native player may not have been fully functional on macOS/Linux. Removal simplifies cross-platform builds.

## Confidence Assessment

**Overall confidence in removal plan: HIGH (95%)**

**Reasons:**
1. ✅ Complete dependency graph with zero circular dependencies
2. ✅ All integration points identified with exact line numbers
3. ✅ TypeScript strict mode will catch missed references
4. ✅ Phase-by-phase plan with verification steps after each phase
5. ✅ Rollback procedures documented for each phase
6. ✅ Independent architectural modules (no coupling to other features)

**Remaining risks (5%):**
1. ⚠️ Dynamic string references that bypass TypeScript type checking
2. ⚠️ Unforeseen dependencies in plugin system (unlikely - plugins are sandboxed)
3. ⚠️ Edge cases in Plus Page category system (minimal - well-tested UI)

**Risk mitigation:**
- Comprehensive search for "mpv", "native-player", "Anime4K" patterns in Phase 10
- Functional testing of video playback, Plus Page navigation, external player
- Platform build testing to verify installer integrity

## Next Steps

1. **Execute Phase 2:** Remove core MPV files (4 files)
2. **Execute Phase 3:** Remove UI components (2 directories)
3. **Execute Phase 4:** Edit main.ts (remove ~154 lines)
4. **Execute Phase 5:** Edit preload.ts (remove ~2-4 lines)
5. **Execute Phase 6:** Edit constants/index.ts (remove 36 lines)
6. **Execute Phase 7:** Edit Properties.ts (remove 6 lines)
7. **Execute Phase 8:** Edit Plus Page files (remove ~283 lines)
8. **Execute Phase 9:** Remove resources and documentation (5 items)
9. **Execute Phase 10:** Comprehensive validation and testing

**Ready to proceed with Phase 2: Core File Removal**
