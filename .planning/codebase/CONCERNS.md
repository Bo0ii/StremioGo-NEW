# Codebase Concerns

**Analysis Date:** 2026-01-14

## Tech Debt

**Monolithic preload script:**
- Issue: `src/preload.ts` is 3,975 lines handling multiple responsibilities (UI injection, plugin loading, player overlay, party mode, streaming performance, settings UI, observer management)
- Why: Incremental feature additions without refactoring
- Impact: Difficult to maintain, test, and debug; single point of failure
- Fix approach: Split into separate modules (plugin-loader, settings-injector, player-overlay, party-manager)

**Relaxed Electron security:**
- Issue: `src/main.ts:203-215` - Security features disabled (`nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`)
- Why: Required for plugin/theme functionality and local streaming server access
- Impact: Wide attack surface if Stremio web interface is compromised
- Fix approach: Implement contextBridge-based architecture, sandbox plugins (documented TODO in `src/main.ts:212`)

**Dynamic code execution:**
- Issue: Custom `_eval()` function in `src/utils/Helpers.ts:192` executes arbitrary JavaScript in Stremio context, used extensively (`src/utils/DiscordPresence.ts:260,281`, `src/preload.ts:865,2609,2613,3023`)
- Why: Access to Stremio's internal state for Discord RPC and external player integration
- Impact: Security risk if malicious plugin or compromised Stremio API
- Fix approach: Limit scope of eval, validate inputs, consider safer alternatives

## Known Bugs

**Incomplete features:**
- Symptoms: Subtitle selection menu not implemented
- Location: `src/components/native-player-controls/nativePlayerControls.ts:276` - TODO comment
- Workaround: None - feature incomplete
- Root cause: Feature partially implemented

**Array index validation:**
- Symptoms: Stream filtering may not check all array indices
- Location: `plugins/filter-streams.plugin.js:275` - TODO comment
- Workaround: None visible
- Root cause: Incomplete implementation

## Security Considerations

**Unvalidated plugin/theme loading:**
- Risk: `src/core/ModManager.ts:90-100` - Fetches content from URLs in metadata without validation (no integrity checks, hashes, or signatures)
- Files: `src/core/ModManager.ts:399` - Directly writes fetched content to disk
- Current mitigation: None - trusts registry
- Recommendations: Add checksum validation, signature verification, or sandbox plugins

**HTML injection via innerHTML:**
- Risk: Multiple uses of `innerHTML +=` to build UI (`src/preload.ts:1308,1331,1340,1510,1778`, `src/core/Settings.ts:50,90,94`)
- Files: Template rendering throughout components
- Current mitigation: Templates appear safe, but no explicit sanitization
- Recommendations: Add HTML sanitization library (DOMPurify) or use safer DOM methods

**Missing input validation:**
- Risk: No URL validation before fetch (`src/core/ModManager.ts:368-375` - updateUrl used directly)
- Risk: No file path sanitization (`src/core/Properties.ts` - plugin/theme paths from user config)
- Risk: No process argument escaping (`src/utils/ExternalPlayer.ts:99` - args from user data)
- Current mitigation: None visible
- Recommendations: Validate URLs, sanitize file paths, escape process arguments

**IPC security:**
- Risk: IPC handlers in `src/main.ts` accept messages without source validation
- Files: Window controls, transparency, fullscreen handlers
- Current mitigation: None - any renderer can send
- Recommendations: Validate message sources, add allowlist

## Performance Bottlenecks

**N+1 file operations:**
- Problem: `src/core/ModManager.ts:176-191` - Iterates through directories with sequential `statSync()` and `readFileSync()` calls
- Measurement: Not measured, but scales poorly with plugin/theme count
- Cause: Synchronous file operations in loop
- Improvement path: Use async file operations, batch reads, cache metadata

**Missing debounce:**
- Problem: `src/preload.ts:1017-1222` - Addon collection sync on every profile change without debouncing
- Measurement: Not measured, but could cause excessive API calls
- Cause: No rate limiting on frequent operations
- Improvement path: Add debounce/throttle to sync operations

**Memory leaks:**
- Problem: `src/preload.ts:95-145` - Mutation observers with unclear cleanup
- Measurement: Not measured, potential long-term memory growth
- Cause: Long-lived listeners without removal
- Improvement path: Implement proper cleanup, weak references where possible

## Fragile Areas

**DOM selector fragility:**
- Why fragile: `src/constants/index.ts` - CSS selectors target Stremio's internal UI structure
- Files: Settings injection relies on specific class names
- Common failures: Stremio UI updates break selectors
- Safe modification: Test against multiple Stremio versions, add fallback selectors
- Test coverage: No automated tests for selector validity

**Plugin execution:**
- Why fragile: Plugins execute in unrestricted renderer context
- Files: `src/core/ModManager.ts` - Dynamic script injection
- Common failures: Plugin conflicts, Stremio API changes
- Safe modification: Add plugin API versioning, sandboxing
- Test coverage: No plugin isolation tests

## Scaling Limits

Not applicable - desktop application with local resources.

## Dependencies at Risk

**Unused dependency:**
- Package: `@supabase/supabase-js@^2.90.1`
- Risk: Listed in `package.json` but not imported anywhere in codebase
- Impact: Bloats bundle size, potential security vulnerabilities
- Migration plan: Remove from dependencies if truly unused

**Old version patterns:**
- Package: Various dependencies should be audited for security
- Risk: Some may have known vulnerabilities
- Impact: Security holes
- Migration plan: Regular `npm audit` and dependency updates

## Missing Critical Features

**Test suite:**
- Problem: No test framework, files, or coverage
- Current workaround: Manual testing only
- Blocks: Confident refactoring, CI/CD quality gates
- Implementation complexity: Medium (requires mocking Electron APIs, file system)

**Error boundaries:**
- Problem: No top-level error handlers in renderer
- Current workaround: None - errors crash renderer
- Blocks: Graceful error recovery
- Implementation complexity: Low (add try/catch wrappers)

## Test Coverage Gaps

**All critical paths untested:**
- What's not tested: Plugin loading, IPC communication, settings persistence, streaming server fallback, Discord RPC integration
- Risk: Regressions go unnoticed, difficult to refactor safely
- Priority: High
- Difficulty to test: Medium (Electron mocking required)

---

*Concerns audit: 2026-01-14*
*Update as issues are fixed or new ones discovered*
