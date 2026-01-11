import TemplateCache from '../../utils/templateCache';
import partyService, { PartyUser, PartyRoom, PartyMessage } from '../../utils/PartyService';
import Helpers from '../../utils/Helpers';
import logger from '../../utils/logger';

// State
let panelElement: HTMLElement | null = null;
let isOpen = false;
let videoSyncHandler: (() => void) | null = null;
let currentContentInfo: { id: string; type: string; name: string } | null = null;

/**
 * Get the party panel template
 */
function getTemplate(): string {
	return TemplateCache.load(__dirname, 'party-panel');
}

/**
 * Open the party panel
 */
export function openPartyPanel(contentInfo?: { id: string; type: string; name: string }): void {
	logger.info('[PartyPanel] openPartyPanel called');
	console.log('[PartyPanel] openPartyPanel called, contentInfo:', contentInfo);
	console.log('[PartyPanel] isOpen:', isOpen);

	if (isOpen) {
		logger.info('[PartyPanel] Panel already open, closing...');
		console.log('[PartyPanel] Panel already open, closing...');
		closePartyPanel();
		return;
	}

	// Store content info for room creation
	if (contentInfo) {
		currentContentInfo = contentInfo;
		logger.info('[PartyPanel] Content info stored:', contentInfo);
		console.log('[PartyPanel] Content info stored:', contentInfo);
	}

	// Remove existing panel
	const existingPanel = document.getElementById('party-panel');
	if (existingPanel) {
		logger.info('[PartyPanel] Removing existing panel');
		console.log('[PartyPanel] Removing existing panel');
		existingPanel.remove();
	}

	// Get template
	logger.info('[PartyPanel] Getting template...');
	console.log('[PartyPanel] Getting template...');
	let template: string;
	try {
		template = getTemplate();
		logger.info('[PartyPanel] Template loaded, length:', template.length);
		console.log('[PartyPanel] Template loaded, length:', template.length);
		console.log('[PartyPanel] Template preview:', template.substring(0, 200));
	} catch (error) {
		logger.error('[PartyPanel] Failed to load template:', error);
		console.error('[PartyPanel] Failed to load template:', error);
		return;
	}

	// Create panel
	logger.info('[PartyPanel] Creating panel element...');
	console.log('[PartyPanel] Creating panel element...');
	const container = document.createElement('div');
	container.innerHTML = template;

	// Extract and inject styles into document head
	const styleEl = container.querySelector('style');
	if (styleEl && !document.getElementById('party-panel-styles')) {
		const headStyle = document.createElement('style');
		headStyle.id = 'party-panel-styles';
		headStyle.textContent = styleEl.textContent || '';
		document.head.appendChild(headStyle);
		console.log('[PartyPanel] Styles injected into head');
	}

	const panelEl = container.firstElementChild as HTMLElement;
	if (!panelEl) {
		logger.error('[PartyPanel] Failed to create panel element from template');
		console.error('[PartyPanel] Failed to create panel element from template');
		return;
	}

	// Add critical inline styles to ensure visibility
	panelEl.style.cssText = `
		position: fixed !important;
		top: 60px !important;
		right: 20px !important;
		width: 320px !important;
		max-height: calc(100vh - 100px) !important;
		background: rgba(20, 20, 24, 0.98) !important;
		border: 1px solid rgba(255, 255, 255, 0.15) !important;
		border-radius: 12px !important;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
		z-index: 2147483647 !important;
		display: flex !important;
		flex-direction: column !important;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
		visibility: visible !important;
		opacity: 1 !important;
		pointer-events: auto !important;
		color: white !important;
	`;

	logger.info('[PartyPanel] Appending panel to body...');
	console.log('[PartyPanel] Appending panel to body...');
	document.body.appendChild(panelEl);

	panelElement = document.getElementById('party-panel');
	logger.info('[PartyPanel] Panel element in DOM:', !!panelElement);
	console.log('[PartyPanel] Panel element in DOM:', panelElement);
	console.log('[PartyPanel] Panel computed style z-index:', panelElement ? window.getComputedStyle(panelElement).zIndex : 'N/A');

	isOpen = true;

	// Setup event handlers
	logger.info('[PartyPanel] Setting up event handlers...');
	console.log('[PartyPanel] Setting up event handlers...');
	setupEventHandlers();

	// Connect to party server
	logger.info('[PartyPanel] Checking party service connection...');
	console.log('[PartyPanel] partyService.connected:', partyService.connected);
	console.log('[PartyPanel] partyService.ready:', partyService.ready);

	if (!partyService.connected) {
		logger.info('[PartyPanel] Connecting to party server...');
		console.log('[PartyPanel] Connecting to party server...');
		partyService.connect();
	} else if (partyService.ready) {
		logger.info('[PartyPanel] Already connected, showing lobby...');
		console.log('[PartyPanel] Already connected, showing lobby...');
		showLobby();
	}

	// Setup party service listeners
	logger.info('[PartyPanel] Setting up party listeners...');
	console.log('[PartyPanel] Setting up party listeners...');
	setupPartyListeners();

	logger.info('[PartyPanel] Panel opened successfully!');
	console.log('[PartyPanel] Panel opened successfully!');
}

