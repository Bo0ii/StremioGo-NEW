# MPV/Native Player Removal Checklist

**Generated:** 2026-01-14
**Purpose:** Prioritized, phase-by-phase removal plan for safe MPV integration cleanup

---

## Overview

This checklist aligns with roadmap phases 2-8. Each phase builds on the previous, ensuring:
- No broken imports or undefined references
- TypeScript compilation succeeds after each phase
- App remains functional throughout cleanup

**Total estimated changes:** 16+ files/directories removed, ~461 lines edited across 5 files

---

## Phase 2: Core File Removal

**Status:** ⬜ Not Started
**Goal:** Remove self-contained MPV utility modules with zero reverse dependencies
**Risk Level:** 🟢 LOW (files have no external references after Phase 1 removal)

### Files to Remove

- [ ] `src/core/NativePlayerConfig.ts` (285 lines)
- [ ] `src/utils/MpvManager.ts` (821 lines)
- [ ] `src/utils/MpvBinaryManager.ts` (119 lines)
- [ ] `src/utils/Anime4KProfiles.ts` (150 lines)

### Why This Order is Safe

These files are imported ONLY by:
1. `main.ts` (imports removed in Phase 4)
2. Each other (internal dependencies)

After Phase 4 removes the imports, these files become orphaned and safe to delete.

### Verification Steps

After removal:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Check for TypeScript errors - Should be ZERO errors related to these files
- [ ] Search codebase for import statements - Should find ZERO references

### Rollback Plan

If compilation fails:
1. Restore files from git: `git checkout HEAD -- src/core/NativePlayerConfig.ts src/utils/MpvManager.ts src/utils/MpvBinaryManager.ts src/utils/Anime4KProfiles.ts`
2. Re-run Phase 4 to ensure imports are removed first

---

## Phase 3: UI Component Cleanup

**Status:** ⬜ Not Started
**Goal:** Remove UI components for native player controls and route injection
**Risk Level:** 🟢 LOW (components have no reverse dependencies)

### Directories to Remove

- [ ] `src/components/native-player-injector/`
  - [ ] `nativePlayerInjector.ts`
  - [ ] Any HTML template files
- [ ] `src/components/native-player-controls/`
  - [ ] `nativePlayerControls.ts`
  - [ ] `native-player-controls.html`

### Why This Order is Safe

These components are imported ONLY by:
1. `preload.ts` (import removed in Phase 5)

After Phase 5 removes the import, these directories become orphaned.

### Verification Steps

After removal:
- [ ] Run `npm run dist` - Should compile successfully (components are copied to dist/)
- [ ] Check `dist/components/` after build - Should NOT contain native-player-* directories
- [ ] Search codebase for import statements - Should find ZERO references

### Rollback Plan

If compilation fails:
1. Restore directories from git: `git checkout HEAD -- src/components/native-player-injector/ src/components/native-player-controls/`
2. Re-run Phase 5 to ensure imports are removed first

---

## Phase 4: Main Process Integration Removal

**Status:** ⬜ Not Started
**Goal:** Remove MPV initialization, IPC handlers, and cleanup logic from main.ts
**Risk Level:** 🟡 MEDIUM (requires careful line-by-line editing)

### main.ts Edits

#### 1. Remove Import Statements (Lines 22-24)

**Location:** Top of file, after other imports

**Before:**
```typescript
import StreamingConfig from "./core/StreamingConfig";
import MpvManager from "./utils/MpvManager";
import MpvBinaryManager from "./utils/MpvBinaryManager";
import NativePlayerConfig from "./core/NativePlayerConfig";

app.setName("streamgo");
```

**After:**
```typescript
import StreamingConfig from "./core/StreamingConfig";

app.setName("streamgo");
```

**Lines to remove:** 3

---

#### 2. Remove mpvManager Variable Declaration (Line 42)

**Location:** After app.setName(), before GPU optimizations section

**Before:**
```typescript
let mainWindow: BrowserWindow | null;
let mpvManager: MpvManager | null = null;
const transparencyFlagPath = join(app.getPath("userData"), "transparency");
```

