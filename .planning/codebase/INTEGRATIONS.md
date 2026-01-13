# External Integrations

**Analysis Date:** 2026-01-14

## APIs & External Services

**Stremio Services:**
- Stremio Web Player - `https://web.stremio.com/` - Main UI wrapper - `src/constants/index.ts`
- Stremio Server - `https://dl.strem.io/server/v4.20.12/desktop/server.js` - Streaming backend download - `src/constants/index.ts`
- Stremio Service API - GitHub releases for service binary downloads - `src/utils/StremioService.ts`
- Stremio Collection API - Addon synchronization
  - Get: `https://api.strem.io/api/addonCollectionGet` - `src/preload.ts:1033`
  - Set: `https://api.strem.io/api/addonCollectionSet` - `src/preload.ts:1127, 1148`

**Plugin & Theme Registry:**
- Community Registry - `https://raw.githubusercontent.com/REVENGE977/stremio-enhanced-registry/main/registry.json` - Plugin/theme discovery - `src/constants/index.ts`

**Update Management:**
- GitHub API - `https://api.github.com/repos/Bo0ii/StreamGo/releases/latest` - Version checking - `src/core/Updater.ts`, `src/constants/index.ts`
- GitHub Releases - `https://github.com/Bo0ii/StreamGo/releases/latest` - Release page - `src/constants/index.ts`

**Discord Integration:**
- Discord RPC - Direct client connection (not HTTP-based)
  - Client ID: `1200186750727893164`
  - SDK: `@xhayper/discord-rpc` v1.2.1
  - Implementation: `src/utils/DiscordPresence.ts`
  - Purpose: Display current playback (movie/show, episode info) on Discord profile

**Party/Watch Sync:**
- Hugging Face Spaces WebSocket - `wss://bo0ii-streamgo-party.hf.space` - Watch party synchronization - `src/utils/PartyService.ts:9`
- Uses WebSocket protocol for real-time video sync, chat, and playback state

## Data Storage

**Local File System:**
- Platform-specific config directories - `src/core/Properties.ts`
- Plugin files: `{configDir}/plugins/*.plugin.js`
- Theme files: `{configDir}/themes/*.theme.css`
- Native player config: `{configDir}/native-player/config/`
- Streaming server: `{configDir}/streamingserver/`

**Browser Storage:**
- localStorage - Settings, enabled plugins, user preferences
- Storage keys defined in `src/constants/index.ts` - `STORAGE_KEYS`

**No Cloud Backend:**
- Despite `@supabase/supabase-js` dependency, no active Supabase integration found

## Authentication & Identity

**Auth Provider:**
- None - Wraps Stremio's existing authentication
- Stremio handles user login/session management
- No additional authentication layer in StreamGo

## Monitoring & Observability

**Error Tracking:**
- None - Local logging only

**Logs:**
- Winston logger - `src/utils/logger.ts`
- File-based logging to platform-specific directories
- Multiple log levels: debug, info, warn, error

## CI/CD & Deployment

**Hosting:**
- Electron packaged app - Distributed via GitHub Releases
- No cloud hosting - Desktop application only

**CI Pipeline:**
- GitHub Actions - `.github/workflows/`
- Automated builds for multiple platforms
- Release creation and asset upload

## Environment Configuration

**Development:**
- No .env files - Configuration in `src/constants/index.ts`
- All API endpoints hardcoded
- No secrets management (except Discord Client ID in constants)

**Production:**
- Same configuration as development
- Electron auto-updater handles updates

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Media Tools

**FFmpeg Downloads** (auto-downloaded per platform):
- Windows x64: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip`
- Windows ARM64: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-winarm64-gpl.zip`
- macOS x64: `https://ffmpeg.martin-riedl.de/download/macos/amd64/1766437297_8.0.1/ffmpeg.zip`
- macOS ARM64: `https://ffmpeg.martin-riedl.de/download/macos/arm64/1766430132_8.0.1/ffmpeg.zip`
- Linux x64: `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz`
- Linux ARM64: `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz`

**FFprobe Downloads** (macOS only):
- macOS x64: `https://ffmpeg.martin-riedl.de/download/macos/amd64/1766437297_8.0.1/ffprobe.zip`
- macOS ARM64: `https://ffmpeg.martin-riedl.de/download/macos/arm64/1766430132_8.0.1/ffprobe.zip`

All declared in `src/constants/index.ts` - `FFMPEG_URLS`, `MACOS_FFPROBE_URLS`, `SERVER_JS_URL`

## External Player Support

**Supported Players:**
- VLC - Optional external player
- MPC-HC (Media Player Classic) - Optional
- MPV - Native player implementation via `src/utils/MpvManager.ts`

---

*Integration audit: 2026-01-14*
*Update when adding/removing external services*
