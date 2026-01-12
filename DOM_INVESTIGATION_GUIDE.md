# DOM Structure Investigation Guide

## Overview
This guide helps you investigate why top bar elements (app icon, plus button, profile switcher) disappear on non-home pages in StreamGo.

## Investigation Tool

I've created a **DOM Inspector Plugin** that will help you see exactly what's happening to the DOM on different pages.

### How to Use the DOM Inspector

1. **Enable the plugin:**
   - Copy `plugins/dom-inspector.plugin.js` to your StreamGo plugins folder (or it's already there as a bundled plugin)
   - Enable it in StreamGo settings or add it to localStorage:
     ```javascript
     let plugins = JSON.parse(localStorage.getItem('enabledPlugins') || '[]');
     plugins.push('dom-inspector.plugin.js');
     localStorage.setItem('enabledPlugins', JSON.stringify(plugins));
     location.reload();
     ```

2. **Navigate through different routes:**
   - Home: `#/`
   - Discover: `#/discover`
   - Library: `#/library`
   - Calendar: `#/calendar`
   - Detail page: `#/detail/...` (click on any movie/show)
   - Player: `#/player` (start playing something)
   - Settings: `#/settings`

3. **What to look for in the inspector:**
   - **Main nav exists**: Should be "YES" on all pages
   - **Buttons in main nav**: Should be > 0 on all pages
   - **Total horizontal navbars**:
     - `1` = Good (only main nav)
     - `> 1` = Multiple nav bars (potential conflict)
   - **Nav Bars Breakdown**: Shows which nav bars are in main-nav vs route-content

## Current Implementation Analysis

### Injection Points

#### 1. **App Icon** (`preload.ts:1485-1632`)
```typescript
// Targets:
'[class*="main-nav-bars-container"] [class*="horizontal-nav-bar"]'

// Problem:
- Only injects if main-nav-bars-container exists
- Uses mutation observer to re-inject
- But if container doesn't exist, observer can't find it
```

#### 2. **Plus Button** (`plusPage.ts:56-147`)
```typescript
// Targets:
'[class*="horizontal-nav-bar-container"]'

// Problem:
- Uses waitForElm but doesn't specify MAIN nav
- May match page-specific nav bars
- Retries up to 10 times then gives up
```

#### 3. **Profile Switcher** (`streamgo-profiles.plugin.js:4385-4437`)
```typescript
// Targets:
'.horizontal-nav-bar-container-Y_zvK'

// Problem:
- Hardcoded class name (fragile)
- May match wrong nav bar
- Uses mutation observer but same issue as app icon
```

### Navigation Fix Handler (`preload.ts:1898-1939`)
```typescript
// Runs on hashchange
const handleNavFixes = (): void => {
    renameBoardToHome();
    ensureNavElementsVisible();  // ⚠️ Returns early if no main-nav
    injectAppIconInGlassTheme();
    injectPlusNavButton();
};
```

**Critical Issue in `ensureNavElementsVisible()` (line 1697-1698):**
```typescript
const mainNavContainer = document.querySelector('[class*="main-nav-bars-container"]');
if (!mainNavContainer) return;  // ⚠️ EARLY RETURN
```

## What to Test

### Test Scenarios

1. **Home Page (#/)**
   - All elements should be visible ✓
   - Main nav should exist ✓

2. **Detail Pages (#/detail/...)**
   - Check if main-nav-bars-container exists
   - Check if buttons-container exists
   - Count total horizontal nav bars (should be 1)

3. **Player (#/player)**
   - Same checks as detail pages
   - Often has different DOM structure

4. **Other Routes**
   - Discover, Library, Calendar, Settings
   - Document which routes have main-nav-bars-container

### Questions to Answer

Using the DOM Inspector, answer these questions:

1. **Does `main-nav-bars-container` exist on all pages?**
   - If NO: Which pages are missing it?

2. **When there are multiple horizontal nav bars:**
   - Which one is the "real" main nav?
   - Is one in route-content and one in main-nav?

3. **Does `buttons-container` move between nav bars?**
   - Is it always in the same place?
   - Does Stremio clone it or move it?

4. **What happens during route transitions?**
   - Does main-nav get removed and re-added?
   - Or does it persist and only route-content changes?

5. **Are custom elements getting injected into wrong nav bars?**
   - Check "Nav Bars Breakdown" section
   - Look for elements with 🟡 IN ROUTE instead of 🟢 MAIN NAV

## Expected Findings

Based on the analysis, I expect you'll find:

### Hypothesis 1: main-nav-bars-container is Conditional
- **Test**: Does main-nav exist on detail/player pages?
- **If NO**: Elements can't inject because target doesn't exist
- **Solution**: Use a fallback selector or inject into a more persistent container

### Hypothesis 2: Multiple Nav Bars Cause Conflicts
- **Test**: Count horizontal-nav-bar-container on different pages
- **If > 1**: Injection code may target the wrong one
- **Solution**: Be more specific about targeting MAIN nav (not route-specific)

### Hypothesis 3: Route-Specific Nav Bars Override Main Nav
- **Test**: Check if buttons-container exists in both main and route nav
- **If YES**: Route nav may visually hide main nav
- **Solution**: Force visibility on main nav, hide route nav buttons

### Hypothesis 4: DOM Rebuild During Navigation
- **Test**: Does main-nav-bars-container get removed/re-added on hashchange?
- **If YES**: Mutation observer loses reference
- **Solution**: Re-query selectors instead of caching references

## Recommended Next Steps

After gathering data with the DOM Inspector:

1. **Document your findings** in a text file or GitHub issue
2. **Take screenshots** of the inspector on different routes
3. **Share the findings** so we can design the right fix
4. **Test different selector strategies**:
   - Try targeting any horizontal nav (not just main)
   - Try using more persistent containers (body, root)
   - Try using CSS to force visibility instead of re-injection

## Quick Tests You Can Run

### Test 1: Does Main Nav Persist?
```javascript
// Run in console on home page
const mainNav = document.querySelector('[class*="main-nav-bars-container"]');
console.log('Main nav exists:', !!mainNav);

// Navigate to detail page
location.hash = '#/detail/movie/tt0111161';

// Check again after 1 second
setTimeout(() => {
    const mainNav2 = document.querySelector('[class*="main-nav-bars-container"]');
    console.log('Main nav still exists:', !!mainNav2);
    console.log('Same element?', mainNav === mainNav2);
}, 1000);
```

### Test 2: Count Nav Bars on Each Page
```javascript
// Run on different pages
const navBars = document.querySelectorAll('[class*="horizontal-nav-bar-container"]');
console.log('Nav bars found:', navBars.length);
navBars.forEach((nav, i) => {
    const inMain = !!nav.closest('[class*="main-nav-bars-container"]');
    const inRoute = !!nav.closest('[class*="route-content"]');
    console.log(`Nav ${i}:`, { inMain, inRoute });
});
```

### Test 3: Watch for DOM Changes
```javascript
// Run this to see when main-nav changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.removedNodes.forEach((node) => {
                if (node.className && node.className.includes('main-nav')) {
                    console.log('⚠️ MAIN NAV REMOVED');
                }
            });
            mutation.addedNodes.forEach((node) => {
                if (node.className && node.className.includes('main-nav')) {
                    console.log('✓ MAIN NAV ADDED');
                }
            });
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
});

// Navigate around and watch console
```

## Reporting Results

When reporting your findings, please include:

1. **Route tested** (e.g., #/detail/movie/tt0111161)
2. **Main nav exists?** (Yes/No)
3. **Total horizontal nav bars** (number)
4. **Buttons in main nav** (number)
5. **Custom elements visible?** (Plus button, App icon, Profile switcher)
6. **Screenshot of DOM Inspector** (optional but helpful)

## Example Report Format

```
Route: #/detail/movie/tt0111161
Main nav exists: NO
Total horizontal navbars: 1
Buttons in main nav: 0
Plus button visible: NO
App icon visible: NO
Profile switcher visible: NO

Notes:
- Only one horizontal nav bar found
- It's inside route-content, not main-nav-bars-container
- No main-nav-bars-container in the DOM at all
- This explains why elements don't inject
```

---

## Summary

The DOM Inspector will help you answer the key question:

**"Why does the main navigation container disappear or change on non-home pages?"**

Once we know the answer, we can implement the right fix:
- If main-nav doesn't exist: Use alternative selectors
- If multiple nav bars exist: Target more specifically
- If nav gets rebuilt: Improve mutation observer
- If route nav overrides: Use CSS z-index fixes

Good luck with the investigation! 🔍
