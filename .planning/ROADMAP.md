# Roadmap: StreamGo MPV/V5 Integration Cleanup

## Overview

Complete removal of the MPV player and community V5 webview integration from StreamGo, restoring clean functionality with the original player. This cleanup spans investigation, systematic file removal, dependency cleanup, and comprehensive verification to ensure zero integration traces remain.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Investigation & Mapping** - Identify all MPV/V5 integration points *(completed 2026-01-14)*
- [x] **Phase 2: Core File Removal** - Remove main integration files and directories *(completed 2026-01-14)*
- [x] **Phase 3: UI Cleanup** - Remove native player subpage from Plus Page *(completed 2026-01-14)*
- [x] **Phase 4: Dependencies & Configuration** - Clean up package.json and config files *(completed 2026-01-14)*
- [x] **Phase 5: Main Process Cleanup** - Remove MPV integration from main.ts *(completed 2026-01-14)*
- [x] **Phase 6: Preload Script Cleanup** - Remove MPV integration from preload.ts *(completed 2026-01-14)*
- [x] **Phase 7: Build & Verification** - Ensure app builds and runs correctly *(completed 2026-01-14)*
- [ ] **Phase 8: Final Validation** - Comprehensive search for remaining references

## Phase Details

### Phase 1: Investigation & Mapping
**Goal**: Identify all MPV/V5 integration points in the codebase
**Depends on**: Nothing (first phase)
**Research**: Unlikely (reading existing codebase files)
**Plans**: 2 plans

Plans:
- [x] 01-01: Compare against reference directory and search for integration files
- [x] 01-02: Document all integration points and dependencies

### Phase 2: Core File Removal
**Goal**: Remove main MPV integration files and directories
**Depends on**: Phase 1
**Research**: Unlikely (removing files we've already identified)
**Plans**: 3 plans
**Status**: Complete

Plans:
- [x] 02-01: Remove src/components/native-player-* directories
- [x] 02-02: Remove src/utils/Mpv* and src/core/NativePlayerConfig.ts files
- [x] 02-03: Remove src/utils/Anime4KProfiles.ts and related utilities

### Phase 3: UI Cleanup
**Goal**: Remove native player subpage from Plus Page UI
**Depends on**: Phase 2
**Research**: Unlikely (removing UI components using existing patterns)
**Plans**: 2 plans
**Status**: Complete

Plans:
- [x] 03-01: Remove native player subpage from plus-page.html
- [x] 03-02: Remove native player logic from plusPage.ts

### Phase 4: Dependencies & Configuration
**Goal**: Clean up MPV-related dependencies from package.json
**Depends on**: Phase 3
**Research**: Unlikely (standard package.json cleanup)
**Plans**: 1 plan
**Status**: Complete

Plans:
- [x] 04-01: Remove MPV dependencies and verify package.json integrity

### Phase 5: Main Process Cleanup
**Goal**: Remove MPV initialization and integration from main.ts
**Depends on**: Phase 4
**Research**: Unlikely (removing integration code from known files)
**Plans**: 1 plan
**Status**: Complete

Plans:
- [x] 05-01: Verify main.ts is clean (already completed in earlier commit)

### Phase 6: Preload Script Cleanup
**Goal**: Remove MPV integration from preload.ts
**Depends on**: Phase 5
**Research**: Unlikely (removing integration code from known files)
**Plans**: 1 plan
**Status**: Complete

Plans:
- [x] 06-01: Verify preload.ts is clean (already completed in earlier commit)

### Phase 7: Build & Verification
**Goal**: Ensure app builds and runs correctly after cleanup
**Depends on**: Phase 6
**Research**: Unlikely (standard build commands already documented)
**Plans**: 2 plans
**Status**: Complete

Plans:
- [x] 07-01: Run npm run dist and fix any build errors
- [x] 07-02: Run npm run dev and verify original player loads content

### Phase 8: Final Validation
**Goal**: Comprehensive search to verify zero MPV/V5 references remain
**Depends on**: Phase 7
**Research**: Unlikely (grep/search operations)
**Plans**: 2 plans
**Status**: In progress

Plans:
- [x] 08-01: Search for MPV/native-player/V5 references across codebase
- [ ] 08-02: Document cleanup completion and verify all requirements met

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Investigation & Mapping | 2/2 | Complete | 2026-01-14 |
| 2. Core File Removal | 3/3 | Complete | 2026-01-14 |
| 3. UI Cleanup | 2/2 | Complete | 2026-01-14 |
| 4. Dependencies & Configuration | 1/1 | Complete | 2026-01-14 |
| 5. Main Process Cleanup | 1/1 | Complete | 2026-01-14 |
| 6. Preload Script Cleanup | 1/1 | Complete | 2026-01-14 |
| 7. Build & Verification | 2/2 | Complete | 2026-01-14 |
| 8. Final Validation | 1/2 | In progress | - |