**After:**
```typescript
let mainWindow: BrowserWindow | null;
const transparencyFlagPath = join(app.getPath("userData"), "transparency");
```

**Lines to remove:** 1

---

#### 3. Remove initializeNativePlayer Function (Lines 149-201)

**Location:** Before `createWindow()` function

**Before:**
```typescript
app.commandLine.appendSwitch('enable-async-dns');

/**
 * Initialize native MPV player
 * @param window Main browser window
 */
async function initializeNativePlayer(window: BrowserWindow): Promise<void> {
    console.log('[MAIN-PROCESS] ===== INITIALIZING NATIVE PLAYER =====');
    try {
        // ... 49 lines of code ...
    }
}

async function createWindow() {
```

**After:**
```typescript
app.commandLine.appendSwitch('enable-async-dns');

async function createWindow() {
```

**Lines to remove:** 49 (including JSDoc comment)

---

#### 4. Remove IPC Handlers (Lines 487-579)

**Location:** After streaming performance IPC handlers, before external player IPC handlers

**Find this section:**
```typescript
    // ============================================
    // Native Player IPC Handlers
    // ============================================

    ipcMain.on(IPC_CHANNELS.NATIVE_PLAYER_LOAD, async (_, { url, metadata }) => {
        // ... handler code ...
    });

    // ... 9 more handlers ...

    // Don't initialize native player at startup - it will be initialized on-demand when first video is loaded
    // This prevents MPV from taking over the UI on app launch
    console.log('[MAIN-PROCESS] Native player will be initialized on-demand when first video is played');

    // Opens links in external browser instead of opening them in the Electron app.
```

**Remove entire section from:**
- Start: `// ============================================` (Line 487)
- End: Last console.log before external link handler (Line 579)

**Lines to remove:** 93 (including comment block)

---

#### 5. Remove Cleanup Handler in before-quit (Lines 865-873)

**Location:** Inside `app.on("before-quit")` handler

**Before:**
```typescript
    app.on("before-quit", async () => {
        logger.info("App is quitting, checking if service needs termination...");

        // Destroy system tray
        SystemTray.destroy();

        // Cleanup native player
        if (mpvManager) {
            try {
                await mpvManager.quit();
                logger.info("Native player cleaned up successfully");
            } catch (error) {
                logger.error(`Failed to cleanup native player: ${error}`);
            }
        }

        if (!process.argv.includes("--no-stremio-service")) {
            StremioService.terminateIfStartedByApp();
        }
    });
```

**After:**
```typescript
    app.on("before-quit", async () => {
        logger.info("App is quitting, checking if service needs termination...");

        // Destroy system tray
        SystemTray.destroy();

        if (!process.argv.includes("--no-stremio-service")) {
            StremioService.terminateIfStartedByApp();
        }
    });
```

**Lines to remove:** 8

---

### Total Lines Removed from main.ts: ~154

### Verification Steps

After editing:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Check for TypeScript errors - Should be ZERO errors
- [ ] Search file for "mpv" (case-insensitive) - Should find ZERO matches
- [ ] Search file for "native-player" (case-insensitive) - Should find ZERO matches
- [ ] Test app launch - Should start normally without MPV errors

### Rollback Plan

If compilation fails:
1. Restore file from git: `git checkout HEAD -- src/main.ts`
2. Re-apply edits one section at a time
3. Test compilation after each section

---

## Phase 5: Preload Script Integration Removal

**Status:** ⬜ Not Started
**Goal:** Remove native player injector initialization from preload.ts
**Risk Level:** 🟢 LOW (simple import + call removal)

### preload.ts Edits

#### 1. Remove Import Statement (Line 25)

**Location:** After other component imports

**Before:**
```typescript
import { initVideoFilter, cleanupVideoFilter } from "./components/video-filter/videoFilter";
import { setupNativePlayerInjector } from "./components/native-player-injector/nativePlayerInjector";
import logger from "./utils/logger";
```

