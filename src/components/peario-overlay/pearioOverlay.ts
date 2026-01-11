import Helpers from '../../utils/Helpers';
import logger from '../../utils/logger';
import { openPartyPopover, initPartyPopover } from '../party-popover/partyPopover';

// Types
interface ContentInfo {
	type: 'movie' | 'series';
	imdbId: string;
	name: string;
	season?: number;
	episode?: number;
}

// Selector for the row containing circular action buttons (share, heart, etc.)
const ACTION_BUTTONS_ROW_SELECTOR = '[class*="action-buttons-container"]';
// More specific selector for the share button to find the right container
const SHARE_BUTTON_SELECTOR = '[class*="share-button-container"], [class*="share-button"]';

// Button injection state
let buttonInjectionAttempts = 0;
const MAX_BUTTON_INJECTION_ATTEMPTS = 10;

/**
 * Parse the detail page URL to extract content info
 */
function parseDetailUrl(hash: string): ContentInfo | null {
	// Movies: #/detail/movie/tt1234567/...
	const movieMatch = hash.match(/#\/detail\/movie\/(tt\d+)/);
	if (movieMatch) {
		const name = getContentName() || 'Movie';
		return { type: 'movie', imdbId: movieMatch[1], name };
	}

	// Series: #/detail/series/tt1234567:1:1/... (id:season:episode)
	const seriesMatch = hash.match(/#\/detail\/series\/(tt\d+)(?::(\d+):(\d+))?/);
	if (seriesMatch) {
		const name = getContentName() || 'Series';
		return {
			type: 'series',
			imdbId: seriesMatch[1],
			name,
			season: seriesMatch[2] ? parseInt(seriesMatch[2]) : undefined,
			episode: seriesMatch[3] ? parseInt(seriesMatch[3]) : undefined
		};
	}

	// Fallback: try generic detail page pattern
	const genericMatch = hash.match(/#\/detail\/(movie|series)\/([^\\/]+)/);
	if (genericMatch) {
		const id = genericMatch[2].split(':')[0];
		if (id.startsWith('tt')) {
			const name = getContentName() || (genericMatch[1] === 'movie' ? 'Movie' : 'Series');
			return { type: genericMatch[1] as 'movie' | 'series', imdbId: id, name };
		}
	}

	return null;
}

/**
 * Get content name from page
 */
function getContentName(): string | null {
	const nameEl = document.querySelector('[class*="metadetails-container"] [class*="name-"]');
	return nameEl?.textContent || null;
}

/**
 * Check if we're on a detail page
 */
function isOnDetailPage(): boolean {
	return location.hash.includes('#/detail/movie/') || location.hash.includes('#/detail/series/');
}

/**
 * Create the Party button element - matches Stremio's circular action buttons
 */
function createPartyButton(referenceButton?: Element | null): HTMLElement {
	const button = document.createElement('div');
	button.id = 'peario-watch-button';
	button.setAttribute('tabindex', '0');
	button.setAttribute('title', 'Watch with Friends');

	// Copy classes from reference button if available (share button)
	if (referenceButton) {
		button.className = referenceButton.className;
	} else {
		// Fallback class name matching Stremio's pattern
		button.className = 'action-button-XIZa3 button-container-zVLH6';
	}

	// Party/users icon SVG - matching the style of other icons
	button.innerHTML = `
		<svg class="icon-T8MU6" viewBox="0 0 24 24" style="fill: currentColor; width: 1.4em; height: 1.4em;">
			<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
		</svg>
	`;

	logger.info('[Party] Creating button with click handler');
	console.log('[Party] Creating button with click handler');

	// Click handler - open native party panel
	button.addEventListener('click', (e) => {
		logger.info('[Party] Click event fired!');
		console.log('[Party] Click event fired!');
		e.preventDefault();
		e.stopPropagation();
		handlePartyButtonClick();
	});

	// Keyboard accessibility
	button.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handlePartyButtonClick();
		}
	});

	return button;
}

/**
 * Handle party button click - open party popover
 */
