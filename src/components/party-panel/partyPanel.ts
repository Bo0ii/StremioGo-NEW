import TemplateCache from '../../utils/templateCache';
import partyService, { WatchPartyRoom, WatchPartyMember, WatchPartyMessage } from '../../utils/PartyService';
import logger from '../../utils/logger';

// State
let panelElement: HTMLElement | null = null;
let isOpen = false;

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
 * Get the party panel template
 */
function getTemplate(): string {
	return TemplateCache.load(__dirname, 'party-panel');
}

/**
 * Show specific view
 */
function showView(viewName: 'initial' | 'room' | 'loading'): void {
	// Re-fetch elements to ensure they exist
	initialView = document.getElementById('party-panel-initial');
	roomView = document.getElementById('party-panel-room');
	loadingView = document.getElementById('party-panel-loading');

	if (!initialView || !roomView || !loadingView) {
		logger.warn('[PartyPanel] View elements not found');
		return;
	}

	// Hide all views with !important style to ensure they're hidden
	initialView.classList.add('party-view-hidden');
	initialView.style.display = 'none';
	roomView.classList.add('party-view-hidden');
	roomView.style.display = 'none';
	loadingView.classList.add('party-view-hidden');
	loadingView.style.display = 'none';

	// Show selected view
	switch (viewName) {
		case 'initial':
			initialView.classList.remove('party-view-hidden');
			initialView.style.display = 'flex';
			break;
		case 'room':
			roomView.classList.remove('party-view-hidden');
			roomView.style.display = 'flex';
			break;
		case 'loading':
			loadingView.classList.remove('party-view-hidden');
			loadingView.style.display = 'flex';
			break;
	}

	logger.info(`[PartyPanel] Switched to ${viewName} view`);
}

/**
 * Update loading text
 */
function setLoadingText(text: string): void {
	const loadingText = document.getElementById('party-panel-loading-text');
	if (loadingText) {
		loadingText.textContent = text;
	}
}

/**
 * Show error in join view
 */
function showJoinError(message: string): void {
	const errorEl = document.getElementById('party-panel-join-error');
	if (errorEl) {
		errorEl.textContent = message;
		errorEl.style.display = 'block';
	}
}

/**
 * Hide join error
 */
function hideJoinError(): void {
	const errorEl = document.getElementById('party-panel-join-error');
	if (errorEl) {
		errorEl.style.display = 'none';
	}
}

/**
 * Switch between Create and Join tabs
 */
