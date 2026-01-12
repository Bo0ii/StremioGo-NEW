# Top Bar Elements Investigation - Summary

## What I Investigated

I analyzed the StreamGo codebase to understand why top bar elements (app icon, plus button, profile switcher) disappear when navigating away from the home page.

## Key Findings

### 1. **The Root Cause (Confirmed)**

All three injection systems make the same assumption: **`main-nav-bars-container` exists on all pages**

But this assumption may be incorrect. Here's the evidence:

**App Icon Injection** (`src/preload.ts:1485-1632`):
- Targets: `[class*="main-nav-bars-container"] [class*="horizontal-nav-bar"]`
- Uses mutation observer to re-inject when DOM changes
- **Problem**: If container doesn't exist, nothing happens

**Plus Button Injection** (`src/components/plus-page/plusPage.ts:56-147`):
- Targets: `[class*="horizontal-nav-bar-container"]` (generic - doesn't specify MAIN)
- Waits for element with `waitForElm()`
- **Problem**: May match page-specific nav bars instead of main nav
- **Problem**: Gives up after 10 attempts

**Profile Switcher** (`plugins/streamgo-profiles.plugin.js:4385-4437`):
- Targets: `.horizontal-nav-bar-container-Y_zvK` (hardcoded class)
- Uses mutation observer
- **Problem**: Fragile selector + same container assumption

**Navigation Fix Handler** (`src/preload.ts:1898-1939`):
- Runs on `hashchange` to rebuild elements
- Calls `ensureNavElementsVisible()` which has **critical early return**:

```typescript
const mainNavContainer = document.querySelector('[class*="main-nav-bars-container"]');
if (!mainNavContainer) return;  // ⚠️ STOPS HERE IF CONTAINER MISSING
```

### 2. **Multiple Nav Bars Issue**

The code tries to target the MAIN nav bar, but there may be multiple horizontal nav bars:
- One in `main-nav-bars-container` (the persistent top nav)
- One in `route-content` (page-specific nav)

When injection code doesn't specifically target the main nav, it may inject into the wrong one.

### 3. **Current Workaround Attempts**

The code already tries to handle this with:
- **Mutation observers** - Re-inject when DOM changes
- **Retry timeouts** - Keep trying if element not found
- **Clone/recreate** - Store buttons-container HTML and recreate if missing

But these workarounds don't solve the root issue:
- Observers can't observe elements that don't exist
- Retries still fail if targeting wrong container
- Cloning doesn't work if main container itself is missing

## What I Created for You

### 1. **DOM Inspector Plugin** (`plugins/dom-inspector.plugin.js`)

A debugging tool that shows you in real-time:
- Does `main-nav-bars-container` exist?
- How many horizontal nav bars are there?
- Which nav bar has buttons?
- Where are custom elements injected?
- Is main nav in route-content or separate?

**This will give you concrete data** about what's happening on each page.

### 2. **Investigation Guide** (`DOM_INVESTIGATION_GUIDE.md`)

A complete guide with:
- How to use the DOM Inspector
- What to look for on each page
- Test scenarios to run
- Questions to answer
- Expected findings based on hypotheses
- Quick console tests you can run
- Report format for documenting findings

## What You Should Do Next

### Step 1: Enable the DOM Inspector
```javascript
// In browser console on StreamGo
let plugins = JSON.parse(localStorage.getItem('enabledPlugins') || '[]');
plugins.push('dom-inspector.plugin.js');
localStorage.setItem('enabledPlugins', JSON.stringify(plugins));
location.reload();
```

### Step 2: Navigate Through Routes

Visit each route and check the inspector panel:

1. **Home**: `#/` (baseline - should work)
2. **Detail**: `#/detail/movie/tt0111161` (known to break)
3. **Player**: `#/player` (start playing something)
4. **Discover**: `#/discover`
5. **Library**: `#/library`
6. **Settings**: `#/settings`

### Step 3: Document Your Findings

For each route, answer:
- ✅/❌ Does `main-nav-bars-container` exist?
- ✅/❌ Are custom elements visible?
- 🔢 How many horizontal nav bars?
- 🟢/🟡 Where is the main nav? (main-nav or route-content?)

### Step 4: Share Results

Once you have concrete data, we can design the right fix based on what Stremio actually does:

**If main-nav doesn't exist on some pages:**
- Use fallback selectors
- Inject into body/root instead
- Use CSS to position elements

**If multiple nav bars exist:**
- Be more specific in selectors
- Prioritize main-nav over route nav
- Hide duplicate elements

**If nav gets removed/re-added:**
- Improve mutation observer
- Re-query selectors on each check
- Don't cache element references

## Quick Diagnostic Commands

### Check Main Nav Existence
```javascript
console.log('Main nav exists:', !!document.querySelector('[class*="main-nav-bars-container"]'));
```

### Count All Nav Bars
```javascript
const navBars = document.querySelectorAll('[class*="horizontal-nav-bar-container"]');
console.log('Total nav bars:', navBars.length);
navBars.forEach((nav, i) => {
    console.log(`Nav ${i}: in main=${!!nav.closest('[class*="main-nav-bars-container"]')}, in route=${!!nav.closest('[class*="route-content"]')}`);
});
```

### Check Custom Elements
```javascript
console.log('Plus button:', !!document.querySelector('#plus-nav-button'));
console.log('App icon:', !!document.querySelector('.app-icon-glass-theme'));
console.log('Profile switcher:', !!document.querySelector('.sgp-nav-profile'));
```

## Current Code Locations

For reference, here's where the key code lives:

| Component | File | Line Range |
|-----------|------|------------|
| App Icon Injection | `src/preload.ts` | 1485-1632 |
| Plus Button Injection | `src/components/plus-page/plusPage.ts` | 56-147 |
| Profile Switcher | `plugins/streamgo-profiles.plugin.js` | 4385-4437 |
| Nav Fixes Handler | `src/preload.ts` | 1898-1939 |
| Ensure Nav Visible | `src/preload.ts` | 1680-1774 |
| Constants | `src/constants/index.ts` | 1-274 |

## Hypotheses to Test

### Hypothesis A: Container Doesn't Exist
**Test**: Check if `main-nav-bars-container` exists on detail/player pages
- If YES: Container exists but elements still disappear (visibility issue)
- If NO: Container doesn't exist (injection target missing)

### Hypothesis B: Wrong Container Targeted
**Test**: Count nav bars on pages where elements disappear
- If 1: Correct container but wrong selector
- If >1: Multiple containers, injecting into wrong one

### Hypothesis C: Container Rebuilt on Navigation
**Test**: Compare main-nav element before/after navigation (same object?)
- If YES: Container persists (mutation observer should work)
- If NO: Container recreated (observer loses reference)

### Hypothesis D: Z-Index / Visibility CSS Issue
**Test**: Check if elements exist in DOM but are hidden
- If exists but hidden: CSS visibility issue
- If doesn't exist: Injection failed

## Expected Outcome

After you run the investigation, you should know EXACTLY why elements disappear:

**Scenario 1**: "main-nav-bars-container doesn't exist on detail pages"
→ **Solution**: Use alternative container or create our own persistent nav

**Scenario 2**: "Multiple nav bars exist, injecting into route-specific one"
→ **Solution**: Target main-nav specifically, ignore route navs

**Scenario 3**: "Container exists but gets hidden by Stremio CSS"
→ **Solution**: Add !important CSS overrides

**Scenario 4**: "Container gets removed/re-added, observer loses it"
→ **Solution**: Re-attach observer, don't cache element references

## Files Created

1. ✅ `plugins/dom-inspector.plugin.js` - Real-time DOM inspection tool
2. ✅ `DOM_INVESTIGATION_GUIDE.md` - Detailed investigation guide
3. ✅ `INVESTIGATION_SUMMARY.md` - This summary document

## Next Steps

1. 🔍 **Enable DOM Inspector** and navigate through routes
2. 📝 **Document findings** for each route
3. 💬 **Share results** so we can design the fix
4. 🔧 **Implement fix** based on actual behavior

---

**Ready to investigate?** Enable the DOM Inspector plugin and start navigating! The inspector panel will appear in the top-right corner showing you exactly what's happening with the navigation containers on each page.

Let me know what you find! 🚀
