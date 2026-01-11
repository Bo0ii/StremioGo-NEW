import { EventEmitter } from 'events';
import logger from './logger';

const WS_SERVER = 'wss://ws.peario.xyz';
const HEARTBEAT_INTERVAL = 2000;
const SYNC_INTERVAL = 1000;

export interface PartyUser {
	id: string;
	name: string;
	color: string;
}

export interface PartyRoom {
	id: string;
	owner: string;
	users: PartyUser[];
	stream?: {
		url?: string;
		infoHash?: string;
		title?: string;
	};
	meta?: {
		id: string;
		type: string;
		name: string;
		background?: string;
		logo?: string;
	};
	player: {
		paused: boolean;
		buffering: boolean;
		time: number;
	};
}

export interface PartyMessage {
	user: PartyUser;
	text: string;
	timestamp: number;
}

export interface PlayerSyncData {
	paused: boolean;
	buffering: boolean;
	time: number;
}

class PartyService extends EventEmitter {
	private socket: WebSocket | null = null;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private syncInterval: ReturnType<typeof setInterval> | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

	private _connected = false;
	private _ready = false;
	private _user: PartyUser | null = null;
	private _room: PartyRoom | null = null;
	private _messages: PartyMessage[] = [];
	private _autoSync = true;

	// Getters
	get connected(): boolean { return this._connected; }
	get ready(): boolean { return this._ready; }
	get user(): PartyUser | null { return this._user; }
	get room(): PartyRoom | null { return this._room; }
	get messages(): PartyMessage[] { return this._messages; }
	get autoSync(): boolean { return this._autoSync; }
	get isOwner(): boolean {
		return this._user && this._room ? this._room.owner === this._user.id : false;
	}

	/**
	 * Connect to the party server
	 */
	connect(): void {
		if (this.socket) {
			this.disconnect();
		}

		logger.info('[Party] Connecting to server...');

		try {
			this.socket = new WebSocket(WS_SERVER);

			this.socket.onopen = () => {
				logger.info('[Party] Connected to server');
				this._connected = true;
				this.emit('connected');

				// Start heartbeat
				this.heartbeatInterval = setInterval(() => {
					this.send('heartbeat', {});
				}, HEARTBEAT_INTERVAL);
			};

			this.socket.onclose = () => {
				logger.info('[Party] Disconnected from server');
				this._connected = false;
				this._ready = false;
				this.cleanup();
				this.emit('disconnected');
			};

			this.socket.onerror = (error) => {
				logger.error('[Party] WebSocket error:', error);
				this.emit('error', { message: 'Connection error' });
			};

			this.socket.onmessage = (msg) => {
				this.handleMessage(msg);
			};
		} catch (error) {
			logger.error('[Party] Failed to connect:', error);
			this.emit('error', { message: 'Failed to connect to party server' });
		}
	}

	/**
	 * Disconnect from the party server
	 */
	disconnect(): void {
		this.cleanup();

		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}

