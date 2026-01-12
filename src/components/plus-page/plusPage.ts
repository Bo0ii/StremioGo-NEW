import TemplateCache from '../../utils/templateCache';
import Helpers from '../../utils/Helpers';
import logger from '../../utils/logger';
import properties from '../../core/Properties';
import { STORAGE_KEYS, CLASSES, PLAYER_DEFAULTS, FILE_EXTENSIONS } from '../../constants';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const HORIZONTAL_NAV_SELECTOR = '[class*="horizontal-nav-bar-container"]';

// Category content generators
type CategoryGenerator = () => string;

const categoryContent: Record<string, CategoryGenerator> = {
	themes: getThemesContent,
	plugins: getPluginsContent,
	tweaks: getTweaksContent,
	appearance: getAppearanceContent,
	about: getAboutContent,
};

export function getPlusPageTemplate(): string {
	return TemplateCache.load(__dirname, 'plus-page');
}

export function handlePlusRoute(): boolean {
	if (!location.hash.startsWith('#/plus')) {
		// Not on Plus page - clean up overlay if it exists
		const overlay = document.getElementById('plus-page-overlay');
		if (overlay) {
			overlay.remove();
		}
		updatePlusButtonSelectedState();
		return false;
	}

	logger.info("[Plus] Handling Plus page route (direct URL navigation)");

	// Check if Plus page already rendered
	if (document.getElementById('plus-page-overlay')) {
		updatePlusButtonSelectedState();
		return true;
	}

	// Navigate to Plus page using overlay
	navigateToPlusPage();

	return true;
}

// Track injection attempts to avoid infinite loops
let plusButtonInjectionAttempts = 0;
const MAX_INJECTION_ATTEMPTS = 10;

export function injectPlusNavButton(): void {
	// Check if already injected
	if (document.getElementById('plus-nav-button')) {
		updatePlusButtonSelectedState();
		return;
	}

	// Prevent infinite retries
	if (plusButtonInjectionAttempts >= MAX_INJECTION_ATTEMPTS) {
		logger.warn("[Plus] Max injection attempts reached, giving up");
		return;
	}

	plusButtonInjectionAttempts++;

	// Find the Settings link in ANY visible nav bar
	const allNavBars = document.querySelectorAll(HORIZONTAL_NAV_SELECTOR);
	let settingsLink: Element | null = null;
	let targetNavBar: HTMLElement | undefined;

	for (let i = 0; i < allNavBars.length; i++) {
		const navBar = allNavBars[i] as HTMLElement;
		const rect = navBar.getBoundingClientRect();

		// Only check visible nav bars
		if (rect.width > 0 && rect.height > 0) {
			const link = navBar.querySelector('a[href="#/settings"]');
			if (link) {
				settingsLink = link;
				targetNavBar = navBar;
				break;
			}
		}
	}

	// If Settings link not found in any visible nav bar, retry
	if (!settingsLink || !targetNavBar) {
		logger.info("[Plus] Settings link not found in visible nav bars, retrying...");
		setTimeout(() => injectPlusNavButton(), 300);
		return;
	}

	// Create Plus nav button
	const plusButton = document.createElement('a');
	plusButton.id = 'plus-nav-button';
	plusButton.href = '#/plus';
	plusButton.setAttribute('tabindex', '0');
	plusButton.setAttribute('title', 'StreamGo Plus');

	// Copy class from Settings link for consistent styling
	plusButton.className = settingsLink.className;

	// Clone the inner structure from Settings link to match exactly
	const settingsInner = settingsLink.innerHTML;
	// Replace "Settings" text with "Plus"
	plusButton.innerHTML = settingsInner.replace(/Settings/gi, 'Plus');

	// If there's an SVG icon, replace it with Plus icon or remove it
	const existingSvg = plusButton.querySelector('svg');
	if (existingSvg) {
		existingSvg.remove();
	}

	// Ensure the Plus button inherits proper color (not default blue link color)
	plusButton.style.color = 'inherit';
	plusButton.style.textDecoration = 'none';

	// CRITICAL: Add click handler to prevent Stremio's router from handling the navigation
	plusButton.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		navigateToPlusPage();
	});

	// Insert AFTER Settings link (to the right of it)
	if (settingsLink.parentElement) {
		settingsLink.parentElement.insertBefore(plusButton, settingsLink.nextSibling);
		logger.info("[Plus] Plus nav button injected after Settings");
		plusButtonInjectionAttempts = 0; // Reset on success
	} else {
		// Fallback: append to target nav bar
		targetNavBar.appendChild(plusButton);
		logger.info("[Plus] Plus nav button appended to nav bar");
		plusButtonInjectionAttempts = 0;
	}

	// Handle selected state based on current route
	updatePlusButtonSelectedState();
}

// Reset injection attempts when called externally (e.g., on navigation)
export function resetPlusButtonInjection(): void {
	plusButtonInjectionAttempts = 0;
}

function updatePlusButtonSelectedState(): void {
	const plusButton = document.getElementById('plus-nav-button');
	if (!plusButton) return;

	const isOnPlusPage = location.hash.startsWith('#/plus') ||
		document.getElementById('plus-page-overlay') !== null ||
		document.getElementById('plus-page-container') !== null;

	if (isOnPlusPage) {
		plusButton.classList.add('selected');
	} else {
		plusButton.classList.remove('selected');
	}
}

