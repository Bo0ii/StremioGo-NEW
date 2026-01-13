# MPV/Native Player Integration Dependency Map

**Generated:** 2026-01-14
**Purpose:** Complete dependency analysis showing how MPV integration connects to the StreamGo codebase

---

## Executive Summary

The MPV/native player integration forms a **self-contained module** with clean boundaries:
- **Inbound dependencies:** 5 integration points where existing files import/reference MPV code
- **Outbound dependencies:** Standard Node.js APIs, Electron IPC, file system operations
- **Critical finding:** No circular dependencies; removal can proceed in reverse dependency order

---

## 1. What Imports MPV Code (Inbound Dependencies)

### main.ts (Lines 22-24, 153-201, 491-579)

**Import statements:**
```typescript
// Line 22-24
import MpvManager from "./utils/MpvManager";
import MpvBinaryManager from "./utils/MpvBinaryManager";
import NativePlayerConfig from "./core/NativePlayerConfig";
```

**Initialization function (Lines 153-201):**
```typescript
async function initializeNativePlayer(window: BrowserWindow): Promise<void>
```
- Instantiates `NativePlayerConfig`, loads configuration
- Checks `Player.Enabled` flag
- Verifies MPV binary via `MpvBinaryManager.verifyMpv()`
- Creates `MpvManager` instance and initializes with window reference
- Sends `NATIVE_PLAYER_DISABLED` event on failure

**Global variable (Line 42):**
```typescript
let mpvManager: MpvManager | null = null;
```

**IPC Handlers (Lines 491-579):**
- `NATIVE_PLAYER_LOAD` (Lines 491-526): On-demand initialization, calls `mpvManager.loadVideo(url, metadata)`
- `NATIVE_PLAYER_PLAY` (Lines 528-536): `mpvManager.play()`
- `NATIVE_PLAYER_PAUSE` (Lines 538-546): `mpvManager.pause()`
- `NATIVE_PLAYER_SEEK` (Line 548-550): `mpvManager.seek(position)`
- `NATIVE_PLAYER_VOLUME` (Lines 552-554): `mpvManager.setVolume(volume)`
- `NATIVE_PLAYER_SPEED` (Lines 556-558): `mpvManager.setSpeed(speed)`
- `NATIVE_PLAYER_STOP` (Lines 560-562): `mpvManager.quit()`
- `NATIVE_PLAYER_SUBTITLE_ADD` (Lines 564-566): `mpvManager.addSubtitleFile(path)`
- `NATIVE_PLAYER_SET_UPSCALER` (Lines 568-570): `mpvManager.setUpscaler(profile)`
- `OPEN_NATIVE_PLAYER_CONFIG_FOLDER` (Lines 572-575): Opens config folder via `shell.openPath()`

**Cleanup handler (Lines 866-873):**
```typescript
app.on("before-quit", async () => {
    if (mpvManager) {
        await mpvManager.quit();
    }
});
```

**Total lines affected:** ~140 lines across 4 sections

---

### preload.ts (Line 25)

**Import statement:**
```typescript
import { setupNativePlayerInjector } from "./components/native-player-injector/nativePlayerInjector";
```

**Initialization call:** (exact location not visible in excerpt, but referenced in integration-points.md)
- Calls `setupNativePlayerInjector()` during DOM ready initialization

**Total lines affected:** ~2-5 lines

---

### constants/index.ts (Lines 110-123, 154-175)

**LocalStorage keys (Lines 110-123):**
```typescript
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
```

**IPC channels (Lines 154-175):**
```typescript
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
```

**Total lines affected:** 33 lines (13 storage keys + 20 IPC channels)

---

### Properties.ts (Lines 32-37)

**Path definitions:**
```typescript
// Native player configuration (in user config directory)
public static nativePlayerPath = join(Properties.enhancedPath, "native-player");
public static nativePlayerConfigPath = join(Properties.nativePlayerPath, "config");
public static nativePlayerShadersPath = join(Properties.nativePlayerPath, "shaders");
public static nativePlayerScriptsPath = join(Properties.nativePlayerPath, "scripts");
public static nativePlayerCachePath = join(Properties.nativePlayerPath, "cache", "thumbfast");
```

