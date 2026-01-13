# MPV/V5 Integration Points Inventory

**Generated:** 2026-01-14
**Purpose:** Comprehensive mapping of all MPV/native player integration files and references in the StreamGo codebase

## Executive Summary

- **Total Files Identified:** 27 integration files in main codebase
- **Reference Directory:** `stremio-community-v5-webview-windows/` (87 files - C++ implementation)
- **NPM Dependencies:** 0 MPV-specific dependencies (uses bundled binaries)
- **Integration Type:** Complete MPV player implementation with IPC communication, Anime4K upscaling, and UI controls

---

## Category 1: Core Integration Files

### Components (UI Layer)

#### Native Player Injector
- **Location:** `src/components/native-player-injector/`
- **Files:**
  - `nativePlayerInjector.ts` - Monitors player routes, intercepts video playback, redirects to MPV
  - Template file (likely exists but not in search results)
- **Purpose:** DOM injection to intercept Stremio web player and route to native MPV player
- **Dependencies:** IPC channels, route monitoring, video URL interception

#### Native Player Controls
- **Location:** `src/components/native-player-controls/`
- **Files:**
  - `nativePlayerControls.ts` - UI controls for MPV player (play/pause/seek/volume/speed)
  - `native-player-controls.html` - HTML template for controls UI
- **Purpose:** Custom UI overlay for controlling MPV playback
- **References to:** Anime4K profiles, upscaler selection UI

---

### Core Logic Files

#### NativePlayerConfig.ts
- **Location:** `src/core/NativePlayerConfig.ts`
- **Size:** 285 lines
- **Purpose:** Configuration management for native player
- **Key Features:**
  - INI file parsing for MPV settings
  - Default configuration schema (Player, Upscaler, Subtitles, ThumbFast)
  - Path management for config/shaders/scripts directories
  - Validation and type coercion for config values
- **Configuration Sections:**
  - Player: Enabled, VideoOutput, Volume, HardwareAcceleration, Demux/Buffer settings
  - Upscaler: Anime4K profile selection
  - Subtitles: Font, size, color, border, shadow, background
  - ThumbFast: Thumbnail preview settings
- **File Paths Managed:**
  - `stremio-settings.ini` - Main config file
  - `mpv.conf` - MPV configuration
  - `input.conf` - Keyboard shortcuts
  - Shader, scripts, and cache directories

---

### Utility Modules

#### MpvManager.ts
- **Location:** `src/utils/MpvManager.ts`
- **Size:** 821 lines
- **Purpose:** Core MPV process lifecycle and IPC communication manager
- **Architecture:** Uses `child_process.spawn()` to launch MPV as separate process
- **Key Features:**
  - MPV process spawning with command-line arguments
  - IPC socket communication (Windows named pipes, Unix sockets)
  - Property observation (pause, time-pos, duration, volume, speed, eof-reached)
  - Command queue for async MPV control
  - Auto-reinitialization on unexpected exits
  - Video loading, playback control, seeking, volume, speed, screenshots
  - Subtitle file loading
  - Anime4K shader profile application
  - ThumbFast script loading
  - Discord RPC metadata support
- **IPC Protocol:** JSON-based MPV IPC protocol (`{ "command": [...] }\n`)
- **Socket Paths:**
  - Windows: `\\.\pipe\mpv-socket-streamgo`
  - Unix: `<config-path>/mpv-socket`

#### MpvBinaryManager.ts
- **Location:** `src/utils/MpvBinaryManager.ts`
- **Size:** 119 lines
- **Purpose:** MPV binary location and verification
- **Logic:**
  1. Check system PATH for MPV installation (preferred)
  2. Fall back to bundled binary at `resources/mpv/<platform>-<arch>/mpv.exe`
  3. Verify binary exists and executable
  4. Extract MPV version information
- **Platform Support:** win32, darwin, linux
- **Architecture Support:** x64, arm64