		this._connected = false;
		this._ready = false;
		this._user = null;
		this._room = null;
		this._messages = [];
	}

	/**
	 * Clean up intervals
	 */
	private cleanup(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(msg: MessageEvent): void {
		try {
			// Log raw message for debugging
			logger.info('[Party] RAW MESSAGE:', msg.data);
			console.log('[Party] RAW MESSAGE:', msg.data);

			const { type, payload } = JSON.parse(msg.data);

			// Log parsed message
			logger.info('[Party] PARSED MESSAGE - Type:', type, 'Payload:', payload);
			console.log('[Party] PARSED MESSAGE - Type:', type, 'Payload:', payload);

			switch (type) {
				case 'ready':
					this._ready = true;
					this._user = payload.user;
					logger.info('[Party] Ready, user:', this._user);
					console.log('[Party] Ready, user:', this._user);
					this.emit('ready', payload);
					break;

				case 'user':
					this._user = payload.user;
					logger.info('[Party] User updated:', this._user);
					console.log('[Party] User updated:', this._user);
					this.emit('user', payload);
					break;

				case 'room':
					this._room = payload;
					this._messages = [];
					logger.info('[Party] Joined room:', this._room?.id);
					console.log('[Party] Joined room:', this._room?.id);
					this.emit('room', payload);
					break;

				case 'sync':
					this._room = payload;
					logger.info('[Party] Room synced');
					console.log('[Party] Room synced');
					this.emit('sync', payload);
					break;

				case 'message':
					this._messages.push(payload);
					logger.info('[Party] Chat message received');
					console.log('[Party] Chat message received');
					this.emit('message', payload);
					break;

				case 'error':
					logger.error('[Party] Server error:', payload);
					console.error('[Party] Server error:', payload);
					this.emit('error', payload);
					break;

				default:
					logger.warn('[Party] Unknown message type:', type, 'Full message:', msg.data);
					console.warn('[Party] Unknown message type:', type, 'Full message:', msg.data);
			}
		} catch (error) {
			logger.error('[Party] Failed to parse message:', msg.data, error);
			console.error('[Party] Failed to parse message:', msg.data, error);
		}
	}

	/**
	 * Send a message to the server
	 */
	send(type: string, payload: unknown): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			logger.warn('[Party] Cannot send - not connected');
			console.warn('[Party] Cannot send - not connected');
			return;
		}

		const message = JSON.stringify({ type, payload });
		logger.info('[Party] SENDING MESSAGE:', message);
		console.log('[Party] SENDING MESSAGE:', message);
		this.socket.send(message);
	}

	/**
	 * Create a new party room
	 */
	createRoom(meta: { id: string; type: string; name: string; background?: string; logo?: string }): void {
		logger.info('[Party] Creating room for:', meta.name);
		this.send('room.new', {
			meta
		});
	}

	/**
	 * Join an existing party room
	 */
	joinRoom(roomId: string): void {
		logger.info('[Party] Joining room:', roomId);
		this.send('room.join', { id: roomId });
	}

	/**
	 * Leave the current room
	 */
	leaveRoom(): void {
		logger.info('[Party] Leaving room');

		// Notify server we're leaving the room
		if (this._room) {
			this.send('room.leave', { id: this._room.id });
		}

		this._room = null;
		this._messages = [];
		this.stopSync();
		this.emit('left');
	}

	/**
	 * Sync player state to room
	 */
	syncPlayer(data: PlayerSyncData): void {
		if (!this._room || !this._autoSync) return;

		this.send('player.sync', data);
	}

	/**
	 * Send a chat message
	 */
	sendMessage(text: string): void {
		if (!this._room || !text.trim()) return;

		this.send('message', { text: text.trim() });
	}

	/**
	 * Update room ownership
	 */
	updateOwnership(userId: string): void {
		if (!this._room || !this.isOwner) return;

		this.send('room.updateOwnership', { userId });
	}

	/**
	 * Set auto-sync enabled/disabled
	 */
	setAutoSync(enabled: boolean): void {
		this._autoSync = enabled;
		this.emit('autoSyncChanged', enabled);
	}

	/**
	 * Start syncing with video element
	 */
	startSync(getVideoElement: () => HTMLVideoElement | null): void {
		this.stopSync();

		this.syncInterval = setInterval(() => {
			const video = getVideoElement();
			if (!video || !this._room) return;

			// Sync all states - playing, paused, buffering, and time
			this.syncPlayer({
				paused: video.paused,
				buffering: video.readyState < 3,
				time: video.currentTime
			});
		}, SYNC_INTERVAL);
	}

	/**
	 * Stop syncing
	 */
	stopSync(): void {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
		}
	}

	/**
	 * Apply sync from room to video element
	 */
	applySyncToVideo(video: HTMLVideoElement, roomPlayer: { paused: boolean; time: number }): void {
		if (!this._autoSync) return;

		// Check time difference - only seek if > 1 second out of sync
		const timeDiff = roomPlayer.time - video.currentTime;
		if (Math.abs(timeDiff) > 1) {
			video.currentTime = roomPlayer.time;
			logger.debug('[Party] Synced time to:', roomPlayer.time);
		}

		// Sync play/pause state
		if (roomPlayer.paused && !video.paused) {
			video.pause();
		} else if (!roomPlayer.paused && video.paused) {
			video.play().catch(() => {
				// Autoplay might be blocked
			});
		}
	}
}

// Singleton instance
const partyService = new PartyService();

export default partyService;