/**
 * Navigate to Plus page using an overlay that sits below the nav bar
 */
function navigateToPlusPage(): void {
	logger.info("[Plus] Navigating to Plus page directly");

	// Check if already on Plus page
	if (document.getElementById('plus-page-overlay')) {
		logger.info("[Plus] Already on Plus page");
		return;
	}

	// Create full-screen overlay with our own topbar
	const overlay = document.createElement('div');
	overlay.id = 'plus-page-overlay';
	overlay.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		background: #0f0f11;
		overflow: hidden;
	`;
	overlay.innerHTML = getPlusPageTemplate();
	document.body.appendChild(overlay);

	// Setup sidebar navigation
	setupSidebarNavigation();

	// Load initial category (themes by default)
	activateCategory('themes');

	// Update Plus button selected state
	updatePlusButtonSelectedState();

	// Update URL without triggering Stremio's router
	if (!location.hash.startsWith('#/plus')) {
		history.pushState({ page: 'plus' }, '', '#/plus');
	}

	logger.info("[Plus] Plus page rendered successfully via overlay");
}

function setupSidebarNavigation(): void {
	// Setup sidebar category navigation
	const sidebarItems = document.querySelectorAll('.plus-sidebar-item');
	sidebarItems.forEach(item => {
		item.addEventListener('click', () => {
			const category = item.getAttribute('data-category');
			if (category) {
				activateCategory(category);
			}
		});
	});

	// Setup back button
	const backBtn = document.getElementById('plus-back-btn');
	if (backBtn) {
		backBtn.addEventListener('click', (e) => {
			e.preventDefault();
			navigateAwayFromPlus('#/');
		});
	}

	// Setup top navigation links
	const topNavLinks = document.querySelectorAll('.plus-topbar-link');
	topNavLinks.forEach(link => {
		link.addEventListener('click', (e) => {
			e.preventDefault();
			const href = link.getAttribute('href');
			if (href) {
				navigateAwayFromPlus(href);
			}
		});
	});
}

/**
 * Clean up Plus page overlay and navigate to a new route
 */
function navigateAwayFromPlus(targetHash: string): void {
	// Remove the Plus page overlay
	const overlay = document.getElementById('plus-page-overlay');
	if (overlay) {
		overlay.remove();
	}

	// Update the Plus button state
	updatePlusButtonSelectedState();

	// Navigate to the target
	location.hash = targetHash;
}

function activateCategory(category: string): void {
	// Update sidebar active state
	const sidebarItems = document.querySelectorAll('.plus-sidebar-item');
	sidebarItems.forEach(item => {
		item.classList.remove('active');
		if (item.getAttribute('data-category') === category) {
			item.classList.add('active');
		}
	});

	// Update content
	const contentArea = document.getElementById('plus-content');
	if (!contentArea) return;

	const generator = categoryContent[category];
	if (generator) {
		contentArea.innerHTML = generator();
		setupCategoryControls(category);
	}

	logger.info(`[Plus] Activated category: ${category}`);
}

function setupCategoryControls(category: string): void {
	switch (category) {
		case 'themes':
			setupThemesControls();
			break;
		case 'plugins':
			setupPluginsControls();
			break;
		case 'tweaks':
			setupTweaksControls();
			break;
		case 'appearance':
			setupAppearanceControls();
			break;
		case 'about':
			setupAboutControls();
			break;
	}
}

// ==================== THEMES ====================
function getThemesContent(): string {
	return `
		<div class="plus-content-header">
			<h1>Themes</h1>
			<p>Customize the look and feel of StreamGo with community themes</p>
		</div>

		<div class="plus-search-bar">
			<input type="text" class="plus-search-input" id="plus-themes-search" placeholder="Search themes...">
			<a href="https://github.com/REVENGE977/stremio-enhanced-registry" target="_blank" rel="noreferrer" class="plus-btn">
				<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
					<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
				</svg>
				Submit Theme
			</a>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Available Themes</div>
			<div id="plus-themes-list" class="plus-mods-container">
				<!-- Themes will be loaded dynamically -->
				<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">
					Loading themes...
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Open Themes Folder</div>
						<div class="plus-option-description">Access your local themes directory to add custom themes</div>
					</div>
					<button class="plus-btn" id="plus-open-themes-folder">
						<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
							<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
						</svg>
						Open Folder
					</button>
				</div>
			</div>
		</div>
	`;
}

function setupThemesControls(): void {
	// Search functionality
	const searchInput = document.getElementById('plus-themes-search') as HTMLInputElement;
	if (searchInput) {
		searchInput.addEventListener('input', () => {
			filterMods('themes', searchInput.value);
		});
	}

	// Open folder button
	const openFolderBtn = document.getElementById('plus-open-themes-folder');
	if (openFolderBtn) {
		openFolderBtn.addEventListener('click', () => {
			if (typeof window.openThemesFolder === 'function') {
				window.openThemesFolder();
			}
		});
	}

	// Load themes list
	loadThemesList();
}

async function loadThemesList(): Promise<void> {
	const container = document.getElementById('plus-themes-list');
	if (!container) return;

	try {
		// Get themes from both user and bundled directories
		const [userThemes, bundledThemes] = await Promise.all([
			existsSync(properties.themesPath)
				? readdir(properties.themesPath).then(files => files.filter(f => f.endsWith(FILE_EXTENSIONS.THEME)))
				: Promise.resolve([]),
			existsSync(properties.bundledThemesPath)
				? readdir(properties.bundledThemesPath).then(files => files.filter(f => f.endsWith(FILE_EXTENSIONS.THEME)))
				: Promise.resolve([])
		]);

		// Combine and dedupe (user themes take priority)
		const allThemes = [...new Set([...userThemes, ...bundledThemes])];

		if (allThemes.length === 0) {
			container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">No themes found</div>';
			return;
		}

		const currentTheme = localStorage.getItem(STORAGE_KEYS.CURRENT_THEME) || '';
		let html = '';

		for (const theme of allThemes) {
			const userPath = join(properties.themesPath, theme);
			const bundledPath = join(properties.bundledThemesPath, theme);
			const themePath = existsSync(userPath) ? userPath : bundledPath;

			const metaData = Helpers.extractMetadataFromFile(themePath);
			if (!metaData || !metaData.name) continue;

			const isApplied = currentTheme === theme;
			const isLocked = theme === 'liquid-glass.theme.css';

			html += `
				<div class="plus-mod-item" data-mod-name="${metaData.name}" data-mod-description="${metaData.description || ''}">
					<div class="plus-mod-info">
						<div class="plus-mod-name">${metaData.name}${isLocked ? ' <span style="color: #f5bf42; font-size: 11px;">(Locked)</span>' : ''}</div>
						<div class="plus-mod-meta">v${metaData.version || '1.0'} by ${metaData.author || 'Unknown'}</div>
						<div class="plus-mod-description">${metaData.description || 'No description'}</div>
					</div>
					<button class="plus-btn ${isApplied ? 'plus-btn-primary' : ''}"
							onclick="applyTheme('${theme}')"
							${isLocked && isApplied ? 'disabled' : ''}>
						${isApplied ? 'Applied' : 'Apply'}
					</button>
				</div>
			`;
		}

		container.innerHTML = html || '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">No themes found</div>';
		logger.info(`[Plus] Loaded ${allThemes.length} themes`);
	} catch (err) {
		container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">Error loading themes</div>';
		logger.error(`[Plus] Error loading themes: ${err}`);
	}
}

// ==================== PLUGINS ====================
function getPluginsContent(): string {
	return `
		<div class="plus-content-header">
			<h1>Plugins</h1>
			<p>Extend StreamGo functionality with community plugins</p>
		</div>

		<div class="plus-search-bar">
			<input type="text" class="plus-search-input" id="plus-plugins-search" placeholder="Search plugins...">
			<a href="https://github.com/REVENGE977/stremio-enhanced-registry" target="_blank" rel="noreferrer" class="plus-btn">
				<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
					<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
				</svg>
				Submit Plugin
			</a>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Available Plugins</div>
			<div id="plus-plugins-list" class="plus-mods-container">
				<!-- Plugins will be loaded dynamically -->
				<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">
					Loading plugins...
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Open Plugins Folder</div>
						<div class="plus-option-description">Access your local plugins directory to add custom plugins</div>
					</div>
					<button class="plus-btn" id="plus-open-plugins-folder">
						<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
							<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
						</svg>
						Open Folder
					</button>
				</div>
			</div>
		</div>
	`;
}

function setupPluginsControls(): void {
	// Search functionality
	const searchInput = document.getElementById('plus-plugins-search') as HTMLInputElement;
	if (searchInput) {
		searchInput.addEventListener('input', () => {
			filterMods('plugins', searchInput.value);
		});
	}

	// Open folder button
	const openFolderBtn = document.getElementById('plus-open-plugins-folder');
	if (openFolderBtn) {
		openFolderBtn.addEventListener('click', () => {
			if (typeof window.openPluginsFolder === 'function') {
				window.openPluginsFolder();
			}
		});
	}

	// Load plugins list
	loadPluginsList();
}

async function loadPluginsList(): Promise<void> {
	const container = document.getElementById('plus-plugins-list');
	if (!container) return;

	try {
		// Get plugins from both user and bundled directories
		const [userPlugins, bundledPlugins] = await Promise.all([
			existsSync(properties.pluginsPath)
				? readdir(properties.pluginsPath).then(files => files.filter(f => f.endsWith(FILE_EXTENSIONS.PLUGIN)))
				: Promise.resolve([]),
			existsSync(properties.bundledPluginsPath)
				? readdir(properties.bundledPluginsPath).then(files => files.filter(f => f.endsWith(FILE_EXTENSIONS.PLUGIN)))
				: Promise.resolve([])
		]);

		// Combine and dedupe (user plugins take priority)
		const allPlugins = [...new Set([...userPlugins, ...bundledPlugins])];

		if (allPlugins.length === 0) {
			container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">No plugins found</div>';
			return;
		}

		// Get enabled plugins from localStorage
		const enabledPluginsStr = localStorage.getItem(STORAGE_KEYS.ENABLED_PLUGINS) || '[]';
		let enabledPlugins: string[] = [];
		try {
			enabledPlugins = JSON.parse(enabledPluginsStr);
		} catch {
			enabledPlugins = [];
		}

		let html = '';

		for (const plugin of allPlugins) {
			const userPath = join(properties.pluginsPath, plugin);
			const bundledPath = join(properties.bundledPluginsPath, plugin);
			const pluginPath = existsSync(userPath) ? userPath : bundledPath;

			const metaData = Helpers.extractMetadataFromFile(pluginPath);
			if (!metaData || !metaData.name) continue;

			const isEnabled = enabledPlugins.includes(plugin);

			html += `
				<div class="plus-mod-item" data-mod-name="${metaData.name}" data-mod-description="${metaData.description || ''}" data-plugin-file="${plugin}">
					<div class="plus-mod-info">
						<div class="plus-mod-name">${metaData.name}</div>
						<div class="plus-mod-meta">v${metaData.version || '1.0'} by ${metaData.author || 'Unknown'}</div>
						<div class="plus-mod-description">${metaData.description || 'No description'}</div>
					</div>
					<div class="plus-mod-controls">
						<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${isEnabled ? CLASSES.CHECKED : ''}"
							 data-plugin-toggle="${plugin}" style="outline: none; flex-shrink: 0;">
							<div class="toggle-toOWM"></div>
						</div>
					</div>
				</div>
			`;
		}

		container.innerHTML = html || '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">No plugins found</div>';

		// Setup plugin toggle handlers
		setupPluginToggles();

		logger.info(`[Plus] Loaded ${allPlugins.length} plugins`);
	} catch (err) {
		container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">Error loading plugins</div>';
		logger.error(`[Plus] Error loading plugins: ${err}`);
	}
}

function setupPluginToggles(): void {
	const toggles = document.querySelectorAll('[data-plugin-toggle]');
	toggles.forEach(toggle => {
		toggle.addEventListener('click', () => {
			const pluginFile = toggle.getAttribute('data-plugin-toggle');
			if (!pluginFile) return;

			toggle.classList.toggle(CLASSES.CHECKED);
			const isEnabled = toggle.classList.contains(CLASSES.CHECKED);

			// Update localStorage
			const enabledPluginsStr = localStorage.getItem(STORAGE_KEYS.ENABLED_PLUGINS) || '[]';
			let enabledPlugins: string[] = [];
			try {
				enabledPlugins = JSON.parse(enabledPluginsStr);
			} catch {
				enabledPlugins = [];
			}

			if (isEnabled && !enabledPlugins.includes(pluginFile)) {
				enabledPlugins.push(pluginFile);
			} else if (!isEnabled) {
				enabledPlugins = enabledPlugins.filter(p => p !== pluginFile);
			}

			localStorage.setItem(STORAGE_KEYS.ENABLED_PLUGINS, JSON.stringify(enabledPlugins));
			logger.info(`[Plus] Plugin ${pluginFile} ${isEnabled ? 'enabled' : 'disabled'}`);

			// Show reload notice
			showReloadNotice();
		});
	});
}

function showReloadNotice(): void {
	// Check if notice already exists
	if (document.getElementById('plus-reload-notice')) return;

	const notice = document.createElement('div');
	notice.id = 'plus-reload-notice';
	notice.style.cssText = `
		position: fixed;
		bottom: 20px;
		right: 20px;
		background: rgba(123, 91, 245, 0.95);
		color: white;
		padding: 16px 24px;
		border-radius: 12px;
		font-size: 14px;
		z-index: 10000;
		box-shadow: 0 4px 20px rgba(0,0,0,0.3);
		display: flex;
		align-items: center;
		gap: 12px;
	`;
	notice.innerHTML = `
		<span>Reload page to apply plugin changes</span>
		<button onclick="location.reload()" style="
			background: white;
			color: #7b5bf5;
			border: none;
			padding: 8px 16px;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
		">Reload</button>
	`;
	document.body.appendChild(notice);
}

function filterMods(type: string, query: string): void {
	const listId = type === 'themes' ? 'plus-themes-list' : 'plus-plugins-list';
	const container = document.getElementById(listId);
	if (!container) return;

	const items = container.querySelectorAll('[data-mod-name]');
	const lowerQuery = query.toLowerCase();

	items.forEach(item => {
		const name = item.getAttribute('data-mod-name')?.toLowerCase() || '';
		const description = item.getAttribute('data-mod-description')?.toLowerCase() || '';
		const matches = name.includes(lowerQuery) || description.includes(lowerQuery);
		(item as HTMLElement).style.display = matches ? '' : 'none';
	});
}

// ==================== TWEAKS ====================
function getTweaksContent(): string {
	const performanceMode = localStorage.getItem(STORAGE_KEYS.PERFORMANCE_MODE) === 'true';
	const fullHeightBackground = localStorage.getItem(STORAGE_KEYS.FULL_HEIGHT_BACKGROUND) === 'true';
	const hidePosterHover = localStorage.getItem(STORAGE_KEYS.HIDE_POSTER_HOVER) === 'true';
	const hideContextDots = localStorage.getItem(STORAGE_KEYS.HIDE_CONTEXT_DOTS) === 'true';
	const roundedPosters = localStorage.getItem(STORAGE_KEYS.ROUNDED_POSTERS) === 'true';
	const ambilightEnabled = localStorage.getItem(STORAGE_KEYS.AMBILIGHT_ENABLED) === 'true';
	const skipIntroSeconds = localStorage.getItem(STORAGE_KEYS.SKIP_INTRO_SECONDS) || PLAYER_DEFAULTS.SKIP_INTRO_SECONDS;
	const subtitleFontSize = localStorage.getItem(STORAGE_KEYS.SUBTITLE_FONT_SIZE) || PLAYER_DEFAULTS.SUBTITLE_FONT_SIZE;
	const subtitleColor = localStorage.getItem(STORAGE_KEYS.SUBTITLE_COLOR) || PLAYER_DEFAULTS.SUBTITLE_COLOR;
	const subtitleBgOpacity = localStorage.getItem(STORAGE_KEYS.SUBTITLE_BG_COLOR) ? parseInt(localStorage.getItem(STORAGE_KEYS.SUBTITLE_BG_COLOR)!.match(/[\d.]+(?=\))/)?.[0] || '80') : 80;

	return `
		<div class="plus-content-header">
			<h1>Tweaks</h1>
			<p>Fine-tune the interface and player behavior</p>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Interface</div>
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Performance Mode</div>
						<div class="plus-option-description">Disable blur effects and reduce animations for better performance</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${performanceMode ? CLASSES.CHECKED : ''}" id="plus-performanceMode">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Movie Background Full Height</div>
						<div class="plus-option-description">Extend movie/show background to fill the entire screen</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${fullHeightBackground ? CLASSES.CHECKED : ''}" id="plus-fullHeightBackground">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Hide Poster Hover Effects</div>
						<div class="plus-option-description">Remove hover background effects on movie/show posters</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${hidePosterHover ? CLASSES.CHECKED : ''}" id="plus-hidePosterHover">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Hide Context Menu Dots</div>
						<div class="plus-option-description">Hide the 3-dot context menu on posters</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${hideContextDots ? CLASSES.CHECKED : ''}" id="plus-hideContextDots">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Rounded Poster Corners</div>
						<div class="plus-option-description">Add rounded corners to poster images</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${roundedPosters ? CLASSES.CHECKED : ''}" id="plus-roundedPosters">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Player</div>
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Ambilight Effect</div>
						<div class="plus-option-description">Projects video edge colors as a glow around the window border</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${ambilightEnabled ? CLASSES.CHECKED : ''}" id="plus-ambilight">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Skip Intro Duration</div>
						<div class="plus-option-description">Seconds to skip when pressing Skip Intro</div>
					</div>
					<div class="plus-range-container">
						<input type="number" id="plus-skipIntro" value="${skipIntroSeconds}" min="30" max="180"
							style="width: 70px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
							border-radius: 6px; padding: 8px 12px; color: white; font-size: 14px; text-align: center;">
						<span style="color: rgba(255,255,255,0.5);">seconds</span>
					</div>
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Subtitles</div>
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Subtitle Font Size</div>
						<div class="plus-option-description">Adjust the size of subtitle text</div>
					</div>
					<div class="plus-range-container">
						<input type="range" id="plus-subtitleSize" min="16" max="48" value="${subtitleFontSize}">
						<span class="plus-range-value" id="plus-subtitleSizeValue">${subtitleFontSize}px</span>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Subtitle Color</div>
						<div class="plus-option-description">Choose subtitle text color</div>
					</div>
					<div style="display: flex; align-items: center; gap: 12px;">
						<input type="color" id="plus-subtitleColor" value="${subtitleColor}"
							style="width: 40px; height: 32px; border: none; border-radius: 6px; cursor: pointer; background: transparent;">
						<span id="plus-subtitleColorValue" style="color: rgba(255,255,255,0.5); font-size: 13px;">${subtitleColor}</span>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Subtitle Background Opacity</div>
						<div class="plus-option-description">Adjust the opacity of subtitle background</div>
					</div>
					<div class="plus-range-container">
						<input type="range" id="plus-subtitleBgOpacity" min="0" max="100" value="${subtitleBgOpacity}">
						<span class="plus-range-value" id="plus-subtitleBgOpacityValue">${subtitleBgOpacity}%</span>
					</div>
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Keyboard Shortcuts</div>
			<div class="plus-card">
				<div class="plus-shortcuts-grid">
					<div class="plus-shortcut-item"><span>Screenshot</span><kbd>S</kbd></div>
					<div class="plus-shortcut-item"><span>Picture-in-Picture</span><kbd>P</kbd></div>
					<div class="plus-shortcut-item"><span>Speed Down</span><kbd>[</kbd></div>
					<div class="plus-shortcut-item"><span>Speed Up</span><kbd>]</kbd></div>
					<div class="plus-shortcut-item"><span>Skip Intro</span><kbd>Shift + Left</kbd></div>
					<div class="plus-shortcut-item"><span>Skip Outro</span><kbd>Shift + Right</kbd></div>
					<div class="plus-shortcut-item"><span>Sub Delay -</span><kbd>G</kbd></div>
					<div class="plus-shortcut-item"><span>Sub Delay +</span><kbd>H</kbd></div>
				</div>
			</div>
		</div>
	`;
}

function setupTweaksControls(): void {
	// Interface toggles
	setupToggle('plus-performanceMode', STORAGE_KEYS.PERFORMANCE_MODE, applyTweaks);
	setupToggle('plus-fullHeightBackground', STORAGE_KEYS.FULL_HEIGHT_BACKGROUND, applyTweaks);
	setupToggle('plus-hidePosterHover', STORAGE_KEYS.HIDE_POSTER_HOVER, applyTweaks);
	setupToggle('plus-hideContextDots', STORAGE_KEYS.HIDE_CONTEXT_DOTS, applyTweaks);
	setupToggle('plus-roundedPosters', STORAGE_KEYS.ROUNDED_POSTERS, applyTweaks);

	// Player toggles
	setupToggle('plus-ambilight', STORAGE_KEYS.AMBILIGHT_ENABLED);

	// Skip intro duration
	const skipIntroInput = document.getElementById('plus-skipIntro') as HTMLInputElement;
	if (skipIntroInput) {
		skipIntroInput.addEventListener('change', () => {
			let value = parseInt(skipIntroInput.value);
			value = Math.max(30, Math.min(180, value));
			skipIntroInput.value = value.toString();
			localStorage.setItem(STORAGE_KEYS.SKIP_INTRO_SECONDS, value.toString());
		});
	}

	// Subtitle controls
	setupRangeWithValue('plus-subtitleSize', 'plus-subtitleSizeValue', 'px', STORAGE_KEYS.SUBTITLE_FONT_SIZE);
	setupRangeWithValue('plus-subtitleBgOpacity', 'plus-subtitleBgOpacityValue', '%', null, (value) => {
		const opacity = parseInt(value) / 100;
		localStorage.setItem(STORAGE_KEYS.SUBTITLE_BG_COLOR, `rgba(0,0,0,${opacity})`);
	});

	const subtitleColorInput = document.getElementById('plus-subtitleColor') as HTMLInputElement;
	const subtitleColorValue = document.getElementById('plus-subtitleColorValue');
	if (subtitleColorInput && subtitleColorValue) {
		subtitleColorInput.addEventListener('input', () => {
			subtitleColorValue.textContent = subtitleColorInput.value;
			localStorage.setItem(STORAGE_KEYS.SUBTITLE_COLOR, subtitleColorInput.value);
		});
	}
}

// ==================== APPEARANCE ====================
function getAppearanceContent(): string {
	const darkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true';
	const accentColor = localStorage.getItem(STORAGE_KEYS.ACCENT_COLOR) || '#7b5bf5';

	return `
		<div class="plus-content-header">
			<h1>Appearance</h1>
			<p>Customize colors and visual style</p>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Theme</div>
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Dark Mode</div>
						<div class="plus-option-description">Enable a softer dark gray appearance</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${darkMode ? CLASSES.CHECKED : ''}" id="plus-darkMode">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Accent Color</div>
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Preset Colors</div>
						<div class="plus-option-description">Choose from predefined accent colors</div>
					</div>
					<div class="plus-color-options" id="plus-accentColorPicker">
						<div class="plus-color-option ${accentColor === '#7b5bf5' ? 'selected' : ''}" data-color="#7b5bf5" title="Purple (Default)" style="background-color: #7b5bf5;"></div>
						<div class="plus-color-option ${accentColor === '#3b82f6' ? 'selected' : ''}" data-color="#3b82f6" title="Blue" style="background-color: #3b82f6;"></div>
						<div class="plus-color-option ${accentColor === '#10b981' ? 'selected' : ''}" data-color="#10b981" title="Green" style="background-color: #10b981;"></div>
						<div class="plus-color-option ${accentColor === '#ef4444' ? 'selected' : ''}" data-color="#ef4444" title="Red" style="background-color: #ef4444;"></div>
						<div class="plus-color-option ${accentColor === '#f97316' ? 'selected' : ''}" data-color="#f97316" title="Orange" style="background-color: #f97316;"></div>
						<div class="plus-color-option ${accentColor === '#ec4899' ? 'selected' : ''}" data-color="#ec4899" title="Pink" style="background-color: #ec4899;"></div>
						<div class="plus-color-option ${accentColor === '#06b6d4' ? 'selected' : ''}" data-color="#06b6d4" title="Cyan" style="background-color: #06b6d4;"></div>
						<div class="plus-color-option ${accentColor === '#8b5cf6' ? 'selected' : ''}" data-color="#8b5cf6" title="Violet" style="background-color: #8b5cf6;"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Custom Color</div>
						<div class="plus-option-description">Pick any color you want</div>
					</div>
					<div style="display: flex; align-items: center; gap: 12px;">
						<input type="color" id="plus-customAccentColor" value="${accentColor}"
							style="width: 40px; height: 32px; border: none; border-radius: 6px; cursor: pointer; background: transparent;">
						<input type="text" id="plus-customAccentColorText" value="${accentColor}"
							style="width: 90px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
							border-radius: 6px; padding: 8px 12px; color: white; font-size: 13px;">
						<button class="plus-btn" id="plus-resetAccentColor">Reset</button>
					</div>
				</div>
			</div>
		</div>
	`;
}

function setupAppearanceControls(): void {
	// Dark mode toggle
	setupToggle('plus-darkMode', STORAGE_KEYS.DARK_MODE, applyAppearance);

	// Accent color picker
	const colorOptions = document.querySelectorAll('.plus-color-option');
	colorOptions.forEach(option => {
		option.addEventListener('click', () => {
			const color = option.getAttribute('data-color');
			if (color) {
				setAccentColor(color);
				updateColorSelection(color);
			}
		});
	});

	// Custom color picker
	const customColorPicker = document.getElementById('plus-customAccentColor') as HTMLInputElement;
	const customColorText = document.getElementById('plus-customAccentColorText') as HTMLInputElement;

	if (customColorPicker) {
		customColorPicker.addEventListener('input', () => {
			const color = customColorPicker.value;
			setAccentColor(color);
			if (customColorText) customColorText.value = color;
			updateColorSelection(color);
		});
	}

	if (customColorText) {
		customColorText.addEventListener('change', () => {
			const color = customColorText.value;
			if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
				setAccentColor(color);
				if (customColorPicker) customColorPicker.value = color;
				updateColorSelection(color);
			}
		});
	}

	// Reset button
	const resetBtn = document.getElementById('plus-resetAccentColor');
	if (resetBtn) {
		resetBtn.addEventListener('click', () => {
			const defaultColor = '#7b5bf5';
			setAccentColor(defaultColor);
			if (customColorPicker) customColorPicker.value = defaultColor;
			if (customColorText) customColorText.value = defaultColor;
			updateColorSelection(defaultColor);
		});
	}
}

function updateColorSelection(selectedColor: string): void {
	const colorOptions = document.querySelectorAll('.plus-color-option');
	colorOptions.forEach(option => {
		const color = option.getAttribute('data-color');
		option.classList.toggle('selected', color === selectedColor);
	});
}

function setAccentColor(color: string): void {
	localStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, color);
	document.documentElement.style.setProperty('--accent-color', color);
	applyAppearance();
}

// ==================== ABOUT ====================
function getAboutContent(): string {
	const version = typeof window.getAppVersion === 'function' ? window.getAppVersion() : '1.0.0';
	const checkUpdatesOnStartup = localStorage.getItem(STORAGE_KEYS.CHECK_UPDATES_ON_STARTUP) !== 'false';
	const discordRPC = localStorage.getItem(STORAGE_KEYS.DISCORD_RPC) === 'true';
	const windowTransparency = localStorage.getItem('enableTransparentThemes') === 'true';
	const externalPlayerPath = localStorage.getItem(STORAGE_KEYS.EXTERNAL_PLAYER_PATH) || '';

	return `
		<div class="plus-content-header">
			<h1>About</h1>
			<p>StreamGo information and settings</p>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">App Information</div>
			<div class="plus-card">
				<div class="plus-info-row">
					<svg viewBox="0 0 24 24" style="fill: currentColor;">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
					</svg>
					<span>Version: <strong style="color: white;">v${version}</strong></span>
				</div>
				<div class="plus-info-row">
					<svg viewBox="0 0 24 24" style="fill: currentColor;">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
					</svg>
					<span>Developed by: <a href="https://github.com/Bo0ii" target="_blank" rel="noreferrer">bo0ii</a></span>
				</div>
				<div class="plus-info-row">
					<svg viewBox="0 0 24 24" style="fill: currentColor;">
						<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
					</svg>
					<span>Credits: <strong style="color: white;">REVENGE977</strong></span>
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Settings</div>
			<div class="plus-card">
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Check for updates on startup</div>
						<div class="plus-option-description">Automatically check for new versions when the app starts</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${checkUpdatesOnStartup ? CLASSES.CHECKED : ''}" id="plus-checkUpdates">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Discord Rich Presence</div>
						<div class="plus-option-description">Show what you're watching on your Discord profile</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${discordRPC ? CLASSES.CHECKED : ''}" id="plus-discordRPC">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">Window Transparency</div>
						<div class="plus-option-description">Enable for themes that support transparency (experimental)</div>
					</div>
					<div tabindex="-1" class="toggle-container-lZfHP button-container-zVLH6 ${windowTransparency ? CLASSES.CHECKED : ''}" id="plus-transparency">
						<div class="toggle-toOWM"></div>
					</div>
				</div>
				<div class="plus-option">
					<div class="plus-option-info">
						<div class="plus-option-label">External Player Path</div>
						<div class="plus-option-description">Leave empty for auto-detection</div>
					</div>
					<div style="display: flex; gap: 10px; align-items: center;">
						<input type="text" id="plus-externalPlayerPath" value="${externalPlayerPath}" placeholder="Auto-detect"
							style="flex: 1; max-width: 200px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
							border-radius: 6px; padding: 8px 12px; color: white; font-size: 13px;">
						<button class="plus-btn" id="plus-browsePlayerPath">Browse</button>
					</div>
				</div>
			</div>
		</div>

		<div class="plus-section">
			<div class="plus-section-title">Actions</div>
			<div class="plus-card" style="display: flex; gap: 12px; flex-wrap: wrap;">
				<button class="plus-btn plus-btn-primary" id="plus-communityMarketplace">
					<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
					</svg>
					Community Marketplace
				</button>
				<button class="plus-btn" id="plus-checkForUpdates">
					<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
						<path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12z"/>
					</svg>
					Check For Updates
				</button>
			</div>
		</div>
	`;
}

function setupAboutControls(): void {
	// Toggles
	setupToggle('plus-checkUpdates', STORAGE_KEYS.CHECK_UPDATES_ON_STARTUP);
	setupToggle('plus-discordRPC', STORAGE_KEYS.DISCORD_RPC, () => {
		if (typeof window.toggleDiscordRPC === 'function') {
			window.toggleDiscordRPC();
		}
	});
	setupToggle('plus-transparency', 'enableTransparentThemes', () => {
		if (typeof window.toggleTransparency === 'function') {
			window.toggleTransparency();
		}
	});

	// External player path
	const playerPathInput = document.getElementById('plus-externalPlayerPath') as HTMLInputElement;
	if (playerPathInput) {
		playerPathInput.addEventListener('change', () => {
			localStorage.setItem(STORAGE_KEYS.EXTERNAL_PLAYER_PATH, playerPathInput.value);
		});
	}

	const browseBtn = document.getElementById('plus-browsePlayerPath');
	if (browseBtn) {
		browseBtn.addEventListener('click', () => {
			if (typeof window.browsePlayerPath === 'function') {
				window.browsePlayerPath();
			}
		});
	}

	// Action buttons
	const marketplaceBtn = document.getElementById('plus-communityMarketplace');
	if (marketplaceBtn) {
		marketplaceBtn.addEventListener('click', () => {
			if (typeof window.openCommunityMarketplace === 'function') {
				window.openCommunityMarketplace();
			}
		});
	}

	const updateBtn = document.getElementById('plus-checkForUpdates');
	if (updateBtn) {
		updateBtn.addEventListener('click', () => {
			if (typeof window.checkForUpdates === 'function') {
				window.checkForUpdates();
			}
		});
	}
}

// ==================== UTILITY FUNCTIONS ====================
function setupToggle(elementId: string, storageKey: string, callback?: () => void): void {
	const toggle = document.getElementById(elementId);
	if (!toggle) return;

	toggle.addEventListener('click', () => {
		toggle.classList.toggle(CLASSES.CHECKED);
		const isChecked = toggle.classList.contains(CLASSES.CHECKED);
		localStorage.setItem(storageKey, isChecked ? 'true' : 'false');
		logger.info(`[Plus] ${storageKey} toggled ${isChecked ? 'ON' : 'OFF'}`);
		if (callback) callback();
	});
}

function setupRangeWithValue(
	rangeId: string,
	valueId: string,
	suffix: string,
	storageKey: string | null,
	customHandler?: (value: string) => void
): void {
	const range = document.getElementById(rangeId) as HTMLInputElement;
	const valueDisplay = document.getElementById(valueId);

	if (!range || !valueDisplay) return;

	range.addEventListener('input', () => {
		valueDisplay.textContent = range.value + suffix;
		if (storageKey) {
			localStorage.setItem(storageKey, range.value);
		}
		if (customHandler) {
			customHandler(range.value);
		}
	});
}

function applyTweaks(): void {
	// Trigger the existing applyTweaks function if available
	if (typeof window.applyTweaks === 'function') {
		window.applyTweaks();
	}
}

function applyAppearance(): void {
	// Trigger the existing applyAppearance function if available
	if (typeof window.applyAppearance === 'function') {
		window.applyAppearance();
	}
}

// Inject a banner in Settings Plus section pointing to the new Plus page
export function injectSettingsPlusBanner(): void {
	const enhancedSection = document.getElementById('enhanced');
	if (!enhancedSection) return;

	// Check if banner already exists
	if (document.getElementById('plus-page-banner')) return;

	// Create banner
	const banner = document.createElement('div');
	banner.id = 'plus-page-banner';
	banner.style.cssText = `
		background: linear-gradient(135deg, rgba(123, 91, 245, 0.15), rgba(123, 91, 245, 0.05));
		border: 1px solid rgba(123, 91, 245, 0.3);
		border-radius: 12px;
		padding: 16px 20px;
		margin: 16px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	`;

	banner.innerHTML = `
		<div style="flex: 1;">
			<div style="font-size: 15px; font-weight: 600; color: white; margin-bottom: 4px;">
				New Plus Page Available
			</div>
			<div style="font-size: 13px; color: rgba(255,255,255,0.6);">
				Access all StreamGo settings in a new, organized layout from the top navigation bar.
			</div>
		</div>
		<a href="#/plus" id="plus-banner-link" style="
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 10px 20px;
			background: rgba(123, 91, 245, 0.8);
			border-radius: 8px;
			color: white;
			font-size: 14px;
			font-weight: 500;
			text-decoration: none;
			transition: background 0.15s ease;
			white-space: nowrap;
		">
			<svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
			</svg>
			Open Plus Page
		</a>
	`;

	// Insert after the section title
	const sectionTitle = enhancedSection.querySelector('[class*="section-title"], [class*="title"]');
	if (sectionTitle && sectionTitle.nextSibling) {
		enhancedSection.insertBefore(banner, sectionTitle.nextSibling);
	} else {
		// Insert at the beginning if no title found
		enhancedSection.insertBefore(banner, enhancedSection.firstChild?.nextSibling || null);
	}

	// Add hover effect and click handler
	const link = banner.querySelector('#plus-banner-link') as HTMLElement;
	if (link) {
		link.addEventListener('mouseenter', () => {
			link.style.background = 'rgba(123, 91, 245, 1)';
		});
		link.addEventListener('mouseleave', () => {
			link.style.background = 'rgba(123, 91, 245, 0.8)';
		});
		// Add click handler to prevent Stremio's router from handling navigation
		link.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			navigateToPlusPage();
		});
	}

	logger.info('[Plus] Injected Settings Plus section banner');
}

// Declare window extensions for TypeScript
declare global {
	interface Window {
		openThemesFolder?: () => void;
		openPluginsFolder?: () => void;
		loadThemes?: () => void;
		loadPlugins?: () => void;
		applyTweaks?: () => void;
		applyAppearance?: () => void;
		toggleDiscordRPC?: () => void;
		toggleTransparency?: () => void;
		browsePlayerPath?: () => void;
		openCommunityMarketplace?: () => void;
		checkForUpdates?: () => void;
		getAppVersion?: () => string;
	}
}
