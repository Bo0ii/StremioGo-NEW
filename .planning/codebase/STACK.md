# Technology Stack

**Analysis Date:** 2026-01-14

## Languages

**Primary:**
- TypeScript 5.7.2 - `package.json`, `tsconfig.json` - All application code

**Secondary:**
- JavaScript - Build scripts (`copyComponents.js`), plugin files (`*.plugin.js`)
- HTML - Component templates (`src/components/**/*.html`)
- CSS - Theme files (`themes/*.theme.css`)

## Runtime

**Environment:**
- Electron 37.3.1 - Desktop application framework
- Node.js - Build and runtime environment (no specific version pinned)

**Package Manager:**
- npm - Package management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Electron 37.3.1 - Desktop wrapper for Stremio web player
- Stremio Web Player v5 - Wrapped from `https://web.stremio.com/`

**Testing:**
- None currently configured

**Build/Dev:**
- TypeScript 5.7.2 - Compilation to JavaScript (CommonJS, ES2022 target)
- Electron Builder 26.0.12 - Cross-platform packaging
- Custom build system - `copyComponents.js` copies HTML templates to dist

## Key Dependencies

**Critical:**
- `@xhayper/discord-rpc@^1.2.1` - Discord Rich Presence integration - `src/utils/DiscordPresence.ts`
- `discord-api-types@^0.37.119` - Discord API type definitions
- `electron-updater@^5.3.0` - Auto-update functionality - `src/core/Updater.ts`
- `winston@^3.11.0` - Structured logging - `src/utils/logger.ts`

**Infrastructure:**
- `marked@^15.0.7` - Markdown parsing for plugin metadata
- `unzipper@^0.12.3` - ZIP extraction for plugins/themes
- `ini@^6.0.0` - INI file parsing for configuration
- `electron-prompt@^1.7.0` - Dialog prompts

**UI Enhancement:**
- `acrylic-vibrancy@^1.1.0` - Windows Aero glass effect (dev dependency)

**Unused:**
- `@supabase/supabase-js@^2.90.1` - Listed in dependencies but not imported anywhere in codebase

## Configuration

**Environment:**
- No .env files - All configuration hardcoded in `src/constants/index.ts`
- Platform-specific paths managed by `src/core/Properties.ts`
- User settings in platform-specific directories:
  - Windows: `%APPDATA%/streamgo/`
  - macOS: `~/Library/Application Support/streamgo/`
  - Linux: `~/.config/streamgo/`

**Build:**
- `tsconfig.json` - TypeScript compiler options (strict mode enabled)
- `.eslintrc` - Linting configuration
- `copyComponents.js` - Custom build step to copy HTML templates

## Platform Requirements

**Development:**
- Windows/macOS/Linux - Any platform with Node.js and Electron support
- No Docker or additional tooling required

**Production:**
- Distributed as packaged Electron app via Electron Builder
- Platform-specific builds for:
  - Windows x64 and ARM64
  - macOS Intel and Apple Silicon
  - Linux x64 and ARM64

---

*Stack analysis: 2026-01-14*
*Update after major dependency changes*