**Total lines affected:** 6 lines

---

### plusPage.ts (Lines 20, 322-324, 1167-1442)

**Category registration (Line 20):**
```typescript
nativeplayer: getNativePlayerContent,
```

**Category controls setup (Lines 322-324):**
```typescript
case 'nativeplayer':
    setupNativePlayerControls();
    break;
```

**Native player UI content generator (Lines 1167-1348):**
- Function `getNativePlayerContent()` - Generates complete settings page HTML
- Sections: General, Upscaling (Anime4K), Subtitles, Advanced
- Settings exposed:
  - Enable/disable toggle
  - Video output mode (gpu-next, gpu, x11)
  - Upscaler profile (off, fast, balanced, hq, uhq)
  - Subtitle font, size, color
  - ThumbFast thumbnail previews
  - Config folder opener, reset to defaults

**Native player controls setup (Lines 1350-1442):**
- Function `setupNativePlayerControls()` - Binds event handlers for all controls
- IPC communication:
  - Line 1375: `ipcRenderer.send('native-player-set-upscaler', profile)` - Live upscaler switching
  - Line 1414: `ipcRenderer.send('open-native-player-config-folder')` - Open config folder
- LocalStorage operations: Reads/writes all 13 native player settings

**HTML template reference (Line 81 in plus-page.html):**
```html
<div class="plus-sidebar-item" data-category="nativeplayer">
    <svg>...</svg>
    <span>Native Player</span>
</div>
```

**Total lines affected:** ~280 lines (UI generation + controls setup)

---

## 2. What MPV Code Imports (Outbound Dependencies)

### NativePlayerConfig.ts

**External dependencies:**
- Node.js `fs`: `existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`
- Node.js `path`: `join`
- Third-party `ini` package: `parse`, `stringify` (listed in package.json)

**Internal dependencies:**
- `Properties` (for path configuration)
- `logger` (for logging)

**Platform APIs:** None

---

### MpvManager.ts

**External dependencies:**
- Node.js `child_process`: `spawn` (for launching MPV process)
- Node.js `net`: `Socket` (for IPC socket communication)
- Node.js `fs`: `existsSync`, `mkdirSync`
- Node.js `path`: `join`
- Electron `BrowserWindow` (passed as parameter for event sending)

**Internal dependencies:**
- `MpvBinaryManager` (to get MPV binary path)
- `NativePlayerConfig` (to load configuration)
- `Anime4KProfiles` (to apply shader profiles)
- `logger` (for logging)

**Platform APIs:**
- Windows named pipes: `\\.\pipe\mpv-socket-streamgo`
- Unix domain sockets: `<config-path>/mpv-socket`

---

### MpvBinaryManager.ts

**External dependencies:**
- Node.js `fs`: `existsSync`, `accessSync`, constants `X_OK`
- Node.js `path`: `join`
- Node.js `child_process`: `execSync` (for version detection)

**Internal dependencies:**
- `Properties` (for bundled binary paths)
- `logger` (for logging)

**Platform detection:** `process.platform`, `process.arch`

---

### Anime4KProfiles.ts

**External dependencies:**
- Node.js `path`: `join`

**Internal dependencies:**
- `Properties` (for shader path configuration)

**No platform-specific APIs**

---

### Components (native-player-injector, native-player-controls)

**External dependencies:**
- Electron `ipcRenderer` (for main process communication)
- DOM APIs (for UI manipulation)

**Internal dependencies:**
- Constants from `constants/index.ts` (IPC channels, storage keys)
- `logger` (for logging)

---

## 3. Plus Page Integration (Detailed Analysis)

### UI Structure

