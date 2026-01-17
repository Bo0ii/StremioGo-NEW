---
title: StreamGo Party Server
emoji: 🎬
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
---

# StreamGo Party Server

WebSocket server for StreamGo Watch Party feature. This server handles real-time synchronization between party members for video playback, chat, and host management.

## Features

- Short party codes (e.g., "SH7KM3") for easy sharing
- Multiple hosts support with toggle functionality
- Real-time video sync with latency compensation
- Chat messaging
- Password-protected parties (optional)
- Heartbeat system for connection management

## Deployment to HuggingFace Spaces

### Step 1: Create a HuggingFace Account

1. Go to [huggingface.co](https://huggingface.co) and sign up for a free account
2. Verify your email address

### Step 2: Create a New Space

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Configure the Space:
   - **Owner**: Your username
   - **Space name**: `streamgo-party` (or any name you prefer)
   - **License**: Choose one (e.g., MIT)
   - **SDK**: Select **Docker**
   - **Hardware**: CPU basic (free tier)
   - **Visibility**: **Public** (required for free hosting)

4. Click "Create Space"

### Step 3: Upload Server Files

Upload all files from this `HuggingFaceServer/` folder to your Space:

**Required files:**
- `Dockerfile`
- `package.json`
- `index.js`
- `live.js`
- `.dockerignore`

**Upload methods:**
- **Web UI**: Click "Files" tab, then "Add file" → "Upload files"
- **Git**: Clone the Space repo and push files

### Step 4: Wait for Build

- HuggingFace will automatically build and deploy your Docker container
- Watch the "Logs" tab for build progress
- The build typically takes 1-2 minutes

### Step 5: Verify Deployment

Once deployed, visit your Space URL:
```
https://YOUR-USERNAME-streamgo-party.hf.space
```

You should see:
```json
{
  "status": "ok",
  "name": "StreamGo Party Server",
  "version": "1.0.0"
}
```

### Step 6: Update StreamGo PartyService

After deployment, update the server URL in your StreamGo codebase:

**File:** `src/utils/PartyService.ts`

Find this section (around line 8-11):
```typescript
const WATCHPARTY_SERVERS: Record<string, string> = {
    'S': 'wss://YOUR-USERNAME-streamgo-party.hf.space',
};
```

Replace `YOUR-USERNAME` with your actual HuggingFace username:
```typescript
const WATCHPARTY_SERVERS: Record<string, string> = {
    'S': 'wss://johndoe-streamgo-party.hf.space',
};
```

## Server URL Format

After deployment, your WebSocket server will be available at:
```
wss://YOUR-USERNAME-streamgo-party.hf.space
```

Replace `YOUR-USERNAME` with your HuggingFace username.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7860` | Server port (required for HuggingFace) |
| `SERVER_PREFIX` | `S` | Prefix for party codes (e.g., "S" generates "SH7KM3") |

## Protocol Reference

### Create Party
WebSocket subprotocol header format:
```
c#1#username#password#partyname#joinAsHost
```

**Parameters:**
- `c` - Command type (create)
- `1` - Protocol version
- `username` - Display name (URL-encoded)
- `password` - Party password (empty for public)
- `partyname` - Party name (URL-encoded)
- `joinAsHost` - `1` if new members should be hosts, `0` otherwise

### Join Party
WebSocket subprotocol header format:
```
j#1#username#partycode#password
```

**Parameters:**
- `j` - Command type (join)
- `1` - Protocol version
- `username` - Display name (URL-encoded)
- `partycode` - Short party code (e.g., "SH7KM3")
- `password` - Party password (empty if none)

### Server Messages

| Message | Format | Description |
|---------|--------|-------------|
| `ping` | `ping` | Heartbeat check (respond with `pong`) |
| `party:` | `party:{"code":"X","name":"Y","members":[...]}` | Party state update |
| `cmd:` | `cmd:latency:command:data` | Command from host with latency |
| `msg:` | `msg:userId:text` | Chat message from user |
| `badroom` | `badroom` | Invalid party code or password |
| `upgrade` | `upgrade` | Client version outdated |

### Client Messages

| Message | Format | Description |
|---------|--------|-------------|
| `pong` | `pong` | Heartbeat response |
| `cmd:` | `cmd:command:data` | Command to broadcast (host only) |
| `msg:` | `msg:text` | Chat message |
| `toggle:` | `toggle:userId` | Toggle host status (host only) |

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Server runs on:
- HTTP: `http://localhost:7860`
- WebSocket: `ws://localhost:7860`

## Troubleshooting

### Space Not Building
- Check the "Logs" tab for error messages
- Ensure all required files are uploaded
- Verify Dockerfile syntax

### WebSocket Connection Failed
- Verify the server URL uses `wss://` (not `ws://`)
- Check that the Space is running (green status indicator)
- Ensure the Space is public

### Party Not Syncing
- Check browser console for WebSocket errors
- Verify both clients are connected to the same party code
- Ensure at least one member is a host

## License

This server is part of the StreamGo project.