function handlePartyButtonClick(): void {
	logger.info('[Party] Button clicked!');
	console.log('[Party] Button clicked!');

	const contentInfo = parseDetailUrl(location.hash);
	logger.info(`[Party] Content info parsed:`, contentInfo);
	console.log('[Party] Content info:', contentInfo);

	try {
		if (contentInfo) {
			logger.info(`[Party] Calling openPartyPopover with content: ${contentInfo.type} - ${contentInfo.name}`);
			console.log('[Party] Calling openPartyPopover with content:', contentInfo);
			openPartyPopover({
				id: contentInfo.imdbId,
				type: contentInfo.type,
				name: contentInfo.name
			});
			logger.info(`[Party] openPartyPopover called successfully`);
			console.log('[Party] openPartyPopover called successfully');
		} else {
			logger.info('[Party] Calling openPartyPopover without content info');
			console.log('[Party] Calling openPartyPopover without content info');
			openPartyPopover();
			logger.info('[Party] openPartyPopover called successfully (no content)');
			console.log('[Party] openPartyPopover called successfully (no content)');
		}
	} catch (error) {
		logger.error('[Party] Error opening popover:', error);
		console.error('[Party] Error opening popover:', error);
	}
}

/**
 * Remove the Party button from DOM
 */
function removePartyButton(): void {
	const button = document.getElementById('peario-watch-button');
	if (button) {
		button.remove();
	}
}

/**
 * Inject the Party button into the detail page
 */
export function injectPearioButton(): void {
	// Only inject on detail pages
	if (!isOnDetailPage()) {
		removePartyButton();
		return;
	}

	// Already injected check
	if (document.getElementById('peario-watch-button')) {
		return;
	}

	if (buttonInjectionAttempts >= MAX_BUTTON_INJECTION_ATTEMPTS) {
		logger.warn('[Party] Max injection attempts reached');
		return;
	}

	buttonInjectionAttempts++;

	// Wait for action buttons container
	Helpers.waitForElm(ACTION_BUTTONS_ROW_SELECTOR).then((container) => {
		// Race condition check
		if (document.getElementById('peario-watch-button')) {
			return;
		}

		// Verify we're still on detail page
		if (!isOnDetailPage()) {
			return;
		}

		// Find share button - it's the last circular button, we'll insert after it
		const shareButton = container.querySelector(SHARE_BUTTON_SELECTOR);

		// Create the Party button, copying classes from share button for consistent styling
		const partyButton = createPartyButton(shareButton);

		// The share button is a direct child of action-buttons-container
		// Insert after share button at the same level
		if (shareButton) {
			// Insert after the share button
			if (shareButton.nextSibling) {
				shareButton.parentElement?.insertBefore(partyButton, shareButton.nextSibling);
			} else {
				shareButton.parentElement?.appendChild(partyButton);
			}
		} else {
			// Fallback: look for the last button-like element and insert after it
			const allButtons = container.querySelectorAll('[class*="button-container"], [class*="action-button"]');
			if (allButtons.length > 0) {
				const lastButton = allButtons[allButtons.length - 1];
				lastButton.parentElement?.insertBefore(partyButton, lastButton.nextSibling);
			} else {
				container.appendChild(partyButton);
			}
		}

		buttonInjectionAttempts = 0;
		logger.info('[Party] Watch button injected');
	}).catch(err => {
		logger.warn(`[Party] Could not inject button: ${err}`);
		// Retry after delay
		setTimeout(() => injectPearioButton(), 300);
	});
}

/**
 * Reset button injection attempts counter
 */
export function resetPearioButtonInjection(): void {
	buttonInjectionAttempts = 0;
}

/**
 * Handle route changes
 */
export function handlePearioRoute(): void {
	// Re-inject button on detail pages
	if (isOnDetailPage()) {
		removePartyButton();
		buttonInjectionAttempts = 0;
		injectPearioButton();
	} else {
		removePartyButton();
	}
}

/**
 * Initialize the party system
 */
export function initPartySystem(): void {
	try {
		logger.info('[Party] Initializing party system...');
		console.log('[Party] Initializing party system...');
		initPartyPopover();
		logger.info('[Party] System initialized successfully');
		console.log('[Party] System initialized successfully');
	} catch (error) {
		logger.error('[Party] Failed to initialize party system:', error);
		console.error('[Party] Failed to initialize party system:', error);
	}
}

// Legacy exports for compatibility (no longer needed)
export function getPearioOverlayTemplate(): string {
	return '';
}

export function openPearioOverlay(): void {
	handlePartyButtonClick();
}

export function closePearioOverlay(): void {
	// No-op - popover handles its own close
}