**After:**
```typescript
import { initVideoFilter, cleanupVideoFilter } from "./components/video-filter/videoFilter";
import logger from "./utils/logger";
```

**Lines to remove:** 1

---

#### 2. Remove setupNativePlayerInjector Call

**Location:** Search for "setupNativePlayerInjector()" in the file

**Strategy:**
1. Search for `setupNativePlayerInjector()` call
2. Remove the line containing the call
3. If wrapped in conditional/try-catch, remove only the call line

**Expected pattern (exact location unknown):**
```typescript
setupNativePlayerInjector();
```

**Lines to remove:** 1-3 (depending on context)

---

### Total Lines Removed from preload.ts: ~2-4

### Verification Steps

After editing:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Search file for "native-player" - Should find ZERO matches
- [ ] Search file for "setupNativePlayerInjector" - Should find ZERO matches
- [ ] Test app launch - Should start normally

### Rollback Plan

If compilation fails:
1. Restore file from git: `git checkout HEAD -- src/preload.ts`
2. Re-apply edit

---

## Phase 6: Constants Cleanup

**Status:** ⬜ Not Started
**Goal:** Remove native player storage keys and IPC channels from constants
**Risk Level:** 🟢 LOW (simple block removal)

### constants/index.ts Edits

#### 1. Remove LocalStorage Keys (Lines 109-123)

**Location:** Inside STORAGE_KEYS object

**Before:**
```typescript
    BUNDLED_ADDONS_INSTALLED: 'streamgo_bundled_addons_installed',
    // Native Player settings
    NATIVE_PLAYER_ENABLED: 'nativePlayerEnabled',
    NATIVE_PLAYER_VIDEO_OUTPUT: 'nativePlayerVideoOutput',
    NATIVE_PLAYER_VOLUME: 'nativePlayerVolume',
    NATIVE_PLAYER_UPSCALER_PROFILE: 'nativePlayerUpscalerProfile',
    NATIVE_PLAYER_SUBTITLE_FONT: 'nativePlayerSubtitleFont',
    NATIVE_PLAYER_SUBTITLE_SIZE: 'nativePlayerSubtitleSize',
    NATIVE_PLAYER_SUBTITLE_COLOR: 'nativePlayerSubtitleColor',
    NATIVE_PLAYER_SUBTITLE_BORDER_SIZE: 'nativePlayerSubtitleBorderSize',
    NATIVE_PLAYER_SUBTITLE_BORDER_COLOR: 'nativePlayerSubtitleBorderColor',
    NATIVE_PLAYER_SUBTITLE_SHADOW_OFFSET: 'nativePlayerSubtitleShadowOffset',
    NATIVE_PLAYER_SUBTITLE_BG_OPACITY: 'nativePlayerSubtitleBgOpacity',
    NATIVE_PLAYER_THUMBFAST_ENABLED: 'nativePlayerThumbfastEnabled',
    NATIVE_PLAYER_THUMBFAST_HEIGHT: 'nativePlayerThumbfastHeight',
} as const;
```

**After:**
```typescript
    BUNDLED_ADDONS_INSTALLED: 'streamgo_bundled_addons_installed',
} as const;
```

**Lines to remove:** 14 (including comment)

---

#### 2. Remove IPC Channels (Lines 154-175)

**Location:** Inside IPC_CHANNELS object

