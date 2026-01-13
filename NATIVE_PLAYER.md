# Native Player Integration

StreamGo now includes a native MPV-based player with advanced features including hardware acceleration, Anime4K upscaling, custom subtitles, and thumbnail previews.

## Features

### Core Playback
- **Hardware Acceleration**: Platform-specific hardware decoding (d3d11va on Windows, videotoolbox on macOS, vaapi on Linux)
- **High Performance**: GPU-accelerated video output with `gpu-next` backend
- **Configurable Caching**: Adjustable demuxer cache and buffer sizes

### Anime4K Upscaling
- **Multiple Profiles**: Off, Fast, Balanced, HQ, UHQ
- **Keyboard Shortcuts**: Ctrl+0-4 for quick profile switching
- **GPU Shaders**: Real-time upscaling for anime content

### Subtitles
- **Custom Styling**: Font, size, color customization
- **Drag & Drop**: Support for .srt, .ass, .ssa, .vtt files
- **ASS Override**: Full control over subtitle rendering

### Advanced Features
- **ThumbFast**: Timeline thumbnail previews
- **Screenshot**: High-quality screenshot capture (S key)
- **Playback Speed**: Adjustable speed from 0.5x to 2x
- **Keyboard Shortcuts**: Full keyboard control

## Installation

### Prerequisites

#### Option 1: System MPV (Recommended)
Install MPV on your system:

**Windows:**
```bash
# Using winget
winget install mpv

# Or download from https://mpv.io/installation/
```

**macOS:**
```bash
# Using Homebrew
brew install mpv
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install mpv

# Fedora
sudo dnf install mpv

# Arch
sudo pacman -S mpv
```

#### Option 2: Bundled MPV
StreamGo can use bundled MPV binaries (requires manual download):

1. Download MPV for your platform from https://mpv.io/installation/
2. Place in `resources/mpv/{platform}-{arch}/` directory:
   - Windows x64: `resources/mpv/win32-x64/mpv.exe`
   - macOS Intel: `resources/mpv/darwin-x64/mpv`
   - macOS ARM: `resources/mpv/darwin-arm64/mpv`
   - Linux x64: `resources/mpv/linux-x64/mpv`

### Node.js Dependencies

```bash
npm install node-mpv --save
npm install ini --save
npm install @types/ini --save-dev
```

### Anime4K Shaders (Optional)

For upscaling support, download Anime4K shaders:

1. Download from https://github.com/bloc97/Anime4K/releases
2. Extract all `.glsl` files
3. Place in config directory:
   - Windows: `%APPDATA%/StreamGo/native-player/shaders/`
   - macOS: `~/Library/Application Support/StreamGo/native-player/shaders/`
   - Linux: `~/.config/StreamGo/native-player/shaders/`

Required shader files:
- `Anime4K_Clamp_Highlights.glsl`
- `Anime4K_Restore_CNN_VL.glsl`
- `Anime4K_Restore_CNN_M.glsl`
- `Anime4K_Restore_CNN_S.glsl`
- `Anime4K_Upscale_CNN_x2_VL.glsl`
- `Anime4K_Upscale_CNN_x2_M.glsl`
- `Anime4K_Upscale_CNN_x2_S.glsl`
- `Anime4K_AutoDownscalePre_x2.glsl`
- `Anime4K_AutoDownscalePre_x4.glsl`

### ThumbFast (Optional)

For timeline thumbnail previews:

1. Download `thumbfast.lua` from https://github.com/po5/thumbfast
2. Place in config directory:
   - Windows: `%APPDATA%/StreamGo/native-player/scripts/thumbfast.lua`
   - macOS: `~/Library/Application Support/StreamGo/native-player/scripts/thumbfast.lua`
   - Linux: `~/.config/StreamGo/native-player/scripts/thumbfast.lua`

## Configuration

### Enable Native Player

1. Open StreamGo
2. Click **Plus** in the top navigation
3. Navigate to **Native Player** in the sidebar
4. Toggle **Enable Native Player** ON
5. Reload the app

### Settings

Access all native player settings via **Plus > Native Player**:

#### General
- **Enable Native Player**: Toggle native playback on/off
- **Video Output**: Choose GPU backend (gpu-next recommended)
- **Hardware Acceleration**: Auto-detected based on platform

#### Upscaling (Anime4K)
- **Upscaler Profile**: Choose quality level
  - Off: No upscaling
  - Fast: Low quality, minimal GPU usage
  - Balanced: Medium quality (recommended)
  - HQ: High quality, higher GPU usage
  - UHQ: Ultra high quality, requires powerful GPU

#### Subtitles
- **Font**: Subtitle font family (default: Arial)
- **Font Size**: Text size (20-100px)
- **Text Color**: Subtitle color picker

#### Advanced
- **ThumbFast**: Enable/disable timeline thumbnails
- **Thumbnail Height**: Preview size (100-400px)
- **Open Config Folder**: Access MPV config files
- **Reset to Defaults**: Restore all settings

