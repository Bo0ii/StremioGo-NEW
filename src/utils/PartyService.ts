import { EventEmitter } from 'events';
import logger from './logger';

// WatchParty Protocol Version
const WATCHPARTY_VERSION = '1';

// Server configuration
const WATCHPARTY_SERVERS: Record<string, string> = {
	'S': 'wss://bo0ii-streamgo-party.hf.space',
};

// Timing constants
const PING_TIMEOUT = 34000; // 30s ping interval + 4s buffer
const SYNC_INTERVAL = 1000;
const MAX_SYNC_DELAY_MS = 300; // Max delay before forcing seek

// Storage keys for persisting user preferences
const STORAGE_KEYS = {
	USERNAME: 'streamgo_party_username',
	PARTY_NAME: 'streamgo_party_name',
	JOIN_AS_HOST: 'streamgo_party_join_as_host',
};

/**
 * Party member interface
 */
export interface WatchPartyMember {
	userId: string;
	userName: string;
	isHost: boolean;
}

/**
 * Party room interface
 */
export interface WatchPartyRoom {
	code: string;
	name: string;
	members: WatchPartyMember[];
}

/**
 * Chat message interface
 */
export interface WatchPartyMessage {
	senderId: string;
	senderName: string;
	isHost: boolean;
	text: string;
	timestamp: number;
}

/**
 * Command data for video sync
 */
export interface VideoSyncData {
	time: number;
	paused: boolean;
	playbackSpeed?: number;
	force?: boolean;
}

/**
 * WatchParty Service
 * Manages WebSocket connection to WatchParty server
 */
class PartyService extends EventEmitter {
	private socket: WebSocket | null = null;
	private pingTimeout: ReturnType<typeof setTimeout> | null = null;
	private syncInterval: ReturnType<typeof setInterval> | null = null;

	private _connected = false;
	private _room: WatchPartyRoom | null = null;
	private _messages: WatchPartyMessage[] = [];
	private _autoSync = true;
	private _latency = 0;
	private _startMsgTime = 0;
	private _failedServers: string[] = [];
	private _myUserId: string | null = null;

	// Getters
	get connected(): boolean { return this._connected; }
	get room(): WatchPartyRoom | null { return this._room; }
	get messages(): WatchPartyMessage[] { return this._messages; }
	get autoSync(): boolean { return this._autoSync; }
	get latency(): number { return this._latency; }

	/**
	 * Get current user's member info
	 */
	get currentUser(): WatchPartyMember | null {
		if (!this._room || !this._myUserId) return null;
		return this._room.members.find(m => m.userId === this._myUserId) || null;
	}

	/**
	 * Check if current user is a host
	 */
	get isHost(): boolean {
		return this.currentUser?.isHost || false;
	}

	/**
	 * Get stored username
	 */
	getStoredUsername(): string {
		return localStorage.getItem(STORAGE_KEYS.USERNAME) || '';
	}

	/**
	 * Get stored party name
	 */
	getStoredPartyName(): string {
		return localStorage.getItem(STORAGE_KEYS.PARTY_NAME) || 'Watch Party';
	}

	/**
	 * Get stored "join as host" preference
	 */
	getStoredJoinAsHost(): boolean {
		return localStorage.getItem(STORAGE_KEYS.JOIN_AS_HOST) === 'true';
	}

	/**
	 * Save username to storage
	 */
	saveUsername(username: string): void {
		localStorage.setItem(STORAGE_KEYS.USERNAME, username);
	}

	/**
	 * Save party name to storage
	 */
	savePartyName(partyName: string): void {
		localStorage.setItem(STORAGE_KEYS.PARTY_NAME, partyName);
	}

	/**
	 * Save "join as host" preference
	 */
	saveJoinAsHost(joinAsHost: boolean): void {
		localStorage.setItem(STORAGE_KEYS.JOIN_AS_HOST, joinAsHost.toString());
	}

