import TemplateCache from '../../utils/templateCache';
import logger from '../../utils/logger';
import partyService from '../../utils/PartyService';

// State
let popoverElement: HTMLElement | null = null;
let isOpen = false;
let currentContentInfo: { id: string; type: string; name: string } | null = null;
let isJoiningMode = false; // Track if we're joining an existing party vs creating a new one

// View elements
let initialView: HTMLElement | null = null;
let joinView: HTMLElement | null = null;
let roomView: HTMLElement | null = null;
let loadingView: HTMLElement | null = null;

/**
 * Get the party popover template
 */
function getTemplate(contentInfo: { id: string; type: string; name: string }): string {
	let template = TemplateCache.load(__dirname, 'party-popover');

	// Replace placeholders
	template = template.replace(/\{\{\s*CONTENT_TITLE\s*\}\}/g, escapeHtml(contentInfo.name));
	template = template.replace(/\{\{\s*CONTENT_TYPE\s*\}\}/g, contentInfo.type);

	return template;
}

/**
 * Show specific view
 */
function showView(viewName: 'initial' | 'join' | 'room' | 'loading'): void {
	if (!initialView || !joinView || !roomView || !loadingView) return;

	// Hide all views by adding the hidden class
	initialView.classList.add('party-view-hidden');
	joinView.classList.add('party-view-hidden');
	roomView.classList.add('party-view-hidden');
	loadingView.classList.add('party-view-hidden');

	// Show selected view by removing the hidden class
	switch (viewName) {
		case 'initial':
			initialView.classList.remove('party-view-hidden');
			break;
		case 'join':
			joinView.classList.remove('party-view-hidden');
			break;
		case 'room':
			roomView.classList.remove('party-view-hidden');
			break;
		case 'loading':
			loadingView.classList.remove('party-view-hidden');
			break;
	}
}

/**
 * Update loading text
 */
function setLoadingText(text: string): void {
	const loadingText = document.getElementById('party-loading-text');
	if (loadingText) {
		loadingText.textContent = text;
	}
}

/**
 * Show error in join view
 */
function showJoinError(message: string): void {
	const errorEl = document.getElementById('party-join-error');
	if (errorEl) {
		errorEl.textContent = message;
		errorEl.style.display = 'block';
	}
}

/**
 * Hide join error
 */
function hideJoinError(): void {
	const errorEl = document.getElementById('party-join-error');
	if (errorEl) {
		errorEl.style.display = 'none';
	}
}

/**
 * Update participant count badge
 */
function updateParticipantCount(count: number): void {
	const badge = document.getElementById('party-participant-count');
	if (badge) {
		badge.textContent = count.toString();
		badge.style.display = count > 0 ? 'inline-flex' : 'none';
	}
}

/**
 * Update PIN display
 */
function updatePinDisplay(pin: string): void {
	const pinCode = document.getElementById('party-pin-code');
	if (pinCode) {
		pinCode.textContent = pin;
	}
}

/**
 * Render participants list
 */
function renderParticipants(): void {
	const listEl = document.getElementById('party-participants-list');
	if (!listEl || !partyService.room) return;

	listEl.innerHTML = '';

	partyService.room.users.forEach(user => {
		const isOwner = user.id === partyService.room?.owner;
		const initial = user.name.charAt(0).toUpperCase();

		const participant = document.createElement('div');
		participant.className = 'party-participant';
		participant.innerHTML = `
			<div class="party-participant-avatar" style="background-color: ${user.color};">
				${initial}
			</div>
			<span class="party-participant-name">${escapeHtml(user.name)}</span>
			${isOwner ? '<span class="party-participant-owner">HOST</span>' : ''}
		`;

		listEl.appendChild(participant);
	});

	// Update participant count
	updateParticipantCount(partyService.room.users.length);
}

/**
 * Render chat messages
 */