The Plus Page is a **full-screen overlay** implemented as:
- Container: `#plus-page-overlay` (positioned `fixed`, `z-index: 9999`)
- Layout: Grid with sidebar (220px) + content area
- Navigation: Sidebar items trigger `activateCategory('nativeplayer')`

### Category System

**Registration (plusPage.ts:14-22):**
```typescript
const categoryContent: Record<string, CategoryGenerator> = {
    themes: getThemesContent,
    plugins: getPluginsContent,
    tweaks: getTweaksContent,
    appearance: getAppearanceContent,
    nativeplayer: getNativePlayerContent,  // LINE 20
    about: getAboutContent,
};
```

**Activation flow:**
1. User clicks sidebar item with `data-category="nativeplayer"`
2. `activateCategory('nativeplayer')` called (Line 285)
3. `categoryContent['nativeplayer']()` executed → `getNativePlayerContent()` (Line 299)
4. HTML injected into `#plus-content` (Line 301)
5. `setupCategoryControls('nativeplayer')` called → `setupNativePlayerControls()` (Line 322)

### Settings Persistence

All settings stored in `localStorage` with keys from `STORAGE_KEYS`:
- Read on page render (Lines 1169-1176)
- Written on user interaction (Lines 1354-1441)
- No server-side persistence

### IPC Communication

**Renderer → Main:**
- `native-player-set-upscaler` (Line 1375): Live upscaler profile switching
- `open-native-player-config-folder` (Line 1414): Open config folder

**Main → Renderer:**
- None (settings page is read-only UI)

### UI Components

**Toggle switches (6 total):**
- Enable Native Player (Line 1192)
- ThumbFast Enabled (Line 1309)

**Select dropdowns (2 total):**
- Video Output (Line 1202)
- Upscaler Profile (Line 1230)

**Text inputs (1 total):**
- Subtitle Font (Line 1264)

**Range sliders (2 total):**
- Subtitle Size (Line 1275)
- ThumbFast Height (Line 1320)

**Color pickers (1 total):**
- Subtitle Color (Line 1286)

**Buttons (2 total):**
- Open Config Folder (Line 1330)
- Reset to Defaults (Line 1343)

---

## 4. IPC Communication Surface

### Command Flow (Renderer → Main)

| IPC Channel | Handler Location | Function Called |
|-------------|------------------|-----------------|
| `NATIVE_PLAYER_LOAD` | main.ts:491 | `mpvManager.loadVideo(url, metadata)` |
| `NATIVE_PLAYER_PLAY` | main.ts:528 | `mpvManager.play()` |
| `NATIVE_PLAYER_PAUSE` | main.ts:538 | `mpvManager.pause()` |
| `NATIVE_PLAYER_SEEK` | main.ts:548 | `mpvManager.seek(position)` |
| `NATIVE_PLAYER_VOLUME` | main.ts:552 | `mpvManager.setVolume(volume)` |
| `NATIVE_PLAYER_SPEED` | main.ts:556 | `mpvManager.setSpeed(speed)` |
| `NATIVE_PLAYER_STOP` | main.ts:560 | `mpvManager.quit()` |
| `NATIVE_PLAYER_SUBTITLE_ADD` | main.ts:564 | `mpvManager.addSubtitleFile(path)` |
| `NATIVE_PLAYER_SET_UPSCALER` | main.ts:568 | `mpvManager.setUpscaler(profile)` |
| `OPEN_NATIVE_PLAYER_CONFIG_FOLDER` | main.ts:572 | `shell.openPath(configPath)` |

### Event Flow (Main → Renderer)

| IPC Channel | Sent From | Trigger |
|-------------|-----------|---------|
| `MPV_PROP_CHANGE` | MpvManager.ts | MPV property observation (pause, time-pos, duration, volume, speed, eof-reached) |
| `MPV_EVENT_ENDED` | MpvManager.ts | Playback finished (eof-reached) |
| `MPV_EVENT_ERROR` | MpvManager.ts | Playback error |
| `NATIVE_PLAYER_DISABLED` | main.ts:179, 199 | MPV unavailable/disabled |
| `NATIVE_PLAYER_FALLBACK_WEB` | (unused) | Placeholder for web player fallback |