function switchTab(tab: 'create' | 'join'): void {
	const createTab = document.getElementById('party-panel-create-tab');
	const joinTab = document.getElementById('party-panel-join-tab');
	const createForm = document.getElementById('party-panel-create-form');
	const joinForm = document.getElementById('party-panel-join-form');

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
	const badge = document.getElementById('party-panel-count');
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
	const roomName = document.getElementById('party-panel-room-name');
	if (roomName) {
		roomName.textContent = room.name;
	}

	// Update party code
	const pinCode = document.getElementById('party-panel-pin-code');
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
	const listEl = document.getElementById('party-panel-participants-list');
	if (!listEl) return;

	const currentUserIsHost = partyService.isHost;
	const hostCount = members.filter(m => m.isHost).length;

	// DEBUGGING: Log what we're about to render
	console.log('[PartyPanel] === RENDER DEBUG ===');
	console.log('[PartyPanel] Rendering', members.length, 'members');
	console.log('[PartyPanel] Current user is host:', currentUserIsHost);
	console.log('[PartyPanel] Host count:', hostCount);
	members.forEach((member, index) => {
		console.log(`[PartyPanel] Member ${index + 1}: ${member.userName} | isHost: ${member.isHost} | will show crown: ${member.isHost}`);
	});
	console.log('[PartyPanel] === END RENDER DEBUG ===');

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
	const messagesEl = document.getElementById('party-panel-messages');
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
	const messagesEl = document.getElementById('party-panel-messages');
	if (!messagesEl) return;

	const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	const color = getColorForUser(msg.senderId);

	const messageEl = document.createElement('div');

	if (msg.senderId === 'system') {
		messageEl.className = 'party-message party-message-system';
		messageEl.innerHTML = `<span>${escapeHtml(msg.text)}</span>`;
	} else {
		messageEl.className = 'party-message';
		messageEl.innerHTML = `
			<div class="party-message-header">
				${msg.isHost ? `<svg class="party-message-host" viewBox="0,0,256,256"><g fill="#9370db"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></g></svg>` : ''}
				<span class="party-message-user" style="color: ${color};">
					${escapeHtml(msg.senderName)}
				</span>
				<span class="party-message-time">${time}</span>
			</div>
			<div class="party-message-text">${escapeHtml(msg.text)}</div>
		`;
	}

	messagesEl.appendChild(messageEl);
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Handle create party
 */
function handleCreateParty(): void {
	const usernameInput = document.getElementById('party-panel-create-username') as HTMLInputElement;
	const partynameInput = document.getElementById('party-panel-create-partyname') as HTMLInputElement;
	const passwordInput = document.getElementById('party-panel-create-password') as HTMLInputElement;
	const joinAsHostInput = document.getElementById('party-panel-create-joinashost') as HTMLInputElement;

	const username = usernameInput?.value.trim();
	const partyName = partynameInput?.value.trim() || 'Watch Party';
	const password = passwordInput?.value || '';
	const joinAsHost = joinAsHostInput?.checked || false;

	if (!username) {
		usernameInput?.focus();
		return;
	}

	logger.info('[PartyPanel] Creating party:', { username, partyName, joinAsHost });

	showView('loading');
	setLoadingText('Creating party...');

	partyService.createParty(username, partyName, password, joinAsHost);
}

/**
 * Handle join party
 */
function handleJoinParty(): void {
	const usernameInput = document.getElementById('party-panel-join-username') as HTMLInputElement;
	const codeInput = document.getElementById('party-panel-join-code') as HTMLInputElement;
	const passwordInput = document.getElementById('party-panel-join-password') as HTMLInputElement;

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

	logger.info('[PartyPanel] Joining party:', partyCode);

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

	navigator.clipboard.writeText(pin).then(() => {
		logger.info('[PartyPanel] PIN copied to clipboard');

		const copyBtn = document.getElementById('party-panel-copy-btn');
		if (copyBtn) {
			const originalHTML = copyBtn.innerHTML;
			copyBtn.innerHTML = `
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
				</svg>
			`;
			setTimeout(() => {
				copyBtn.innerHTML = originalHTML;
			}, 2000);
		}
	}).catch(err => {
		logger.error('[PartyPanel] Failed to copy PIN:', err);
	});
}

/**
 * Handle leave party button click
 */
function handleLeaveParty(): void {
	logger.info('[PartyPanel] Leaving party...');

	partyService.leaveParty();

	showView('initial');
	updateParticipantCount(0);
}

/**
 * Handle send chat message
 */
function handleSendMessage(): void {
	const input = document.getElementById('party-panel-message-input') as HTMLInputElement;
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
	const createUsername = document.getElementById('party-panel-create-username') as HTMLInputElement;
	const createPartyname = document.getElementById('party-panel-create-partyname') as HTMLInputElement;
	const createJoinAsHost = document.getElementById('party-panel-create-joinashost') as HTMLInputElement;

	if (createUsername) createUsername.value = storedUsername;
	if (createPartyname) createPartyname.value = storedPartyName;
	if (createJoinAsHost) createJoinAsHost.checked = storedJoinAsHost;

	// Join form
	const joinUsername = document.getElementById('party-panel-join-username') as HTMLInputElement;
	if (joinUsername) joinUsername.value = storedUsername;
}

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
	// Close button
	document.getElementById('party-close-btn')?.addEventListener('click', closePartyPanel);

	// Escape key to close
	document.addEventListener('keydown', handleEscape);

	// Tab switching
	document.getElementById('party-panel-create-tab')?.addEventListener('click', () => switchTab('create'));
	document.getElementById('party-panel-join-tab')?.addEventListener('click', () => switchTab('join'));

	// Create form submit
	document.getElementById('party-panel-create-submit')?.addEventListener('click', handleCreateParty);

	// Join form submit
	document.getElementById('party-panel-join-submit')?.addEventListener('click', handleJoinParty);

	// Join code input - Enter key and uppercase transform
	const joinCodeInput = document.getElementById('party-panel-join-code') as HTMLInputElement;
	joinCodeInput?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			handleJoinParty();
		}
	});
	joinCodeInput?.addEventListener('input', () => {
		joinCodeInput.value = joinCodeInput.value.toUpperCase();
	});

	// Room view buttons
	document.getElementById('party-panel-copy-btn')?.addEventListener('click', handleCopyPin);
	document.getElementById('party-panel-leave-btn')?.addEventListener('click', handleLeaveParty);

	// Auto-sync toggle
	document.getElementById('party-panel-auto-sync')?.addEventListener('change', (e) => {
		const checked = (e.target as HTMLInputElement).checked;
		partyService.setAutoSync(checked);
	});

	// Chat send button
	document.getElementById('party-panel-send-btn')?.addEventListener('click', handleSendMessage);

	// Chat input - Enter key
	document.getElementById('party-panel-message-input')?.addEventListener('keydown', (e) => {
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
		logger.info('[PartyPanel] Connected to server');
	});

	// Room event (joined/created)
	partyService.on('room', (room: WatchPartyRoom) => {
		logger.info('[PartyPanel] Room event:', room);

		showView('room');
		updateRoomDisplay(room);
		renderMessages();
	});

	// Message event
	partyService.on('message', (message: WatchPartyMessage) => {
		logger.info('[PartyPanel] New message');

		addMessageToUI(message);
	});

	// Error event
	partyService.on('error', (error: { message: string }) => {
		logger.error('[PartyPanel] Error:', error);

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
		logger.info('[PartyPanel] Disconnected');

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
		closePartyPanel();
	}
}