function renderMessages(): void {
	const messagesEl = document.getElementById('party-chat-messages');
	if (!messagesEl) return;

	messagesEl.innerHTML = '';

	partyService.messages.forEach(msg => {
		const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

		const messageEl = document.createElement('div');
		messageEl.className = 'party-chat-message';
		messageEl.innerHTML = `
			<div class="party-chat-message-header">
				<span class="party-chat-message-user" style="color: ${msg.user.color};">
					${escapeHtml(msg.user.name)}
				</span>
				<span class="party-chat-message-time">${time}</span>
			</div>
			<div class="party-chat-message-text">${escapeHtml(msg.text)}</div>
		`;

		messagesEl.appendChild(messageEl);
	});

	// Scroll to bottom
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Handle create party button click
 */
function handleCreateParty(): void {
	logger.info('[PartyPopover] Creating party...');
	console.log('[PartyPopover] Creating party...');

	isJoiningMode = false; // We're creating, not joining

	showView('loading');
	setLoadingText('Connecting...');

	// Connect to party service
	partyService.connect();
}

/**
 * Handle join party button click
 */
function handleJoinPartyClick(): void {
	showView('join');
	hideJoinError();

	// Focus input
	const input = document.getElementById('party-pin-input') as HTMLInputElement;
	if (input) {
		input.value = '';
		setTimeout(() => input.focus(), 100);
	}
}

/**
 * Handle join party submission
 */
function handleJoinPartySubmit(): void {
	const input = document.getElementById('party-pin-input') as HTMLInputElement;
	if (!input) return;

	const pin = input.value.trim().toUpperCase();
	if (!pin) {
		showJoinError('Please enter a party PIN');
		return;
	}

	logger.info('[PartyPopover] Joining party:', pin);
	console.log('[PartyPopover] Joining party:', pin);

	isJoiningMode = true; // We're joining, not creating

	hideJoinError();
	showView('loading');
	setLoadingText('Connecting...');

	// Connect and join
	partyService.connect();

	// Wait for ready event, then join
	const onReady = () => {
		partyService.off('ready', onReady);
		setLoadingText('Joining party...');
		partyService.joinRoom(pin);
	};
	partyService.once('ready', onReady);
}

/**
 * Handle copy PIN button click
 */
function handleCopyPin(): void {
	const pinCode = document.getElementById('party-pin-code');
	if (!pinCode || !partyService.room) return;

	const pin = partyService.room.id;

	// Copy to clipboard
	navigator.clipboard.writeText(pin).then(() => {
		logger.info('[PartyPopover] PIN copied to clipboard');

		// Show visual feedback
		const copyBtn = document.getElementById('party-copy-pin-btn');
		if (copyBtn) {
			const originalHTML = copyBtn.innerHTML;
			copyBtn.innerHTML = `
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
				</svg>
			`;
			setTimeout(() => {
				copyBtn.innerHTML = originalHTML;
			}, 2000);
		}
	}).catch(err => {
		logger.error('[PartyPopover] Failed to copy PIN:', err);
	});
}

/**
 * Handle leave party button click
 */
function handleLeaveParty(): void {
	logger.info('[PartyPopover] Leaving party...');
	console.log('[PartyPopover] Leaving party...');

	// Actually leave the party and disconnect
	partyService.leaveRoom();
	partyService.disconnect();

	// Remove all listeners to prevent memory leaks
	partyService.removeAllListeners();

	// Reset state
	isJoiningMode = false;

	// Close the popover
	closePartyPopover();
}

/**
 * Handle send chat message
 */
function handleSendMessage(): void {
	const input = document.getElementById('party-chat-input') as HTMLInputElement;
	if (!input) return;

	const text = input.value.trim();
	if (!text) return;

	partyService.sendMessage(text);
	input.value = '';
}

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
	// Close button
	document.getElementById('party-popover-close')?.addEventListener('click', closePartyPopover);

	// Close on backdrop click
	const backdrop = popoverElement?.querySelector('.party-backdrop');
	backdrop?.addEventListener('click', closePartyPopover);

	// Prevent clicks on container from closing
	const container = popoverElement?.querySelector('.party-popover-container');
	container?.addEventListener('click', (e) => {
		e.stopPropagation();
	});

	// Escape key to close
	document.addEventListener('keydown', handleEscape);

	// Initial view buttons
	document.getElementById('party-create-btn')?.addEventListener('click', handleCreateParty);
	document.getElementById('party-join-btn')?.addEventListener('click', handleJoinPartyClick);

	// Join view buttons
	document.getElementById('party-join-submit-btn')?.addEventListener('click', handleJoinPartySubmit);
	document.getElementById('party-join-back-btn')?.addEventListener('click', () => {
		showView('initial');
		hideJoinError();
	});

	// Join view - Enter key
	document.getElementById('party-pin-input')?.addEventListener('keydown', (e) => {
		if ((e as KeyboardEvent).key === 'Enter') {
			handleJoinPartySubmit();
		}
	});

	// Room view buttons
	document.getElementById('party-copy-pin-btn')?.addEventListener('click', handleCopyPin);
	document.getElementById('party-leave-btn')?.addEventListener('click', handleLeaveParty);

	// Chat send button
	document.getElementById('party-chat-send-btn')?.addEventListener('click', handleSendMessage);

	// Chat input - Enter key
	document.getElementById('party-chat-input')?.addEventListener('keydown', (e) => {
		if ((e as KeyboardEvent).key === 'Enter') {
			handleSendMessage();
		}
	});
}