#### Anime4KProfiles.ts
- **Location:** `src/utils/Anime4KProfiles.ts`
- **Size:** 150 lines
- **Purpose:** Anime4K shader profile definitions and management
- **Profiles:**
  - `off` - No upscaling
  - `fast` - Low quality, fast (6 shaders)
  - `balanced` - Medium quality, recommended (6 shaders)
  - `hq` - High quality (7 shaders)
  - `uhq` - Ultra high quality, GPU-intensive (7 shaders)
- **Shader Files Referenced:**
  - `Anime4K_Clamp_Highlights.glsl`
  - `Anime4K_Restore_CNN_VL.glsl`, `Anime4K_Restore_CNN_M.glsl`, `Anime4K_Restore_CNN_S.glsl`
  - `Anime4K_Upscale_CNN_x2_VL.glsl`, `Anime4K_Upscale_CNN_x2_M.glsl`, `Anime4K_Upscale_CNN_x2_S.glsl`
  - `Anime4K_AutoDownscalePre_x2.glsl`, `Anime4K_AutoDownscalePre_x4.glsl`
- **Functions:** `getShaderPaths()`, `applyShaderProfile()`, profile listing

---

## Category 2: Integration References in Existing Files

### Main Process (main.ts)
- **Lines with MPV references:** ~50+ lines
- **Key Functions:**
  - `initializeNativePlayer()` - Initializes MPV manager on-demand
  - IPC handlers for all native player commands (load, play, pause, seek, volume, speed, stop, subtitle-add, set-upscaler)
  - Cleanup on app quit
- **Initialization Strategy:** On-demand (when first video is played, not at startup)
- **Error Handling:** Falls back to web player on MPV initialization failure

### Preload Script (preload.ts)
- **Lines with MPV references:** 2 integration points
- **Integration:**
  - Imports `setupNativePlayerInjector` from native-player-injector component
  - Calls `setupNativePlayerInjector()` during DOM ready initialization
- **Purpose:** Activates route monitoring for native player

### Plus Page (plusPage.ts)
- **Native Player Section:** Complete settings page
- **Settings Exposed:**
  - Enable/disable toggle
  - Video output mode (gpu-next, etc.)
  - Upscaler profile selection
  - Subtitle configuration (font, size, color)
  - ThumbFast preview settings
  - Config folder opener
- **Functions:**
  - `getNativePlayerContent()` - Renders settings UI
  - `setupNativePlayerControls()` - Binds event handlers
- **Storage Keys Used:** 13 native player-specific localStorage keys

### Constants (src/constants/index.ts)
- **LocalStorage Keys:** 13 keys for native player settings (lines 110-123)
  - `NATIVE_PLAYER_ENABLED`
  - `NATIVE_PLAYER_VIDEO_OUTPUT`
  - `NATIVE_PLAYER_VOLUME`
  - `NATIVE_PLAYER_UPSCALER_PROFILE`
  - Subtitle settings (7 keys)
  - ThumbFast settings (2 keys)
- **IPC Channels:** 20 channels for native player communication (lines 154-175)
  - Player lifecycle: INIT, LOAD, PLAY, PAUSE, STOP
  - Controls: SEEK, VOLUME, SPEED, SUBTITLE_ADD, SET_UPSCALER
  - Events: MPV_PROP_CHANGE, MPV_EVENT_ENDED, MPV_EVENT_ERROR
  - Config: GET_CONFIG, SET_CONFIG, OPEN_NATIVE_PLAYER_CONFIG_FOLDER
  - Fallback: NATIVE_PLAYER_DISABLED, NATIVE_PLAYER_FALLBACK_WEB

### Properties (src/core/Properties.ts)
- **Lines 32-37:** Native player path configuration
- **Paths Defined:**
  - `nativePlayerPath` - Root: `<user-config>/streamgo/native-player`
  - `nativePlayerConfigPath` - Config files: `native-player/config/`
  - `nativePlayerShadersPath` - Anime4K shaders: `native-player/shaders/`
  - `nativePlayerScriptsPath` - Lua scripts: `native-player/scripts/`
  - `nativePlayerCachePath` - ThumbFast cache: `native-player/cache/thumbfast/`