/**
 * Open the party panel
 */
export function openPartyPanel(contentInfo?: { id: string; type: string; name: string }): void {
	logger.info('[PartyPanel] openPartyPanel called');

	if (isOpen) {
		logger.info('[PartyPanel] Panel already open, closing...');
		closePartyPanel();
		return;
	}

	// Content info can be used for room creation if needed
	if (contentInfo) {
		logger.info('[PartyPanel] Opening with content info:', contentInfo);
	}

	// Remove existing panel
	const existingPanel = document.getElementById('party-panel');
	if (existingPanel) {
		logger.info('[PartyPanel] Removing existing panel');
		existingPanel.remove();
	}

	// Get template
	logger.info('[PartyPanel] Getting template...');
	let template: string;
	try {
		template = getTemplate();
		logger.info('[PartyPanel] Template loaded, length:', template.length);
	} catch (error) {
		logger.error('[PartyPanel] Failed to load template:', error);
		return;
	}

	// Create panel
	logger.info('[PartyPanel] Creating panel element...');
	const container = document.createElement('div');
	container.innerHTML = template;

	// Extract and inject styles into document head
	const styleEl = container.querySelector('style');
	if (styleEl && !document.getElementById('party-panel-styles')) {
		const headStyle = document.createElement('style');
		headStyle.id = 'party-panel-styles';
		headStyle.textContent = styleEl.textContent || '';
		document.head.appendChild(headStyle);
	}

	const panelEl = container.firstElementChild as HTMLElement;
	if (!panelEl) {
		logger.error('[PartyPanel] Failed to create panel element from template');
		return;
	}

	// Add critical inline styles to ensure visibility
	panelEl.style.cssText = `
		position: fixed !important;
		top: 60px !important;
		right: 20px !important;
		width: 320px !important;
		max-height: calc(100vh - 100px) !important;
		background: rgba(18, 18, 20, 0.98) !important;
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
	document.body.appendChild(panelEl);

	panelElement = document.getElementById('party-panel');
	logger.info('[PartyPanel] Panel element in DOM:', !!panelElement);

	isOpen = true;

	// Get view elements
	initialView = document.getElementById('party-panel-initial');
	roomView = document.getElementById('party-panel-room');
	loadingView = document.getElementById('party-panel-loading');

	// Setup event handlers
	logger.info('[PartyPanel] Setting up event handlers...');
	setupEventHandlers();

	// Setup party service listeners
	logger.info('[PartyPanel] Setting up party listeners...');
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

	logger.info('[PartyPanel] Panel opened successfully!');
}

/**
 * Close the party panel
 */
export function closePartyPanel(): void {
	if (!isOpen) return;

	logger.info('[PartyPanel] Closing panel');

	panelElement?.remove();
	panelElement = null;
	initialView = null;
	roomView = null;
	loadingView = null;
	isOpen = false;

	// Cleanup event listeners
	document.removeEventListener('keydown', handleEscape);

	logger.info('[PartyPanel] Panel closed (party still active)');
}

/**
 * Check if panel is open
 */
export function isPanelOpen(): boolean {
	return isOpen;
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
export function handlePartyNavigation(): void {
	// Keep panel open when navigating
}

/**
 * Initialize party panel module
 */
export function initPartyPanel(): void {
	logger.info('[PartyPanel] Initializing party panel module...');

	// Listen for hash changes
	window.addEventListener('hashchange', handlePartyNavigation);

	logger.info('[PartyPanel] Module initialized successfully');
}

export default {
	open: openPartyPanel,
	close: closePartyPanel,
	isOpen: isPanelOpen,
	init: initPartyPanel
};