/**
 * Setup PartyService event listeners
 */
function setupPartyServiceListeners(): void {
	// Connected event
	partyService.on('connected', () => {
		logger.info('[PartyPopover] Connected to server');
		console.log('[PartyPopover] Connected to server');
	});

	// Ready event
	partyService.on('ready', (data) => {
		logger.info('[PartyPopover] Ready:', data);
		console.log('[PartyPopover] Ready:', data);

		// Only create a room if we're NOT joining an existing party
		if (isJoiningMode) {
			logger.info('[PartyPopover] Skipping room creation - joining mode');
			console.log('[PartyPopover] Skipping room creation - joining mode');
			return;
		}

		// If we're creating a party, send room.new
		if (!currentContentInfo) return;

		setLoadingText('Creating party...');

		// Create room with a minimal placeholder stream since Peario requires it
		// Users can select an actual stream later
		partyService.send('room.new', {
			stream: {
				title: 'Waiting for stream selection...',
				url: null,
				infoHash: null
			},
			meta: {
				id: currentContentInfo.id,
				type: currentContentInfo.type,
				name: currentContentInfo.name
			}
		});
	});

	// Room event (joined/created)
	partyService.on('room', (room) => {
		logger.info('[PartyPopover] Room event:', room);
		console.log('[PartyPopover] Room event:', room);

		// Show room view
		showView('room');

		// Update UI
		updatePinDisplay(room.id);
		renderParticipants();
		renderMessages();
	});

	// Sync event (room updated)
	partyService.on('sync', () => {
		logger.info('[PartyPopover] Room synced');
		console.log('[PartyPopover] Room synced');

		renderParticipants();
	});

	// Message event
	partyService.on('message', () => {
		logger.info('[PartyPopover] New message');
		console.log('[PartyPopover] New message');

		renderMessages();
	});

	// Error event
	partyService.on('error', (error) => {
		logger.error('[PartyPopover] Error:', error);
		console.error('[PartyPopover] Error:', error);

		// Show error in join view if that's where we are
		if (joinView && !joinView.classList.contains('party-view-hidden')) {
			showJoinError(error.message || 'Failed to join party');
			showView('join');
		} else {
			// Show initial view with error logged
			showView('initial');
		}
	});

	// Disconnected event
	partyService.on('disconnected', () => {
		logger.info('[PartyPopover] Disconnected');
		console.log('[PartyPopover] Disconnected');

		if (isOpen) {
			showView('initial');
			updateParticipantCount(0);
		}
	});
}

/**
 * Handle escape key
 */
function handleEscape(e: KeyboardEvent): void {
	if (e.key === 'Escape' && isOpen) {
		closePartyPopover();
	}
}

/**
 * Open the party popover
 */