**Before:**
```typescript
    RESTART_STREAMING_SERVICE: 'restart-streaming-service',
    // Native Player IPC Channels
    NATIVE_PLAYER_ENABLED: 'native-player-enabled',
    NATIVE_PLAYER_INIT: 'native-player-init',
    NATIVE_PLAYER_LOAD: 'native-player-load',
    NATIVE_PLAYER_PLAY: 'native-player-play',
    NATIVE_PLAYER_PAUSE: 'native-player-pause',
    NATIVE_PLAYER_SEEK: 'native-player-seek',
    NATIVE_PLAYER_VOLUME: 'native-player-volume',
    NATIVE_PLAYER_SPEED: 'native-player-speed',
    NATIVE_PLAYER_STOP: 'native-player-stop',
    NATIVE_PLAYER_SUBTITLE_ADD: 'native-player-subtitle-add',
    NATIVE_PLAYER_SET_UPSCALER: 'native-player-set-upscaler',
    NATIVE_PLAYER_GET_CONFIG: 'native-player-get-config',
    NATIVE_PLAYER_SET_CONFIG: 'native-player-set-config',
    OPEN_NATIVE_PLAYER_CONFIG_FOLDER: 'open-native-player-config-folder',
    // MPV Events (main -> renderer)
    MPV_PROP_CHANGE: 'mpv-prop-change',
    MPV_EVENT_ENDED: 'mpv-event-ended',
    MPV_EVENT_ERROR: 'mpv-event-error',
    NATIVE_PLAYER_DISABLED: 'native-player-disabled',
    NATIVE_PLAYER_FALLBACK_WEB: 'native-player-fallback-web',
} as const;
```

**After:**
```typescript
    RESTART_STREAMING_SERVICE: 'restart-streaming-service',
} as const;
```

**Lines to remove:** 22 (including comments)

---

### Total Lines Removed from constants/index.ts: 36

### Verification Steps

After editing:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Search file for "NATIVE_PLAYER" - Should find ZERO matches
- [ ] Search file for "MPV_" - Should find ZERO matches
- [ ] Test app launch - Should start normally

### Rollback Plan

If compilation fails:
1. Restore file from git: `git checkout HEAD -- src/constants/index.ts`
2. Re-apply edits one block at a time

---

## Phase 7: Properties Path Cleanup

**Status:** ⬜ Not Started
**Goal:** Remove native player path properties from Properties.ts
**Risk Level:** 🟢 LOW (simple property removal)

### Properties.ts Edits

#### Remove Native Player Path Properties (Lines 32-37)

**Location:** After bundled theme/plugin paths

**Before:**
```typescript
    public static bundledThemesPath = Properties.isPackaged
        ? join(process.resourcesPath, "themes")
        : join(dirname(dirname(__dirname)), "themes");

    // Native player configuration (in user config directory)
    public static nativePlayerPath = join(Properties.enhancedPath, "native-player");
    public static nativePlayerConfigPath = join(Properties.nativePlayerPath, "config");
    public static nativePlayerShadersPath = join(Properties.nativePlayerPath, "shaders");
    public static nativePlayerScriptsPath = join(Properties.nativePlayerPath, "scripts");
    public static nativePlayerCachePath = join(Properties.nativePlayerPath, "cache", "thumbfast");
}

export default Properties;
```

**After:**
```typescript
    public static bundledThemesPath = Properties.isPackaged
        ? join(process.resourcesPath, "themes")
        : join(dirname(dirname(__dirname)), "themes");
}

export default Properties;
```

**Lines to remove:** 6 (including comment)

---

### Total Lines Removed from Properties.ts: 6

### Verification Steps

After editing:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Search file for "nativePlayer" - Should find ZERO matches
- [ ] Test app launch - Should start normally

### Rollback Plan

If compilation fails:
1. Restore file from git: `git checkout HEAD -- src/core/Properties.ts`
2. Re-apply edit

---

## Phase 8: Plus Page UI Cleanup

**Status:** ⬜ Not Started
**Goal:** Remove Native Player category from Plus Page
**Risk Level:** 🟡 MEDIUM (requires multiple edits in UI code)

### plusPage.ts Edits

#### 1. Remove Category Registration (Line 20)

**Location:** Inside `categoryContent` object

**Before:**
```typescript
const categoryContent: Record<string, CategoryGenerator> = {
    themes: getThemesContent,
    plugins: getPluginsContent,
    tweaks: getTweaksContent,
    appearance: getAppearanceContent,
    nativeplayer: getNativePlayerContent,
    about: getAboutContent,
};
```

**After:**
```typescript
const categoryContent: Record<string, CategoryGenerator> = {
    themes: getThemesContent,
    plugins: getPluginsContent,
    tweaks: getTweaksContent,
    appearance: getAppearanceContent,
    about: getAboutContent,
};
```

