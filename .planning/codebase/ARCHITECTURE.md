# Architecture

**Analysis Date:** 2026-01-14

## Pattern Overview

**Overall:** Electron Desktop Wrapper with DOM Injection System

**Key Characteristics:**
- Dual-process model (Main + Renderer with Preload)
- Wraps existing web application (web.stremio.com)
- Plugin/theme system via dynamic script/style injection
- DOM mutation observer for UI enhancement
- IPC-based main↔renderer communication

## Layers

**Main Process Layer:**
- Purpose: Electron app lifecycle, native integrations, window management
- Contains: `src/main.ts` - Entry point, IPC handlers, GPU flags, protocol handlers
- Depends on: Core services (Updater, StreamingServer, StremioService, NativePlayer)
- Used by: None (top-level process)

**Preload/Renderer Layer:**
- Purpose: DOM manipulation, UI injection, plugin/theme loading
- Contains: `src/preload.ts` - Settings injection, plugin loader, mutation observers
- Depends on: Core (Settings, ModManager), Utils (DiscordPresence, PartyService)
- Used by: Stremio web player (injected into)

**Core Business Logic Layer** (`src/core/`):
- Purpose: Application-specific logic and configuration
- Contains:
  - `ModManager.ts` - Plugin/theme lifecycle management
  - `Settings.ts` - Settings UI injection into Stremio interface
  - `Updater.ts` - Version checking and auto-updates
  - `Properties.ts` - Platform-specific paths and resource management
  - `StreamingConfig.ts` - Streaming server configuration profiles
  - `NativePlayerConfig.ts` - Native MPV player settings
- Depends on: Utils layer, Constants
- Used by: Main process, Preload script

**Service Layer** (`src/utils/`):
- Purpose: External service integrations and utilities
- Contains:
  - `StreamingServer.ts` - FFmpeg and server.js management
  - `StremioService.ts` - Stremio Service installation/startup
  - `DiscordPresence.ts` - Discord Rich Presence integration
  - `ExternalPlayer.ts` - External player (VLC, MPV) launching
  - `MpvManager.ts` - Native MPV player process management
  - `MpvBinaryManager.ts` - MPV binary download/verification
  - `PartyService.ts` - Watch party synchronization
  - `SystemTray.ts` - System tray icon/menu
  - `Helpers.ts` - Metadata parsing, dialogs, version comparison
  - `logger.ts` - Winston logging utility
  - `TemplateCache.ts` - HTML template caching
- Depends on: Constants, Node.js built-ins
- Used by: Core layer, Main process, Preload

**UI Component Layer** (`src/components/`):
- Purpose: Reusable UI components for settings and features
- Contains: TypeScript + HTML template pairs (e.g., `modsTab.ts` + `mods-tab.html`)
- Depends on: TemplateCache, Constants
- Used by: Preload (Settings injection)

**Constants & Interfaces** (`src/constants/`, `src/interfaces/`):
- Purpose: Centralized configuration and type definitions
- Contains: CSS selectors, IPC channels, URLs, storage keys, type definitions
- Depends on: Nothing (leaf nodes)
- Used by: All layers

## Data Flow

**Application Startup:**

1. `app.ready()` event triggers in `src/main.ts`
2. Check/create platform-specific directories (plugins, themes, native-player)
3. Initialize streaming server (bundled → external → manual server.js fallback)
4. `createWindow()` loads `https://web.stremio.com/`
5. `src/preload.ts` runs before page load
6. Settings UI injected into Stremio's settings panel via `initSettings()`
7. Plugins loaded from bundled and user directories via `loadPlugins()`
8. Themes applied via `applyTheme()` (CSS injection)
9. Discord RPC, system tray, update checker initialized

**Plugin Installation Flow:**

1. User clicks install in mods tab
2. `ModManager.downloadMod()` fetches from CDN
3. File saved to user plugins/themes directory
4. localStorage updated with enabled plugins list
5. `ModManager.loadPlugin()` injects `<script>` tag into DOM
6. Plugin executes in renderer context

**IPC Communication:**

```
Main Process ↔ Renderer Process (via ipcMain/ipcRenderer)

Examples:
- Window controls: minimize, maximize, close
- Update checks: check → download progress → install
- Streaming config: get settings → apply profile → restart service
- External player: detect → launch with URL
- Native player: load video → play/pause/seek → stop
```

## Key Abstractions

**Plugin/Theme System:**
- Purpose: Extend Stremio UI with custom JavaScript and CSS
- Examples: `plugins/card-hover-info.plugin.js`, `themes/liquid-glass.theme.css`
- Pattern: JSDoc metadata + dynamic injection
- Locations: Bundled (`plugins/`, `themes/`) and user-installed (config dir)

**Settings Injection:**
- Purpose: Add StreamGo settings to Stremio's settings panel
- Examples: `src/core/Settings.ts` - Injects mods, appearance, tweaks, about categories
- Pattern: DOM cloning + CSS selector targeting

**Template System:**
- Purpose: Separate HTML markup from TypeScript logic
- Examples: `src/utils/TemplateCache.ts` loads `src/components/**/*.html`
- Pattern: Disk-based caching with `{{placeholder}}` replacement

**Mutation Observer:**
- Purpose: Detect DOM changes for UI enhancement
- Location: `src/preload.ts` - Unified observer with debounced callbacks
- Pattern: Single observer instance, filtered mutations, 100ms debounce

## Entry Points

**Main Process:**
- Location: `src/main.ts`
- Triggers: Electron `app.ready()` event
- Responsibilities: Create window, initialize services, setup IPC handlers, manage native player

**Preload Script:**
- Location: `src/preload.ts`
- Triggers: Before renderer page load
- Responsibilities: Inject UI, load plugins/themes, setup observers, initialize Discord RPC

**Build Entry:**
- Command: `npm run dist`
- Process: TypeScript compilation → HTML template copying → Output to `dist/`
- Entry for Electron: `dist/main.js`

## Error Handling

**Strategy:** Try/catch at service boundaries, log errors, graceful degradation

**Patterns:**
- Services throw errors with descriptive messages
- Main process catches and logs via Winston
- Renderer catches and displays dialogs or console errors
- Streaming server falls back through priority list (bundled → external → manual)

## Cross-Cutting Concerns

**Logging:**
- Winston logger configured in `src/utils/logger.ts`
- Multiple transports: console and file-based
- Log levels: debug, info, warn, error
- Used throughout all layers

**Settings Persistence:**
- localStorage for user preferences
- File-based for plugin/theme files
- INI files for native player configuration

**Security:**
- Relaxed Electron security (`nodeIntegration: true`, `contextIsolation: false`)
- Required for plugin/theme functionality
- Custom `_eval()` function for safe context execution

---

*Architecture analysis: 2026-01-14*
*Update when major patterns change*