export function openPartyPopover(contentInfo?: { id: string; type: string; name: string }): void {
	logger.info('[PartyPopover] openPartyPopover called');
	console.log('[PartyPopover] openPartyPopover called, contentInfo:', contentInfo);

	if (isOpen) {
		logger.info('[PartyPopover] Popover already open, closing...');
		console.log('[PartyPopover] Popover already open, closing...');
		closePartyPopover();
		return;
	}

	// Check if already in a party (connection exists and has a room)
	if (partyService.connected && partyService.room) {
		logger.info('[PartyPopover] Already in a party, reopening...');
		console.log('[PartyPopover] Already in a party, room:', partyService.room.id);
		// Continue to show the existing party
	}

	// Store content info
	if (contentInfo) {
		currentContentInfo = contentInfo;
	} else {
		// Try to get content from current page
		currentContentInfo = getContentFromPage();
	}

	if (!currentContentInfo) {
		logger.error('[PartyPopover] No content info available');
		console.error('[PartyPopover] No content info available');
		return;
	}

	logger.info('[PartyPopover] Content info:', currentContentInfo);
	console.log('[PartyPopover] Content info:', currentContentInfo);

	// Remove existing popover
	const existingPopover = document.getElementById('party-popover');
	if (existingPopover) {
		existingPopover.remove();
	}

	// Get template with content info
	let template: string;
	try {
		template = getTemplate(currentContentInfo);
		logger.info('[PartyPopover] Template loaded, length:', template.length);
		console.log('[PartyPopover] Template loaded, length:', template.length);
	} catch (error) {
		logger.error('[PartyPopover] Failed to load template:', error);
		console.error('[PartyPopover] Failed to load template:', error);
		return;
	}

	// Create popover
	const container = document.createElement('div');
	container.innerHTML = template;

	// Extract and inject styles into document head
	const styleEl = container.querySelector('style');
	if (styleEl && !document.getElementById('party-popover-styles')) {
		const headStyle = document.createElement('style');
		headStyle.id = 'party-popover-styles';
		headStyle.textContent = styleEl.textContent || '';
		document.head.appendChild(headStyle);
		logger.info('[PartyPopover] Styles injected into head');
		console.log('[PartyPopover] Styles injected into head');
		// Remove style from container so it doesn't get duplicated
		styleEl.remove();
	}

	const popoverEl = container.firstElementChild as HTMLElement;
	if (!popoverEl) {
		logger.error('[PartyPopover] Failed to create popover element');
		console.error('[PartyPopover] Failed to create popover element');
		return;
	}

	// Append to body
	document.body.appendChild(popoverEl);
	popoverElement = document.getElementById('party-popover');

	if (!popoverElement) {
		logger.error('[PartyPopover] Failed to find popover in DOM');
		console.error('[PartyPopover] Failed to find popover in DOM');
		return;
	}

	isOpen = true;

	// Get view elements
	initialView = document.getElementById('party-initial-view');
	joinView = document.getElementById('party-join-view');
	roomView = document.getElementById('party-room-view');
	loadingView = document.getElementById('party-loading-view');

	// Setup event handlers
	setupEventHandlers();

	// Setup PartyService listeners
	setupPartyServiceListeners();

	// Show appropriate view based on connection state
	if (partyService.connected && partyService.room) {
		// Already in a party, show room view
		showView('room');
		updatePinDisplay(partyService.room.id);
		renderParticipants();
		renderMessages();
	} else {
		// Not in a party, show initial view
		showView('initial');
	}

	logger.info('[PartyPopover] Popover opened successfully');
	console.log('[PartyPopover] Popover opened successfully');
}

/**
 * Close the party popover
 */
export function closePartyPopover(): void {
	if (!isOpen) return;

	logger.info('[PartyPopover] Closing popover');
	console.log('[PartyPopover] Closing popover');

	// DON'T disconnect from party - keep the connection alive
	// so users can reopen the popover and still be in the party
	// Only remove the UI event listeners for this popover instance

	popoverElement?.remove();
	popoverElement = null;
	initialView = null;
	joinView = null;
	roomView = null;
	loadingView = null;
	isOpen = false;
	isJoiningMode = false; // Reset joining mode

	// Cleanup event listeners
	document.removeEventListener('keydown', handleEscape);

	logger.info('[PartyPopover] Popover closed (party still active)');
}

/**
 * Check if popover is open
 */
export function isPopoverOpen(): boolean {
	return isOpen;
}

/**
 * Get content info from current page
 */
function getContentFromPage(): { id: string; type: string; name: string } | null {
	const hash = location.hash;

	// Parse detail page URL
	const movieMatch = hash.match(/#\/detail\/movie\/(tt\d+)/);
	if (movieMatch) {
		const nameEl = document.querySelector('[class*="metadetails-container"] [class*="name-"]');
		const title = nameEl?.textContent?.trim() || 'Movie';
		return { id: movieMatch[1], type: 'movie', name: title };
	}

	const seriesMatch = hash.match(/#\/detail\/series\/(tt\d+)/);
	if (seriesMatch) {
		const nameEl = document.querySelector('[class*="metadetails-container"] [class*="name-"]');
		const title = nameEl?.textContent?.trim() || 'Series';
		return { id: seriesMatch[1], type: 'series', name: title };
	}

	return null;
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
 * Handle route changes
 */
export function handlePartyPopoverRoute(): void {
	// Keep popover open when navigating
	// But update content info if on detail page
	if (isOpen && location.hash.includes('#/detail/')) {
		const content = getContentFromPage();
		if (content) {
			currentContentInfo = content;
			// Update footer display
			const titleEl = document.querySelector('.party-content-title');
			const typeEl = document.querySelector('.party-content-type');
			if (titleEl) titleEl.textContent = content.name;
			if (typeEl) typeEl.textContent = content.type;
		}
	}
}

/**
 * Initialize party popover module
 */
export function initPartyPopover(): void {
	logger.info('[PartyPopover] Initializing party popover module...');
	console.log('[PartyPopover] Initializing party popover module...');

	// Listen for hash changes
	window.addEventListener('hashchange', handlePartyPopoverRoute);

	logger.info('[PartyPopover] Module initialized successfully');
	console.log('[PartyPopover] Module initialized successfully');
}

export default {
	open: openPartyPopover,
	close: closePartyPopover,
	isOpen: isPopoverOpen,
	init: initPartyPopover
};