**Lines to remove:** 1

---

#### 2. Remove Category Controls Case (Lines 322-324)

**Location:** Inside `setupCategoryControls()` switch statement

**Before:**
```typescript
    switch (category) {
        case 'themes':
            setupThemesControls();
            break;
        case 'plugins':
            setupPluginsControls();
            break;
        case 'tweaks':
            setupTweaksControls();
            break;
        case 'appearance':
            setupAppearanceControls();
            break;
        case 'nativeplayer':
            setupNativePlayerControls();
            break;
        case 'about':
            setupAboutControls();
            break;
    }
```

**After:**
```typescript
    switch (category) {
        case 'themes':
            setupThemesControls();
            break;
        case 'plugins':
            setupPluginsControls();
            break;
        case 'tweaks':
            setupTweaksControls();
            break;
        case 'appearance':
            setupAppearanceControls();
            break;
        case 'about':
            setupAboutControls();
            break;
    }
```

**Lines to remove:** 3

---

#### 3. Remove getNativePlayerContent Function (Lines 1167-1348)

**Location:** After getAboutContent(), before setupNativePlayerControls()

**Find this section:**
```typescript
// ==================== NATIVE PLAYER ====================
function getNativePlayerContent(): string {
    // ... 181 lines of HTML generation ...
}
```

**Remove entire function** (181 lines)

**Lines to remove:** 181

---

#### 4. Remove setupNativePlayerControls Function (Lines 1350-1442)

**Location:** After getNativePlayerContent(), before utility functions

**Find this section:**
```typescript
function setupNativePlayerControls(): void {
    const { ipcRenderer } = require('electron');
    // ... 92 lines of event handler setup ...
}
```

**Remove entire function** (92 lines)

**Lines to remove:** 92

---

### plus-page.html Edits

#### Remove Native Player Sidebar Item (Lines 81-86)

**Location:** Inside `.plus-sidebar-nav` section

**Before:**
```html
        <div class="plus-sidebar-item" data-category="appearance">
            <svg viewBox="0 0 24 24" width="20" height="20" style="fill: currentColor;">
                <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z"/>
            </svg>
            <span>Appearance</span>
        </div>
        <div class="plus-sidebar-item" data-category="nativeplayer">
            <svg viewBox="0 0 24 24" width="20" height="20" style="fill: currentColor;">
                <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Native Player</span>
        </div>
        <div class="plus-sidebar-item" data-category="about">
            <svg viewBox="0 0 24 24" width="20" height="20" style="fill: currentColor;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span>About</span>
        </div>
```

**After:**
```html
        <div class="plus-sidebar-item" data-category="appearance">
            <svg viewBox="0 0 24 24" width="20" height="20" style="fill: currentColor;">
                <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z"/>
            </svg>
            <span>Appearance</span>
        </div>
        <div class="plus-sidebar-item" data-category="about">
            <svg viewBox="0 0 24 24" width="20" height="20" style="fill: currentColor;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span>About</span>
        </div>
```

**Lines to remove:** 6

---

### Total Lines Removed from Plus Page: ~283

### Verification Steps

After editing:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Search plusPage.ts for "nativeplayer" - Should find ZERO matches
- [ ] Search plusPage.ts for "getNativePlayerContent" - Should find ZERO matches
- [ ] Search plusPage.ts for "setupNativePlayerControls" - Should find ZERO matches
- [ ] Search plus-page.html for "nativeplayer" - Should find ZERO matches
- [ ] Launch app and navigate to Plus Page - Should display 5 categories (not 6)
- [ ] Verify sidebar shows: Themes, Plugins, Tweaks, Appearance, About (no Native Player)

### Rollback Plan

If compilation fails:
1. Restore files from git: `git checkout HEAD -- src/components/plus-page/plusPage.ts src/components/plus-page/plus-page.html`
2. Re-apply edits one section at a time
3. Test compilation after each section

---

## Phase 9: Resource and Documentation Cleanup

**Status:** ⬜ Not Started
**Goal:** Remove bundled MPV binaries, reference directory, and documentation
**Risk Level:** 🟢 LOW (no code dependencies)