/**
 * Close the party panel
 */
export function closePartyPanel(): void {
	if (!isOpen) return;

	panelElement?.remove();
	panelElement = null;
	isOpen = false;

	// Stop video sync if active
	stopVideoSync();

	logger.info('[PartyPanel] Panel closed');
}

/**
 * Check if panel is open
 */
export function isPanelOpen(): boolean {
	return isOpen;
}

/**
 * Setup event handlers for panel UI
 */
function setupEventHandlers(): void {
	// Close button
	document.getElementById('party-close-btn')?.addEventListener('click', closePartyPanel);

	// Create party button
	document.getElementById('party-create-btn')?.addEventListener('click', createParty);

	// Join party button
	document.getElementById('party-join-btn')?.addEventListener('click', joinParty);

	// Join input - enter key
	document.getElementById('party-join-input')?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') joinParty();
	});

	// Copy code button
	document.getElementById('party-copy-btn')?.addEventListener('click', copyRoomCode);

	// Leave party button
	document.getElementById('party-leave-btn')?.addEventListener('click', leaveParty);

	// Auto-sync toggle
	document.getElementById('party-auto-sync')?.addEventListener('change', (e) => {
		const checked = (e.target as HTMLInputElement).checked;
		partyService.setAutoSync(checked);
	});

	// Send message button
	document.getElementById('party-send-btn')?.addEventListener('click', sendMessage);

	// Message input - enter key
	document.getElementById('party-message-input')?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') sendMessage();
	});

	// Close on escape
	document.addEventListener('keydown', handleEscape);
}

/**
 * Handle escape key
 */
function handleEscape(e: KeyboardEvent): void {
	if (e.key === 'Escape' && isOpen) {
		closePartyPanel();
	}
}

/**
 * Setup party service event listeners
 */
function setupPartyListeners(): void {
	// Ready event
	partyService.on('ready', () => {
		showLobby();
	});

	// Room joined/created
	partyService.on('room', (room: PartyRoom) => {
		showRoom(room);
	});

	// Room sync
	partyService.on('sync', (room: PartyRoom) => {
		updateRoom(room);
		applyVideoSync(room);
	});

	// Chat message
	partyService.on('message', (message: PartyMessage) => {
		addMessage(message);
	});

	// Error
	partyService.on('error', (error: { message: string }) => {
		showError(error.message);
	});

	// Disconnected
	partyService.on('disconnected', () => {
		showStatus('Disconnected. Reconnecting...', true);
	});
}

/**
 * Show lobby view (create/join options)
 */
