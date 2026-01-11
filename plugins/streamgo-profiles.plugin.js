/**
 * @name StreamGo Profiles
 * @description Multi-profile support with cloud sync via your own Supabase.
 * @version 1.0.0
 * @author Bo0ii
 */

(function() {
    'use strict';

    // Prevent duplicate initialization
    if (window.StreamGoProfiles) {
        console.log('[Profiles] Already initialized');
        return;
    }

    // ============================================
    // CONSTANTS
    // ============================================

    const PLUGIN_NAME = 'StreamGo Profiles';
    const MAX_PROFILES = 3;
    const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes - more frequent since each user has own Supabase
    const PROGRESS_SYNC_DEBOUNCE = 10000; // 10 seconds debounce for progress updates
    const IMMEDIATE_SYNC_ENABLED = true; // Sync immediately on changes

    // Stremio localStorage keys we need to monitor
    const STREMIO_KEYS = {
        LIBRARY: 'library',
        LIBRARY_RECENT: 'library_recent',  // Note: Stremio uses underscore, not camelCase
        PROFILE: 'profile',
        CINEMATA: 'cinemata',
    };

    const STORAGE_KEYS = {
        ACTIVE_PROFILE_ID: 'streamgo_active_profile_id',
        CACHED_PROFILES: 'streamgo_cached_profiles',
        DEVICE_ID: 'streamgo_device_id',
        LAST_SYNC_AT: 'streamgo_last_sync_at',
        PENDING_CHANGES: 'streamgo_pending_changes',
        CACHED_WATCHLIST: 'streamgo_cached_watchlist',
        CACHED_CONTINUE: 'streamgo_cached_continue',
        CACHED_FAVORITES: 'streamgo_cached_favorites',
        MAIN_PROFILE_ID: 'streamgo_main_profile_id', // First profile created - bound to existing data
        STREMIO_DATA_IMPORTED: 'streamgo_stremio_data_imported', // Flag to prevent re-importing
        LAST_ACCOUNT_ID: 'streamgo_last_account_id', // Track account changes
    };

    // Predefined avatars as inline SVGs
    const AVATARS = {
        'gradient-purple': {
            name: 'Purple',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gp" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#667eea"/><stop offset="100%" style="stop-color:#764ba2"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gp)"/></svg>`
        },
        'gradient-blue': {
            name: 'Blue',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4facfe"/><stop offset="100%" style="stop-color:#00f2fe"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gb)"/></svg>`
        },
        'gradient-green': {
            name: 'Green',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#11998e"/><stop offset="100%" style="stop-color:#38ef7d"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gg)"/></svg>`
        },
        'gradient-orange': {
            name: 'Orange',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="go" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f093fb"/><stop offset="100%" style="stop-color:#f5576c"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#go)"/></svg>`
        },
        'gradient-pink': {
            name: 'Pink',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gpink" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ff9a9e"/><stop offset="100%" style="stop-color:#fecfef"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gpink)"/></svg>`
        },
        'gradient-red': {
            name: 'Red',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f85032"/><stop offset="100%" style="stop-color:#e73827"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gr)"/></svg>`
        },
    };

    // ============================================
    // CONFIG MANAGER
    // ============================================

    class ConfigManager {
        constructor() {
            this.fs = require('fs');
            this.path = require('path');
            this.configPath = this.getConfigPath();
            this.config = null;
        }

        getConfigPath() {
            const os = require('os');
            const platform = process.platform;
            let basePath;

            if (platform === 'win32') {
                basePath = process.env.APPDATA || this.path.join(os.homedir(), 'AppData', 'Roaming');
            } else if (platform === 'darwin') {
                basePath = this.path.join(os.homedir(), 'Library', 'Application Support');
            } else {
                basePath = this.path.join(os.homedir(), '.config');
            }

            return this.path.join(basePath, 'streamgo', 'supabase-config.json');
        }

        ensureConfigDir() {
            const dir = this.path.dirname(this.configPath);
            if (!this.fs.existsSync(dir)) {
                this.fs.mkdirSync(dir, { recursive: true });
            }
        }

        loadConfig() {
            try {
                if (this.fs.existsSync(this.configPath)) {
                    const data = this.fs.readFileSync(this.configPath, 'utf8');
                    this.config = JSON.parse(data);
                    return this.config;
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to load config:`, e);
            }
            return null;
        }

        saveConfig(projectUrl, anonKey) {
            this.ensureConfigDir();
            this.config = {
                projectUrl: projectUrl.trim().replace(/\/$/, ''), // Remove trailing slash
                anonKey: anonKey.trim(),
                setupComplete: true,
                configuredAt: new Date().toISOString()
            };
            try {
                this.fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
                return true;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to save config:`, e);
                return false;
            }
        }

        isConfigured() {
            const config = this.config || this.loadConfig();
            return config && config.setupComplete && config.projectUrl && config.anonKey;
        }

        getProjectUrl() {
            return this.config?.projectUrl;
        }

        getAnonKey() {
            return this.config?.anonKey;
        }

        clearConfig() {
            try {
                if (this.fs.existsSync(this.configPath)) {
                    this.fs.unlinkSync(this.configPath);
                }
                this.config = null;
                return true;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to clear config:`, e);
                return false;
            }
        }
    }

    // ============================================
    // SUPABASE CLIENT (SDK-based with Realtime support)
    // ============================================

    class SupabaseClient {
        constructor(configManager, accountManager) {
            this.configManager = configManager;
            this.accountManager = accountManager;
            this.client = null;
            this.initialized = false;
        }

        async initialize() {
            if (this.initialized && this.client) return this.client;

            try {
                const { createClient } = require('@supabase/supabase-js');
                const projectUrl = this.configManager.getProjectUrl();
                const anonKey = this.configManager.getAnonKey();

                if (!projectUrl || !anonKey) {
                    console.log(`[${PLUGIN_NAME}] Missing Supabase credentials, cannot initialize`);
                    return null;
                }

                this.client = createClient(projectUrl, anonKey, {
                    realtime: {
                        params: {
                            eventsPerSecond: 10
                        }
                    },
                    global: {
                        headers: {
                            'x-account-id': this.accountManager.getHashedAccountId() || ''
                        }
                    }
                });

                this.initialized = true;
                console.log(`[${PLUGIN_NAME}] Supabase SDK initialized`);
                return this.client;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to initialize Supabase SDK:`, e);
                return null;
            }
        }

        // Update headers when account ID changes
        // Note: The Supabase SDK doesn't support changing global headers after initialization
        // We need to reinitialize the client with updated headers
        updateAccountId() {
            const accountId = this.accountManager.getHashedAccountId();
            console.log(`[${PLUGIN_NAME}] updateAccountId: Setting x-account-id to ${accountId?.substring(0, 16)}...`);

            // For SDK requests, we need to reinitialize to update headers
            // For now, the fetch fallback will use getHeaders() which always gets fresh account ID
            if (this.client && accountId) {
                // Try to update headers - this may not work in all SDK versions
                try {
                    if (this.client.rest && this.client.rest.headers) {
                        this.client.rest.headers['x-account-id'] = accountId;
                    }
                } catch (e) {
                    console.log(`[${PLUGIN_NAME}] Could not update SDK headers, will use fetch fallback`);
                }
            }
        }

        // Reinitialize the SDK client with current account ID (call this after account changes)
        async reinitialize() {
            this.initialized = false;
            this.client = null;
            return await this.initialize();
        }

        getHeaders() {
            const accountId = this.accountManager.getHashedAccountId();
            return {
                'apikey': this.configManager.getAnonKey(),
                'Authorization': `Bearer ${this.configManager.getAnonKey()}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
                'x-account-id': accountId || ''
            };
        }

        getUrl(table) {
            return `${this.configManager.getProjectUrl()}/rest/v1/${table}`;
        }

        async testConnection() {
            try {
                const response = await fetch(`${this.configManager.getProjectUrl()}/rest/v1/`, {
                    method: 'GET',
                    headers: {
                        'apikey': this.configManager.getAnonKey(),
                        'Authorization': `Bearer ${this.configManager.getAnonKey()}`
                    }
                });
                return response.ok || response.status === 404;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Connection test failed:`, e);
                return false;
            }
        }

        async checkTablesExist() {
            try {
                const response = await fetch(this.getUrl('profiles') + '?limit=1', {
                    method: 'GET',
                    headers: this.getHeaders()
                });
                return response.ok || response.status === 406;
            } catch (e) {
                return false;
            }
        }

        async select(table, options = {}) {
            // Always use fetch API for reliability - SDK has header issues
            // The fetch fallback uses getHeaders() which always gets fresh account ID
            let url = this.getUrl(table);
            const params = new URLSearchParams();

            if (options.select) params.append('select', options.select);
            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    params.append(key, `eq.${value}`);
                });
            }
            if (options.gt) {
                Object.entries(options.gt).forEach(([key, value]) => {
                    params.append(key, `gt.${value}`);
                });
            }
            if (options.order) params.append('order', options.order);
            if (options.limit) params.append('limit', options.limit);

            const queryString = params.toString();
            if (queryString) url += '?' + queryString;

            try {
                const headers = this.getHeaders();
                console.log(`[${PLUGIN_NAME}] Fetch ${table}: x-account-id=${headers['x-account-id']?.substring(0, 16)}...`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[${PLUGIN_NAME}] Fetch ${table} HTTP ${response.status}: ${errorText}`);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                console.log(`[${PLUGIN_NAME}] Fetch ${table}: ${data?.length || 0} rows`);
                return data;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Select ${table} failed:`, e.message || e);
                return [];
            }
        }

        async insert(table, data) {
            if (this.client) {
                try {
                    const { data: result, error } = await this.client
                        .from(table)
                        .insert(data)
                        .select();
                    if (error) throw error;
                    return result?.[0] || result;
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] SDK Insert failed, falling back to fetch:`, e);
                }
            }

            try {
                const response = await fetch(this.getUrl(table), {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                return result[0] || result;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Insert failed:`, e);
                return null;
            }
        }

        async update(table, data, match) {
            if (this.client) {
                try {
                    let query = this.client.from(table).update(data);
                    Object.entries(match).forEach(([key, value]) => {
                        query = query.eq(key, value);
                    });
                    const { data: result, error } = await query.select();
                    if (error) throw error;
                    return result?.[0] || result;
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] SDK Update failed, falling back to fetch:`, e);
                }
            }

            let url = this.getUrl(table);
            const params = new URLSearchParams();
            Object.entries(match).forEach(([key, value]) => {
                params.append(key, `eq.${value}`);
            });
            url += '?' + params.toString();

            try {
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: this.getHeaders(),
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                return result[0] || result;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Update failed:`, e);
                return null;
            }
        }

        async upsert(table, data) {
            // Determine correct conflict columns based on table
            // profile_continue_watching has UNIQUE(profile_id, content_id, video_id)
            // profile_watchlist and profile_favorites have UNIQUE(profile_id, content_id)
            const conflictColumns = table === 'profile_continue_watching'
                ? 'profile_id,content_id,video_id'
                : 'profile_id,content_id';

            if (this.client) {
                try {
                    const { data: result, error } = await this.client
                        .from(table)
                        .upsert(data, { onConflict: conflictColumns })
                        .select();
                    if (error) throw error;
                    return result?.[0] || result;
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] SDK Upsert failed, falling back to fetch:`, e);
                }
            }

            try {
                const headers = this.getHeaders();
                headers['Prefer'] = 'resolution=merge-duplicates,return=representation';

                // Add on_conflict query parameter for fetch fallback
                const url = `${this.getUrl(table)}?on_conflict=${conflictColumns}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                return result[0] || result;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Upsert failed for ${table}:`, e);
                return null;
            }
        }

        async delete(table, match) {
            if (this.client) {
                try {
                    let query = this.client.from(table).delete();
                    Object.entries(match).forEach(([key, value]) => {
                        query = query.eq(key, value);
                    });
                    const { error } = await query;
                    if (error) throw error;
                    return true;
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] SDK Delete failed, falling back to fetch:`, e);
                }
            }

            let url = this.getUrl(table);
            const params = new URLSearchParams();
            Object.entries(match).forEach(([key, value]) => {
                params.append(key, `eq.${value}`);
            });
            url += '?' + params.toString();

            try {
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });
                return response.ok;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Delete failed:`, e);
                return false;
            }
        }
    }

    // ============================================
    // REALTIME MANAGER (WebSocket subscriptions)
    // ============================================

    class RealtimeManager {
        constructor(supabaseClient, syncEngine) {
            this.supabase = supabaseClient;
            this.syncEngine = syncEngine;
            this.profileManager = null; // Set later via setProfileManager
            this.channel = null;
            this.isSubscribed = false;
        }

        setProfileManager(profileManager) {
            this.profileManager = profileManager;
        }

        async subscribeToProfileChanges() {
            if (!this.supabase.client) {
                console.log(`[${PLUGIN_NAME}] Supabase SDK not initialized, cannot subscribe to realtime`);
                return;
            }

            const profileId = this.profileManager?.getActiveProfileId();
            if (!profileId) {
                console.log(`[${PLUGIN_NAME}] No active profile, cannot subscribe to realtime`);
                return;
            }

            // Unsubscribe from previous channel
            await this.unsubscribe();

            console.log(`[${PLUGIN_NAME}] Subscribing to realtime for profile ${profileId}`);

            try {
                this.channel = this.supabase.client
                    .channel(`profile-${profileId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'profile_watchlist',
                            filter: `profile_id=eq.${profileId}`
                        },
                        (payload) => this.handleChange('watchlist', payload)
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'profile_continue_watching',
                            filter: `profile_id=eq.${profileId}`
                        },
                        (payload) => this.handleChange('continue', payload)
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'profile_favorites',
                            filter: `profile_id=eq.${profileId}`
                        },
                        (payload) => this.handleChange('favorites', payload)
                    )
                    .subscribe((status) => {
                        console.log(`[${PLUGIN_NAME}] Realtime subscription status: ${status}`);
                        this.isSubscribed = status === 'SUBSCRIBED';
                    });
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to subscribe to realtime:`, e);
            }
        }

        handleChange(type, payload) {
            console.log(`[${PLUGIN_NAME}] Realtime ${type} change:`, payload.eventType);

            const cacheMap = {
                'watchlist': { get: 'getCachedWatchlist', set: 'cacheWatchlist' },
                'continue': { get: 'getCachedContinueWatching', set: 'cacheContinueWatching' },
                'favorites': { get: 'getCachedFavorites', set: 'cacheFavorites' }
            };

            const { get, set } = cacheMap[type];
            const cached = [...this.syncEngine[get]()]; // Clone array

            if (payload.eventType === 'INSERT' && !payload.new.deleted_at) {
                // Add new item
                cached.unshift(payload.new);
            } else if (payload.eventType === 'UPDATE') {
                const idx = cached.findIndex(item => item.id === payload.new.id);
                if (idx !== -1) {
                    if (payload.new.deleted_at) {
                        // Soft deleted - remove from cache
                        cached.splice(idx, 1);
                    } else {
                        // Update item
                        cached[idx] = payload.new;
                    }
                }
            } else if (payload.eventType === 'DELETE') {
                const idx = cached.findIndex(item => item.id === payload.old.id);
                if (idx !== -1) {
                    cached.splice(idx, 1);
                }
            }

            this.syncEngine[set](cached);
        }

        async unsubscribe() {
            if (this.channel && this.supabase.client) {
                try {
                    await this.supabase.client.removeChannel(this.channel);
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] Error unsubscribing:`, e);
                }
                this.channel = null;
                this.isSubscribed = false;
            }
        }
    }

    // ============================================
    // DOM FILTER MANAGER (UI Filtering for Profile Isolation)
    // ============================================
    // Instead of modifying Stremio's localStorage (which doesn't work),
    // we filter the Continue Watching UI to only show items belonging
    // to the active profile. This works alongside Stremio, not against it.

    class DOMFilterManager {
        constructor(dataManager) {
            this.dataManager = dataManager;
            this.profileManager = null; // Set via setProfileManager
            this.observer = null;
            this.profileContentIds = new Set(); // Content IDs for active profile
            this.profileTitles = new Set(); // Titles for fallback matching
            this.filterDebounceTimer = null;
            this.initialized = false;
        }

        setProfileManager(manager) {
            this.profileManager = manager;
        }

        async init() {
            if (this.initialized) return;

            console.log(`[${PLUGIN_NAME}] Initializing DOM Filter Manager...`);

            // Inject CSS for hiding (ensures it works across all themes)
            this.injectFilterStyles();

            await this.loadProfileContentIds();
            this.setupObserver();

            // Initial filter with small delay to let DOM settle
            setTimeout(() => this.filterContinueWatching(), 500);

            this.initialized = true;
            console.log(`[${PLUGIN_NAME}] DOM Filter Manager initialized with ${this.profileContentIds.size} content IDs`);
        }

        injectFilterStyles() {
            if (document.getElementById('sgp-filter-styles')) return;

            const style = document.createElement('style');
            style.id = 'sgp-filter-styles';
            style.textContent = `
                /* StreamGo Profiles - DOM Filter Styles */

                /* Hidden items - completely remove from view */
                .sgp-hidden,
                [data-streamgo-hidden="true"] {
                    display: none !important;
                }

                /* Hidden row - completely hide */
                [data-streamgo-row-hidden="true"] {
                    display: none !important;
                }

                /* Fix Continue Watching row sizing - ensure same flex constraints as regular rows */
                [data-streamgo-cw-row="true"] .meta-item-QFHCh,
                [data-streamgo-cw-row="true"] [class*="meta-item"] {
                    flex: calc(1 / var(--poster-shape-ratio)) 0 250px !important;
                    flex-grow: 0 !important;
                }

                /* Ensure Continue Watching items have same base size as other rows */
                [data-streamgo-cw-row="true"] [class*="meta-items-container"] [class*="meta-item"] {
                    flex-basis: 250px !important;
                    max-width: 250px !important;
                }

                /* Optional: Reduce progress bar margin to minimize extra height */
                [data-streamgo-cw-row="true"] [class*="meta-item-container"] [class*="progress-bar-layer"] {
                    margin-top: 6px !important; /* Reduced from 10px */
                }
            `;
            document.head.appendChild(style);
            console.log(`[${PLUGIN_NAME}] Injected filter styles`);
        }

        async loadProfileContentIds(forceRefresh = false) {
            const profileId = this.profileManager?.getActiveProfileId();
            if (!profileId) {
                this.profileContentIds = new Set();
                this.profileTitles = new Set();
                console.log(`[${PLUGIN_NAME}] No active profile, clearing content IDs`);
                return;
            }

            try {
                // Force fresh fetch from Supabase to ensure we have correct profile data
                let continueWatching;
                if (forceRefresh) {
                    console.log(`[${PLUGIN_NAME}] Force fetching continue watching for profile ${profileId}`);
                    continueWatching = await this.dataManager.supabase.select('profile_continue_watching', {
                        filter: { profile_id: profileId },
                        order: 'last_watched_at.desc'
                    });
                    continueWatching = (continueWatching || []).filter(i => !i.deleted_at);
                } else {
                    continueWatching = await this.dataManager.getContinueWatching();
                }

                this.profileContentIds = new Set(continueWatching.map(item => item.content_id));
                // Also store normalized titles for fallback matching
                this.profileTitles = new Set(
                    continueWatching
                        .filter(item => item.title)
                        .map(item => item.title.toLowerCase().trim())
                );
                console.log(`[${PLUGIN_NAME}] Loaded ${this.profileContentIds.size} content IDs and ${this.profileTitles.size} titles for profile ${profileId}`);
                // Debug: show the actual IDs and titles loaded
                if (this.profileContentIds.size > 0) {
                    console.log(`[${PLUGIN_NAME}] Sample IDs:`, Array.from(this.profileContentIds).slice(0, 5).join(', '));
                    console.log(`[${PLUGIN_NAME}] Sample titles:`, Array.from(this.profileTitles).slice(0, 5).join(', '));
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to load content IDs:`, e);
                this.profileContentIds = new Set();
                this.profileTitles = new Set();
            }
        }

        setupObserver() {
            if (this.observer) {
                this.observer.disconnect();
            }

            // Watch for DOM changes (new items being rendered)
            this.observer = new MutationObserver((mutations) => {
                let shouldFilter = false;

                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const el = node;
                                // Check if this is a board row or contains meta items
                                if (el.matches && (
                                    el.matches('[class*="board-row"]') ||
                                    el.matches('[class*="meta-item"]') ||
                                    (el.querySelector && el.querySelector('[class*="meta-item"]'))
                                )) {
                                    shouldFilter = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (shouldFilter) break;
                }

                if (shouldFilter) {
                    // Debounce filter calls
                    clearTimeout(this.filterDebounceTimer);
                    this.filterDebounceTimer = setTimeout(() => {
                        requestAnimationFrame(() => this.filterContinueWatching());
                    }, 100);
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Helper to extract content ID and title from an element
        extractItemInfo(element) {
            if (!element) return { contentId: null, title: null };

            let contentId = null;
            let title = null;

            // ID patterns to look for
            const idPatterns = [
                /tt\d+/,           // IMDB ID
                /tmdb:\d+/,        // TMDB ID
                /kitsu:\d+/,       // Kitsu ID
            ];

            // Check element's own attributes for ID
            for (const attr of element.attributes || []) {
                const value = attr.value;
                for (const pattern of idPatterns) {
                    const match = value.match(pattern);
                    if (match) {
                        contentId = match[0];
                        break;
                    }
                }
                if (contentId) break;
            }

            // Check all anchors inside for ID
            if (!contentId) {
                const anchors = element.querySelectorAll('a[href]');
                for (const anchor of anchors) {
                    const href = anchor.getAttribute('href') || '';
                    // Look for /detail/TYPE/ID pattern
                    const detailMatch = href.match(/\/detail\/[^/]+\/([^/\s?#]+)/);
                    if (detailMatch) {
                        contentId = detailMatch[1];
                        break;
                    }
                    // Look for direct ID patterns
                    for (const pattern of idPatterns) {
                        const match = href.match(pattern);
                        if (match) {
                            contentId = match[0];
                            break;
                        }
                    }
                    if (contentId) break;
                }
            }

            // Check background images for poster URLs that might contain IDs
            if (!contentId) {
                const allElements = element.querySelectorAll('*');
                for (const el of allElements) {
                    const style = el.getAttribute('style') || '';
                    const bgMatch = style.match(/url\([^)]*\/(tt\d+|tmdb:\d+|kitsu:\d+)[^)]*\)/);
                    if (bgMatch) {
                        contentId = bgMatch[1];
                        break;
                    }
                }
            }

            // Extract title from various sources
            // 1. Look for title attribute
            title = element.getAttribute('title');

            // 2. Look for aria-label
            if (!title) {
                title = element.getAttribute('aria-label');
            }

            // 3. Look for text content in title-like elements
            if (!title) {
                const titleEl = element.querySelector('[class*="title"], [class*="name"], [class*="label"]');
                if (titleEl) {
                    title = titleEl.textContent?.trim();
                }
            }

            // 4. Look for title attribute on child elements
            if (!title) {
                const titledChild = element.querySelector('[title]');
                if (titledChild) {
                    title = titledChild.getAttribute('title');
                }
            }

            // 5. Look for alt text on images
            if (!title) {
                const img = element.querySelector('img[alt]');
                if (img) {
                    title = img.getAttribute('alt');
                }
            }

            return { contentId, title: title ? title.toLowerCase().trim() : null };
        }

        filterContinueWatching() {
            const allBoardRows = document.querySelectorAll('[class*="board-row"]');
            console.log(`[${PLUGIN_NAME}] filterContinueWatching: Found ${allBoardRows.length} board rows`);

            allBoardRows.forEach(row => {
                const rowTitle = row.querySelector('[class*="title"]')?.textContent?.toLowerCase() || '';

                // Only filter Continue Watching row
                if (!rowTitle.includes('continue') || !rowTitle.includes('watching')) {
                    return;
                }

                // Mark this as the Continue Watching row for CSS targeting
                row.setAttribute('data-streamgo-cw-row', 'true');

                console.log(`[${PLUGIN_NAME}] Found Continue Watching row, title: "${rowTitle}"`);

                // Find the items container - could be various class names
                const container = row.querySelector('[class*="meta-items-container"]') ||
                                  row.querySelector('[class*="items-container"]') ||
                                  row.querySelector('[class*="posters"]');

                if (!container) {
                    console.log(`[${PLUGIN_NAME}] No items container found in row`);
                    return;
                }

                console.log(`[${PLUGIN_NAME}] Container class: ${container.className}`);
                console.log(`[${PLUGIN_NAME}] Container has ${container.children.length} direct children`);

                // Debug: dump first child structure
                if (container.children.length > 0) {
                    const first = container.children[0];
                    console.log(`[${PLUGIN_NAME}] First item - tag: ${first.tagName}, class: ${first.className}`);
                    console.log(`[${PLUGIN_NAME}] First item innerHTML preview: ${first.innerHTML.substring(0, 500)}...`);

                    // Look for any anchors in this item
                    const anchors = first.querySelectorAll('a');
                    console.log(`[${PLUGIN_NAME}] First item has ${anchors.length} anchor(s)`);
                    anchors.forEach((a, i) => {
                        console.log(`[${PLUGIN_NAME}]   Anchor ${i}: href="${a.getAttribute('href')}", class="${a.className}", title="${a.getAttribute('title')}"`);
                    });

                    // Try to extract info from first item
                    const testInfo = this.extractItemInfo(first);
                    console.log(`[${PLUGIN_NAME}] First item info: ID=${testInfo.contentId || 'NONE'}, Title="${testInfo.title || 'NONE'}"`);
                }

                let visibleCount = 0;
                let totalItems = 0;
                let matchedByTitle = 0;
                const itemsToProcess = Array.from(container.children);

                itemsToProcess.forEach((item, index) => {
                    const { contentId, title } = this.extractItemInfo(item);

                    // Try to match by content ID first, then by title
                    let belongsToProfile = false;
                    let matchType = 'none';

                    if (contentId && this.profileContentIds.has(contentId)) {
                        belongsToProfile = true;
                        matchType = 'id';
                    } else if (title && this.profileTitles.has(title)) {
                        belongsToProfile = true;
                        matchType = 'title';
                        matchedByTitle++;
                    }

                    // Only process items we could identify (by ID or title)
                    if (contentId || title) {
                        totalItems++;

                        if (belongsToProfile) {
                            // Show - belongs to active profile
                            // Remove hiding styles/classes, add visible marker
                            item.classList.remove('sgp-hidden');
                            item.removeAttribute('data-streamgo-hidden');
                            item.setAttribute('data-streamgo-visible', 'true');
                            // Clear any inline styles we may have set
                            if (item.style.cssText.includes('visibility')) {
                                item.style.cssText = '';
                            }
                            visibleCount++;
                            if (index < 5) console.log(`[${PLUGIN_NAME}] Showing item ${index}: ${contentId || title} (matched by ${matchType})`);
                        } else {
                            // Hide - doesn't belong to active profile
                            // Use CSS class for hiding (no inline styles needed)
                            item.classList.add('sgp-hidden');
                            item.setAttribute('data-streamgo-hidden', 'true');
                            item.removeAttribute('data-streamgo-visible');
                            if (index < 5) console.log(`[${PLUGIN_NAME}] Hiding item ${index}: ${contentId || title}`);
                        }
                    } else {
                        if (index < 3) console.log(`[${PLUGIN_NAME}] Item ${index}: No ID or title found`);
                    }
                });

                console.log(`[${PLUGIN_NAME}] Processing complete: ${totalItems} items identified, ${visibleCount} visible (${matchedByTitle} matched by title)`);
                console.log(`[${PLUGIN_NAME}] Profile has ${this.profileContentIds.size} IDs, ${this.profileTitles.size} titles`);

                // If ALL items are hidden (new profile with no data), hide the entire row
                if (visibleCount === 0 && totalItems > 0) {
                    row.setAttribute('data-streamgo-row-hidden', 'true');
                    console.log(`[${PLUGIN_NAME}] Hiding entire Continue Watching row (0 items for this profile)`);
                } else if (visibleCount === 0 && totalItems === 0) {
                    // No items identified at all - something is wrong with our extraction
                    console.log(`[${PLUGIN_NAME}] WARNING: Could not identify any items! DOM structure may have changed.`);
                } else {
                    // Make sure row is visible
                    row.removeAttribute('data-streamgo-row-hidden');
                }
            });
        }

        async onProfileSwitch(newProfileId) {
            console.log(`[${PLUGIN_NAME}] DOM Filter: Profile switched to ${newProfileId}`);

            // Force refresh content IDs from Supabase (not cache) to ensure correct data
            await this.loadProfileContentIds(true);

            // Re-filter DOM
            this.filterContinueWatching();
        }

        // Add a content ID and title to the filter (called when user watches something)
        addContentId(contentId, title = null) {
            let added = false;
            if (contentId && !this.profileContentIds.has(contentId)) {
                this.profileContentIds.add(contentId);
                added = true;
            }
            if (title) {
                const normalizedTitle = title.toLowerCase().trim();
                if (!this.profileTitles.has(normalizedTitle)) {
                    this.profileTitles.add(normalizedTitle);
                    added = true;
                }
            }
            if (added) {
                console.log(`[${PLUGIN_NAME}] Added to filter: ID=${contentId}, Title="${title}" (now ${this.profileContentIds.size} IDs, ${this.profileTitles.size} titles)`);
                // Re-filter to show the new item
                this.filterContinueWatching();
            }
        }

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }

            // Remove all hidden/visible attributes and classes to restore original state
            document.querySelectorAll('[data-streamgo-hidden]').forEach(el => {
                el.classList.remove('sgp-hidden');
                el.removeAttribute('data-streamgo-hidden');
            });

            document.querySelectorAll('[data-streamgo-visible]').forEach(el => {
                el.removeAttribute('data-streamgo-visible');
            });

            document.querySelectorAll('[data-streamgo-row-hidden]').forEach(el => {
                el.removeAttribute('data-streamgo-row-hidden');
            });

            document.querySelectorAll('[data-streamgo-cw-row]').forEach(el => {
                el.removeAttribute('data-streamgo-cw-row');
            });

            // Remove injected styles
            const filterStyles = document.getElementById('sgp-filter-styles');
            if (filterStyles) {
                filterStyles.remove();
            }

            clearTimeout(this.filterDebounceTimer);
            this.initialized = false;
        }
    }

    // ============================================
    // LOCAL STORAGE MANAGER (Legacy - kept for profile data backup)
    // ============================================
    // NOTE: This class is kept for backward compatibility but is no longer
    // used for profile switching. DOM filtering is used instead.

    class LocalStorageManager {
        constructor() {
            this.PROFILE_DATA_PREFIX = 'streamgo_profile_data_';
        }

        // Clear profile data
        clearProfileData(profileId) {
            if (profileId) {
                localStorage.removeItem(`${this.PROFILE_DATA_PREFIX}${profileId}`);
            }
        }
    }

    // ============================================
    // OFFLINE QUEUE MANAGER
    // ============================================

    class OfflineQueueManager {
        constructor(supabaseClient) {
            this.supabase = supabaseClient;
            this.QUEUE_KEY = 'streamgo_offline_queue';
            this.isProcessing = false;

            // Setup network listeners
            window.addEventListener('online', () => {
                console.log(`[${PLUGIN_NAME}] Back online, processing queue...`);
                this.processQueue();
            });

            window.addEventListener('offline', () => {
                console.log(`[${PLUGIN_NAME}] Went offline, will queue changes...`);
            });
        }

        isOnline() {
            return navigator.onLine;
        }

        getQueue() {
            try {
                return JSON.parse(localStorage.getItem(this.QUEUE_KEY)) || [];
            } catch {
                return [];
            }
        }

        saveQueue(queue) {
            localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
        }

        enqueue(operation) {
            const queue = this.getQueue();
            queue.push({
                ...operation,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                retries: 0
            });
            this.saveQueue(queue);
            console.log(`[${PLUGIN_NAME}] Queued operation: ${operation.type} on ${operation.table}`);

            // Try to process immediately if online
            if (this.isOnline()) {
                this.processQueue();
            }
        }

        async processQueue() {
            if (this.isProcessing || !this.isOnline()) return;

            const queue = this.getQueue();
            if (queue.length === 0) return;

            this.isProcessing = true;
            console.log(`[${PLUGIN_NAME}] Processing ${queue.length} queued operations...`);

            const failed = [];

            for (const op of queue) {
                try {
                    await this.execute(op);
                    console.log(`[${PLUGIN_NAME}] Processed queued operation: ${op.type} on ${op.table}`);
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] Queue operation failed:`, e);
                    op.retries++;
                    if (op.retries < 3) {
                        failed.push(op);
                    }
                }
            }

            this.saveQueue(failed);
            this.isProcessing = false;

            if (failed.length > 0) {
                console.log(`[${PLUGIN_NAME}] ${failed.length} operations will retry later`);
            }
        }

        async execute(op) {
            const { type, table, data, match } = op;

            switch (type) {
                case 'INSERT':
                    await this.supabase.insert(table, data);
                    break;
                case 'UPDATE':
                    await this.supabase.update(table, data, match);
                    break;
                case 'UPSERT':
                    await this.supabase.upsert(table, data);
                    break;
                case 'DELETE':
                    await this.supabase.delete(table, match);
                    break;
                default:
                    throw new Error(`Unknown operation type: ${type}`);
            }
        }
    }

    // ============================================
    // ACCOUNT MANAGER
    // ============================================

    class AccountManager {
        constructor() {
            this.cachedHash = null;
            this.lastAuthKey = null;
        }

        getStremioAuthKey() {
            try {
                const profile = JSON.parse(localStorage.getItem('profile'));
                if (profile && profile.auth && profile.auth.key) {
                    return profile.auth.key;
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Could not retrieve Stremio auth key:`, e);
            }
            return null;
        }

        // Check if Stremio profile data is fully loaded (not just partially)
        isProfileDataReady() {
            try {
                const profile = JSON.parse(localStorage.getItem('profile'));
                // Just check that auth key exists and has reasonable length
                // Don't be too strict - Stremio's profile structure varies
                const ready = profile &&
                       profile.auth &&
                       profile.auth.key &&
                       profile.auth.key.length > 10;

                if (!ready) {
                    console.log(`[${PLUGIN_NAME}] Profile check: profile=${!!profile}, auth=${!!profile?.auth}, key=${!!profile?.auth?.key}, keyLen=${profile?.auth?.key?.length || 0}`);
                }
                return ready;
            } catch (e) {
                console.log(`[${PLUGIN_NAME}] Profile check failed:`, e.message);
                return false;
            }
        }

        // Check if the auth key has changed since last check
        hasAuthKeyChanged() {
            const currentKey = this.getStremioAuthKey();
            if (this.lastAuthKey && currentKey && this.lastAuthKey !== currentKey) {
                console.log(`[${PLUGIN_NAME}] Auth key changed!`);
                return true;
            }
            this.lastAuthKey = currentKey;
            return false;
        }

        async hashString(str) {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async computeHashedAccountId() {
            const authKey = this.getStremioAuthKey();
            if (!authKey) return null;
            this.cachedHash = await this.hashString(authKey);
            return this.cachedHash;
        }

        getHashedAccountId() {
            return this.cachedHash;
        }

        isLoggedIn() {
            return !!this.getStremioAuthKey();
        }
    }

    // ============================================
    // STREMIO INTEGRATION
    // ============================================

    class StremioIntegration {
        constructor(dataManager, profileManager, syncEngine) {
            this.dataManager = dataManager;
            this.profileManager = profileManager;
            this.syncEngine = syncEngine;
            this.domFilterManager = null;  // For notifying DOM filter of new watches
            this.progressDebounceTimers = {};
            this.lastLibraryState = null;
            this.isImporting = false;
            this.initialized = false;
        }

        setDOMFilterManager(manager) {
            this.domFilterManager = manager;
        }

        init() {
            if (this.initialized) return;
            this.initialized = true;

            console.log(`[${PLUGIN_NAME}] Initializing Stremio integration...`);

            // Hook into localStorage to monitor Stremio changes
            this.hookLocalStorage();

            // Monitor video player for continue watching
            this.monitorPlayback();

            // Monitor library UI for watchlist changes
            this.monitorLibraryUI();

            // Initial snapshot of library state
            this.captureLibraryState();

            console.log(`[${PLUGIN_NAME}] Stremio integration initialized`);
        }

        // Hook into localStorage setItem to detect Stremio changes
        hookLocalStorage() {
            const originalSetItem = localStorage.setItem.bind(localStorage);
            const self = this;

            localStorage.setItem = function(key, value) {
                const result = originalSetItem(key, value);

                // Monitor library changes (watchlist)
                if (key === STREMIO_KEYS.LIBRARY || key === STREMIO_KEYS.LIBRARY_RECENT) {
                    if (!self.isImporting) {
                        self.handleLibraryChange(key, value);
                    }
                }

                return result;
            };
        }

        // Handle library changes (items added/removed from watchlist)
        async handleLibraryChange(key, value) {
            const activeProfileId = this.profileManager.getActiveProfileId();
            if (!activeProfileId) return;

            try {
                const newLibrary = JSON.parse(value);
                const oldLibrary = this.lastLibraryState;

                if (!oldLibrary) {
                    this.lastLibraryState = newLibrary;
                    return;
                }

                // Find new items (added to library/watchlist)
                const newItems = this.findNewLibraryItems(oldLibrary, newLibrary);
                const removedItems = this.findRemovedLibraryItems(oldLibrary, newLibrary);

                // Sync new items to backend
                for (const item of newItems) {
                    console.log(`[${PLUGIN_NAME}] Adding to watchlist:`, item.name || item._id);
                    await this.dataManager.addToWatchlist(
                        item._id || item.id,
                        item.type || 'movie',
                        item.name || item.title,
                        item.poster
                    );
                }

                // Soft-delete removed items
                for (const item of removedItems) {
                    console.log(`[${PLUGIN_NAME}] Removing from watchlist:`, item.name || item._id);
                    await this.dataManager.removeFromWatchlist(item._id || item.id);
                }

                this.lastLibraryState = newLibrary;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error handling library change:`, e);
            }
        }

        findNewLibraryItems(oldLib, newLib) {
            const oldIds = new Set(Object.keys(oldLib || {}));
            const newItems = [];

            for (const [id, item] of Object.entries(newLib || {})) {
                if (!oldIds.has(id)) {
                    newItems.push({ ...item, _id: id });
                }
            }

            return newItems;
        }

        findRemovedLibraryItems(oldLib, newLib) {
            const newIds = new Set(Object.keys(newLib || {}));
            const removedItems = [];

            for (const [id, item] of Object.entries(oldLib || {})) {
                if (!newIds.has(id)) {
                    removedItems.push({ ...item, _id: id });
                }
            }

            return removedItems;
        }

        // Monitor video player for continue watching progress
        monitorPlayback() {
            // Watch for video element creation
            const observer = new MutationObserver((mutations) => {
                const video = document.querySelector('video');
                if (video && !video._sgpMonitored) {
                    video._sgpMonitored = true;
                    this.attachVideoListeners(video);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Also check if video already exists
            const existingVideo = document.querySelector('video');
            if (existingVideo && !existingVideo._sgpMonitored) {
                existingVideo._sgpMonitored = true;
                this.attachVideoListeners(existingVideo);
            }
        }

        attachVideoListeners(video) {
            console.log(`[${PLUGIN_NAME}] Attaching video listeners`);

            // Debounced progress update
            const updateProgress = () => {
                this.handleProgressUpdate(video);
            };

            // Update on timeupdate (debounced)
            video.addEventListener('timeupdate', () => {
                const contentId = this.getCurrentContentId();
                if (!contentId) return;

                // Clear existing timer
                if (this.progressDebounceTimers[contentId]) {
                    clearTimeout(this.progressDebounceTimers[contentId]);
                }

                // Set new debounced timer
                this.progressDebounceTimers[contentId] = setTimeout(updateProgress, PROGRESS_SYNC_DEBOUNCE);
            });

            // Always update on pause and before unload
            video.addEventListener('pause', updateProgress);
            video.addEventListener('ended', updateProgress);
            window.addEventListener('beforeunload', updateProgress);
        }

        async handleProgressUpdate(video) {
            const activeProfileId = this.profileManager.getActiveProfileId();
            if (!activeProfileId) {
                console.log(`[${PLUGIN_NAME}] handleProgressUpdate: No active profile, skipping`);
                return;
            }

            const contentInfo = this.getCurrentContentInfo();
            if (!contentInfo || !contentInfo.contentId) {
                console.log(`[${PLUGIN_NAME}] handleProgressUpdate: No content info found`);
                return;
            }

            const progress = video.currentTime;
            const duration = video.duration;

            // Only sync if meaningful progress (more than 30 seconds watched)
            if (progress < 30) {
                console.log(`[${PLUGIN_NAME}] handleProgressUpdate: Progress too low (${Math.floor(progress)}s < 30s), skipping`);
                return;
            }

            console.log(`[${PLUGIN_NAME}] Updating progress for ${contentInfo.contentId} (${contentInfo.title}): ${Math.floor(progress)}s / ${Math.floor(duration)}s`);
            console.log(`[${PLUGIN_NAME}] Active profile: ${activeProfileId}`);

            try {
                const result = await this.dataManager.updateProgress(
                    contentInfo.contentId,
                    contentInfo.videoId,
                    progress,
                    duration,
                    {
                        type: contentInfo.type,
                        title: contentInfo.title,
                        poster: contentInfo.poster,
                        season: contentInfo.season,
                        episode: contentInfo.episode,
                        streamHash: contentInfo.streamHash
                    }
                );
                console.log(`[${PLUGIN_NAME}] Progress update result:`, result ? 'success' : 'failed');

                // Notify DOM filter that this content is now part of the active profile
                // This ensures it will be visible in Continue Watching after watching
                if (this.domFilterManager) {
                    this.domFilterManager.addContentId(contentInfo.contentId, contentInfo.title);
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to update progress:`, e);
            }
        }

        getCurrentContentId() {
            // Try to extract content ID (IMDB/TMDB ID) from various sources
            const url = window.location.hash || window.location.href;

            // Method 1: Match detail page URL patterns like #/detail/movie/tt1234567
            const detailMatch = url.match(/detail\/(movie|series)\/([^\/\?]+)/);
            if (detailMatch) {
                return detailMatch[2];
            }

            // Method 2: When in player, get content ID from library_recent (most recently played)
            try {
                const libraryRecent = JSON.parse(localStorage.getItem('library_recent') || '{}');
                const items = libraryRecent.items || libraryRecent;

                // Find the most recently updated item
                let mostRecent = null;
                let mostRecentTime = 0;

                for (const [id, item] of Object.entries(items)) {
                    // Look for IMDB ID pattern
                    if (id.match(/^tt\d+/) || id.match(/^tmdb:/) || id.match(/^kitsu:/)) {
                        const updateTime = item.mtime || item.state?.lastWatched || 0;
                        if (updateTime > mostRecentTime) {
                            mostRecentTime = updateTime;
                            mostRecent = id;
                        }
                    }
                }

                if (mostRecent) {
                    console.log(`[${PLUGIN_NAME}] getCurrentContentId: Found from library_recent: ${mostRecent}`);
                    return mostRecent;
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] getCurrentContentId: Error reading library_recent:`, e);
            }

            // Method 3: Look for IMDB ID pattern in the full URL
            const imdbMatch = url.match(/(tt\d+)/);
            if (imdbMatch) {
                return imdbMatch[1];
            }

            // Method 4: Check for lastOpenedContent in localStorage
            try {
                const lastContent = localStorage.getItem('lastOpenedContent');
                if (lastContent) {
                    const parsed = JSON.parse(lastContent);
                    if (parsed.id || parsed.imdbId) {
                        return parsed.id || parsed.imdbId;
                    }
                }
            } catch (e) {
                // Ignore
            }

            console.log(`[${PLUGIN_NAME}] getCurrentContentId: Could not find content ID`);
            return null;
        }

        getCurrentContentInfo() {
            const contentId = this.getCurrentContentId();
            if (!contentId) return null;

            const url = window.location.hash || window.location.href;

            // Determine type from URL or library data
            let type = 'movie';
            if (url.includes('/series/') || url.includes('series')) {
                type = 'series';
            }

            // Try to get type and title from library_recent
            let title = '';
            let poster = '';
            try {
                const libraryRecent = JSON.parse(localStorage.getItem('library_recent') || '{}');
                const items = libraryRecent.items || libraryRecent;
                const item = items[contentId];
                if (item) {
                    title = item.name || item.title || '';
                    poster = item.poster || '';
                    type = item.type || type;
                    console.log(`[${PLUGIN_NAME}] getCurrentContentInfo: Found in library_recent - title: "${title}", type: ${type}`);
                }
            } catch (e) {
                // Ignore
            }

            // Fallback: Try to get title from page (but be careful not to get "Continue watching")
            if (!title) {
                // Look for specific title elements in the player
                const playerTitleEl = document.querySelector('[class*="nav-bar"] [class*="title"], [class*="details-info"] [class*="title"], [class*="meta-preview"] [class*="title"]');
                if (playerTitleEl) {
                    title = playerTitleEl.textContent?.trim() || '';
                }
            }

            // Fallback: Try to get poster from page
            if (!poster) {
                const posterEl = document.querySelector('[class*="poster-"] img, [class*="background-"] img');
                if (posterEl) {
                    poster = posterEl.src;
                }
            }

            // For series, try to extract season/episode
            let season = null;
            let episode = null;
            let videoId = contentId;

            const episodeMatch = url.match(/(\d+):(\d+):(\d+)/);
            if (episodeMatch) {
                season = parseInt(episodeMatch[2]);
                episode = parseInt(episodeMatch[3]);
                videoId = `${contentId}:${season}:${episode}`;
            }

            console.log(`[${PLUGIN_NAME}] getCurrentContentInfo: contentId=${contentId}, title="${title}", type=${type}`);

            return {
                contentId,
                videoId,
                type,
                title,
                poster,
                season,
                episode,
                streamHash: this.getStreamHash()
            };
        }

        getStreamHash() {
            // Try to get the current stream hash from Stremio's state
            try {
                const lastStreams = JSON.parse(localStorage.getItem('lastStreams') || '{}');
                const contentId = this.getCurrentContentId();
                if (contentId && lastStreams[contentId]) {
                    return lastStreams[contentId];
                }
            } catch (e) {
                // Ignore
            }
            return null;
        }

        // Monitor library UI for changes (backup detection method)
        monitorLibraryUI() {
            // Watch for clicks on add/remove library buttons
            document.addEventListener('click', async (e) => {
                const target = e.target;

                // Check if clicking on library/watchlist button
                if (target.closest('[class*="add-to-library"]') ||
                    target.closest('[class*="remove-from-library"]') ||
                    target.closest('[class*="library-button"]')) {

                    // Wait a bit for Stremio to update, then re-capture state
                    setTimeout(() => {
                        this.captureLibraryState();
                    }, 500);
                }
            }, true);
        }

        // Capture current library state
        captureLibraryState() {
            try {
                const libraryStr = localStorage.getItem(STREMIO_KEYS.LIBRARY);
                if (libraryStr) {
                    this.lastLibraryState = JSON.parse(libraryStr);
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error capturing library state:`, e);
            }
        }

        // Import existing Stremio data for the first (main) profile
        async importExistingStremioData(profileId) {
            // Check if already imported
            if (localStorage.getItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED) === 'true') {
                console.log(`[${PLUGIN_NAME}] Stremio data already imported, skipping`);
                return;
            }

            console.log(`[${PLUGIN_NAME}] Importing existing Stremio data to profile ${profileId}...`);
            this.isImporting = true;

            try {
                // Import library items (watchlist)
                await this.importLibraryItems(profileId);

                // Import continue watching (libraryRecent + cinemata progress)
                await this.importContinueWatching(profileId);

                // Mark as imported
                localStorage.setItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED, 'true');
                localStorage.setItem(STORAGE_KEYS.MAIN_PROFILE_ID, profileId);

                console.log(`[${PLUGIN_NAME}] Successfully imported Stremio data`);
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error importing Stremio data:`, e);
            }

            this.isImporting = false;
        }

        async importLibraryItems(profileId) {
            try {
                const libraryStr = localStorage.getItem(STREMIO_KEYS.LIBRARY);
                if (!libraryStr) return;

                const libraryData = JSON.parse(libraryStr);

                // Handle potential nested structure: {uid: "...", items: {...}} or direct object
                const library = libraryData.items || libraryData;
                let imported = 0;

                for (const [id, item] of Object.entries(library)) {
                    if (!item || typeof item !== 'object' || item.removed) continue; // Skip removed or invalid items

                    await this.dataManager.addToWatchlist(
                        id,
                        item.type || 'movie',
                        item.name,
                        item.poster
                    );
                    imported++;
                }

                console.log(`[${PLUGIN_NAME}] Imported ${imported} library items`);
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error importing library:`, e);
            }
        }

        async importContinueWatching(profileId) {
            try {
                // Get library recent (has lastWatched timestamps and videoId)
                const libraryRecentStr = localStorage.getItem(STREMIO_KEYS.LIBRARY_RECENT);
                if (!libraryRecentStr) return;

                const libraryRecentData = JSON.parse(libraryRecentStr);

                // Handle nested structure: {uid: "...", items: {...}} or direct object
                const libraryRecent = libraryRecentData.items || libraryRecentData;

                // Get cinemata for additional progress data
                let cinemata = {};
                try {
                    const cinemataStr = localStorage.getItem(STREMIO_KEYS.CINEMATA);
                    if (cinemataStr) {
                        cinemata = JSON.parse(cinemataStr);
                    }
                } catch (e) { /* ignore */ }

                // Get library for metadata
                let library = {};
                try {
                    const libraryStr = localStorage.getItem(STREMIO_KEYS.LIBRARY);
                    if (libraryStr) {
                        library = JSON.parse(libraryStr);
                    }
                } catch (e) { /* ignore */ }

                let imported = 0;

                for (const [id, recentItem] of Object.entries(libraryRecent)) {
                    // Skip invalid items
                    if (!recentItem || typeof recentItem !== 'object') continue;

                    // Only import items that have actual watch progress (state.timeOffset > 0)
                    // The "removed" flag just means removed from library, not that watch history is invalid
                    const state = recentItem.state || {};
                    if (!state.timeOffset || state.timeOffset <= 0) continue;

                    const libItem = library[id] || {};

                    // Get progress info from state object (Stremio's actual structure)
                    // state.timeOffset = current playback position in ms
                    // state.duration = total duration in ms
                    // state.video_id = specific video/episode ID
                    let progress = state.timeOffset || 0;
                    let duration = state.duration || 0;
                    let videoId = state.video_id || recentItem.videoId || id;

                    // Convert from milliseconds to seconds if values seem too large
                    if (progress > 100000) progress = progress / 1000;
                    if (duration > 100000) duration = duration / 1000;

                    // Fallback to cinemata if state doesn't have progress
                    if (progress === 0 && cinemata && cinemata[id]) {
                        const cinemataItem = cinemata[id];
                        if (cinemataItem.progress) progress = cinemataItem.progress;
                        if (cinemataItem.duration) duration = cinemataItem.duration;
                    }

                    // Extract season/episode from videoId (format: tt1234567:1:5 = season 1 episode 5)
                    let season = null;
                    let episode = null;
                    const episodeMatch = videoId.match(/:(\d+):(\d+)$/);
                    if (episodeMatch) {
                        season = parseInt(episodeMatch[1]);
                        episode = parseInt(episodeMatch[2]);
                    }

                    await this.dataManager.updateProgress(
                        id,
                        videoId,
                        progress,
                        duration,
                        {
                            type: recentItem.type || libItem.type || 'movie',
                            title: recentItem.name || libItem.name,
                            poster: recentItem.poster || libItem.poster,
                            season,
                            episode,
                            lastWatched: state.lastWatched
                        }
                    );
                    imported++;
                }

                console.log(`[${PLUGIN_NAME}] Imported ${imported} continue watching items`);
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error importing continue watching:`, e);
            }
        }

        // Force import existing Stremio data - for users who already created a profile
        async forceImportStremioData() {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) {
                console.error(`[${PLUGIN_NAME}] No active profile, cannot import Stremio data`);
                return { success: false, error: 'No active profile' };
            }

            console.log(`[${PLUGIN_NAME}] Force importing Stremio data to profile ${profileId}...`);

            // Clear the imported flag to allow re-import
            localStorage.removeItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED);

            // Clear existing caches
            this.syncEngine.cacheWatchlist([]);
            this.syncEngine.cacheContinueWatching([]);
            this.syncEngine.cacheFavorites([]);

            this.isImporting = true;

            try {
                // Get current counts before import
                const libraryStr = localStorage.getItem(STREMIO_KEYS.LIBRARY);
                const libraryRecentStr = localStorage.getItem(STREMIO_KEYS.LIBRARY_RECENT);

                const libraryData = libraryStr ? JSON.parse(libraryStr) : {};
                const libraryRecentData = libraryRecentStr ? JSON.parse(libraryRecentStr) : {};

                // Handle nested structure: {uid: "...", items: {...}} or direct object
                const library = libraryData.items || libraryData;
                const libraryRecent = libraryRecentData.items || libraryRecentData;

                const libraryCount = Object.keys(library).filter(k => library[k] && typeof library[k] === 'object' && !library[k].removed).length;
                const recentCount = Object.keys(libraryRecent).length;

                console.log(`[${PLUGIN_NAME}] Found ${libraryCount} library items and ${recentCount} recent items to import`);

                // Import library items (watchlist)
                await this.importLibraryItems(profileId);

                // Import continue watching (libraryRecent + cinemata progress)
                await this.importContinueWatching(profileId);

                // Mark as imported
                localStorage.setItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED, 'true');
                localStorage.setItem(STORAGE_KEYS.MAIN_PROFILE_ID, profileId);

                // Refresh sync to get latest from server
                await this.syncEngine.fullSync();

                console.log(`[${PLUGIN_NAME}] Force import complete!`);
                return { success: true, libraryCount, recentCount };
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error force importing Stremio data:`, e);
                return { success: false, error: e.message };
            } finally {
                this.isImporting = false;
            }
        }

        // Update Stremio UI when switching profiles - clear local data and reload
        async onProfileSwitch(newProfileId) {
            console.log(`[${PLUGIN_NAME}] Profile switched to ${newProfileId}, updating Stremio UI...`);

            // Get the profile's data from the server
            const watchlist = await this.dataManager.getWatchlist();
            const continueWatching = await this.dataManager.getContinueWatching();

            // We need to update Stremio's localStorage to reflect the profile's data
            // This is tricky because Stremio syncs with its own server
            // For now, we'll clear our cache and let the next sync handle it

            // Clear cached data so it reloads from server
            this.syncEngine.cacheWatchlist([]);
            this.syncEngine.cacheContinueWatching([]);

            // Trigger a full sync to get the new profile's data
            await this.syncEngine.fullSync();

            // Update our library state snapshot
            this.captureLibraryState();

            console.log(`[${PLUGIN_NAME}] Profile switch complete - Watchlist: ${watchlist.length}, Continue Watching: ${continueWatching.length}`);
        }
    }

    // ============================================
    // SYNC ENGINE
    // ============================================

    class SyncEngine {
        constructor(supabaseClient, accountManager) {
            this.supabase = supabaseClient;
            this.accountManager = accountManager;
        }

        getDeviceId() {
            let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
            if (!deviceId) {
                deviceId = crypto.randomUUID();
                localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
            }
            return deviceId;
        }

        getLastSyncAt() {
            return localStorage.getItem(STORAGE_KEYS.LAST_SYNC_AT) || '1970-01-01T00:00:00Z';
        }

        setLastSyncAt(timestamp) {
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC_AT, timestamp || new Date().toISOString());
        }

        shouldSync() {
            const lastSync = new Date(this.getLastSyncAt()).getTime();
            const now = Date.now();
            return (now - lastSync) > SYNC_INTERVAL;
        }

        async deltaSync() {
            const accountId = this.accountManager.getHashedAccountId();
            if (!accountId) {
                console.log(`[${PLUGIN_NAME}] No account ID, skipping sync`);
                return { profiles: [], watchlist: [], continueWatching: [] };
            }

            const lastSyncAt = this.getLastSyncAt();
            console.log(`[${PLUGIN_NAME}] Delta sync since ${lastSyncAt}`);

            try {
                // Fetch profiles updated since last sync
                const profiles = await this.supabase.select('profiles', {
                    filter: { account_id: accountId },
                    gt: { updated_at: lastSyncAt },
                    order: 'updated_at.desc'
                });

                // Cache profiles
                this.cacheProfiles(profiles);

                // Get active profile for watchlist/continue watching
                const activeProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
                let watchlist = [];
                let continueWatching = [];

                if (activeProfileId) {
                    watchlist = await this.supabase.select('profile_watchlist', {
                        filter: { profile_id: activeProfileId },
                        gt: { updated_at: lastSyncAt },
                        order: 'updated_at.desc'
                    });

                    continueWatching = await this.supabase.select('profile_continue_watching', {
                        filter: { profile_id: activeProfileId },
                        gt: { updated_at: lastSyncAt },
                        order: 'last_watched_at.desc'
                    });

                    this.cacheWatchlist(watchlist);
                    this.cacheContinueWatching(continueWatching);
                }

                this.setLastSyncAt();

                return { profiles, watchlist, continueWatching };
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Delta sync failed:`, e);
                return { profiles: [], watchlist: [], continueWatching: [] };
            }
        }

        async fullSync() {
            const accountId = this.accountManager.getHashedAccountId();
            console.log(`[${PLUGIN_NAME}] fullSync: Starting with accountId=${accountId?.substring(0, 16)}...`);

            if (!accountId) {
                console.warn(`[${PLUGIN_NAME}] fullSync: No account ID, aborting`);
                return null;
            }

            try {
                console.log(`[${PLUGIN_NAME}] fullSync: Fetching profiles...`);
                const profiles = await this.supabase.select('profiles', {
                    filter: { account_id: accountId },
                    order: 'created_at.asc'
                });

                console.log(`[${PLUGIN_NAME}] fullSync: Got ${profiles?.length || 0} profiles from server`);

                // Filter out soft-deleted profiles
                const activeProfiles = (profiles || []).filter(p => !p.deleted_at);
                this.cacheProfiles(activeProfiles);
                console.log(`[${PLUGIN_NAME}] fullSync: Cached ${activeProfiles.length} active profiles`);

                const activeProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
                if (activeProfileId) {
                    console.log(`[${PLUGIN_NAME}] fullSync: Fetching data for active profile ${activeProfileId}...`);

                    const watchlist = await this.supabase.select('profile_watchlist', {
                        filter: { profile_id: activeProfileId },
                        order: 'added_at.desc'
                    });
                    const activeWatchlist = (watchlist || []).filter(w => !w.deleted_at);
                    this.cacheWatchlist(activeWatchlist);

                    const continueWatching = await this.supabase.select('profile_continue_watching', {
                        filter: { profile_id: activeProfileId },
                        order: 'last_watched_at.desc'
                    });
                    const activeContinueWatching = (continueWatching || []).filter(c => !c.deleted_at);
                    this.cacheContinueWatching(activeContinueWatching);

                    console.log(`[${PLUGIN_NAME}] fullSync: Cached ${activeWatchlist.length} watchlist, ${activeContinueWatching.length} continue`);
                } else {
                    console.log(`[${PLUGIN_NAME}] fullSync: No active profile ID in localStorage`);
                }

                this.setLastSyncAt();
                return activeProfiles;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] fullSync failed:`, e);
                return null;
            }
        }

        cacheProfiles(profiles) {
            localStorage.setItem(STORAGE_KEYS.CACHED_PROFILES, JSON.stringify(profiles));
        }

        getCachedProfiles() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHED_PROFILES)) || [];
            } catch {
                return [];
            }
        }

        cacheWatchlist(watchlist) {
            localStorage.setItem(STORAGE_KEYS.CACHED_WATCHLIST, JSON.stringify(watchlist));
        }

        getCachedWatchlist() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHED_WATCHLIST)) || [];
            } catch {
                return [];
            }
        }

        cacheContinueWatching(items) {
            localStorage.setItem(STORAGE_KEYS.CACHED_CONTINUE, JSON.stringify(items));
        }

        getCachedContinueWatching() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHED_CONTINUE)) || [];
            } catch {
                return [];
            }
        }

        cacheFavorites(favorites) {
            localStorage.setItem(STORAGE_KEYS.CACHED_FAVORITES, JSON.stringify(favorites));
        }

        getCachedFavorites() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHED_FAVORITES)) || [];
            } catch {
                return [];
            }
        }
    }

    // ============================================
    // PROFILE MANAGER
    // ============================================

    class ProfileManager {
        constructor(supabaseClient, accountManager, syncEngine) {
            this.supabase = supabaseClient;
            this.accountManager = accountManager;
            this.syncEngine = syncEngine;
            this.stremioIntegration = null;
            this.localStorageManager = null;
            this.realtimeManager = null;
            this.domFilterManager = null;
        }

        setStremioIntegration(integration) {
            this.stremioIntegration = integration;
        }

        setLocalStorageManager(manager) {
            this.localStorageManager = manager;
        }

        setRealtimeManager(manager) {
            this.realtimeManager = manager;
        }

        setDOMFilterManager(manager) {
            this.domFilterManager = manager;
        }

        async getProfiles(forceRefresh = false) {
            // Try cache first (unless forceRefresh is true)
            let profiles = forceRefresh ? [] : this.syncEngine.getCachedProfiles();

            if (profiles.length === 0) {
                // Fetch from server
                const accountId = this.accountManager.getHashedAccountId();
                console.log(`[${PLUGIN_NAME}] getProfiles: accountId=${accountId?.substring(0, 16)}..., forceRefresh=${forceRefresh}`);

                if (accountId) {
                    try {
                        profiles = await this.supabase.select('profiles', {
                            filter: { account_id: accountId },
                            order: 'created_at.asc'
                        });
                        console.log(`[${PLUGIN_NAME}] getProfiles: fetched ${profiles?.length || 0} profiles from server`);
                        profiles = (profiles || []).filter(p => !p.deleted_at);
                        this.syncEngine.cacheProfiles(profiles);
                    } catch (e) {
                        console.error(`[${PLUGIN_NAME}] getProfiles: fetch failed:`, e);
                        profiles = [];
                    }
                } else {
                    console.warn(`[${PLUGIN_NAME}] getProfiles: No account ID available`);
                }
            } else {
                console.log(`[${PLUGIN_NAME}] getProfiles: returning ${profiles.length} cached profiles`);
            }
            return profiles;
        }

        async createProfile(name, avatarId = 'gradient-purple') {
            const profiles = await this.getProfiles();
            if (profiles.length >= MAX_PROFILES) {
                throw new Error(`Maximum ${MAX_PROFILES} profiles allowed`);
            }

            const accountId = this.accountManager.getHashedAccountId();
            if (!accountId) {
                throw new Error('Not logged into Stremio');
            }

            const isFirstProfile = profiles.length === 0;

            const profile = await this.supabase.insert('profiles', {
                account_id: accountId,
                name: name.trim(),
                avatar_id: avatarId,
                is_active: isFirstProfile,
                is_main: isFirstProfile // First profile is the main profile
            });

            if (profile) {
                // If this is the first profile, import existing Stremio data
                if (isFirstProfile && this.stremioIntegration) {
                    console.log(`[${PLUGIN_NAME}] First profile created (main), importing existing Stremio data...`);
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, profile.id);
                    localStorage.setItem(STORAGE_KEYS.MAIN_PROFILE_ID, profile.id);
                    await this.stremioIntegration.importExistingStremioData(profile.id);
                }

                // Refresh cache
                await this.syncEngine.fullSync();

                // Subscribe to realtime for the new profile
                if (this.realtimeManager && isFirstProfile) {
                    await this.realtimeManager.subscribeToProfileChanges();
                }
            }

            return profile;
        }

        async updateProfile(profileId, updates) {
            const result = await this.supabase.update('profiles', {
                name: updates.name?.trim(),
                avatar_id: updates.avatarId
            }, { id: profileId });

            if (result) {
                await this.syncEngine.fullSync();
            }

            return result;
        }

        async deleteProfile(profileId) {
            // Check if this is the main profile - cannot delete
            const profiles = await this.getProfiles();
            const profile = profiles.find(p => p.id === profileId);
            if (profile?.is_main) {
                throw new Error('Cannot delete the main profile');
            }

            // Soft delete
            const result = await this.supabase.update('profiles', {
                deleted_at: new Date().toISOString(),
                is_active: false
            }, { id: profileId });

            if (result) {
                // If this was the active profile, clear it and localStorage data
                if (localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID) === profileId) {
                    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
                }
                // Clear cached localStorage for this profile
                if (this.localStorageManager) {
                    this.localStorageManager.clearProfileData(profileId);
                }
                await this.syncEngine.fullSync();
            }

            return !!result;
        }

        async switchProfile(profileId) {
            const accountId = this.accountManager.getHashedAccountId();
            if (!accountId) return false;

            const previousProfileId = this.getActiveProfileId();
            if (previousProfileId === profileId) {
                console.log(`[${PLUGIN_NAME}] Already on profile ${profileId}`);
                return true;
            }

            console.log(`[${PLUGIN_NAME}] Switching from profile ${previousProfileId} to ${profileId}`);

            // 1. Deactivate all profiles, activate new one (server-side)
            const profiles = await this.getProfiles();
            for (const profile of profiles) {
                if (profile.is_active) {
                    await this.supabase.update('profiles', { is_active: false }, { id: profile.id });
                }
            }
            await this.supabase.update('profiles', { is_active: true }, { id: profileId });

            // 2. Update local storage key
            localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);

            // 3. Clear caches
            this.syncEngine.cacheWatchlist([]);
            this.syncEngine.cacheContinueWatching([]);
            this.syncEngine.cacheFavorites([]);

            // 4. Fetch new profile's data from Supabase
            const [watchlist, continueWatching] = await Promise.all([
                this.supabase.select('profile_watchlist', {
                    filter: { profile_id: profileId },
                    order: 'added_at.desc'
                }),
                this.supabase.select('profile_continue_watching', {
                    filter: { profile_id: profileId },
                    order: 'last_watched_at.desc'
                })
            ]);

            const filteredWatchlist = (watchlist || []).filter(w => !w.deleted_at);
            const filteredContinueWatching = (continueWatching || []).filter(c => !c.deleted_at);

            console.log(`[${PLUGIN_NAME}] Profile ${profileId} data: ${filteredWatchlist.length} watchlist, ${filteredContinueWatching.length} continue watching`);

            // 5. Update caches
            this.syncEngine.cacheWatchlist(filteredWatchlist);
            this.syncEngine.cacheContinueWatching(filteredContinueWatching);

            // 6. Resubscribe to realtime for new profile
            if (this.realtimeManager) {
                await this.realtimeManager.subscribeToProfileChanges();
            }

            // 7. Use DOM filtering to update UI (NO PAGE RELOAD!)
            // This is the key change - we filter the Continue Watching UI instead of modifying localStorage
            if (this.domFilterManager) {
                await this.domFilterManager.onProfileSwitch(profileId);
                console.log(`[${PLUGIN_NAME}] Profile switch complete - UI filtered (no reload needed)`);
            } else {
                console.log(`[${PLUGIN_NAME}] Profile switch complete (DOM filter not available)`);
            }

            return true;
        }

        getActiveProfileId() {
            return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
        }

        getActiveProfile() {
            const activeId = this.getActiveProfileId();
            if (!activeId) return null;
            const profiles = this.syncEngine.getCachedProfiles();
            return profiles.find(p => p.id === activeId) || null;
        }
    }

    // ============================================
    // DATA MANAGER
    // ============================================

    class DataManager {
        constructor(supabaseClient, profileManager, syncEngine) {
            this.supabase = supabaseClient;
            this.profileManager = profileManager;
            this.syncEngine = syncEngine;
            this.offlineQueue = null;
        }

        setOfflineQueue(queue) {
            this.offlineQueue = queue;
        }

        async getWatchlist() {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return [];

            let watchlist = this.syncEngine.getCachedWatchlist();
            if (watchlist.length === 0) {
                watchlist = await this.supabase.select('profile_watchlist', {
                    filter: { profile_id: profileId },
                    order: 'added_at.desc'
                });
                watchlist = watchlist.filter(w => !w.deleted_at);
                this.syncEngine.cacheWatchlist(watchlist);
            }
            return watchlist;
        }

        async addToWatchlist(contentId, contentType, title, poster) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) {
                console.log(`[${PLUGIN_NAME}] No active profile, skipping watchlist add`);
                return null;
            }

            const itemData = {
                profile_id: profileId,
                content_id: contentId,
                content_type: contentType,
                title: title,
                poster: poster,
                status: 'watching',
                updated_at: new Date().toISOString()
            };

            // Optimistic update - add to cache immediately
            const cached = this.syncEngine.getCachedWatchlist();
            const existingIdx = cached.findIndex(w => w.content_id === contentId);
            const tempItem = { ...itemData, id: crypto.randomUUID(), added_at: new Date().toISOString() };
            if (existingIdx !== -1) {
                cached[existingIdx] = { ...cached[existingIdx], ...tempItem };
            } else {
                cached.unshift(tempItem);
            }
            this.syncEngine.cacheWatchlist(cached);

            // Queue if offline
            if (this.offlineQueue && !this.offlineQueue.isOnline()) {
                this.offlineQueue.enqueue({ type: 'UPSERT', table: 'profile_watchlist', data: itemData });
                return tempItem;
            }

            // Execute immediately
            const item = await this.supabase.upsert('profile_watchlist', itemData);
            if (item) {
                // Update cache with real ID
                const updatedCache = this.syncEngine.getCachedWatchlist();
                const idx = updatedCache.findIndex(w => w.content_id === contentId);
                if (idx !== -1) {
                    updatedCache[idx] = item;
                    this.syncEngine.cacheWatchlist(updatedCache);
                }
            }
            return item || tempItem;
        }

        async removeFromWatchlist(contentId) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return false;

            // Optimistic removal
            const watchlist = this.syncEngine.getCachedWatchlist().filter(w => w.content_id !== contentId);
            this.syncEngine.cacheWatchlist(watchlist);

            const match = { profile_id: profileId, content_id: contentId };
            const data = { deleted_at: new Date().toISOString() };

            if (this.offlineQueue && !this.offlineQueue.isOnline()) {
                this.offlineQueue.enqueue({ type: 'UPDATE', table: 'profile_watchlist', data, match });
                return true;
            }

            return !!(await this.supabase.update('profile_watchlist', data, match));
        }

        async getContinueWatching() {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return [];

            let items = this.syncEngine.getCachedContinueWatching();
            if (items.length === 0) {
                items = await this.supabase.select('profile_continue_watching', {
                    filter: { profile_id: profileId },
                    order: 'last_watched_at.desc'
                });
                items = items.filter(i => !i.deleted_at);
                this.syncEngine.cacheContinueWatching(items);
            }
            return items;
        }

        async updateProgress(contentId, videoId, progress, duration, metadata = {}) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) {
                console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: No active profile, skipping`);
                return null;
            }

            console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: Saving to profile ${profileId}`);

            const itemData = {
                profile_id: profileId,
                content_id: contentId,
                video_id: videoId || contentId,
                content_type: metadata.type || 'movie',
                title: metadata.title,
                poster: metadata.poster,
                progress: progress,
                duration: duration,
                season: metadata.season,
                episode: metadata.episode,
                stream_hash: metadata.streamHash,
                last_watched_at: metadata.lastWatched || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: Item data:`, JSON.stringify({
                profile_id: profileId,
                content_id: contentId,
                title: metadata.title,
                progress: Math.floor(progress),
                duration: Math.floor(duration)
            }));

            // Optimistic update
            const cached = this.syncEngine.getCachedContinueWatching();
            const existingIdx = cached.findIndex(c => c.content_id === contentId && c.video_id === (videoId || contentId));
            const tempItem = { ...itemData, id: crypto.randomUUID() };
            if (existingIdx !== -1) {
                cached[existingIdx] = { ...cached[existingIdx], ...tempItem };
                console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: Updated existing cache entry`);
            } else {
                cached.unshift(tempItem);
                console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: Added new cache entry (cache now has ${cached.length} items)`);
            }
            this.syncEngine.cacheContinueWatching(cached);

            if (this.offlineQueue && !this.offlineQueue.isOnline()) {
                console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: Offline, queuing for later`);
                this.offlineQueue.enqueue({ type: 'UPSERT', table: 'profile_continue_watching', data: itemData });
                return tempItem;
            }

            try {
                const item = await this.supabase.upsert('profile_continue_watching', itemData);
                console.log(`[${PLUGIN_NAME}] DataManager.updateProgress: Supabase upsert result:`, item ? 'success' : 'null');
                return item || tempItem;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] DataManager.updateProgress: Supabase upsert failed:`, e);
                return tempItem;
            }
        }

        async removeContinueWatching(contentId, videoId = null) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return false;

            // Optimistic removal
            const items = this.syncEngine.getCachedContinueWatching().filter(c =>
                !(c.content_id === contentId && (!videoId || c.video_id === videoId))
            );
            this.syncEngine.cacheContinueWatching(items);

            const match = { profile_id: profileId, content_id: contentId };
            if (videoId) match.video_id = videoId;
            const data = { deleted_at: new Date().toISOString() };

            if (this.offlineQueue && !this.offlineQueue.isOnline()) {
                this.offlineQueue.enqueue({ type: 'UPDATE', table: 'profile_continue_watching', data, match });
                return true;
            }

            return !!(await this.supabase.update('profile_continue_watching', data, match));
        }

        // ============================================
        // FAVORITES METHODS
        // ============================================

        async getFavorites() {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return [];

            let favorites = this.syncEngine.getCachedFavorites();
            if (favorites.length === 0) {
                favorites = await this.supabase.select('profile_favorites', {
                    filter: { profile_id: profileId },
                    order: 'added_at.desc'
                });
                favorites = favorites.filter(f => !f.deleted_at);
                this.syncEngine.cacheFavorites(favorites);
            }
            return favorites;
        }

        async addToFavorites(contentId, contentType, title, poster) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) {
                console.log(`[${PLUGIN_NAME}] No active profile, skipping favorites add`);
                return null;
            }

            const itemData = {
                profile_id: profileId,
                content_id: contentId,
                content_type: contentType,
                title: title,
                poster: poster,
                updated_at: new Date().toISOString()
            };

            // Optimistic update
            const cached = this.syncEngine.getCachedFavorites();
            const existingIdx = cached.findIndex(f => f.content_id === contentId);
            const tempItem = { ...itemData, id: crypto.randomUUID(), added_at: new Date().toISOString() };
            if (existingIdx === -1) {
                cached.unshift(tempItem);
                this.syncEngine.cacheFavorites(cached);
            }

            console.log(`[${PLUGIN_NAME}] Adding to favorites: ${contentId} (${title})`);

            if (this.offlineQueue && !this.offlineQueue.isOnline()) {
                this.offlineQueue.enqueue({ type: 'UPSERT', table: 'profile_favorites', data: itemData });
                return tempItem;
            }

            const item = await this.supabase.upsert('profile_favorites', itemData);
            if (item) {
                const updatedCache = this.syncEngine.getCachedFavorites();
                const idx = updatedCache.findIndex(f => f.content_id === contentId);
                if (idx !== -1) {
                    updatedCache[idx] = item;
                    this.syncEngine.cacheFavorites(updatedCache);
                }
            }
            return item || tempItem;
        }

        async removeFromFavorites(contentId) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return false;

            // Optimistic removal
            const favorites = this.syncEngine.getCachedFavorites().filter(f => f.content_id !== contentId);
            this.syncEngine.cacheFavorites(favorites);

            console.log(`[${PLUGIN_NAME}] Removing from favorites: ${contentId}`);

            const match = { profile_id: profileId, content_id: contentId };
            const data = { deleted_at: new Date().toISOString() };

            if (this.offlineQueue && !this.offlineQueue.isOnline()) {
                this.offlineQueue.enqueue({ type: 'UPDATE', table: 'profile_favorites', data, match });
                return true;
            }

            return !!(await this.supabase.update('profile_favorites', data, match));
        }

        async isFavorite(contentId) {
            const favorites = await this.getFavorites();
            return favorites.some(f => f.content_id === contentId);
        }

        async toggleFavorite(contentId, contentType, title, poster) {
            const isFav = await this.isFavorite(contentId);
            if (isFav) {
                return await this.removeFromFavorites(contentId);
            } else {
                return await this.addToFavorites(contentId, contentType, title, poster);
            }
        }
    }

    // ============================================
    // UI MANAGER
    // ============================================

    class UIManager {
        constructor(profileManager, dataManager, configManager, syncEngine, accountManager, supabaseClient) {
            this.profileManager = profileManager;
            this.dataManager = dataManager;
            this.configManager = configManager;
            this.syncEngine = syncEngine;
            this.accountManager = accountManager;
            this.supabaseClient = supabaseClient;
            this.stylesInjected = false;
        }

        injectStyles() {
            if (this.stylesInjected) return;

            const style = document.createElement('style');
            style.id = 'streamgo-profiles-styles';
            style.textContent = `
                /* Profile Overlay Base */
                .sgp-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 100000;
                    background: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(10px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .sgp-overlay.visible {
                    opacity: 1;
                }

                /* Glass Card */
                .sgp-card {
                    background: rgba(70, 70, 70, 0.22);
                    backdrop-filter: blur(6px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2),
                                inset 0 1px 0 rgba(255, 255, 255, 0.15);
                    padding: 24px;
                }

                /* Profile Grid */
                .sgp-profile-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 140px));
                    gap: 20px;
                    justify-content: center;
                    padding: 20px;
                    max-width: 700px;
                }

                /* Profile Tile */
                .sgp-profile-tile {
                    width: 140px;
                    height: 170px;
                    background: rgba(70, 70, 70, 0.22);
                    backdrop-filter: blur(6px);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2),
                                inset 0 1px 0 rgba(255, 255, 255, 0.15);
                    cursor: pointer;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                                box-shadow 0.2s ease,
                                border-color 0.2s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 16px;
                }
                .sgp-profile-tile:hover {
                    transform: scale(1.05);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .sgp-profile-tile.add-tile {
                    border-style: dashed;
                    opacity: 0.7;
                }
                .sgp-profile-tile.add-tile:hover {
                    opacity: 1;
                }

                /* Avatar */
                .sgp-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sgp-avatar svg {
                    width: 100%;
                    height: 100%;
                }
                .sgp-avatar-small {
                    width: 28px;
                    height: 28px;
                }

                /* Profile Name */
                .sgp-profile-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: white;
                    text-align: center;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* Title */
                .sgp-title {
                    font-size: 28px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 24px;
                    text-align: center;
                }
                .sgp-subtitle {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.6);
                    margin-bottom: 32px;
                    text-align: center;
                }

                /* Buttons */
                .sgp-btn {
                    padding: 12px 24px;
                    border-radius: 8px;
                    border: none;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .sgp-btn-primary {
                    background: #5865F2;
                    color: white;
                }
                .sgp-btn-primary:hover {
                    background: #4752c4;
                }
                .sgp-btn-primary:disabled {
                    background: #4752c4;
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .sgp-btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .sgp-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
                .sgp-btn-danger {
                    background: #da373c;
                    color: white;
                }
                .sgp-btn-danger:hover {
                    background: #c22d31;
                }

                /* Form elements */
                .sgp-input {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.3);
                    color: white;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s ease;
                }
                .sgp-input:focus {
                    border-color: #5865F2;
                }
                .sgp-input::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }
                .sgp-label {
                    display: block;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Avatar Grid */
                .sgp-avatar-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-top: 16px;
                }
                .sgp-avatar-option {
                    width: 100%;
                    aspect-ratio: 1;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    border: 2px solid transparent;
                    overflow: hidden;
                }
                .sgp-avatar-option:hover {
                    transform: scale(1.1);
                }
                .sgp-avatar-option.selected {
                    border-color: #5865F2;
                    box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.5);
                }
                .sgp-avatar-option svg {
                    width: 100%;
                    height: 100%;
                }

                /* Modal */
                .sgp-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 100001;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(5px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s ease;
                }
                .sgp-modal.visible {
                    opacity: 1;
                    pointer-events: auto;
                }
                .sgp-modal-content {
                    background: rgba(40, 40, 40, 0.95);
                    backdrop-filter: blur(10px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
                    padding: 32px;
                    min-width: 400px;
                    max-width: 500px;
                }
                .sgp-modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 24px;
                }
                .sgp-modal-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                    justify-content: flex-end;
                }

                /* Profile Switcher (nav bar - circular avatar) */
                .sgp-nav-profile {
                    position: relative;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                    overflow: hidden;
                    border: 2px solid transparent;
                    flex-shrink: 0;
                }
                .sgp-nav-profile:hover {
                    transform: scale(1.08);
                    border-color: rgba(255, 255, 255, 0.5);
                }
                .sgp-nav-profile svg {
                    width: 100%;
                    height: 100%;
                }

                /* Netflix-style Full Screen Profile Selector */
                .sgp-selector-overlay {
                    position: fixed;
                    inset: 0;
                    background: #141414;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .sgp-selector-overlay.visible {
                    opacity: 1;
                }
                .sgp-selector-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 32px;
                }
                .sgp-selector-title {
                    font-size: 3.5vw;
                    font-weight: 400;
                    color: white;
                    margin: 0;
                }
                .sgp-selector-grid {
                    display: flex;
                    gap: 24px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .sgp-selector-tile {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    transition: transform 0.15s ease;
                }
                .sgp-selector-tile:hover .sgp-selector-avatar {
                    border-color: white;
                }
                .sgp-selector-tile:hover .sgp-selector-name {
                    color: white;
                }
                .sgp-selector-tile.selected .sgp-selector-avatar {
                    border-color: white;
                    transform: scale(1.1);
                }
                .sgp-selector-tile.active .sgp-selector-avatar {
                    border-color: rgba(255,255,255,0.5);
                }
                .sgp-selector-avatar {
                    width: 120px;
                    height: 120px;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 3px solid transparent;
                    transition: border-color 0.15s ease, transform 0.15s ease;
                    background: #333;
                }
                .sgp-selector-avatar svg {
                    width: 100%;
                    height: 100%;
                }
                .sgp-selector-avatar.add-avatar {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.1);
                }
                .sgp-selector-avatar.add-avatar svg {
                    width: 50%;
                    height: 50%;
                    color: rgba(255,255,255,0.5);
                }
                .sgp-selector-tile.add-tile:hover .sgp-selector-avatar.add-avatar svg {
                    color: white;
                }
                .sgp-selector-name {
                    font-size: 14px;
                    color: rgba(255,255,255,0.6);
                    transition: color 0.15s ease;
                    text-align: center;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .sgp-manage-btn {
                    margin-top: 32px;
                    padding: 8px 24px;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.4);
                    color: rgba(255,255,255,0.6);
                    font-size: 12px;
                    letter-spacing: 2px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .sgp-manage-btn:hover {
                    border-color: white;
                    color: white;
                }

                /* Manage Profiles Modal */
                .sgp-manage-profiles-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 16px;
                }
                .sgp-manage-profile-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 12px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                }
                .sgp-manage-profile-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .sgp-manage-profile-avatar svg {
                    width: 100%;
                    height: 100%;
                }
                .sgp-manage-profile-name {
                    flex: 1;
                    font-size: 15px;
                    color: white;
                }
                .sgp-manage-profile-actions {
                    display: flex;
                    gap: 8px;
                }
                .sgp-btn-small {
                    padding: 6px 12px !important;
                    font-size: 12px !important;
                }

                /* Glass Popup Menu */
                .sgp-popup {
                    position: absolute;
                    top: calc(100% + 12px);
                    right: 0;
                    min-width: 220px;
                    background: rgba(30, 30, 30, 0.85);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5),
                                inset 0 1px 0 rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                    opacity: 0;
                    transform: translateY(-8px) scale(0.95);
                    transform-origin: top right;
                    pointer-events: none;
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    z-index: 10000;
                }
                .sgp-popup.visible {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    pointer-events: auto;
                }

                /* Popup Header (current profile) */
                .sgp-popup-header {
                    padding: 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .sgp-popup-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    overflow: hidden;
                }
                .sgp-popup-avatar svg {
                    width: 100%;
                    height: 100%;
                }
                .sgp-popup-info {
                    flex: 1;
                }
                .sgp-popup-name {
                    font-size: 15px;
                    font-weight: 600;
                    color: white;
                }
                .sgp-popup-label {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                    margin-top: 2px;
                }

                /* Popup Menu Items */
                .sgp-popup-menu {
                    padding: 8px 0;
                }
                .sgp-popup-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 14px;
                }
                .sgp-popup-item:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
                .sgp-popup-item svg {
                    width: 18px;
                    height: 18px;
                    opacity: 0.7;
                }
                .sgp-popup-divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.08);
                    margin: 4px 0;
                }

                /* Legacy dropdown styles for backward compat */
                .sgp-switcher {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 12px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.08);
                    cursor: pointer;
                    transition: background 0.15s ease;
                    margin-left: 12px;
                }
                .sgp-switcher:hover {
                    background: rgba(255, 255, 255, 0.12);
                }
                .sgp-switcher-name {
                    font-size: 13px;
                    color: white;
                    max-width: 100px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .sgp-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    min-width: 200px;
                    background: rgba(40, 40, 40, 0.95);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    overflow: hidden;
                    opacity: 0;
                    transform: translateY(-10px);
                    pointer-events: none;
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
                .sgp-dropdown.visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                .sgp-dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                .sgp-dropdown-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                .sgp-dropdown-item.active {
                    background: rgba(88, 101, 242, 0.2);
                }
                .sgp-dropdown-divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                    margin: 4px 0;
                }

                /* Setup Wizard */
                .sgp-wizard {
                    max-width: 500px;
                    width: 90%;
                }
                .sgp-wizard-step {
                    display: none;
                }
                .sgp-wizard-step.active {
                    display: block;
                }
                .sgp-step-indicator {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 32px;
                }
                .sgp-step-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.3);
                    transition: background 0.2s ease;
                }
                .sgp-step-dot.active {
                    background: #5865F2;
                }
                .sgp-step-dot.completed {
                    background: #38ef7d;
                }

                /* Code block */
                .sgp-code {
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 8px;
                    padding: 16px;
                    font-family: monospace;
                    font-size: 12px;
                    color: #38ef7d;
                    max-height: 200px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                /* Toast */
                .sgp-toast {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 100002;
                    background: rgba(40, 40, 40, 0.95);
                    backdrop-filter: blur(10px);
                    border-radius: 8px;
                    padding: 12px 20px;
                    color: white;
                    font-size: 14px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                    transform: translateY(100px);
                    opacity: 0;
                    transition: transform 0.3s ease, opacity 0.3s ease;
                }
                .sgp-toast.visible {
                    transform: translateY(0);
                    opacity: 1;
                }
                .sgp-toast.success {
                    border-left: 4px solid #38ef7d;
                }
                .sgp-toast.error {
                    border-left: 4px solid #f85032;
                }

                /* Add icon */
                .sgp-add-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 2px dashed rgba(255, 255, 255, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    color: rgba(255, 255, 255, 0.5);
                }

                /* Manage link */
                .sgp-manage-link {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 13px;
                    cursor: pointer;
                    margin-top: 24px;
                    text-decoration: underline;
                    transition: color 0.2s ease;
                }
                .sgp-manage-link:hover {
                    color: white;
                }

                /* Tile actions */
                .sgp-tile-actions {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: flex;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .sgp-profile-tile:hover .sgp-tile-actions {
                    opacity: 1;
                }
                .sgp-tile-action {
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.5);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                }
                .sgp-tile-action:hover {
                    background: rgba(0, 0, 0, 0.7);
                }

                /* Loading spinner */
                .sgp-spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: sgp-spin 0.8s linear infinite;
                }
                @keyframes sgp-spin {
                    to { transform: rotate(360deg); }
                }

                /* Settings Page */
                .sgp-settings-page {
                    position: fixed;
                    inset: 0;
                    z-index: 100000;
                    background: rgba(15, 15, 15, 0.98);
                    display: flex;
                    flex-direction: column;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .sgp-settings-page.visible {
                    opacity: 1;
                }
                .sgp-settings-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(20, 20, 20, 0.95);
                }
                .sgp-back-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: background 0.2s ease;
                }
                .sgp-back-btn:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
                .sgp-settings-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: white;
                }
                .sgp-settings-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .sgp-settings-container {
                    width: 100%;
                    max-width: 500px;
                }
                .sgp-settings-section {
                    background: rgba(70, 70, 70, 0.22);
                    backdrop-filter: blur(6px);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    padding: 20px;
                    margin-bottom: 16px;
                }
                .sgp-settings-section-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 16px;
                }
                .sgp-settings-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }
                .sgp-settings-row:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .sgp-settings-row:first-child {
                    padding-top: 0;
                }
                .sgp-settings-label {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.8);
                }
                .sgp-settings-value {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.5);
                    font-family: monospace;
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .sgp-settings-value.masked {
                    letter-spacing: 2px;
                }
                .sgp-status-badge {
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .sgp-status-badge.connected {
                    background: rgba(56, 239, 125, 0.2);
                    color: #38ef7d;
                }
                .sgp-status-badge.disconnected {
                    background: rgba(218, 55, 60, 0.2);
                    color: #da373c;
                }
                .sgp-settings-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 24px;
                }
                .sgp-btn-full {
                    width: 100%;
                    padding: 14px 24px;
                }
                .sgp-gear-icon {
                    width: 16px;
                    height: 16px;
                    opacity: 0.7;
                    cursor: pointer;
                    transition: opacity 0.2s ease;
                }
                .sgp-gear-icon:hover {
                    opacity: 1;
                }

                /* Plugin Card Settings Icon */
                .sgp-plugin-settings-btn {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.7);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    z-index: 10;
                }
                .sgp-plugin-settings-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                }
                .sgp-plugin-settings-btn svg {
                    width: 16px;
                    height: 16px;
                }

                /* Plus Page Plugin Card Settings Icon - positioned next to toggle */
                .sgp-plugin-settings-btn-plus {
                    position: relative;
                    bottom: auto;
                    right: auto;
                    margin-right: 12px;
                }

                /* Error state */
                .sgp-error {
                    color: #f85032;
                    font-size: 13px;
                    margin-top: 8px;
                }

                /* Success state */
                .sgp-success {
                    color: #38ef7d;
                    font-size: 13px;
                    margin-top: 8px;
                }

                /* Form group */
                .sgp-form-group {
                    margin-bottom: 20px;
                }
            `;
            document.head.appendChild(style);
            this.stylesInjected = true;
        }

        getAvatarSvg(avatarId) {
            return AVATARS[avatarId]?.svg || AVATARS['gradient-purple'].svg;
        }

        // Toast notification
        showToast(message, type = 'success') {
            // Remove existing toast
            const existing = document.querySelector('.sgp-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = `sgp-toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add('visible');
            });

            setTimeout(() => {
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // Setup Wizard
        showSetupWizard() {
            this.injectStyles();

            const overlay = document.createElement('div');
            overlay.className = 'sgp-overlay';
            overlay.id = 'sgp-setup-wizard';

            overlay.innerHTML = `
                <div class="sgp-card sgp-wizard">
                    <div class="sgp-step-indicator">
                        <div class="sgp-step-dot active" data-step="1"></div>
                        <div class="sgp-step-dot" data-step="2"></div>
                        <div class="sgp-step-dot" data-step="3"></div>
                    </div>

                    <!-- Step 1: Credentials -->
                    <div class="sgp-wizard-step active" data-step="1">
                        <h2 class="sgp-title">Connect Your Supabase</h2>
                        <p class="sgp-subtitle">Enter your Supabase project credentials from Project Settings → API.</p>

                        <div class="sgp-form-group">
                            <label class="sgp-label">Project URL</label>
                            <input type="text" class="sgp-input" id="sgp-project-url" placeholder="https://xxxxx.supabase.co">
                        </div>

                        <div class="sgp-form-group">
                            <label class="sgp-label">Anon Public Key</label>
                            <input type="text" class="sgp-input" id="sgp-anon-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6...">
                        </div>

                        <div class="sgp-form-group">
                            <label class="sgp-label">Access Token <span style="opacity: 0.5; font-size: 10px;">(for auto-setup)</span></label>
                            <input type="password" class="sgp-input" id="sgp-access-token" placeholder="sbp_xxxxxxxxxxxxxxxx">
                            <p style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 6px;">
                                Get it from <a href="https://supabase.com/dashboard/account/tokens" target="_blank" style="color: #5865F2;">Account → Access Tokens</a>. Used once, not stored.
                            </p>
                        </div>

                        <div id="sgp-cred-error" class="sgp-error" style="display: none;"></div>

                        <div class="sgp-modal-actions">
                            <button class="sgp-btn sgp-btn-secondary" id="sgp-wizard-cancel">Cancel</button>
                            <button class="sgp-btn sgp-btn-primary" id="sgp-wizard-next-1">Connect & Setup</button>
                        </div>
                    </div>

                    <!-- Step 2: Setting Up -->
                    <div class="sgp-wizard-step" data-step="2">
                        <h2 class="sgp-title">Setting Up Database</h2>
                        <p class="sgp-subtitle" id="sgp-setup-status">Connecting to Supabase...</p>

                        <div style="display: flex; justify-content: center; padding: 40px;">
                            <div class="sgp-spinner" id="sgp-setup-spinner"></div>
                        </div>

                        <div id="sgp-setup-error" class="sgp-error" style="display: none; text-align: center;"></div>

                        <div class="sgp-modal-actions" id="sgp-setup-actions" style="display: none;">
                            <button class="sgp-btn sgp-btn-secondary" id="sgp-wizard-back-2">Back</button>
                            <button class="sgp-btn sgp-btn-primary" id="sgp-wizard-retry">Retry</button>
                        </div>
                    </div>

                    <!-- Step 3: Complete -->
                    <div class="sgp-wizard-step" data-step="3">
                        <h2 class="sgp-title">Setup Complete!</h2>
                        <p class="sgp-subtitle">Your Supabase is connected. Now create your first profile.</p>

                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 64px; margin-bottom: 16px;">✓</div>
                            <p class="sgp-success">Cloud sync is now enabled</p>
                        </div>

                        <div class="sgp-modal-actions" style="justify-content: center;">
                            <button class="sgp-btn sgp-btn-primary" id="sgp-wizard-finish">Create First Profile</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            let savedAccessToken = '';

            const runSetup = async () => {
                const projectUrl = overlay.querySelector('#sgp-project-url').value.trim();
                const anonKey = overlay.querySelector('#sgp-anon-key').value.trim();
                const accessToken = overlay.querySelector('#sgp-access-token').value.trim();
                const errorEl = overlay.querySelector('#sgp-cred-error');
                const setupStatus = overlay.querySelector('#sgp-setup-status');
                const setupError = overlay.querySelector('#sgp-setup-error');
                const setupActions = overlay.querySelector('#sgp-setup-actions');
                const spinner = overlay.querySelector('#sgp-setup-spinner');

                // Validate inputs
                if (!projectUrl || !anonKey || !accessToken) {
                    errorEl.textContent = 'Please fill in all fields';
                    errorEl.style.display = 'block';
                    return;
                }

                if (!projectUrl.includes('supabase.co')) {
                    errorEl.textContent = 'Invalid Project URL. Should be like: https://xxxxx.supabase.co';
                    errorEl.style.display = 'block';
                    return;
                }

                errorEl.style.display = 'none';
                setupError.style.display = 'none';
                setupActions.style.display = 'none';
                spinner.style.display = 'block';
                savedAccessToken = accessToken;

                // Save config (without access token - we don't store it)
                this.configManager.saveConfig(projectUrl, anonKey);

                // Go to step 2
                this.goToStep(overlay, 2);

                // Step 1: Test connection
                setupStatus.textContent = 'Testing connection...';
                const connected = await this.supabaseClient.testConnection();

                if (!connected) {
                    setupStatus.textContent = 'Connection failed';
                    setupError.textContent = 'Could not connect to Supabase. Check your Project URL and Anon Key.';
                    setupError.style.display = 'block';
                    setupActions.style.display = 'flex';
                    spinner.style.display = 'none';
                    this.configManager.clearConfig();
                    return;
                }

                // Step 2: Check if tables already exist
                setupStatus.textContent = 'Checking database...';
                const tablesExist = await this.supabaseClient.checkTablesExist();

                if (tablesExist) {
                    // Tables already exist, skip migration
                    setupStatus.textContent = 'Database ready!';
                    await new Promise(r => setTimeout(r, 500));
                    this.goToStep(overlay, 3);
                    return;
                }

                // Step 3: Run migration
                setupStatus.textContent = 'Creating database tables...';

                try {
                    await this.supabaseClient.executeSqlWithAccessToken(this.getMigrationSql(), accessToken);

                    // Step 4: Verify tables exist
                    setupStatus.textContent = 'Verifying setup...';
                    await new Promise(r => setTimeout(r, 1000));

                    const verified = await this.supabaseClient.checkTablesExist();

                    if (verified) {
                        this.goToStep(overlay, 3);
                    } else {
                        throw new Error('Tables were not created. Please check your access token permissions.');
                    }
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] Migration failed:`, e);
                    setupStatus.textContent = 'Setup failed';

                    let errorMsg = 'Could not create database tables.';
                    if (e.message.includes('Invalid API key') || e.message.includes('401')) {
                        errorMsg = 'Invalid Access Token. Please generate a new one from Supabase Dashboard.';
                    } else if (e.message.includes('403')) {
                        errorMsg = 'Access denied. Make sure your Access Token has database permissions.';
                    }

                    setupError.textContent = errorMsg;
                    setupError.style.display = 'block';
                    setupActions.style.display = 'flex';
                    spinner.style.display = 'none';
                }
            };

            // Event listeners
            overlay.querySelector('#sgp-wizard-cancel').addEventListener('click', () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
            });

            overlay.querySelector('#sgp-wizard-next-1').addEventListener('click', runSetup);

            overlay.querySelector('#sgp-wizard-back-2').addEventListener('click', () => {
                this.goToStep(overlay, 1);
                overlay.querySelector('#sgp-setup-actions').style.display = 'none';
                overlay.querySelector('#sgp-setup-error').style.display = 'none';
                overlay.querySelector('#sgp-setup-spinner').style.display = 'block';
            });

            overlay.querySelector('#sgp-wizard-retry').addEventListener('click', runSetup);

            overlay.querySelector('#sgp-wizard-finish').addEventListener('click', () => {
                overlay.classList.remove('visible');
                setTimeout(() => {
                    overlay.remove();
                    this.showCreateProfileModal(true);
                }, 300);
            });
        }

        getMigrationSql() {
            return `
-- ============================================
-- StreamGo Profiles - Supabase Schema
-- ============================================

-- ============================================
-- TABLES
-- ============================================

-- Profiles table: stores user profiles linked to Stremio accounts
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_id TEXT DEFAULT 'gradient-purple',
    is_active BOOLEAN DEFAULT false,
    is_main BOOLEAN DEFAULT false,
    sync_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Watchlist table: stores watchlist items per profile
CREATE TABLE IF NOT EXISTS profile_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    title TEXT,
    poster TEXT,
    status TEXT DEFAULT 'watching',
    sync_version INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(profile_id, content_id)
);

-- Continue watching table: stores playback progress per profile
CREATE TABLE IF NOT EXISTS profile_continue_watching (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    video_id TEXT,
    content_type TEXT NOT NULL,
    title TEXT,
    poster TEXT,
    progress REAL NOT NULL DEFAULT 0,
    duration REAL,
    season INTEGER,
    episode INTEGER,
    stream_hash TEXT,
    sync_version INTEGER DEFAULT 0,
    last_watched_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(profile_id, content_id, video_id)
);

-- Favorites table: stores favorited content per profile
CREATE TABLE IF NOT EXISTS profile_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    title TEXT,
    poster TEXT,
    added_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(profile_id, content_id)
);

-- Settings table: stores per-profile settings
CREATE TABLE IF NOT EXISTS profile_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, setting_key)
);

-- ============================================
-- INDEXES
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_profiles_account_active ON profiles(account_id, is_active) WHERE deleted_at IS NULL;

-- Watchlist indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_profile_id ON profile_watchlist(profile_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_updated_at ON profile_watchlist(updated_at);
CREATE INDEX IF NOT EXISTS idx_watchlist_profile_status ON profile_watchlist(profile_id, status) WHERE deleted_at IS NULL;

-- Continue watching indexes
CREATE INDEX IF NOT EXISTS idx_continue_profile_id ON profile_continue_watching(profile_id);
CREATE INDEX IF NOT EXISTS idx_continue_updated_at ON profile_continue_watching(updated_at);
CREATE INDEX IF NOT EXISTS idx_continue_last_watched ON profile_continue_watching(profile_id, last_watched_at DESC) WHERE deleted_at IS NULL;

-- Favorites indexes
CREATE INDEX IF NOT EXISTS idx_favorites_profile_id ON profile_favorites(profile_id);
CREATE INDEX IF NOT EXISTS idx_favorites_updated_at ON profile_favorites(updated_at);
CREATE INDEX IF NOT EXISTS idx_favorites_content ON profile_favorites(profile_id, content_id) WHERE deleted_at IS NULL;

-- Settings indexes
CREATE INDEX IF NOT EXISTS idx_settings_profile_id ON profile_settings(profile_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON profile_settings(profile_id, setting_key);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_continue_watching ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Access own profiles" ON profiles;
DROP POLICY IF EXISTS "Access own watchlist" ON profile_watchlist;
DROP POLICY IF EXISTS "Access own continue watching" ON profile_continue_watching;
DROP POLICY IF EXISTS "Access own favorites" ON profile_favorites;
DROP POLICY IF EXISTS "Access own settings" ON profile_settings;

-- Profiles policy: users can only access profiles matching their account_id
CREATE POLICY "Access own profiles" ON profiles FOR ALL
    USING (account_id = current_setting('request.headers', true)::json->>'x-account-id');

-- Watchlist policy: users can only access watchlist items for their profiles
CREATE POLICY "Access own watchlist" ON profile_watchlist FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_watchlist.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

-- Continue watching policy: users can only access continue watching for their profiles
CREATE POLICY "Access own continue watching" ON profile_continue_watching FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_continue_watching.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

-- Favorites policy: users can only access favorites for their profiles
CREATE POLICY "Access own favorites" ON profile_favorites FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_favorites.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

-- Settings policy: users can only access settings for their profiles
CREATE POLICY "Access own settings" ON profile_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_settings.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for re-running script)
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS watchlist_updated_at ON profile_watchlist;
DROP TRIGGER IF EXISTS continue_watching_updated_at ON profile_continue_watching;
DROP TRIGGER IF EXISTS favorites_updated_at ON profile_favorites;
DROP TRIGGER IF EXISTS settings_updated_at ON profile_settings;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER watchlist_updated_at BEFORE UPDATE ON profile_watchlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER continue_watching_updated_at BEFORE UPDATE ON profile_continue_watching
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER favorites_updated_at BEFORE UPDATE ON profile_favorites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON profile_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
            `.trim();
        }

        goToStep(overlay, step) {
            // Update step indicators
            overlay.querySelectorAll('.sgp-step-dot').forEach((dot, i) => {
                dot.classList.remove('active', 'completed');
                if (i + 1 < step) dot.classList.add('completed');
                if (i + 1 === step) dot.classList.add('active');
            });

            // Show/hide steps
            overlay.querySelectorAll('.sgp-wizard-step').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.step) === step);
            });
        }

        // Profile Selector (full screen - Netflix style)
        async showProfileSelector(isInitial = false) {
            this.injectStyles();

            // Remove existing
            const existing = document.getElementById('sgp-profile-selector');
            if (existing) existing.remove();

            const profiles = await this.profileManager.getProfiles();
            const activeProfile = this.profileManager.getActiveProfile();

            const overlay = document.createElement('div');
            overlay.className = 'sgp-selector-overlay';
            overlay.id = 'sgp-profile-selector';

            let tilesHtml = '';
            for (const profile of profiles) {
                const isActive = activeProfile && profile.id === activeProfile.id;
                tilesHtml += `
                    <div class="sgp-selector-tile ${isActive ? 'active' : ''}" data-profile-id="${profile.id}">
                        <div class="sgp-selector-avatar">
                            ${this.getAvatarSvg(profile.avatar_id)}
                        </div>
                        <span class="sgp-selector-name">${profile.name}</span>
                    </div>
                `;
            }

            // Add "Add Profile" tile if under limit
            if (profiles.length < MAX_PROFILES) {
                tilesHtml += `
                    <div class="sgp-selector-tile add-tile" id="sgp-add-profile-tile">
                        <div class="sgp-selector-avatar add-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </div>
                        <span class="sgp-selector-name">Add Profile</span>
                    </div>
                `;
            }

            overlay.innerHTML = `
                <div class="sgp-selector-content">
                    <h1 class="sgp-selector-title">Who's watching?</h1>
                    <div class="sgp-selector-grid">${tilesHtml}</div>
                    <button class="sgp-manage-btn" id="sgp-manage-profiles">MANAGE PROFILES</button>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            // Profile tile click - switch profile
            overlay.querySelectorAll('.sgp-selector-tile:not(.add-tile)').forEach(tile => {
                tile.addEventListener('click', async () => {
                    const profileId = tile.dataset.profileId;

                    // Add selection animation
                    tile.classList.add('selected');

                    await this.profileManager.switchProfile(profileId);

                    setTimeout(() => {
                        overlay.classList.remove('visible');
                        setTimeout(() => {
                            overlay.remove();
                            this.updateSwitcher();
                        }, 300);
                    }, 200);
                });
            });

            // Add Profile tile click
            const addTile = overlay.querySelector('#sgp-add-profile-tile');
            if (addTile) {
                addTile.addEventListener('click', () => {
                    this.showCreateProfileModal();
                });
            }

            // Manage Profiles button
            overlay.querySelector('#sgp-manage-profiles').addEventListener('click', () => {
                this.showManageProfiles(profiles);
            });
        }

        // Manage Profiles modal (edit/delete)
        async showManageProfiles(profiles) {
            const modal = document.createElement('div');
            modal.className = 'sgp-modal';
            modal.id = 'sgp-manage-profiles-modal';

            let profilesHtml = '';
            for (const profile of profiles) {
                profilesHtml += `
                    <div class="sgp-manage-profile-row">
                        <div class="sgp-manage-profile-avatar">${this.getAvatarSvg(profile.avatar_id)}</div>
                        <span class="sgp-manage-profile-name">${profile.name}</span>
                        <div class="sgp-manage-profile-actions">
                            <button class="sgp-btn sgp-btn-secondary sgp-btn-small sgp-edit-profile" data-id="${profile.id}">Edit</button>
                            <button class="sgp-btn sgp-btn-danger sgp-btn-small sgp-delete-profile" data-id="${profile.id}">Delete</button>
                        </div>
                    </div>
                `;
            }

            modal.innerHTML = `
                <div class="sgp-modal-content" style="max-width: 450px;">
                    <h3 class="sgp-modal-title">Manage Profiles</h3>
                    <div class="sgp-manage-profiles-list">${profilesHtml}</div>
                    <div class="sgp-modal-actions" style="margin-top: 24px;">
                        <button class="sgp-btn sgp-btn-secondary" id="sgp-manage-close">Close</button>
                        <button class="sgp-btn sgp-btn-primary" id="sgp-manage-settings">Settings</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            requestAnimationFrame(() => modal.classList.add('visible'));

            // Edit buttons
            modal.querySelectorAll('.sgp-edit-profile').forEach(btn => {
                btn.addEventListener('click', () => {
                    const profileId = btn.dataset.id;
                    const profile = profiles.find(p => p.id === profileId);
                    if (profile) this.showEditProfileModal(profile);
                });
            });

            // Delete buttons
            modal.querySelectorAll('.sgp-delete-profile').forEach(btn => {
                btn.addEventListener('click', () => {
                    const profileId = btn.dataset.id;
                    const profile = profiles.find(p => p.id === profileId);
                    if (profile) this.showDeleteConfirmation(profile);
                });
            });

            // Close button
            modal.querySelector('#sgp-manage-close').addEventListener('click', () => {
                modal.classList.remove('visible');
                setTimeout(() => modal.remove(), 200);
            });

            // Settings button
            modal.querySelector('#sgp-manage-settings').addEventListener('click', () => {
                modal.classList.remove('visible');
                setTimeout(() => {
                    modal.remove();
                    // Close the selector too
                    const selector = document.getElementById('sgp-profile-selector');
                    if (selector) {
                        selector.classList.remove('visible');
                        setTimeout(() => selector.remove(), 300);
                    }
                    this.showSettingsPage();
                }, 200);
            });
        }

        // Create Profile Modal
        showCreateProfileModal(isFirst = false) {
            this.injectStyles();

            const modal = document.createElement('div');
            modal.className = 'sgp-modal';
            modal.id = 'sgp-create-profile-modal';

            let avatarsHtml = '';
            Object.entries(AVATARS).forEach(([id, avatar], i) => {
                avatarsHtml += `
                    <div class="sgp-avatar-option ${i === 0 ? 'selected' : ''}" data-avatar-id="${id}">
                        ${avatar.svg}
                    </div>
                `;
            });

            modal.innerHTML = `
                <div class="sgp-modal-content">
                    <h3 class="sgp-modal-title">${isFirst ? 'Create Your Profile' : 'Create Profile'}</h3>

                    <div class="sgp-form-group">
                        <label class="sgp-label">Profile Name</label>
                        <input type="text" class="sgp-input" id="sgp-profile-name" placeholder="Enter name" maxlength="20">
                    </div>

                    <div class="sgp-form-group">
                        <label class="sgp-label">Choose Avatar</label>
                        <div class="sgp-avatar-grid">${avatarsHtml}</div>
                    </div>

                    <div id="sgp-create-error" class="sgp-error" style="display: none;"></div>

                    <div class="sgp-modal-actions">
                        <button class="sgp-btn sgp-btn-secondary" id="sgp-create-cancel">Cancel</button>
                        <button class="sgp-btn sgp-btn-primary" id="sgp-create-save">Create</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            requestAnimationFrame(() => modal.classList.add('visible'));

            let selectedAvatar = 'gradient-purple';

            // Avatar selection
            modal.querySelectorAll('.sgp-avatar-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    modal.querySelectorAll('.sgp-avatar-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    selectedAvatar = opt.dataset.avatarId;
                });
            });

            modal.querySelector('#sgp-create-cancel').addEventListener('click', () => {
                modal.classList.remove('visible');
                setTimeout(() => modal.remove(), 200);
            });

            modal.querySelector('#sgp-create-save').addEventListener('click', async () => {
                const name = modal.querySelector('#sgp-profile-name').value.trim();
                const errorEl = modal.querySelector('#sgp-create-error');

                if (!name) {
                    errorEl.textContent = 'Please enter a profile name';
                    errorEl.style.display = 'block';
                    return;
                }

                try {
                    const profile = await this.profileManager.createProfile(name, selectedAvatar);
                    if (profile) {
                        modal.classList.remove('visible');
                        setTimeout(() => {
                            modal.remove();
                            this.showToast('Profile created!');
                            // If first profile, switch to it
                            if (isFirst) {
                                this.profileManager.switchProfile(profile.id);
                                this.updateSwitcher();
                            } else {
                                this.showProfileSelector();
                            }
                        }, 200);
                    }
                } catch (e) {
                    errorEl.textContent = e.message;
                    errorEl.style.display = 'block';
                }
            });
        }

        // Edit Profile Modal
        showEditProfileModal(profile) {
            this.injectStyles();

            const modal = document.createElement('div');
            modal.className = 'sgp-modal';
            modal.id = 'sgp-edit-profile-modal';

            let avatarsHtml = '';
            Object.entries(AVATARS).forEach(([id, avatar]) => {
                avatarsHtml += `
                    <div class="sgp-avatar-option ${profile.avatar_id === id ? 'selected' : ''}" data-avatar-id="${id}">
                        ${avatar.svg}
                    </div>
                `;
            });

            modal.innerHTML = `
                <div class="sgp-modal-content">
                    <h3 class="sgp-modal-title">Edit Profile</h3>

                    <div class="sgp-form-group">
                        <label class="sgp-label">Profile Name</label>
                        <input type="text" class="sgp-input" id="sgp-edit-name" value="${profile.name}" maxlength="20">
                    </div>

                    <div class="sgp-form-group">
                        <label class="sgp-label">Choose Avatar</label>
                        <div class="sgp-avatar-grid">${avatarsHtml}</div>
                    </div>

                    <div id="sgp-edit-error" class="sgp-error" style="display: none;"></div>

                    <div class="sgp-modal-actions">
                        <button class="sgp-btn sgp-btn-secondary" id="sgp-edit-cancel">Cancel</button>
                        <button class="sgp-btn sgp-btn-primary" id="sgp-edit-save">Save</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            requestAnimationFrame(() => modal.classList.add('visible'));

            let selectedAvatar = profile.avatar_id;

            modal.querySelectorAll('.sgp-avatar-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    modal.querySelectorAll('.sgp-avatar-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    selectedAvatar = opt.dataset.avatarId;
                });
            });

            modal.querySelector('#sgp-edit-cancel').addEventListener('click', () => {
                modal.classList.remove('visible');
                setTimeout(() => modal.remove(), 200);
            });

            modal.querySelector('#sgp-edit-save').addEventListener('click', async () => {
                const name = modal.querySelector('#sgp-edit-name').value.trim();
                const errorEl = modal.querySelector('#sgp-edit-error');

                if (!name) {
                    errorEl.textContent = 'Please enter a profile name';
                    errorEl.style.display = 'block';
                    return;
                }

                const result = await this.profileManager.updateProfile(profile.id, {
                    name,
                    avatarId: selectedAvatar
                });

                if (result) {
                    modal.classList.remove('visible');
                    setTimeout(() => {
                        modal.remove();
                        this.showToast('Profile updated!');
                        this.showProfileSelector();
                        this.updateSwitcher();
                    }, 200);
                }
            });
        }

        // Delete Confirmation
        showDeleteConfirmation(profile) {
            this.injectStyles();

            const modal = document.createElement('div');
            modal.className = 'sgp-modal';
            modal.id = 'sgp-delete-modal';

            modal.innerHTML = `
                <div class="sgp-modal-content">
                    <h3 class="sgp-modal-title">Delete Profile?</h3>
                    <p style="color: rgba(255,255,255,0.7); margin-bottom: 16px;">
                        Are you sure you want to delete <strong>${profile.name}</strong>?
                    </p>
                    <p style="color: #f85032; font-size: 13px;">
                        This will permanently delete all watchlist items and watch history for this profile.
                    </p>

                    <div class="sgp-modal-actions">
                        <button class="sgp-btn sgp-btn-secondary" id="sgp-delete-cancel">Cancel</button>
                        <button class="sgp-btn sgp-btn-danger" id="sgp-delete-confirm">Delete</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            requestAnimationFrame(() => modal.classList.add('visible'));

            modal.querySelector('#sgp-delete-cancel').addEventListener('click', () => {
                modal.classList.remove('visible');
                setTimeout(() => modal.remove(), 200);
            });

            modal.querySelector('#sgp-delete-confirm').addEventListener('click', async () => {
                await this.profileManager.deleteProfile(profile.id);
                modal.classList.remove('visible');
                setTimeout(() => {
                    modal.remove();
                    this.showToast('Profile deleted');
                    this.showProfileSelector();
                    this.updateSwitcher();
                }, 200);
            });
        }

        // Profile Switcher (nav bar - circular avatar between search and fullscreen)
        injectSwitcher() {
            this.injectStyles();

            // Remove existing
            const existing = document.querySelector('.sgp-nav-profile');
            if (existing) existing.remove();
            const existingOld = document.querySelector('.sgp-switcher');
            if (existingOld) existingOld.remove();

            // Find the nav bar buttons container (where search and fullscreen icons are)
            const navBar = document.querySelector('.horizontal-nav-bar-container-Y_zvK');
            if (!navBar) {
                setTimeout(() => this.injectSwitcher(), 1000);
                return;
            }

            const activeProfile = this.profileManager.getActiveProfile();
            if (!activeProfile) return;

            // Find the fullscreen button to insert before it
            const navButtons = navBar.querySelectorAll('[class*="button"]');
            let fullscreenBtn = null;

            navButtons.forEach(btn => {
                if (btn.querySelector('svg') && (
                    btn.innerHTML.includes('expand') ||
                    btn.innerHTML.includes('fullscreen') ||
                    btn.className.includes('fullscreen') ||
                    btn.getAttribute('title')?.toLowerCase().includes('fullscreen')
                )) {
                    fullscreenBtn = btn;
                }
            });

            // Create the profile avatar container
            const profileContainer = document.createElement('div');
            profileContainer.className = 'sgp-nav-profile';
            profileContainer.title = `${activeProfile.name} - Click to switch profiles`;
            profileContainer.innerHTML = this.getAvatarSvg(activeProfile.avatar_id);

            // Insert between search and fullscreen (or at end of nav bar)
            if (fullscreenBtn && fullscreenBtn.parentNode) {
                fullscreenBtn.parentNode.insertBefore(profileContainer, fullscreenBtn);
            } else {
                navBar.appendChild(profileContainer);
            }

            // Click opens full-screen profile selector directly (Netflix style)
            profileContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showProfileSelector();
            });
        }

        updateSwitcher() {
            const existing = document.querySelector('.sgp-nav-profile');
            if (existing) existing.remove();
            const existingOld = document.querySelector('.sgp-switcher');
            if (existingOld) existingOld.remove();
            this.injectSwitcher();
        }

        // Settings Page
        async showSettingsPage() {
            this.injectStyles();

            // Remove existing
            const existing = document.getElementById('sgp-settings-page');
            if (existing) existing.remove();

            const config = this.configManager.loadConfig();

            // Try to get profiles count, but handle errors gracefully
            let profileCount = 0;
            try {
                if (this.profileManager) {
                    const profiles = await this.profileManager.getProfiles();
                    profileCount = profiles.length;
                }
            } catch (e) {
                console.log('[Profiles] Could not fetch profiles:', e);
            }

            // Test connection but handle errors
            let isConnected = false;
            try {
                if (this.supabaseClient && config?.projectUrl) {
                    isConnected = await this.supabaseClient.testConnection();
                }
            } catch (e) {
                console.log('[Profiles] Connection test failed:', e);
            }

            // Extract project name from URL
            const projectUrl = config?.projectUrl || '';
            const projectName = projectUrl.replace('https://', '').replace('.supabase.co', '');

            // Mask the anon key
            const anonKey = config?.anonKey || '';
            const maskedKey = anonKey.length > 20
                ? anonKey.substring(0, 8) + '••••••••' + anonKey.substring(anonKey.length - 4)
                : '••••••••';

            const page = document.createElement('div');
            page.className = 'sgp-settings-page';
            page.id = 'sgp-settings-page';

            page.innerHTML = `
                <div class="sgp-settings-header">
                    <button class="sgp-back-btn" id="sgp-settings-back">←</button>
                    <span class="sgp-settings-title">Profiles Settings</span>
                </div>
                <div class="sgp-settings-content">
                    <div class="sgp-settings-container">
                        <!-- Connection Section -->
                        <div class="sgp-settings-section">
                            <div class="sgp-settings-section-title">Connection</div>
                            <div class="sgp-settings-row">
                                <span class="sgp-settings-label">Status</span>
                                <span class="sgp-status-badge ${isConnected ? 'connected' : 'disconnected'}">
                                    ${isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <div class="sgp-settings-row">
                                <span class="sgp-settings-label">Project URL</span>
                                <span class="sgp-settings-value" title="${projectUrl}">${projectName || 'Not configured'}</span>
                            </div>
                            <div class="sgp-settings-row">
                                <span class="sgp-settings-label">API Key</span>
                                <span class="sgp-settings-value masked">${maskedKey}</span>
                            </div>
                        </div>

                        <!-- Sync Section -->
                        <div class="sgp-settings-section">
                            <div class="sgp-settings-section-title">Sync</div>
                            <div class="sgp-settings-row">
                                <span class="sgp-settings-label">Last Synced</span>
                                <span class="sgp-settings-value" id="sgp-last-sync">${this.formatLastSync()}</span>
                            </div>
                            <div class="sgp-settings-row">
                                <span class="sgp-settings-label">Total Profiles</span>
                                <span class="sgp-settings-value">${profileCount} / ${MAX_PROFILES}</span>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="sgp-settings-actions">
                            <button class="sgp-btn sgp-btn-primary sgp-btn-full" id="sgp-manual-sync">
                                Sync Now
                            </button>
                            <button class="sgp-btn sgp-btn-danger sgp-btn-full" id="sgp-delink">
                                Delink Supabase
                            </button>
                        </div>

                        <p style="text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 24px;">
                            Delinking will remove your Supabase credentials from this device.<br>
                            Your cloud data will remain intact.
                        </p>
                    </div>
                </div>
            `;

            document.body.appendChild(page);
            requestAnimationFrame(() => page.classList.add('visible'));

            // Back button
            page.querySelector('#sgp-settings-back').addEventListener('click', () => {
                page.classList.remove('visible');
                setTimeout(() => page.remove(), 300);
            });

            // Manual sync
            page.querySelector('#sgp-manual-sync').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.textContent = 'Syncing...';

                try {
                    await this.syncEngine.fullSync();
                    this.showToast('Sync complete!');
                    page.querySelector('#sgp-last-sync').textContent = 'Just now';
                } catch (err) {
                    this.showToast('Sync failed', 'error');
                }

                btn.disabled = false;
                btn.textContent = 'Sync Now';
            });

            // Delink
            page.querySelector('#sgp-delink').addEventListener('click', () => {
                this.showDelinkConfirmation(page);
            });
        }

        formatLastSync() {
            const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_AT);
            if (!lastSync || lastSync === '1970-01-01T00:00:00Z') {
                return 'Never';
            }

            const date = new Date(lastSync);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

            return date.toLocaleDateString();
        }

        // Inject settings icon into the plugin card in Settings → Plugins and Plus → Plugins
        injectPluginSettingsIcon() {
            this.injectStyles();

            // Find all plugin cards - both in Settings page and Plus page
            // Settings page uses [class*="addon-container"], Plus page uses .plus-mod-item
            const settingsPluginCards = document.querySelectorAll('[class*="addon-container"]');
            const plusPluginCards = document.querySelectorAll('.plus-mod-item[data-plugin-file]');

            // Process Settings page cards
            settingsPluginCards.forEach(card => {
                // Check if this is the StreamGo Profiles plugin by looking for its name
                const nameEl = card.querySelector('[class*="name-container"]');
                if (nameEl && nameEl.textContent.includes('StreamGo Profiles')) {
                    this.addSettingsIconToCard(card);
                }
            });

            // Process Plus page cards
            plusPluginCards.forEach(card => {
                // Check if this is the StreamGo Profiles plugin
                const nameEl = card.querySelector('.plus-mod-name');
                if (nameEl && nameEl.textContent.includes('StreamGo Profiles')) {
                    this.addSettingsIconToCard(card, true);
                }
            });
        }

        // Helper to add settings icon to a plugin card
        addSettingsIconToCard(card, isPlusPage = false) {
            // Check if we already added the settings button
            if (card.querySelector('.sgp-plugin-settings-btn')) return;

            // Create the settings button
            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'sgp-plugin-settings-btn';
            if (isPlusPage) {
                settingsBtn.classList.add('sgp-plugin-settings-btn-plus');
            }
            settingsBtn.title = 'Plugin Settings';
            settingsBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            `;

            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showSettingsPage();
            });

            if (isPlusPage) {
                // On Plus page, insert into the controls container before the toggle
                const controlsContainer = card.querySelector('.plus-mod-controls');
                if (controlsContainer) {
                    controlsContainer.insertBefore(settingsBtn, controlsContainer.firstChild);
                } else {
                    card.appendChild(settingsBtn);
                }
            } else {
                // On Settings page, use absolute positioning
                card.style.position = 'relative';
                card.appendChild(settingsBtn);
            }
        }

        showDelinkConfirmation(settingsPage) {
            const modal = document.createElement('div');
            modal.className = 'sgp-modal';
            modal.id = 'sgp-delink-modal';

            modal.innerHTML = `
                <div class="sgp-modal-content">
                    <h3 class="sgp-modal-title">Delink Supabase?</h3>
                    <p style="color: rgba(255,255,255,0.7); margin-bottom: 16px;">
                        This will remove your Supabase credentials from this device.
                    </p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 13px;">
                        Your profiles and data in Supabase will <strong>not</strong> be deleted.
                        You can reconnect anytime using the same credentials.
                    </p>

                    <div class="sgp-modal-actions">
                        <button class="sgp-btn sgp-btn-secondary" id="sgp-delink-cancel">Cancel</button>
                        <button class="sgp-btn sgp-btn-danger" id="sgp-delink-confirm">Delink</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            requestAnimationFrame(() => modal.classList.add('visible'));

            modal.querySelector('#sgp-delink-cancel').addEventListener('click', () => {
                modal.classList.remove('visible');
                setTimeout(() => modal.remove(), 200);
            });

            modal.querySelector('#sgp-delink-confirm').addEventListener('click', () => {
                // Clear all local data - both new and any old keys
                this.configManager.clearConfig();

                // Clear all storage keys
                Object.values(STORAGE_KEYS).forEach(key => {
                    localStorage.removeItem(key);
                });

                // Also clear any potential old/legacy keys
                const keysToRemove = [
                    'streamgo_active_profile_id',
                    'streamgo_cached_profiles',
                    'streamgo_device_id',
                    'streamgo_last_sync_at',
                    'streamgo_pending_changes',
                    'streamgo_cached_watchlist',
                    'streamgo_cached_continue',
                    'sgp_supabase_url',
                    'sgp_supabase_key',
                    'sgp_config'
                ];
                keysToRemove.forEach(key => localStorage.removeItem(key));

                // Remove UI elements
                const navProfile = document.querySelector('.sgp-nav-profile');
                if (navProfile) navProfile.remove();
                const switcher = document.querySelector('.sgp-switcher');
                if (switcher) switcher.remove();

                modal.classList.remove('visible');
                settingsPage.classList.remove('visible');

                setTimeout(() => {
                    modal.remove();
                    settingsPage.remove();
                    this.showToast('Supabase delinked - all data cleared');
                    // Show setup wizard again
                    this.showSetupWizard();
                }, 200);
            });
        }
    }

    // ============================================
    // MAIN PLUGIN CLASS
    // ============================================

    class StreamGoProfiles {
        constructor() {
            this.configManager = new ConfigManager();
            this.accountManager = new AccountManager();
            this.supabaseClient = null;
            this.syncEngine = null;
            this.profileManager = null;
            this.dataManager = null;
            this.stremioIntegration = null;
            this.uiManager = null;
            this.realtimeManager = null;
            this.localStorageManager = null;
            this.offlineQueueManager = null;
            this.domFilterManager = null;  // NEW: DOM-based UI filtering
            this.initialized = false;
        }

        async init() {
            // Prevent duplicate initializations
            if (this._initInProgress) {
                console.log(`[${PLUGIN_NAME}] Init already in progress, skipping...`);
                return;
            }
            this._initInProgress = true;

            console.log(`[${PLUGIN_NAME}] Initializing...`);

            // Initialize core managers
            this.supabaseClient = new SupabaseClient(this.configManager, this.accountManager);
            this.syncEngine = new SyncEngine(this.supabaseClient, this.accountManager);
            this.profileManager = new ProfileManager(this.supabaseClient, this.accountManager, this.syncEngine);
            this.dataManager = new DataManager(this.supabaseClient, this.profileManager, this.syncEngine);

            // Initialize new managers
            this.localStorageManager = new LocalStorageManager();
            this.offlineQueueManager = new OfflineQueueManager(this.supabaseClient);
            this.realtimeManager = new RealtimeManager(this.supabaseClient, this.syncEngine);
            this.domFilterManager = new DOMFilterManager(this.dataManager);  // NEW

            // Wire up managers
            this.profileManager.setLocalStorageManager(this.localStorageManager);
            this.profileManager.setRealtimeManager(this.realtimeManager);
            this.profileManager.setDOMFilterManager(this.domFilterManager);  // NEW
            this.domFilterManager.setProfileManager(this.profileManager);    // NEW
            this.realtimeManager.setProfileManager(this.profileManager);
            this.dataManager.setOfflineQueue(this.offlineQueueManager);

            // Create Stremio integration (hooks into Stremio's UI)
            this.stremioIntegration = new StremioIntegration(this.dataManager, this.profileManager, this.syncEngine);

            // Wire up the integration to ProfileManager
            this.profileManager.setStremioIntegration(this.stremioIntegration);

            // Wire up DOM filter to Stremio integration (so new watches update the filter)
            this.stremioIntegration.setDOMFilterManager(this.domFilterManager);

            this.uiManager = new UIManager(
                this.profileManager,
                this.dataManager,
                this.configManager,
                this.syncEngine,
                this.accountManager,
                this.supabaseClient
            );

            // Setup navigation observer early so settings icon works
            this.setupNavigationObserver();

            // Check if user is logged into Stremio and profile data is ready
            if (!this.accountManager.isLoggedIn()) {
                console.log(`[${PLUGIN_NAME}] Not logged into Stremio, waiting...`);
                this._initInProgress = false; // Reset to allow retry
                setTimeout(() => this.init(), 3000);
                return;
            }

            // Wait for Stremio profile data to be fully loaded (with max retries)
            if (!this.accountManager.isProfileDataReady()) {
                this._profileReadyRetries = (this._profileReadyRetries || 0) + 1;
                if (this._profileReadyRetries > 10) {
                    // After 10 retries (20 seconds), proceed anyway with whatever data we have
                    console.log(`[${PLUGIN_NAME}] Max profile ready retries reached, proceeding with available data...`);
                    this._profileReadyRetries = 0;
                } else {
                    console.log(`[${PLUGIN_NAME}] Stremio profile data not fully loaded, waiting... (attempt ${this._profileReadyRetries}/10)`);
                    this._initInProgress = false; // Reset to allow retry
                    setTimeout(() => this.init(), 2000);
                    return;
                }
            } else {
                this._profileReadyRetries = 0; // Reset on success
            }

            // Compute account hash
            await this.accountManager.computeHashedAccountId();
            const currentAccountId = this.accountManager.getHashedAccountId();

            if (!currentAccountId) {
                console.log(`[${PLUGIN_NAME}] Failed to compute account ID, retrying...`);
                this._initInProgress = false; // Reset to allow retry
                setTimeout(() => this.init(), 2000);
                return;
            }

            console.log(`[${PLUGIN_NAME}] Current account ID: ${currentAccountId?.substring(0, 16)}...`);

            // Check if configured
            if (!this.configManager.isConfigured()) {
                console.log(`[${PLUGIN_NAME}] Not configured, showing setup wizard`);
                this._initInProgress = false; // Reset as setup wizard handles flow
                this.uiManager.showSetupWizard();
                return;
            }

            // Load config
            this.configManager.loadConfig();

            // Check if account changed - clear stale caches
            const lastAccountId = localStorage.getItem(STORAGE_KEYS.LAST_ACCOUNT_ID);
            if (lastAccountId && lastAccountId !== currentAccountId) {
                console.log(`[${PLUGIN_NAME}] Account changed, clearing stale caches...`);
                this.clearAllCaches();
            }
            localStorage.setItem(STORAGE_KEYS.LAST_ACCOUNT_ID, currentAccountId);

            // Initialize Supabase SDK for realtime support
            // Force reinitialize to ensure headers have the correct account ID
            this.supabaseClient.initialized = false;
            this.supabaseClient.client = null;
            await this.supabaseClient.initialize();
            console.log(`[${PLUGIN_NAME}] Supabase SDK initialized with account ID: ${this.accountManager.getHashedAccountId()?.substring(0, 16)}...`);

            // Fetch profiles with retry logic
            let profiles = await this.fetchProfilesWithRetry();
            console.log(`[${PLUGIN_NAME}] Final profile count: ${profiles.length}`);

            let activeProfile = null;

            if (profiles.length === 0) {
                // No profiles - AUTO-CREATE "Main" profile (no dialog needed)
                console.log(`[${PLUGIN_NAME}] No profiles found, auto-creating Main profile...`);
                activeProfile = await this.autoCreateMainProfile();
                if (activeProfile) {
                    profiles = [activeProfile];
                }
            } else {
                // Check for locally stored active profile ID
                let activeProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
                activeProfile = activeProfileId ? profiles.find(p => p.id === activeProfileId) : null;

                // If local active profile doesn't match server profiles, check server's is_active flag
                if (!activeProfile) {
                    console.log(`[${PLUGIN_NAME}] Local active profile not found, checking server is_active flag...`);
                    const serverActiveProfile = profiles.find(p => p.is_active);
                    if (serverActiveProfile) {
                        console.log(`[${PLUGIN_NAME}] Found server-active profile: ${serverActiveProfile.name}`);
                        activeProfile = serverActiveProfile;
                        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, serverActiveProfile.id);
                    }
                }

                // If still no active profile, use the first (main) profile
                if (!activeProfile) {
                    console.log(`[${PLUGIN_NAME}] No active profile found, auto-selecting first profile...`);
                    activeProfile = profiles[0];
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, activeProfile.id);
                    // Mark it as active on server too
                    await this.supabaseClient.update('profiles', { is_active: true }, { id: activeProfile.id });
                }
            }

            if (activeProfile) {
                console.log(`[${PLUGIN_NAME}] Using profile: ${activeProfile.name} (${activeProfile.id})`);

                // Fetch profile data (populate caches)
                await this.loadProfileData(activeProfile.id);

                // Inject switcher and subscribe to realtime
                this.uiManager.injectSwitcher();
                await this.realtimeManager.subscribeToProfileChanges();

                // Initialize DOM Filter Manager for UI-based profile isolation
                await this.domFilterManager.init();
            }

            // Initialize Stremio integration (hooks into UI for watchlist/progress tracking)
            this.stremioIntegration.init();

            // Process any pending offline queue items
            this.offlineQueueManager.processQueue();

            // Setup periodic sync as fallback (every 30 seconds)
            setInterval(() => {
                if (this.syncEngine.shouldSync()) {
                    this.syncEngine.deltaSync();
                }
            }, 30000);

            this.initialized = true;
            this._initInProgress = false;
            console.log(`[${PLUGIN_NAME}] Initialized with UI Filtering support`);
        }

        // Auto-create Main profile when user first signs in
        async autoCreateMainProfile() {
            try {
                const accountId = this.accountManager.getHashedAccountId();
                if (!accountId) {
                    console.error(`[${PLUGIN_NAME}] Cannot create Main profile: no account ID`);
                    return null;
                }

                console.log(`[${PLUGIN_NAME}] Creating Main profile for account ${accountId.substring(0, 16)}...`);

                // Create Main profile
                const mainProfile = await this.supabaseClient.insert('profiles', {
                    account_id: accountId,
                    name: 'Main',
                    avatar_id: 'gradient-purple',
                    is_active: true,
                    is_main: true
                });

                if (mainProfile) {
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, mainProfile.id);
                    localStorage.setItem(STORAGE_KEYS.MAIN_PROFILE_ID, mainProfile.id);

                    // Import existing Stremio continue watching data to Main profile
                    await this.importStremioDataToProfile(mainProfile.id);

                    // Refresh cache
                    await this.syncEngine.fullSync();

                    console.log(`[${PLUGIN_NAME}] Main profile created: ${mainProfile.id}`);
                    return mainProfile;
                }

                return null;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to auto-create Main profile:`, e);
                return null;
            }
        }

        // Import existing Stremio continue watching data to a profile
        async importStremioDataToProfile(profileId) {
            // Check if already imported
            if (localStorage.getItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED) === 'true') {
                console.log(`[${PLUGIN_NAME}] Stremio data already imported, skipping`);
                return;
            }

            console.log(`[${PLUGIN_NAME}] Importing Stremio data to profile ${profileId}...`);

            try {
                // Get library_recent (continue watching data)
                const libraryRecentStr = localStorage.getItem('library_recent');
                if (!libraryRecentStr) {
                    console.log(`[${PLUGIN_NAME}] No library_recent found, nothing to import`);
                    localStorage.setItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED, 'true');
                    return;
                }

                const libraryRecentData = JSON.parse(libraryRecentStr);
                const items = libraryRecentData.items || libraryRecentData;

                let imported = 0;
                for (const [contentId, item] of Object.entries(items)) {
                    if (!item || typeof item !== 'object') continue;

                    // Only import items with actual watch progress
                    const state = item.state || {};
                    if (!state.timeOffset || state.timeOffset <= 0) continue;

                    // Convert from milliseconds to seconds if needed
                    let progress = state.timeOffset || 0;
                    let duration = state.duration || 0;
                    if (progress > 100000) progress = progress / 1000;
                    if (duration > 100000) duration = duration / 1000;

                    // Extract season/episode from video_id
                    let season = null;
                    let episode = null;
                    const videoId = state.video_id || contentId;
                    const episodeMatch = videoId.match(/:(\d+):(\d+)$/);
                    if (episodeMatch) {
                        season = parseInt(episodeMatch[1]);
                        episode = parseInt(episodeMatch[2]);
                    }

                    await this.dataManager.updateProgress(
                        contentId,
                        videoId,
                        progress,
                        duration,
                        {
                            type: item.type || 'movie',
                            title: item.name,
                            poster: item.poster,
                            season,
                            episode
                        }
                    );
                    imported++;
                }

                localStorage.setItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED, 'true');
                console.log(`[${PLUGIN_NAME}] Imported ${imported} continue watching items`);
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error importing Stremio data:`, e);
            }
        }

        // Public API: Force import existing Stremio data to the active profile
        // Call this from console: window.StreamGoProfiles.forceImportStremioData()
        async forceImportStremioData() {
            if (!this.stremioIntegration) {
                console.error(`[${PLUGIN_NAME}] Plugin not initialized yet`);
                return { success: false, error: 'Plugin not initialized' };
            }
            return await this.stremioIntegration.forceImportStremioData();
        }

        // Public API: Debug Stremio profile structure
        // Call from console: window.StreamGoProfiles.debugStremioProfile()
        debugStremioProfile() {
            try {
                const profileStr = localStorage.getItem('profile');
                if (!profileStr) {
                    console.log(`[${PLUGIN_NAME}] No 'profile' key in localStorage`);
                    return null;
                }
                const profile = JSON.parse(profileStr);
                console.log(`[${PLUGIN_NAME}] Stremio profile structure:`, {
                    hasProfile: !!profile,
                    hasAuth: !!profile?.auth,
                    hasAuthKey: !!profile?.auth?.key,
                    authKeyLength: profile?.auth?.key?.length || 0,
                    topLevelKeys: Object.keys(profile || {}),
                    authKeys: Object.keys(profile?.auth || {})
                });
                return profile;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to parse profile:`, e);
                return null;
            }
        }

        // Public API: List all profiles
        // Call from console: window.StreamGoProfiles.listProfiles()
        async listProfiles() {
            const profiles = await this.profileManager.getProfiles(true);
            const activeId = this.profileManager.getActiveProfileId();
            console.log(`[${PLUGIN_NAME}] === PROFILES ===`);
            profiles.forEach(p => {
                const active = p.id === activeId ? ' [ACTIVE]' : '';
                console.log(`[${PLUGIN_NAME}]   ${p.name}: ${p.id}${active}`);
            });
            console.log(`[${PLUGIN_NAME}] === END ===`);
            return profiles;
        }

        // Public API: Test profile switch
        // Call from console: window.StreamGoProfiles.testProfileSwitch('profile-id')
        async testProfileSwitch(profileId) {
            console.log(`[${PLUGIN_NAME}] === TEST PROFILE SWITCH ===`);
            console.log(`[${PLUGIN_NAME}] Target profile ID: ${profileId}`);

            // 1. Check current state
            const currentProfileId = this.profileManager.getActiveProfileId();
            console.log(`[${PLUGIN_NAME}] Current profile ID: ${currentProfileId}`);

            // 2. Fetch data for target profile
            console.log(`[${PLUGIN_NAME}] Fetching data for target profile...`);
            const [watchlist, continueWatching] = await Promise.all([
                this.supabaseClient.select('profile_watchlist', {
                    filter: { profile_id: profileId },
                    order: 'added_at.desc'
                }),
                this.supabaseClient.select('profile_continue_watching', {
                    filter: { profile_id: profileId },
                    order: 'last_watched_at.desc'
                })
            ]);

            console.log(`[${PLUGIN_NAME}] Target profile data:`);
            console.log(`[${PLUGIN_NAME}]   - Watchlist: ${watchlist?.length || 0} items`);
            console.log(`[${PLUGIN_NAME}]   - Continue watching: ${continueWatching?.length || 0} items`);

            if (continueWatching && continueWatching.length > 0) {
                console.log(`[${PLUGIN_NAME}]   - First continue item:`, continueWatching[0]);
            }

            // 3. Check current localStorage
            console.log(`[${PLUGIN_NAME}] Current localStorage:`);
            const currentLibrary = localStorage.getItem('library');
            const currentRecent = localStorage.getItem('library_recent');
            console.log(`[${PLUGIN_NAME}]   - library: ${currentLibrary?.length || 0} chars`);
            console.log(`[${PLUGIN_NAME}]   - library_recent: ${currentRecent?.length || 0} chars`);

            // 4. Now actually switch
            console.log(`[${PLUGIN_NAME}] Calling switchProfile...`);
            const result = await this.profileManager.switchProfile(profileId);
            console.log(`[${PLUGIN_NAME}] switchProfile result: ${result}`);

            // 5. Check localStorage after switch (before reload)
            console.log(`[${PLUGIN_NAME}] localStorage AFTER switch:`);
            const newLibrary = localStorage.getItem('library');
            const newRecent = localStorage.getItem('library_recent');
            console.log(`[${PLUGIN_NAME}]   - library: ${newLibrary?.length || 0} chars`);
            console.log(`[${PLUGIN_NAME}]   - library_recent: ${newRecent?.length || 0} chars`);

            try {
                const recentParsed = JSON.parse(newRecent);
                console.log(`[${PLUGIN_NAME}]   - library_recent items count: ${Object.keys(recentParsed?.items || {}).length}`);
            } catch (e) {
                console.log(`[${PLUGIN_NAME}]   - Could not parse library_recent`);
            }

            console.log(`[${PLUGIN_NAME}] === END TEST ===`);
            return result;
        }

        // Public API: Debug account ID and test Supabase connection
        // Call from console: window.StreamGoProfiles.debugConnection()
        async debugConnection() {
            console.log(`[${PLUGIN_NAME}] === DEBUG CONNECTION ===`);

            // 1. Check account ID
            const accountId = this.accountManager.getHashedAccountId();
            console.log(`[${PLUGIN_NAME}] Current account ID hash: ${accountId}`);

            // 2. Check Supabase config
            const projectUrl = this.configManager.getProjectUrl();
            console.log(`[${PLUGIN_NAME}] Supabase URL: ${projectUrl}`);

            // 3. Try direct fetch without RLS filter to see all profiles
            try {
                const headers = this.supabaseClient.getHeaders();
                console.log(`[${PLUGIN_NAME}] Request headers x-account-id: ${headers['x-account-id']}`);

                // Fetch ALL profiles (without account_id filter) to see what's in the database
                const url = `${projectUrl}/rest/v1/profiles?select=id,account_id,name,is_active`;
                console.log(`[${PLUGIN_NAME}] Fetching: ${url}`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers
                });

                const responseText = await response.text();
                console.log(`[${PLUGIN_NAME}] Response status: ${response.status}`);
                console.log(`[${PLUGIN_NAME}] Response body: ${responseText}`);

                if (response.ok) {
                    const profiles = JSON.parse(responseText);
                    console.log(`[${PLUGIN_NAME}] Found ${profiles.length} total profiles in database:`);
                    profiles.forEach(p => {
                        const matches = p.account_id === accountId ? '✓ MATCHES' : '✗ different';
                        console.log(`[${PLUGIN_NAME}]   - ${p.name}: account_id=${p.account_id?.substring(0, 16)}... ${matches}`);
                    });
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Debug fetch failed:`, e);
            }

            console.log(`[${PLUGIN_NAME}] === END DEBUG ===`);
        }

        // Public API: Get current sync status
        getSyncStatus() {
            return {
                initialized: this.initialized,
                hasActiveProfile: !!this.profileManager?.getActiveProfileId(),
                activeProfileId: this.profileManager?.getActiveProfileId(),
                watchlistCount: this.syncEngine?.getCachedWatchlist()?.length || 0,
                continueWatchingCount: this.syncEngine?.getCachedContinueWatching()?.length || 0,
                favoritesCount: this.syncEngine?.getCachedFavorites()?.length || 0,
                isOnline: navigator.onLine,
                offlineQueueLength: this.offlineQueueManager?.getQueue()?.length || 0
            };
        }

        // Clear all caches (used when account changes)
        clearAllCaches() {
            console.log(`[${PLUGIN_NAME}] Clearing all caches...`);

            // Reset initialized flags to allow reinit
            this.initialized = false;
            this._initInProgress = false;

            // Clear profile-related caches
            localStorage.removeItem(STORAGE_KEYS.CACHED_PROFILES);
            localStorage.removeItem(STORAGE_KEYS.CACHED_WATCHLIST);
            localStorage.removeItem(STORAGE_KEYS.CACHED_CONTINUE);
            localStorage.removeItem(STORAGE_KEYS.CACHED_FAVORITES);
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
            localStorage.removeItem(STORAGE_KEYS.MAIN_PROFILE_ID);
            localStorage.removeItem(STORAGE_KEYS.LAST_SYNC_AT);
            localStorage.removeItem(STORAGE_KEYS.STREMIO_DATA_IMPORTED);

            // Clear any saved profile localStorage data
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('streamgo_profile_data_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Clear sync engine caches in memory
            if (this.syncEngine) {
                this.syncEngine.cacheProfiles([]);
                this.syncEngine.cacheWatchlist([]);
                this.syncEngine.cacheContinueWatching([]);
                this.syncEngine.cacheFavorites([]);
            }

            // Reset Supabase client so it reinitializes with new headers
            if (this.supabaseClient) {
                this.supabaseClient.initialized = false;
                this.supabaseClient.client = null;
            }

            console.log(`[${PLUGIN_NAME}] All caches cleared`);
        }

        // Load profile data from Supabase and build localStorage
        async loadProfileData(profileId) {
            console.log(`[${PLUGIN_NAME}] Loading data for profile ${profileId}...`);

            try {
                // Fetch watchlist and continue watching in parallel
                const [watchlist, continueWatching] = await Promise.all([
                    this.supabaseClient.select('profile_watchlist', {
                        filter: { profile_id: profileId },
                        order: 'added_at.desc'
                    }),
                    this.supabaseClient.select('profile_continue_watching', {
                        filter: { profile_id: profileId },
                        order: 'last_watched_at.desc'
                    })
                ]);

                // Filter out soft-deleted items
                const filteredWatchlist = (watchlist || []).filter(w => !w.deleted_at);
                const filteredContinueWatching = (continueWatching || []).filter(c => !c.deleted_at);

                console.log(`[${PLUGIN_NAME}] Loaded: ${filteredWatchlist.length} watchlist, ${filteredContinueWatching.length} continue watching`);

                // Update caches (DOM filtering uses these caches to know which items to show)
                this.syncEngine.cacheWatchlist(filteredWatchlist);
                this.syncEngine.cacheContinueWatching(filteredContinueWatching);

                // NOTE: We no longer build localStorage for Stremio
                // Instead, DOM filtering shows/hides Continue Watching items based on profile

                return { watchlist: filteredWatchlist, continueWatching: filteredContinueWatching };
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Failed to load profile data:`, e);
                return { watchlist: [], continueWatching: [] };
            }
        }

        // Fetch profiles with retry logic for robustness
        async fetchProfilesWithRetry(maxRetries = 3, delayMs = 1500) {
            console.log(`[${PLUGIN_NAME}] Fetching profiles from server...`);

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                console.log(`[${PLUGIN_NAME}] Fetch attempt ${attempt}/${maxRetries}...`);

                try {
                    // First do a fullSync to populate all caches
                    const syncResult = await this.syncEngine.fullSync();
                    console.log(`[${PLUGIN_NAME}] fullSync returned:`, syncResult ? `${syncResult.length} profiles` : 'null/failed');

                    // Force fetch profiles fresh (bypassing cache) to ensure we have the latest
                    const profiles = await this.profileManager.getProfiles(true);
                    console.log(`[${PLUGIN_NAME}] Attempt ${attempt}: Found ${profiles.length} profiles`);

                    if (profiles.length > 0) {
                        return profiles;
                    }

                    // If no profiles found and not last attempt, wait and retry
                    if (attempt < maxRetries) {
                        console.log(`[${PLUGIN_NAME}] No profiles found, waiting ${delayMs}ms before retry...`);

                        // Re-check if account ID is still valid before retry
                        const accountId = this.accountManager.getHashedAccountId();
                        if (!accountId) {
                            console.log(`[${PLUGIN_NAME}] Account ID lost, recomputing...`);
                            await this.accountManager.computeHashedAccountId();
                            this.supabaseClient.updateAccountId();
                        }

                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] Fetch attempt ${attempt} failed:`, e);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }
            }

            console.log(`[${PLUGIN_NAME}] All ${maxRetries} fetch attempts returned 0 profiles`);
            return [];
        }

        setupNavigationObserver() {
            // Prevent multiple observers
            if (this._observerSetup) return;
            this._observerSetup = true;

            // Re-inject switcher when nav bar is recreated
            // Also inject plugin settings icon when on plugins page
            const observer = new MutationObserver(() => {
                if (!this.uiManager) return;

                const navBar = document.querySelector('.horizontal-nav-bar-container-Y_zvK');
                if (navBar && !navBar.querySelector('.sgp-nav-profile')) {
                    try {
                        const activeProfile = this.profileManager?.getActiveProfile();
                        if (activeProfile) {
                            this.uiManager.injectSwitcher();
                        }
                    } catch (e) {
                        // Ignore errors during navigation
                    }
                }

                // Check if we're on the plugins/addons page (Settings or Plus page) and inject settings icon
                const settingsPluginCards = document.querySelectorAll('[class*="addon-container"]');
                const plusPluginCards = document.querySelectorAll('.plus-mod-item[data-plugin-file]');
                if (settingsPluginCards.length > 0 || plusPluginCards.length > 0) {
                    try {
                        this.uiManager.injectPluginSettingsIcon();
                    } catch (e) {
                        // Ignore errors during navigation
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    // Initialize plugin
    window.StreamGoProfiles = new StreamGoProfiles();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => window.StreamGoProfiles.init(), 1000);
        });
    } else {
        setTimeout(() => window.StreamGoProfiles.init(), 1000);
    }

    // Listen for Stremio profile changes (login/logout events)
    let lastProfileJson = localStorage.getItem('profile');
    window.addEventListener('storage', (e) => {
        if (e.key === 'profile') {
            const newProfileJson = e.newValue;

            // Profile changed (login or logout)
            if (newProfileJson !== lastProfileJson) {
                console.log(`[${PLUGIN_NAME}] Stremio profile changed, reinitializing...`);
                lastProfileJson = newProfileJson;

                // If new profile exists, reinitialize after a delay
                if (newProfileJson) {
                    setTimeout(() => {
                        if (window.StreamGoProfiles.initialized) {
                            // Clear caches and reinitialize
                            window.StreamGoProfiles.clearAllCaches();
                        }
                        window.StreamGoProfiles.init();
                    }, 2000);
                }
            }
        }
    });

    // Also poll for profile changes (storage event doesn't fire in same tab)
    setInterval(() => {
        const currentProfile = localStorage.getItem('profile');
        if (currentProfile !== lastProfileJson) {
            console.log(`[${PLUGIN_NAME}] Detected profile change via polling`);
            lastProfileJson = currentProfile;

            if (currentProfile && window.StreamGoProfiles.accountManager) {
                // Check if auth key changed
                if (window.StreamGoProfiles.accountManager.hasAuthKeyChanged()) {
                    console.log(`[${PLUGIN_NAME}] Auth key changed, reinitializing...`);
                    window.StreamGoProfiles.clearAllCaches();
                    window.StreamGoProfiles.init();
                }
            }
        }
    }, 3000);

})();