	/**
	 * Pick an available server
	 */
	private pickServer(serverPrefix: string = ''): string | null {
		const availableServers = Object.entries(WATCHPARTY_SERVERS)
			.filter(([prefix]) => prefix.startsWith(serverPrefix))
			.filter(([, url]) => !this._failedServers.includes(url));

		if (availableServers.length === 0) {
			// If all servers failed with prefix, try any server
			if (serverPrefix) {
				return this.pickServer('');
			}
			return null;
		}

		// Pick random available server
		const [, url] = availableServers[Math.floor(Math.random() * availableServers.length)];
		return url;
	}

	/**
	 * Connect to server with protocol
	 */
	private connect(protocol: string, serverPrefix: string = ''): void {
		// Clean up existing connection
		if (this.socket) {
			this.disconnect();
		}

		const server = this.pickServer(serverPrefix);
		if (!server) {
			logger.error('[Party] No servers available');
			this.emit('error', { message: 'No servers available. Please try again later.' });
			return;
		}

		logger.info('[Party] Connecting to:', server);
		console.log('[Party] Connecting to:', server, 'with protocol:', protocol);

		try {
			// Connect with protocol as subprotocol header
			this.socket = new WebSocket(server, protocol);

			this.socket.onopen = () => {
				logger.info('[Party] Connected');
				this._connected = true;
				this.emit('connected');
			};

			this.socket.onclose = () => {
				logger.info('[Party] Disconnected');
				this._connected = false;
				this.cleanup();
				this.emit('disconnected');
			};

			this.socket.onerror = (error) => {
				logger.error('[Party] Connection error:', error);

				// Mark server as failed temporarily
				this._failedServers.push(server);
				setTimeout(() => {
					const index = this._failedServers.indexOf(server);
					if (index > -1) this._failedServers.splice(index, 1);
				}, 60000); // Retry server after 1 minute

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
	 * Create a new party
	 */
	createParty(username: string, partyName: string = 'Watch Party', password: string = '', joinAsHost: boolean = true): void {
		logger.info('[Party] Creating party:', partyName);
		console.log('[Party] Creating party:', { username, partyName, joinAsHost });

		// Save preferences
		this.saveUsername(username);
		this.savePartyName(partyName);
		this.saveJoinAsHost(joinAsHost);

		// Build protocol string: c#version#username#password#partyname#joinAsHost
		const protocol = `c#${WATCHPARTY_VERSION}#${encodeURIComponent(username)}#${encodeURIComponent(password)}#${encodeURIComponent(partyName)}#${joinAsHost ? '1' : '0'}`;

		this.connect(protocol);
	}

	/**
	 * Join an existing party
	 */
	joinParty(username: string, partyCode: string, password: string = ''): void {
		logger.info('[Party] Joining party:', partyCode);
		console.log('[Party] Joining party:', { username, partyCode });

		// Save username
		this.saveUsername(username);

		// Get server prefix from party code (first character)
		const serverPrefix = partyCode.charAt(0);

		// Build protocol string: j#version#username#partycode#password
		const protocol = `j#${WATCHPARTY_VERSION}#${encodeURIComponent(username)}#${partyCode}#${encodeURIComponent(password)}`;

		this.connect(protocol, serverPrefix);
	}

	/**
	 * Disconnect from party
	 */
	disconnect(): void {
		this.cleanup();

		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}

		this._connected = false;
		this._room = null;
		this._messages = [];
		this._myUserId = null;
	}

	/**
	 * Leave current party (alias for disconnect)
	 */
	leaveParty(): void {
		logger.info('[Party] Leaving party');
		this.disconnect();
		this.emit('left');
	}

	/**
	 * Clean up timers
	 */
	private cleanup(): void {
		if (this.pingTimeout) {
			clearTimeout(this.pingTimeout);
			this.pingTimeout = null;
		}
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
		}
	}

	/**
	 * Handle heartbeat
	 */
	private heartbeat(): void {
		if (this.pingTimeout) clearTimeout(this.pingTimeout);

		// Calculate latency
		this._latency = Date.now() - this._startMsgTime;

		// Set timeout for next ping
		this.pingTimeout = setTimeout(() => {
			logger.error('[Party] Connection timeout');
			this.emit('error', { message: 'Connection timeout' });
			this.disconnect();
		}, PING_TIMEOUT);
	}

	/**
	 * Handle incoming messages
	 */
	private handleMessage(msg: MessageEvent): void {
		const data = msg.data.toString();
		logger.info('[Party] Message:', data.substring(0, 100));
		console.log('[Party] Message:', data);

		// Ping - respond with pong
		if (data === 'ping') {
			this._startMsgTime = Date.now();
			this.socket?.send('pong');
			this.heartbeat();
			return;
		}

		// Bad room - invalid code or password
		if (data === 'badroom') {
			logger.error('[Party] Invalid party code or password');
			this.emit('error', { message: 'Invalid party code or password' });
			this.disconnect();
			return;
		}

		// Upgrade required - version mismatch
		if (data === 'upgrade') {
			logger.error('[Party] Version outdated');
			this.emit('error', { message: 'Party system needs to be updated' });
			this.disconnect();
			return;
		}

		// Party update
		if (data.startsWith('party:')) {
			try {
				const party = JSON.parse(data.substring(6)) as WatchPartyRoom;
				const previousRoom = this._room;

				// Store our user ID from the WebSocket key (set by server)
				if (!this._myUserId && this.socket) {
					// Find ourselves in the member list (we're the newest member)
					if (!previousRoom && party.members.length > 0) {
						// On first join, we're likely the last member added
						this._myUserId = party.members[party.members.length - 1].userId;
					}
				}

				// Detect join/leave/host changes for system messages
				if (previousRoom) {
					const oldMembers = previousRoom.members;
					const newMembers = party.members;

					// Member joined
					if (oldMembers.length < newMembers.length) {
						const joinedMember = newMembers.find(
							m => !oldMembers.some(om => om.userId === m.userId)
						);
						if (joinedMember) {
							this.addSystemMessage(`${joinedMember.userName} joined the party`);
						}
					}
					// Member left
					else if (oldMembers.length > newMembers.length) {
						const leftMember = oldMembers.find(
							m => !newMembers.some(nm => nm.userId === m.userId)
						);
						if (leftMember) {
							this.addSystemMessage(`${leftMember.userName} left the party`);
						}
					}
					// Host status changed
					else {
						for (const newMember of newMembers) {
							const oldMember = oldMembers.find(m => m.userId === newMember.userId);
							if (oldMember && oldMember.isHost !== newMember.isHost) {
								const action = newMember.isHost ? 'promoted to' : 'demoted from';
								this.addSystemMessage(`${newMember.userName} was ${action} host`);
							}
						}
					}
				}

				this._room = party;
				this.emit('room', party);
			} catch (error) {
				logger.error('[Party] Failed to parse party update:', error);
			}
			return;
		}

		// Command from host
		if (data.startsWith('cmd:')) {
			try {
				// Format: cmd:latency:command:jsonData
				const colonIndex1 = data.indexOf(':', 4);
				const colonIndex2 = data.indexOf(':', colonIndex1 + 1);

				const latency = parseInt(data.substring(4, colonIndex1));
				const command = data.substring(colonIndex1 + 1, colonIndex2);
				const jsonData = data.substring(colonIndex2 + 1);

				const commandData = jsonData && jsonData !== 'undefined' ? JSON.parse(jsonData) : null;

				this.emit('command', { latency, command, data: commandData });
				this.executeCommand(latency, command, commandData);
			} catch (error) {
				logger.error('[Party] Failed to parse command:', error);
			}
			return;
		}

		// Chat message
		if (data.startsWith('msg:')) {
			try {
				// Format: msg:userId:text
				const colonIndex = data.indexOf(':', 4);
				const senderId = data.substring(4, colonIndex);
				const text = data.substring(colonIndex + 1);

				// Find sender in party members
				const sender = this._room?.members.find(m => m.userId === senderId);

				const message: WatchPartyMessage = {
					senderId,
					senderName: sender?.userName || 'Unknown',
					isHost: sender?.isHost || false,
					text,
					timestamp: Date.now(),
				};

				this._messages.push(message);
				this.emit('message', message);
			} catch (error) {
				logger.error('[Party] Failed to parse message:', error);
			}
			return;
		}
	}

	/**
	 * Add system message
	 */
	private addSystemMessage(text: string): void {
		const message: WatchPartyMessage = {
			senderId: 'system',
			senderName: 'System',
			isHost: false,
			text,
			timestamp: Date.now(),
		};

		this._messages.push(message);
		this.emit('message', message);
	}

	/**
	 * Execute received command with latency compensation
	 */
	private executeCommand(latency: number, command: string, data: unknown): void {
		if (command === 'state' && data) {
			const stateData = data as VideoSyncData;
			const video = document.querySelector('video');

			if (!video || !this._autoSync) return;

			// Calculate latency compensation in seconds
			const latencySeconds = (latency + this._latency) / 1000;
			const maxDelay = (MAX_SYNC_DELAY_MS / 1000) * (stateData.playbackSpeed || 1);

			// Sync time with latency compensation
			const targetTime = stateData.time + latencySeconds;
			const timeDiff = Math.abs(video.currentTime - targetTime);

			if (timeDiff > maxDelay || stateData.force) {
				video.currentTime = targetTime;
			}

			// Sync play/pause
			if (stateData.paused !== video.paused) {
				if (stateData.paused) {
					video.pause();
				} else {
					video.play().catch(() => {
						// Autoplay might be blocked
					});
				}
			}

			// Sync playback speed
			if (stateData.playbackSpeed && video.playbackRate !== stateData.playbackSpeed) {
				video.playbackRate = stateData.playbackSpeed;
			}
		}
	}

	/**
	 * Broadcast command to party (host only)
	 */
	broadcastCommand(command: string, data: unknown): void {
		if (!this.socket || !this.isHost) return;

		const message = `cmd:${command}:${JSON.stringify(data)}`;
		this.socket.send(message);
	}

	/**
	 * Send a custom message to the server (advanced usage)
	 */
	send(type: string, data?: unknown): void {
		if (!this.socket) return;

		const message = data !== undefined
			? `${type}:${JSON.stringify(data)}`
			: type;
		this.socket.send(message);
	}

	/**
	 * Send chat message
	 */
	sendChatMessage(text: string): void {
		if (!this.socket || !this._room || !text.trim()) return;

		this.socket.send(`msg:${text.trim()}`);
	}

	/**
	 * Toggle host status for a user (host only)
	 */
	toggleHost(userId: string): void {
		if (!this.socket || !this.isHost) return;

		this.socket.send(`toggle:${userId}`);
	}

	/**
	 * Set auto-sync enabled/disabled
	 */
	setAutoSync(enabled: boolean): void {
		this._autoSync = enabled;
		this.emit('autoSyncChanged', enabled);
	}

	/**
	 * Start syncing video state
	 */
	startSync(getVideoElement: () => HTMLVideoElement | null): void {
		this.stopSync();

		this.syncInterval = setInterval(() => {
			const video = getVideoElement();
			if (!video || !this._room || !this.isHost) return;

			// Broadcast current video state
			this.broadcastCommand('state', {
				time: video.currentTime,
				paused: video.paused,
				playbackSpeed: video.playbackRate,
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
	 * Broadcast immediate state change (play/pause/seek)
	 */
	broadcastStateChange(video: HTMLVideoElement, force: boolean = false): void {
		if (!this.isHost) return;

		this.broadcastCommand('state', {
			time: video.currentTime,
			paused: video.paused,
			playbackSpeed: video.playbackRate,
			force,
		});
	}
}

// Singleton instance
const partyService = new PartyService();

export default partyService;