---

## Category 3: Bundled Resources

### MPV Binaries Directory
- **Location:** `resources/mpv/win32-x64/`
- **Files:**
  - `mpv.exe` - Main MPV executable
  - `mpv.com` - Console version
  - `mpv-register.bat` - File association registration
  - `mpv-unregister.bat` - File association removal
  - `updater.bat` - MPV updater script
  - `doc/manual.pdf` - MPV documentation
  - `doc/mpbindings.png` - Key bindings reference
  - `installer/updater.ps1` - PowerShell updater
  - `mpv/fonts.conf` - Font configuration
- **Size:** Full MPV distribution (Windows x64 only in current checkout)
- **Other Platforms:** Likely need `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64` directories

---

## Category 4: Reference Implementation

### stremio-community-v5-webview-windows/
- **Type:** C++/Qt WebView2 native application (original V5 integration)
- **Total Files:** 87 files
- **Structure:**
  - `src/mpv/` - C++ MPV integration (player.cpp, player.h)
  - `src/core/` - Global state management (globals.cpp, globals.h)
  - `src/ui/` - Qt UI (mainwindow.cpp, splash.cpp)
  - `src/webview/` - WebView2 integration (webview.cpp)
  - `src/utils/` - Config, Discord, extensions, helpers
  - `build/` - Build scripts (anime4k, animejanai, checksums, deploy)
  - `utils/mpv/` - MPV portable configs, Anime4K profiles, ThumbFast
  - `utils/windows/` - FFmpeg binaries, installer scripts
  - `CMakeLists.txt` - CMake build configuration

#### Key Reference Files:
- **MPV Integration:**
  - `src/mpv/player.cpp` - Core MPV player C++ wrapper
  - `src/mpv/player.h` - Header file
- **Anime4K Configs:**
  - `utils/mpv/anime4k/portable_config/mpv.conf`
  - `utils/mpv/anime4k/portable_config/input.conf`
  - `utils/mpv/anime4k/portable_config/scripts/skip-intro.lua`
  - `utils/mpv/anime4k/anime4k-High-end.zip` - Shader package
- **Default MPV Config:**
  - `utils/mpv/Default Portable Config.7z`
- **ThumbFast:**
  - `utils/mpv/thumbfast/thumbfast.7z`
- **FFmpeg:**
  - `utils/windows/ffmpeg/` - Complete FFmpeg distribution (10 files including DLLs)

#### Build Scripts Reference:
- `build/build_anime4k.js` - Anime4K shader packaging
- `build/build_animejanai.js` - AnimeJanai upscaler integration
- `build/deploy_windows.js` - Windows deployment automation

#### Documentation:
- `README.md` - Project overview, V5 integration details
- `docs/WINDOWS.md` - Windows-specific build/setup instructions
- `docs/GOODBYE.md` - Project sunset notes
- `docs/RELEASE.md` - Release process

---

## Category 5: Package Dependencies

### Analysis: package.json
**No MPV-specific dependencies identified.**

The integration uses:
- **Bundled binaries** (not npm packages)
- **Native Node.js modules:**
  - `child_process` - For spawning MPV
  - `fs`, `path` - File system operations
  - `net` - IPC socket communication
- **Existing dependencies (potentially used):**
  - `ini` (v6.0.0) - For parsing stremio-settings.ini
  - `winston` - Logging (used by MpvManager)
  - None of the other 9 dependencies are MPV-related

**No package.json modifications needed for removal** (MPV is completely external)

---

## Category 6: Documentation Files

### User-Facing Documentation
- `NATIVE_PLAYER.md` - Native player feature documentation
- `NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt` - Implementation planning document
- `IMPLEMENTATION_SUMMARY.md` - Summary of implementation