### Directories/Files to Remove

- [ ] `resources/mpv/` (entire directory - 9+ files)
  - Contains MPV binaries for win32-x64
  - Safe to delete - app no longer references bundled binaries

- [ ] `stremio-community-v5-webview-windows/` (entire directory - 87 files)
  - Reference C++/Qt implementation
  - Never used by Electron app
  - Safe to delete

- [ ] `NATIVE_PLAYER.md`
  - User-facing native player documentation

- [ ] `NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt`
  - Implementation planning document

- [ ] `IMPLEMENTATION_SUMMARY.md`
  - Implementation summary

### Verification Steps

After removal:
- [ ] Run `npm run dist` - Should compile successfully
- [ ] Check `release-builds/` after platform build - Should NOT contain resources/mpv/
- [ ] Search entire codebase for "NATIVE_PLAYER.md" - Should find ZERO references
- [ ] Verify app size reduction (MPV binaries are large)

### Rollback Plan

If needed:
1. Restore from git: `git checkout HEAD -- resources/mpv/ stremio-community-v5-webview-windows/ NATIVE_PLAYER.md NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt IMPLEMENTATION_SUMMARY.md`

---

## Phase 10: Final Validation

**Status:** ⬜ Not Started
**Goal:** Comprehensive testing and cleanup verification
**Risk Level:** 🟢 LOW (validation only)

### Code Validation

- [ ] Run `npm run dist` - Should compile successfully with ZERO errors
- [ ] Run `npm run lint` - Should pass with ZERO errors
- [ ] Search entire codebase for "mpv" (case-insensitive) - Should find ZERO matches
- [ ] Search entire codebase for "native-player" (case-insensitive) - Should find ZERO matches (except in .md planning docs)
- [ ] Search entire codebase for "Anime4K" - Should find ZERO matches
- [ ] Verify no orphaned imports - All import statements should resolve

### Functional Testing

- [ ] Launch app in dev mode: `npm run dev`
  - Should start without errors
  - Should NOT show native player initialization logs in console
  - Should NOT attempt to load MPV binary