function showLobby(): void {
	const status = document.getElementById('party-status');
	const actions = document.getElementById('party-actions');
	const lobby = document.getElementById('party-lobby');
	const room = document.getElementById('party-room');

	if (status) status.style.display = 'none';
	if (actions) actions.style.display = 'flex';
	if (lobby) lobby.style.display = 'flex';
	if (room) room.style.display = 'none';
}

/**
 * Show room view
 */
function showRoom(roomData: PartyRoom): void {
	const lobby = document.getElementById('party-lobby');
	const room = document.getElementById('party-room');

	if (lobby) lobby.style.display = 'none';
	if (room) room.style.display = 'flex';

	// Update room code
	const roomId = document.getElementById('party-room-id');
	if (roomId) roomId.textContent = roomData.id;

	// Update users list
	updateUsersList(roomData.users, roomData.owner);

	// Start video sync
	startVideoSync();
}

/**
 * Update room display
 */
function updateRoom(roomData: PartyRoom): void {
	// Update users list
	updateUsersList(roomData.users, roomData.owner);
}

/**
 * Update users list
 */
function updateUsersList(users: PartyUser[], ownerId: string): void {
	const list = document.getElementById('party-users-list');
	if (!list) return;

	list.innerHTML = users.map(user => `
		<div class="party-user">
			<div class="party-user-avatar" style="background: ${user.color}">
				${user.name.charAt(0).toUpperCase()}
			</div>
			<span class="party-user-name">${escapeHtml(user.name)}</span>
			${user.id === ownerId ? '<span class="party-user-owner">Host</span>' : ''}
		</div>
	`).join('');
}

/**
 * Add chat message
 */
function addMessage(message: PartyMessage): void {
	const messages = document.getElementById('party-messages');
	if (!messages) return;

	const time = new Date(message.timestamp).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit'
	});

	const messageEl = document.createElement('div');
	messageEl.className = 'party-message';
	messageEl.innerHTML = `
		<div class="party-message-header">
			<span class="party-message-user" style="color: ${message.user.color}">
				${escapeHtml(message.user.name)}
			</span>
			<span class="party-message-time">${time}</span>
		</div>
		<div class="party-message-text">${escapeHtml(message.text)}</div>
	`;

	messages.appendChild(messageEl);
	messages.scrollTop = messages.scrollHeight;
}

/**
 * Show status message
 */
function showStatus(text: string, showSpinner = false): void {
	const status = document.getElementById('party-status');
	if (!status) return;

	status.innerHTML = `
		${showSpinner ? '<div class="party-loading-spinner"></div>' : ''}
		<span>${escapeHtml(text)}</span>
	`;
	status.style.display = 'flex';
}

/**
 * Show error message
 */
function showError(message: string): void {
	showStatus(message, false);
	const status = document.getElementById('party-status');
	if (status) {
		status.style.color = '#e94848';
	}
}

/**
 * Create a new party
 */
function createParty(): void {
	if (!partyService.ready) {
		showError('Not connected to server');
		return;
	}

	// Get content info from current page or stored
	const meta = currentContentInfo || getContentFromPage();

	if (!meta) {
		showError('Please open a movie or series first');
		return;
	}

	showStatus('Creating party...', true);
	partyService.createRoom(meta);
}

/**
 * Join an existing party
 */
function joinParty(): void {
	if (!partyService.ready) {
		showError('Not connected to server');
		return;
	}

	const input = document.getElementById('party-join-input') as HTMLInputElement;
	const roomId = input?.value.trim();

	if (!roomId) {
		showError('Please enter a room code');
		return;
	}

	showStatus('Joining party...', true);
	partyService.joinRoom(roomId);
}

/**
 * Leave the current party
 */
function leaveParty(): void {
	partyService.leaveRoom();
	stopVideoSync();
	showLobby();
}

/**
 * Copy room code to clipboard
 */