### Planning Documents
- `.planning/PROJECT.md` - References native player in project overview
- `.planning/ROADMAP.md` - Phase 01-08: MPV/V5 integration cleanup
- `.planning/STATE.md` - Current state tracking
- `.planning/phases/01-investigation-mapping/01-01-PLAN.md` - This investigation plan
- `.planning/phases/01-investigation-mapping/01-02-PLAN.md` - Next plan (dependency analysis)
- `.planning/codebase/` - Multiple files reference MPV integration:
  - `STRUCTURE.md`
  - `ARCHITECTURE.md`
  - `INTEGRATIONS.md`
  - `CONCERNS.md`
  - `CONVENTIONS.md`

---

## Category 7: IPC Communication Surface

### IPC Channels (20 channels)
All defined in `src/constants/index.ts` lines 154-175:

#### Renderer → Main (Commands)
1. `NATIVE_PLAYER_INIT` - Initialize MPV
2. `NATIVE_PLAYER_LOAD` - Load video URL + metadata
3. `NATIVE_PLAYER_PLAY` - Start playback
4. `NATIVE_PLAYER_PAUSE` - Pause playback
5. `NATIVE_PLAYER_SEEK` - Seek to position (seconds)
6. `NATIVE_PLAYER_VOLUME` - Set volume (0-100)
7. `NATIVE_PLAYER_SPEED` - Set playback speed (0.25-4.0)
8. `NATIVE_PLAYER_STOP` - Stop and quit MPV
9. `NATIVE_PLAYER_SUBTITLE_ADD` - Add subtitle file path
10. `NATIVE_PLAYER_SET_UPSCALER` - Set Anime4K profile
11. `NATIVE_PLAYER_GET_CONFIG` - Request configuration
12. `NATIVE_PLAYER_SET_CONFIG` - Update configuration
13. `OPEN_NATIVE_PLAYER_CONFIG_FOLDER` - Open config directory
14. `NATIVE_PLAYER_ENABLED` - Check if enabled (unused?)

#### Main → Renderer (Events)
15. `MPV_PROP_CHANGE` - Property changed (pause, time-pos, duration, volume, speed, eof-reached)
16. `MPV_EVENT_ENDED` - Playback finished
17. `MPV_EVENT_ERROR` - Playback error occurred
18. `NATIVE_PLAYER_DISABLED` - MPV unavailable/disabled
19. `NATIVE_PLAYER_FALLBACK_WEB` - Fall back to web player

---

## Category 8: File System Footprint

### User Config Directory Structure
Created at runtime in `<user-config>/streamgo/native-player/`:

```
native-player/
├── config/
│   ├── stremio-settings.ini    (INI config)
│   ├── mpv.conf                (MPV configuration)
│   └── input.conf              (Keyboard shortcuts)
├── shaders/                    (Anime4K .glsl files)
├── scripts/                    (Lua scripts like thumbfast.lua)
└── cache/
    └── thumbfast/              (Thumbnail cache)
```

### Required Shader Files (per profile)
Based on `Anime4KProfiles.ts`, up to 7 shader files per profile:
- Anime4K_Clamp_Highlights.glsl
- Anime4K_Restore_CNN_VL.glsl
- Anime4K_Restore_CNN_M.glsl
- Anime4K_Restore_CNN_S.glsl
- Anime4K_Upscale_CNN_x2_VL.glsl
- Anime4K_Upscale_CNN_x2_M.glsl
- Anime4K_Upscale_CNN_x2_S.glsl
- Anime4K_AutoDownscalePre_x2.glsl
- Anime4K_AutoDownscalePre_x4.glsl

**Total unique shaders needed:** 9 .glsl files

---

## Category 9: External Dependencies (Runtime)

### Required at Runtime
1. **MPV binary** - System PATH or bundled at `resources/mpv/<platform>-<arch>/mpv[.exe]`
2. **Anime4K shader files** - Must be in `native-player/shaders/` directory
3. **ThumbFast script** (optional) - `native-player/scripts/thumbfast.lua`
4. **Config files** - Auto-generated if missing

### Not Required (Reference Only)
- `stremio-community-v5-webview-windows/` directory - Can be deleted after mapping

---

## Comparison: Reference vs. Current Implementation