- [ ] Navigate to Plus Page (#/plus)
  - Should display 5 categories (not 6)
  - Should NOT show "Native Player" in sidebar
  - All other categories should work normally

- [ ] Test video playback
  - Should use Stremio's web player (default)
  - Should NOT show native player UI
  - Should NOT attempt MPV initialization

- [ ] Test external player (if configured)
  - Should still work (VLC/MPC-HC are independent)

### Build Testing

- [ ] Build for current platform: `npm run build:win` (or mac/linux)
  - Should complete successfully
  - Check `release-builds/` for output
  - Should NOT include `resources/mpv/` in packaged app
  - Installer should run and app should launch

### Package Dependency Audit

- [ ] Check if `ini` package is used elsewhere in codebase
  - Search for `import.*ini` or `require.*ini`
  - If ONLY used by NativePlayerConfig: Remove from package.json dependencies
  - If used elsewhere: Keep in package.json

### Git Status Check

- [ ] Run `git status` - Should show:
  - ~16+ deleted files (core files, components, resources, docs)
  - ~5 modified files (main.ts, preload.ts, constants, Properties, plusPage)
  - Total changes should align with this checklist

### Documentation Updates

- [ ] Update main README.md (if it mentions native player)
- [ ] Update CHANGELOG.md with removal notes
- [ ] Verify no broken links to deleted documentation

---

## Success Criteria Checklist

All phases complete when:

- [ ] **All 16+ files/directories removed** from codebase
- [ ] **~461 lines edited** across 5 integration files
- [ ] **TypeScript compilation succeeds** with zero errors
- [ ] **ESLint passes** with zero errors
- [ ] **App launches** without MPV-related errors
- [ ] **Plus Page displays** 5 categories (Themes, Plugins, Tweaks, Appearance, About)
- [ ] **Video playback works** using Stremio web player
- [ ] **Platform build succeeds** and produces working installer
- [ ] **No MPV references** remain in codebase (search confirms)
- [ ] **No orphaned imports** or undefined references
- [ ] **Git status shows** expected file changes only

---

## Post-Removal Cleanup (Optional)

These steps are OPTIONAL and can be done later:

### User Data Cleanup

**Do NOT do this programmatically** - Let users decide:

- User config directory: `<user-config>/streamgo/native-player/`
  - Contains user's MPV config files, shader files, ThumbFast cache
  - Users may want to preserve for future use

### LocalStorage Cleanup

**Do NOT do this programmatically** - Preserves user settings:

- 13 `nativePlayer*` localStorage keys remain in user's browser storage
  - Harmless if left in place
  - Allows users to preserve settings if they reinstall

### Package.json Cleanup

**Only if confirmed unused elsewhere:**

- Remove `ini` dependency if ONLY used by NativePlayerConfig
- Check usage first: `grep -r "require.*ini\|import.*ini" src/`

---

## Rollback Instructions (Emergency)

If something goes catastrophically wrong:

### Full Rollback

```bash
# Restore all deleted files
git checkout HEAD -- src/core/NativePlayerConfig.ts
git checkout HEAD -- src/utils/MpvManager.ts
git checkout HEAD -- src/utils/MpvBinaryManager.ts
git checkout HEAD -- src/utils/Anime4KProfiles.ts
git checkout HEAD -- src/components/native-player-injector/
git checkout HEAD -- src/components/native-player-controls/
git checkout HEAD -- resources/mpv/
git checkout HEAD -- stremio-community-v5-webview-windows/
git checkout HEAD -- NATIVE_PLAYER.md
git checkout HEAD -- NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt
git checkout HEAD -- IMPLEMENTATION_SUMMARY.md

# Restore all modified files
git checkout HEAD -- src/main.ts
git checkout HEAD -- src/preload.ts
git checkout HEAD -- src/constants/index.ts
git checkout HEAD -- src/core/Properties.ts
git checkout HEAD -- src/components/plus-page/plusPage.ts
git checkout HEAD -- src/components/plus-page/plus-page.html

# Rebuild
npm run dist
```

### Partial Rollback

Restore only the phase that failed using the phase-specific rollback instructions above.

---

## Phase Completion Tracking

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase 2: Core Files | ⬜ Not Started | - | - |
| Phase 3: UI Components | ⬜ Not Started | - | - |
| Phase 4: Main Process | ⬜ Not Started | - | - |
| Phase 5: Preload Script | ⬜ Not Started | - | - |
| Phase 6: Constants | ⬜ Not Started | - | - |
| Phase 7: Properties | ⬜ Not Started | - | - |
| Phase 8: Plus Page UI | ⬜ Not Started | - | - |
| Phase 9: Resources | ⬜ Not Started | - | - |
| Phase 10: Validation | ⬜ Not Started | - | - |

---

## Notes for Executor

### General Guidelines

1. **One phase at a time** - Complete and verify each phase before moving to the next
2. **Commit after each phase** - Allows easy rollback if needed
3. **Test compilation** after every file edit (run `npm run dist`)
4. **Read error messages carefully** - TypeScript will tell you if you missed something
5. **Use search liberally** - Verify no references remain after each removal

### Common Pitfalls

- **Forgetting imports** - Always remove import statements before deleting files
- **Partial line removal** - Ensure no trailing commas or syntax errors
- **Comment-only lines** - Don't forget to remove comment blocks associated with removed code
- **Template files** - Components may have both `.ts` and `.html` files

### Time Estimates

- Phase 2-3: 10 minutes (file deletion)
- Phase 4: 20 minutes (main.ts editing)
- Phase 5: 5 minutes (preload.ts editing)
- Phase 6-7: 10 minutes (constants/properties editing)
- Phase 8: 25 minutes (Plus Page editing)
- Phase 9: 5 minutes (resource deletion)
- Phase 10: 30 minutes (comprehensive testing)

**Total estimated time: ~2 hours** for careful, methodical execution

---

**End of removal checklist. Ready for execution in Phase 2.**
