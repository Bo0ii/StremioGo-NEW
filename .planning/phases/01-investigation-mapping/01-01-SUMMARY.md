# Phase 1 Plan 1: Integration File Discovery Summary

**Comprehensive MPV/V5 integration discovered: 27 active files, 87 reference files, 20 IPC channels, 13 settings keys**

## Accomplishments

- Searched codebase for MPV/V5 integration patterns across 4 search queries (mpv, native-player, anime4k, v5-webview)
- Identified 27 files containing integration code in active codebase
- Analyzed package.json - confirmed zero NPM dependencies (uses bundled binaries only)
- Compared against reference directory (stremio-community-v5-webview-windows/) with 87 C++ source files
- Mapped complete IPC communication surface (20 channels)
- Documented file system footprint and runtime dependencies

## Files Created/Modified

- `.planning/phases/01-investigation-mapping/integration-points.md` - Complete 580-line inventory of integration files

## Key Findings

### Integration Scope
The MPV/native player integration is a **complete player replacement system** with:
- 11 TypeScript source files (4 core utilities, 2 UI components, 5 integration points in existing files)
- 2 HTML templates
- 9 bundled resource files (MPV binaries for win32-x64 only)
- 3 documentation files
- 87 reference implementation files (C++/Qt)

### Architecture Insights
The implementation differs significantly from the reference C++ implementation:
- **Reference:** libmpv C API embedded in Qt widget
- **Current:** child_process spawn + JSON IPC socket communication
- **UI:** Separate MPV window (not embedded) controlled via IPC
- **Platform:** Cross-platform Electron vs. Windows-only native

### Critical Integration Points
1. **main.ts** - ~50 lines of MPV lifecycle management and IPC handlers
2. **preload.ts** - Initialization of native player injector
3. **plusPage.ts** - Complete settings page section
4. **constants/index.ts** - 33 constants (13 storage keys + 20 IPC channels)
5. **Properties.ts** - 6 lines of path configuration

### Dependencies
- **Zero NPM dependencies** - All integration is custom code
- **Runtime dependency:** MPV binary (system PATH or bundled)
- **Optional assets:** Anime4K shaders (9 .glsl files), ThumbFast Lua script
- **Config files:** Auto-generated INI files

### File Categories
1. Core utilities: 4 self-contained modules (low removal risk)
2. UI components: 2 component directories (low removal risk)
3. Integration points: 5 files with embedded references (medium-high removal risk)
4. Resources: 9 binary files (low removal risk)
5. Documentation: 3 markdown files (low removal risk)
6. Reference: 87 files (can be deleted immediately)

## Decisions Made

None - pure discovery phase as planned

## Issues Encountered

### Unexpected Finding 1: Windows-Only Binary Distribution
Only `resources/mpv/win32-x64/` directory exists. Missing binaries for:
- darwin-x64 (macOS Intel)
- darwin-arm64 (macOS Apple Silicon)
- linux-x64
- linux-arm64

This suggests either:
- Incomplete implementation
- Platform-specific builds were planned but not completed
- MPV is expected from system PATH on non-Windows platforms

### Unexpected Finding 2: Complete IPC Surface
20 IPC channels represent a deeply integrated system:
- 14 command channels (renderer → main)
- 5 event channels (main → renderer)
- Property observation system with 6 observed properties

Removal will require careful cleanup of all IPC handlers in main.ts.

### Unexpected Finding 3: Reference Implementation Size
The `stremio-community-v5-webview-windows/` directory is substantial (87 files) and includes:
- Complete C++ Qt application
- Build automation scripts
- FFmpeg distribution
- Installer scripts
- Extension packages

This directory is NOT used by the current Electron implementation and can be safely deleted.

## Next Step

Ready for **01-02-PLAN.md** - Document integration dependencies and create detailed removal strategy with:
- Exact line ranges for code removal in modified files
- localStorage key migration/cleanup plan
- IPC channel cleanup checklist
- Component removal order
- Testing strategy for web player fallback

## Statistics

- **Search patterns:** 4 (mpv, native-player, anime4k, v5-webview)
- **Files matched:** 48 unique files (including planning docs)
- **Active integration files:** 27
- **Reference files:** 87
- **Lines of integration code:** ~2,500+ lines (excluding reference)
- **IPC channels:** 20
- **LocalStorage keys:** 13
- **Config directories:** 5
- **Shader files needed:** 9
- **Documentation files:** 3
- **Planning docs referencing MPV:** 10+

## File Manifest

### Must Remove
1. `src/core/NativePlayerConfig.ts` (285 lines)
2. `src/utils/MpvManager.ts` (821 lines)
3. `src/utils/MpvBinaryManager.ts` (119 lines)
4. `src/utils/Anime4KProfiles.ts` (150 lines)
5. `src/components/native-player-injector/` (directory)
6. `src/components/native-player-controls/` (directory)
7. `resources/mpv/` (directory - 9 files)
8. `NATIVE_PLAYER.md`
9. `NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt`
10. `IMPLEMENTATION_SUMMARY.md`
11. `stremio-community-v5-webview-windows/` (directory - 87 files)

### Must Modify
12. `src/main.ts` (remove MPV initialization, IPC handlers, cleanup)
13. `src/preload.ts` (remove setupNativePlayerInjector call)
14. `src/components/plus-page/plusPage.ts` (remove native player section)
15. `src/constants/index.ts` (remove 33 constants)
16. `src/core/Properties.ts` (remove 6 lines of path definitions)

### Total Files Affected: 16 files/directories