### Reference Implementation (C++)
- **Language:** C++/Qt
- **MPV Integration:** libmpv C API
- **Architecture:** Embedded MPV in Qt widget with WebView2
- **Platform:** Windows only (native executable)
- **Build System:** CMake
- **Distribution:** Native installer with bundled MPV/FFmpeg

### Current Implementation (Electron)
- **Language:** TypeScript
- **MPV Integration:** child_process spawning + IPC socket communication
- **Architecture:** Separate MPV window, controlled via JSON IPC
- **Platform:** Cross-platform (Electron)
- **Build System:** npm/tsc + electron-builder
- **Distribution:** Electron app with bundled MPV binaries per platform

### What Was Adopted from Reference
1. **Anime4K shader profiles** - Same profile structure and shader files
2. **Config structure** - Similar INI-based configuration
3. **ThumbFast integration** - Same thumbnail preview script
4. **MPV configuration patterns** - Similar mpv.conf and input.conf defaults
5. **Concept** - Native MPV playback instead of web player

### What Was NOT Adopted
- C++ libmpv integration (uses child_process instead)
- Qt UI framework (uses Electron/web UI)
- WebView2 embedding (uses separate MPV window)
- Windows-specific code (cross-platform)
- Build scripts for Anime4K/FFmpeg packaging

---

## Complete File List

### Source Code Files (11 files)
1. `src/core/NativePlayerConfig.ts`
2. `src/utils/MpvManager.ts`
3. `src/utils/MpvBinaryManager.ts`
4. `src/utils/Anime4KProfiles.ts`
5. `src/components/native-player-injector/nativePlayerInjector.ts`
6. `src/components/native-player-controls/nativePlayerControls.ts`
7. `src/components/native-player-controls/native-player-controls.html`
8. `src/main.ts` (integration points)
9. `src/preload.ts` (integration points)
10. `src/components/plus-page/plusPage.ts` (native player section)
11. `src/constants/index.ts` (constants + IPC channels)

### Additional Modified Files (2 files)
12. `src/core/Properties.ts` (path definitions)
13. `package.json` (NO changes needed)

### Resource Files (9 files in resources/mpv/win32-x64/)
14-22. MPV binaries and documentation (see Category 3)

### Documentation Files (3 files)
23. `NATIVE_PLAYER.md`
24. `NATIVE_PLAYER_IMPLEMENTATION_PLAN.txt`
25. `IMPLEMENTATION_SUMMARY.md`

### Reference Directory (87 files)
26. `stremio-community-v5-webview-windows/` - Entire directory

### Planning Documents (10+ files)
27+. `.planning/` directory files with MPV references

---

## Search Results Summary

### Pattern: "mpv|Mpv|MPV" (case-insensitive)
- **48 files matched** (includes planning docs and reference dir)

### Pattern: "native-player|nativePlayer|NativePlayer"
- **22 files matched**

### Pattern: "anime4k|Anime4K" (case-insensitive)
- **16 files matched**

### Pattern: "v5-webview|community-v5"
- **4 files matched** (all reference to source project)

---

## Risk Assessment for Removal

### High Risk (Core Dependencies)
- `main.ts` - 50+ lines of MPV integration, IPC handlers spread throughout
- `preload.ts` - Initial setup call
- `constants/index.ts` - 33 constants (13 storage keys + 20 IPC channels)

### Medium Risk (Isolated Modules)
- `plusPage.ts` - Complete native player settings section, can be removed as unit
- `Properties.ts` - 6 lines of path definitions

### Low Risk (Self-Contained)
- All 4 native player core files (NativePlayerConfig, MpvManager, MpvBinaryManager, Anime4KProfiles)
- Both component directories (native-player-injector, native-player-controls)
- All resource files
- All documentation files

---

## Next Steps

Ready for Plan 01-02: Document integration dependencies and create removal strategy
- Map exact line ranges in modified files
- Identify localStorage migration needs
- Check for any external dependencies on native player (plugins, themes)
- Create detailed removal checklist