**Event listeners:** Located in `native-player-injector` and `native-player-controls` components

---

## 5. File System Footprint

### Runtime Directory Structure

Created at runtime in user config directory (`<user-config>/streamgo/native-player/`):

```
native-player/
├── config/
│   ├── stremio-settings.ini    # Main config file (generated by NativePlayerConfig)
│   ├── mpv.conf                # MPV configuration (user-editable)
│   └── input.conf              # Keyboard shortcuts (user-editable)
├── shaders/                    # Anime4K .glsl files (9 shaders)
├── scripts/                    # Lua scripts (thumbfast.lua)
└── cache/
    └── thumbfast/              # Thumbnail cache (auto-generated by ThumbFast)
```

**Path sources:**
- Defined in `Properties.ts` (Lines 32-37)
- Used by `NativePlayerConfig.ts` for config file paths
- Used by `MpvManager.ts` for socket paths
- Used by `Anime4KProfiles.ts` for shader paths

### Bundled Resources

Located in `resources/mpv/<platform>-<arch>/`:
- `mpv.exe` (Windows) / `mpv` (Unix)
- Documentation, updater scripts (not used by Electron app)

**Current state:** Only `win32-x64` directory exists in repository

---

## 6. Dependency Graph (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Points                        │
│                    (Modified Files)                          │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────┐        ┌─────────────┐      ┌─────────────┐
    │ main.ts  │        │ preload.ts  │      │plusPage.ts  │
    │ (140 L)  │        │   (2-5 L)   │      │  (280 L)    │
    └──────────┘        └─────────────┘      └─────────────┘
           │                    │                    │
           ├────────────────────┼────────────────────┤
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                       Core MPV Files                         │
│                    (Self-Contained)                          │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐
│  MpvManager.ts   │  │NativePlayerConfig│  │Anime4KProfiles │
│   (821 lines)    │  │   (285 lines)    │  │  (150 lines)   │
└──────────────────┘  └──────────────────┘  └────────────────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │ MpvBinaryManager.ts   │
                    │    (119 lines)        │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Components (UI)     │
                    │ - native-player-      │
                    │   injector            │
                    │ - native-player-      │
                    │   controls            │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   External MPV        │
                    │   Binary Process      │
                    │   (child_process)     │
                    └───────────────────────┘
