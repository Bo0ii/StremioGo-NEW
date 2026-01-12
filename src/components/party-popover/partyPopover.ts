import TemplateCache from '../../utils/templateCache';
import logger from '../../utils/logger';
import partyService, { WatchPartyRoom, WatchPartyMessage, WatchPartyMember } from '../../utils/PartyService';

// State
let popoverElement: HTMLElement | null = null;
let isOpen = false;
let currentContentInfo: { id: string; type: string; name: string } | null = null;

// View elements
let initialView: HTMLElement | null = null;
let roomView: HTMLElement | null = null;
let loadingView: HTMLElement | null = null;

// Crown SVG for host badge
const CROWN_SVG = `<svg class="party-host-crown" viewBox="0,0,256,256"><g fill="#9370db"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></g></svg>`;

// Toggle host button SVG
const TOGGLE_HOST_SVG = `<svg viewBox="0,0,256,256" fill="currentColor"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></svg>`;

// Avatar colors
const AVATAR_COLORS = ['#7b5bf5', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

/**
 * Get color for user based on userId
 */
function getColorForUser(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
function showView(viewName: 'initial' | 'room' | 'loading'): void {
	if (!initialView || !roomView || !loadingView) return;

	// Hide all views
	initialView.classList.add('party-view-hidden');
	roomView.classList.add('party-view-hidden');
	loadingView.classList.add('party-view-hidden');

	// Show selected view
	switch (viewName) {
		case 'initial':
			initialView.classList.remove('party-view-hidden');
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
 * Switch between Create and Join tabs
 */
function switchTab(tab: 'create' | 'join'): void {
	const createTab = document.getElementById('party-create-tab');
	const joinTab = document.getElementById('party-join-tab');
	const createForm = document.getElementById('party-create-form');
	const joinForm = document.getElementById('party-join-form');

	if (tab === 'create') {
		createTab?.classList.add('party-tab-active');
		joinTab?.classList.remove('party-tab-active');
		createForm?.classList.remove('party-form-hidden');
		joinForm?.classList.add('party-form-hidden');
	} else {
		createTab?.classList.remove('party-tab-active');
		joinTab?.classList.add('party-tab-active');
		createForm?.classList.add('party-form-hidden');
		joinForm?.classList.remove('party-form-hidden');
	}

	hideJoinError();
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
 * Update room display
 */
function updateRoomDisplay(room: WatchPartyRoom): void {
	// Update room name
	const roomName = document.getElementById('party-room-name');
	if (roomName) {
		roomName.textContent = room.name;
	}

	// Update party code
	const pinCode = document.getElementById('party-pin-code');
	if (pinCode) {
		pinCode.textContent = room.code;
	}

	// Render participants
	renderParticipants(room.members);
}

/**
 * Render participants list
 */
function renderParticipants(members: WatchPartyMember[]): void {
	const listEl = document.getElementById('party-participants-list');
	if (!listEl) return;

	const currentUserIsHost = partyService.isHost;
	const hostCount = members.filter(m => m.isHost).length;

	listEl.innerHTML = members.map(member => {
		const initial = member.userName.charAt(0).toUpperCase();
		const color = getColorForUser(member.userId);
		const canToggle = currentUserIsHost && (hostCount > 1 || !member.isHost);

		return `
			<div class="party-participant">
				<div class="party-participant-avatar" style="background-color: ${color};">
					${escapeHtml(initial)}
				</div>
				<span class="party-participant-name">${escapeHtml(member.userName)}</span>
				${member.isHost ? `<span class="party-participant-host">${CROWN_SVG}</span>` : ''}
				${canToggle ? `<button class="party-toggle-host-btn" data-userid="${member.userId}" title="Toggle host">${TOGGLE_HOST_SVG}</button>` : ''}
			</div>
		`;
	}).join('');

	// Add click handlers for toggle buttons
	listEl.querySelectorAll('.party-toggle-host-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const userId = (e.currentTarget as HTMLElement).dataset.userid;
			if (userId) {
				partyService.toggleHost(userId);
			}
		});
	});

	// Update participant count
	updateParticipantCount(members.length);
}

/**
 * Render chat messages
 */
function renderMessages(): void {
	const messagesEl = document.getElementById('party-chat-messages');
	if (!messagesEl) return;

	messagesEl.innerHTML = '';

	partyService.messages.forEach(msg => {
		addMessageToUI(msg);
	});

	// Scroll to bottom
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Add single message to UI
 */
function addMessageToUI(msg: WatchPartyMessage): void {
	const messagesEl = document.getElementById('party-chat-messages');
	if (!messagesEl) return;

	const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	const color = getColorForUser(msg.senderId);

	const messageEl = document.createElement('div');

	if (msg.senderId === 'system') {
		messageEl.className = 'party-chat-message party-chat-message-system';
		messageEl.innerHTML = `<span>${escapeHtml(msg.text)}</span>`;
	} else {
		messageEl.className = 'party-chat-message';
		messageEl.innerHTML = `
			<div class="party-chat-message-header">
				${msg.isHost ? `<svg class="party-chat-message-host" viewBox="0,0,256,256"><g fill="#9370db"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></g></svg>` : ''}
				<span class="party-chat-message-user" style="color: ${color};">
					${escapeHtml(msg.senderName)}
				</span>
				<span class="party-chat-message-time">${time}</span>
			</div>
			<div class="party-chat-message-text">${escapeHtml(msg.text)}</div>
		`;
	}

	messagesEl.appendChild(messageEl);
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Handle create party
 */
function handleCreateParty(): void {
	const usernameInput = document.getElementById('party-create-username') as HTMLInputElement;
	const partynameInput = document.getElementById('party-create-partyname') as HTMLInputElement;
	const passwordInput = document.getElementById('party-create-password') as HTMLInputElement;
	const joinAsHostInput = document.getElementById('party-create-joinashost') as HTMLInputElement;

	const username = usernameInput?.value.trim();
	const partyName = partynameInput?.value.trim() || 'Watch Party';
	const password = passwordInput?.value || '';
	const joinAsHost = joinAsHostInput?.checked || false;

	if (!username) {
		// Focus on username input
		usernameInput?.focus();
		return;
	}

	logger.info('[PartyPopover] Creating party:', { username, partyName, joinAsHost });
	console.log('[PartyPopover] Creating party:', { username, partyName, joinAsHost });

	showView('loading');
	setLoadingText('Creating party...');

	partyService.createParty(username, partyName, password, joinAsHost);
}

/**
 * Handle join party
 */
function handleJoinParty(): void {
	const usernameInput = document.getElementById('party-join-username') as HTMLInputElement;
	const codeInput = document.getElementById('party-join-code') as HTMLInputElement;
	const passwordInput = document.getElementById('party-join-password') as HTMLInputElement;

	const username = usernameInput?.value.trim();
	const partyCode = codeInput?.value.trim().toUpperCase();
	const password = passwordInput?.value || '';

	if (!username) {
		usernameInput?.focus();
		return;
	}

	if (!partyCode || partyCode.length < 5) {
		showJoinError('Please enter a valid party code');
		codeInput?.focus();
		return;
	}

	hideJoinError();

	logger.info('[PartyPopover] Joining party:', partyCode);
	console.log('[PartyPopover] Joining party:', { username, partyCode });

	showView('loading');
	setLoadingText('Joining party...');

	partyService.joinParty(username, partyCode, password);
}

/**
 * Handle copy PIN button click
 */
function handleCopyPin(): void {
	if (!partyService.room) return;

	const pin = partyService.room.code;

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

	partyService.leaveParty();
	partyService.removeAllListeners();

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

	partyService.sendChatMessage(text);
	input.value = '';
}

/**
 * Populate form with stored values
 */
function populateFormValues(): void {
	const storedUsername = partyService.getStoredUsername();
	const storedPartyName = partyService.getStoredPartyName();
	const storedJoinAsHost = partyService.getStoredJoinAsHost();

	// Create form
	const createUsername = document.getElementById('party-create-username') as HTMLInputElement;
	const createPartyname = document.getElementById('party-create-partyname') as HTMLInputElement;
	const createJoinAsHost = document.getElementById('party-create-joinashost') as HTMLInputElement;

	if (createUsername) createUsername.value = storedUsername;
	if (createPartyname) createPartyname.value = storedPartyName;
	if (createJoinAsHost) createJoinAsHost.checked = storedJoinAsHost;

	// Join form
	const joinUsername = document.getElementById('party-join-username') as HTMLInputElement;
	if (joinUsername) joinUsername.value = storedUsername;
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

	// Tab switching
	document.getElementById('party-create-tab')?.addEventListener('click', () => switchTab('create'));
	document.getElementById('party-join-tab')?.addEventListener('click', () => switchTab('join'));

	// Create form submit
	document.getElementById('party-create-submit')?.addEventListener('click', handleCreateParty);

	// Join form submit
	document.getElementById('party-join-submit')?.addEventListener('click', handleJoinParty);

	// Join code input - Enter key and uppercase transform
	const joinCodeInput = document.getElementById('party-join-code') as HTMLInputElement;
	joinCodeInput?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			handleJoinParty();
		}
	});
	joinCodeInput?.addEventListener('input', () => {
		joinCodeInput.value = joinCodeInput.value.toUpperCase();
	});

	// Room view buttons
	document.getElementById('party-copy-pin-btn')?.addEventListener('click', handleCopyPin);
	document.getElementById('party-leave-btn')?.addEventListener('click', handleLeaveParty);

	// Chat send button
	document.getElementById('party-chat-send-btn')?.addEventListener('click', handleSendMessage);

	// Chat input - Enter key
	document.getElementById('party-chat-input')?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
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

	// Room event (joined/created)
	partyService.on('room', (room: WatchPartyRoom) => {
		logger.info('[PartyPopover] Room event:', room);
		console.log('[PartyPopover] Room event:', room);

		showView('room');
		updateRoomDisplay(room);
		renderMessages();
	});

	// Message event
	partyService.on('message', (message: WatchPartyMessage) => {
		logger.info('[PartyPopover] New message');
		console.log('[PartyPopover] New message:', message);

		addMessageToUI(message);
	});

	// Error event
	partyService.on('error', (error: { message: string }) => {
		logger.error('[PartyPopover] Error:', error);
		console.error('[PartyPopover] Error:', error);

		// Show error in join view if we were joining
		if (loadingView && !loadingView.classList.contains('party-view-hidden')) {
			showJoinError(error.message || 'Connection failed');
			showView('initial');
			switchTab('join');
		} else {
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
		closePartyPopover();
		return;
	}

	// Store content info
	if (contentInfo) {
		currentContentInfo = contentInfo;
	} else {
		currentContentInfo = getContentFromPage();
	}

	if (!currentContentInfo) {
		logger.error('[PartyPopover] No content info available');
		console.error('[PartyPopover] No content info available');
		return;
	}

	// Remove existing popover
	const existingPopover = document.getElementById('party-popover');
	if (existingPopover) {
		existingPopover.remove();
	}

	// Get template
	let template: string;
	try {
		template = getTemplate(currentContentInfo);
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
		styleEl.remove();
	}

	const popoverEl = container.firstElementChild as HTMLElement;
	if (!popoverEl) {
		logger.error('[PartyPopover] Failed to create popover element');
		return;
	}

	// Append to body
	document.body.appendChild(popoverEl);
	popoverElement = document.getElementById('party-popover');

	if (!popoverElement) {
		logger.error('[PartyPopover] Failed to find popover in DOM');
		return;
	}

	isOpen = true;

	// Get view elements
	initialView = document.getElementById('party-initial-view');
	roomView = document.getElementById('party-room-view');
	loadingView = document.getElementById('party-loading-view');

	// Setup event handlers
	setupEventHandlers();

	// Setup PartyService listeners
	setupPartyServiceListeners();

	// Populate form with stored values
	populateFormValues();

	// Show appropriate view based on connection state
	if (partyService.connected && partyService.room) {
		showView('room');
		updateRoomDisplay(partyService.room);
		renderMessages();
	} else {
		showView('initial');
	}

	logger.info('[PartyPopover] Popover opened successfully');
}

/**
 * Close the party popover
 */
export function closePartyPopover(): void {
	if (!isOpen) return;

	logger.info('[PartyPopover] Closing popover');

	popoverElement?.remove();
	popoverElement = null;
	initialView = null;
	roomView = null;
	loadingView = null;
	isOpen = false;

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
	if (isOpen && location.hash.includes('#/detail/')) {
		const content = getContentFromPage();
		if (content) {
			currentContentInfo = content;
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

	// Listen for hash changes
	window.addEventListener('hashchange', handlePartyPopoverRoute);

	logger.info('[PartyPopover] Module initialized successfully');
}

export default {
	open: openPartyPopover,
	close: closePartyPopover,
	isOpen: isPopoverOpen,
	init: initPartyPopover
};
