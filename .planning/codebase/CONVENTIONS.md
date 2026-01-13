# Coding Conventions

**Analysis Date:** 2026-01-14

## Naming Patterns

**Files:**
- Core/Utils: PascalCase (`ModManager.ts`, `Settings.ts`, `Helpers.ts`, `DiscordPresence.ts`)
- Components (TS): camelCase (`modsTab.ts`, `pluginItem.ts`, `backBtn.ts`)
- Components (HTML): kebab-case (`mods-tab.html`, `plugin-item.html`, `back-btn.html`)
- Plugins: kebab-case with `.plugin.js` suffix (`card-hover-info.plugin.js`)
- Themes: kebab-case with `.theme.css` suffix (`liquid-glass.theme.css`)

**Functions:**
- camelCase for all functions (`loadPlugin()`, `getCurrentVersion()`, `parseMetadataFromContent()`)
- No special prefix for async functions
- Event handlers: `handle*` pattern (`handleNavigation()`, `handleReconnect()`)

**Variables:**
- camelCase for variables (`mainWindow`, `enabledPlugins`, `manifestUrl`)
- UPPER_SNAKE_CASE for constants (`STORAGE_KEYS`, `IPC_CHANNELS`, `DISCORD`, `TIMEOUTS`)
- No underscore prefix for private members

**Types:**
- PascalCase for interfaces, no I prefix (`MetaData`, `ParsedMetadata`, `PlayerState`)
- PascalCase for type aliases (`SetActivity`, `ObserverHandler`)
- PascalCase for classes (`Helpers`, `ModManager`, `DiscordPresence`)

## Code Style

**Formatting:**
- Tab indentation with size of 4 (configured in `tsconfig.json` and editor)
- Double quotes for strings throughout TypeScript files
- Semicolons required (TypeScript strict mode)
- Trailing commas in multi-line objects and arrays

**Linting:**
- Tool: ESLint with `.eslintrc`
- Parser: `@typescript-eslint/parser`
- Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`
- Run: `npm run lint` (on `src/**/*.ts`)

## Import Organization

**Order:**
1. External packages (electron, child_process, fs, path)
2. Internal modules from src/ (`./core/*`, `./utils/*`, `../constants`)
3. Relative imports (`./ComponentName`, `../helpers`)

**Grouping:**
- No enforced blank lines between groups (varies by file)
- Alphabetical within each group not enforced

**Path Aliases:**
- None configured - All imports use relative paths

## Error Handling

**Patterns:**
- Throw errors in services, catch at boundaries (main process, IPC handlers)
- Async functions use try/catch blocks
- Example: `src/utils/DiscordPresence.ts` - catch and log errors, attempt reconnect

**Error Types:**
- Built-in Error class with descriptive messages
- No custom error classes visible
- Log errors with Winston before throwing or returning

**Logging:**
- Format: `logger.error(message)`, `logger.warn(message)`, `logger.info(message)`
- Always log context: `logger.error(\`Failed to X: ${(error as Error).message}\`)`

## Logging

**Framework:**
- Winston 3.11.0 via `src/utils/logger.ts`
- Levels: debug, info, warn, error

**Patterns:**
- Structured logging with template literals: `logger.info(\`Connected to DiscordRPC.\`)`
- Log at service boundaries (not in utilities)
- Log state transitions, external calls, errors
- No console.log in production code (use logger instead)

## Comments

**When to Comment:**
- JSDoc blocks for plugin/theme metadata
- Inline comments for non-obvious logic
- Explain why, not what: `// Register stremio:// protocol handler - MUST be called before app.ready`

**JSDoc/TSDoc:**
- Used for plugin/theme metadata at file start
- Format:
  ```javascript
  /**
   * @name Card Hover Info
   * @description Shows IMDB rating on hover
   * @version 1.2.0
   * @author Bo0ii
   */
  ```
- Optional for functions (not consistently applied)

**TODO Comments:**
- Format: `// TODO: description` (no username tracking)
- Examples found: `src/main.ts:212`, `src/components/native-player-controls/nativePlayerControls.ts:276`

## Function Design

**Size:**
- No strict limit - `src/preload.ts` has 3,975 lines total
- Individual functions vary widely

**Parameters:**
- No strict limit visible
- Destructuring used occasionally in parameter lists

**Return Values:**
- Explicit return statements
- Some functions return `any` type (e.g., `src/core/NativePlayerConfig.ts:211`)

## Module Design

**Exports:**
- Default exports for main classes (`export default Helpers;`, `export default ModManager;`)
- Named exports for utilities and constants

**Barrel Files:**
- Not used - No index.ts re-exports
- Direct imports from specific files

---

*Convention analysis: 2026-01-14*
*Update when patterns change*