### Configuration Files

Advanced users can edit config files directly:

**Config Directory:**
- Windows: `%APPDATA%/StreamGo/native-player/config/`
- macOS: `~/Library/Application Support/StreamGo/native-player/config/`
- Linux: `~/.config/StreamGo/native-player/config/`

**Files:**
- `stremio-settings.ini`: Player settings (INI format)
- `mpv.conf`: MPV options (auto-generated)
- `input.conf`: Keyboard shortcuts (auto-generated)

## Keyboard Shortcuts

### Playback Control
- **Space / K**: Play/Pause
- **Left Arrow**: Seek -5 seconds
- **Right Arrow**: Seek +5 seconds
- **Up Arrow**: Volume +5%
- **Down Arrow**: Volume -5%
- **M**: Toggle mute

### Player Features
- **F**: Toggle fullscreen
- **S**: Take screenshot
- **Ctrl+0**: Disable upscaler
- **Ctrl+1**: Fast upscaler
- **Ctrl+2**: Balanced upscaler
- **Ctrl+3**: HQ upscaler
- **Ctrl+4**: UHQ upscaler

## Troubleshooting

### MPV Not Found

**Error**: "MPV binary not found, native player disabled"

**Solutions**:
1. Install MPV system-wide (see Prerequisites)
2. Add MPV to your system PATH
3. Place MPV binary in resources folder (see Installation)

### Shaders Not Working

**Error**: Upscaler doesn't seem to work

**Solutions**:
1. Verify shader files are in the correct directory
2. Check shader file names match exactly (case-sensitive)
3. Open config folder and verify `shaders/` directory exists
4. Try "Balanced" profile first (requires fewer shaders than HQ/UHQ)

### Subtitles Not Loading

**Solutions**:
1. Ensure subtitle file is .srt, .ass, .ssa, or .vtt format
2. Try dragging the subtitle file onto the player window
3. Check MPV logs for subtitle errors

### Performance Issues

**Solutions**:
1. Lower upscaler profile (try Fast or Off)
2. Disable ThumbFast in settings
3. Check hardware acceleration is enabled
4. Close other GPU-intensive applications

### Fallback to Web Player

If native player fails to initialize, StreamGo automatically falls back to Stremio's web player. Check the logs for specific error messages.

## Architecture

### Components

**Main Process:**
- `MpvManager.ts`: Core MPV lifecycle management
- `MpvBinaryManager.ts`: Binary location and verification
- `NativePlayerConfig.ts`: INI config file management
- `Anime4KProfiles.ts`: Shader profile definitions

**Renderer Process:**
- `nativePlayerInjector.ts`: Web player detection and override
- `nativePlayerControls.ts`: Player UI and event handling

**IPC Communication:**
- 18 IPC channels for main ↔ renderer communication
- Event-driven architecture with property observers

### Config Structure

```
{enhancedPath}/StreamGo/native-player/
├── config/
│   ├── mpv.conf              # MPV settings
│   ├── input.conf            # Keyboard shortcuts
│   └── stremio-settings.ini  # Player settings
├── shaders/                  # Anime4K shaders
├── scripts/                  # MPV Lua scripts
│   └── thumbfast.lua
├── fonts/                    # Custom fonts (future)
└── cache/thumbfast/          # Thumbnail cache
```

## Performance Recommendations

### Optimal Settings
- **Video Output**: gpu-next (best quality)
- **Upscaler**: Balanced (1080p content), HQ (720p anime)
- **Cache**: 300MB demux cache, 60s buffer (default)

### Low-End Systems
- **Video Output**: gpu
- **Upscaler**: Fast or Off
- **ThumbFast**: Disabled
- **Cache**: 150MB demux cache, 30s buffer

### High-End Systems
- **Video Output**: gpu-next
- **Upscaler**: UHQ
- **ThumbFast**: Enabled, 300-400px height
- **Cache**: 500MB+ demux cache, 120s buffer

## Known Limitations

1. **Discord Rich Presence**: Not yet integrated with native player (shows web player status)
2. **Streaming Server**: Requires StreamGo's streaming server or Stremio Service
3. **DRM Content**: Not supported (MPV limitation)
4. **Platform Support**: Requires MPV for each platform

## Future Enhancements

- [ ] Discord RPC integration for native player
- [ ] Custom shader upload support
- [ ] Advanced audio configuration
- [ ] Multiple audio/subtitle track selection
- [ ] Resume playback position
- [ ] Watch history integration

## Support

For issues or questions:
- GitHub Issues: https://github.com/Bo0ii/StreamGo/issues
- Check logs in: `{enhancedPath}/StreamGo/logs/`

## Credits

- **MPV**: https://mpv.io/
- **node-mpv**: https://github.com/j-holub/Node-MPV
- **Anime4K**: https://github.com/bloc97/Anime4K
- **ThumbFast**: https://github.com/po5/thumbfast