```

**Key observations:**
1. **Clean separation:** Core MPV files have no imports from integration points
2. **Unidirectional flow:** Integration points → Core files → External binary
3. **No circular dependencies:** Safe to remove in reverse order

---

## 7. Constants Dependency Analysis

### Storage Keys (13 keys)

**Used by:**
- `plusPage.ts`: All 13 keys for settings UI (Lines 1169-1441)
- `native-player-injector`: `NATIVE_PLAYER_ENABLED` for route interception
- `native-player-controls`: All settings for control panel UI

**Removal impact:** No other components read these keys

### IPC Channels (20 channels)

**Used by:**
- `main.ts`: All 14 command channels (Lines 491-575)
- `native-player-injector`: `NATIVE_PLAYER_LOAD`, events (Lines vary)
- `native-player-controls`: All command channels for playback control

**Removal impact:** No other IPC handlers registered for these channels

---

## 8. Critical Integration Points Summary

| File | Lines Affected | Complexity | Removal Risk |
|------|---------------|------------|--------------|
| `main.ts` | ~140 | High | Medium - Mixed with other IPC handlers |
| `preload.ts` | ~2-5 | Low | Low - Single import + call |
| `constants/index.ts` | 33 | Low | Low - Self-contained block |
| `Properties.ts` | 6 | Low | Low - Self-contained block |
| `plusPage.ts` | ~280 | Medium | Medium - Category system integration |

**Total integration code:** ~461 lines across 5 files

---

## 9. External Dependencies Analysis

### Runtime Dependencies

**Required for MPV to function:**
1. MPV binary (system PATH or bundled)
2. Node.js `child_process` API
3. Socket communication (native to Node.js)
4. File system access (native to Node.js)

**Optional assets:**
1. Anime4K shader files (9 .glsl files)
2. ThumbFast Lua script
3. Config files (auto-generated if missing)

### NPM Package Dependencies

**Review of package.json:**
- `ini` (v6.0.0): Used ONLY by `NativePlayerConfig.ts` for INI file parsing
- No other MPV-specific dependencies
- After removal: `ini` package may be unused (verify if used elsewhere)

**Recommendation:** Check if `ini` package is used by other components before removing from package.json

---

## 10. Removal Safety Analysis

### Safe to Remove Immediately (Low Risk)

1. **Core MPV files** (4 files):
   - `src/core/NativePlayerConfig.ts`
   - `src/utils/MpvManager.ts`
   - `src/utils/MpvBinaryManager.ts`
   - `src/utils/Anime4KProfiles.ts`

2. **UI components** (2 directories):
   - `src/components/native-player-injector/`
   - `src/components/native-player-controls/`

3. **Resources** (1 directory):
   - `resources/mpv/`

4. **Documentation** (3 files):
   - `NATIVE_PLAYER.md`
   - `NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt`
   - `IMPLEMENTATION_SUMMARY.md`

5. **Reference directory** (87 files):
   - `stremio-community-v5-webview-windows/`

**Total:** 16+ files/directories with ZERO reverse dependencies

### Requires Careful Editing (Medium Risk)

1. **main.ts:**
   - Remove import statements (3 lines)
   - Remove `mpvManager` variable declaration (1 line)
   - Remove `initializeNativePlayer` function (49 lines)
   - Remove 10 IPC handlers (88 lines)
   - Remove cleanup in `before-quit` (8 lines)

2. **preload.ts:**
   - Remove import statement (1 line)
   - Remove `setupNativePlayerInjector()` call (1 line)

3. **constants/index.ts:**
   - Remove 13 storage keys (14 lines including comments)
   - Remove 20 IPC channels (22 lines including comments)

4. **Properties.ts:**
   - Remove 5 path properties (6 lines including comment)

5. **plusPage.ts:**
   - Remove category registration (1 line)
   - Remove case in switch statement (3 lines)
   - Remove `getNativePlayerContent()` function (181 lines)
   - Remove `setupNativePlayerControls()` function (92 lines)
   - Remove sidebar item from HTML template (6 lines)

**Total:** ~461 lines across 5 files

### No Impact on Other Features

**Verified:**
- External player system: Independent (VLC, MPC-HC)
- Streaming server: Independent (Stremio Service, server.js)
- Plugin/theme system: Independent
- Discord RPC: Independent
- UI components: No dependencies on native player

---

## 11. User Data Cleanup

### LocalStorage Cleanup

**13 keys to clean (optional - left for user data preservation):**
```javascript
const nativePlayerKeys = [
    'nativePlayerEnabled',
    'nativePlayerVideoOutput',
    'nativePlayerVolume',
    'nativePlayerUpscalerProfile',
    'nativePlayerSubtitleFont',
    'nativePlayerSubtitleSize',
    'nativePlayerSubtitleColor',
    'nativePlayerSubtitleBorderSize',
    'nativePlayerSubtitleBorderColor',
    'nativePlayerSubtitleShadowOffset',
    'nativePlayerSubtitleBgOpacity',
    'nativePlayerThumbfastEnabled',
    'nativePlayerThumbfastHeight',
];
```

**Recommendation:** Do NOT remove - allows users to preserve settings if they reinstall

### File System Cleanup

**User config directory (optional):**
- `<user-config>/streamgo/native-player/` (entire directory)

**Recommendation:** Do NOT remove programmatically - let users decide to preserve/delete

---

## Next Steps

Ready for **Plan 01-02 Task 3**: Create prioritized removal checklist based on this dependency map.