async function copyRoomCode(): Promise<void> {
	const room = partyService.room;
	if (!room) return;

	try {
		await navigator.clipboard.writeText(room.id);

		// Show feedback
		const btn = document.getElementById('party-copy-btn');
		if (btn) {
			btn.innerHTML = `
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
				</svg>
			`;
			setTimeout(() => {
				btn.innerHTML = `
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
					</svg>
				`;
			}, 2000);
		}
	} catch (err) {
		logger.error('[PartyPanel] Failed to copy:', err);
	}
}

/**
 * Send chat message
 */
function sendMessage(): void {
	const input = document.getElementById('party-message-input') as HTMLInputElement;
	const text = input?.value.trim();

	if (!text) return;

	partyService.sendMessage(text);
	input.value = '';
}

/**
 * Get content info from current page
 */
function getContentFromPage(): { id: string; type: string; name: string } | null {
	const hash = location.hash;

	// Parse detail page URL
	const movieMatch = hash.match(/#\/detail\/movie\/(tt\d+)/);
	if (movieMatch) {
		const title = document.querySelector('.metadetails-container-K_Dqa .name-vAXRt')?.textContent || 'Movie';
		return { id: movieMatch[1], type: 'movie', name: title };
	}

	const seriesMatch = hash.match(/#\/detail\/series\/(tt\d+)/);
	if (seriesMatch) {
		const title = document.querySelector('.metadetails-container-K_Dqa .name-vAXRt')?.textContent || 'Series';
		return { id: seriesMatch[1], type: 'series', name: title };
	}

	return null;
}

/**
 * Start video sync
 */
function startVideoSync(): void {
	// Get video element function
	const getVideo = (): HTMLVideoElement | null => {
		return document.querySelector('video');
	};

	// Start periodic sync
	partyService.startSync(getVideo);

	// Also sync on play/pause events
	const setupVideoListeners = async (): Promise<void> => {
		try {
			await Helpers.waitForElm('video');
			const video = document.querySelector('video');
			if (!video) return;

			videoSyncHandler = () => {
				partyService.syncPlayer({
					paused: video.paused,
					buffering: video.readyState < 3,
					time: video.currentTime
				});
			};

			video.addEventListener('play', videoSyncHandler);
			video.addEventListener('pause', videoSyncHandler);
			video.addEventListener('seeked', videoSyncHandler);
		} catch (err) {
			// Video not found yet, will sync when available
		}
	};

	setupVideoListeners();
}

/**
 * Stop video sync
 */
function stopVideoSync(): void {
	partyService.stopSync();

	if (videoSyncHandler) {
		const video = document.querySelector('video');
		if (video) {
			video.removeEventListener('play', videoSyncHandler);
			video.removeEventListener('pause', videoSyncHandler);
			video.removeEventListener('seeked', videoSyncHandler);
		}
		videoSyncHandler = null;
	}
}

/**
 * Apply sync from room to video
 */
function applyVideoSync(room: PartyRoom): void {
	const video = document.querySelector('video');
	if (!video || !room.player) return;

	partyService.applySyncToVideo(video, room.player);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Cleanup on navigation
 */
export function handlePartyNavigation(): void {
	// Keep panel open when navigating
	// But update content info if on detail page
	if (location.hash.includes('#/detail/')) {
		const content = getContentFromPage();
		if (content) {
			currentContentInfo = content;
		}
	}
}

/**
 * Initialize party panel module
 */
export function initPartyPanel(): void {
	logger.info('[PartyPanel] Initializing party panel module...');
	console.log('[PartyPanel] Initializing party panel module...');

	// Listen for hash changes
	window.addEventListener('hashchange', handlePartyNavigation);

	logger.info('[PartyPanel] Module initialized successfully');
	console.log('[PartyPanel] Module initialized successfully');
}

export default {
	open: openPartyPanel,
	close: closePartyPanel,
	isOpen: isPanelOpen,
	init: initPartyPanel
};
