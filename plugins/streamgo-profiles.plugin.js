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
        LIBRARY_RECENT: 'libraryRecent',
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
        MAIN_PROFILE_ID: 'streamgo_main_profile_id', // First profile created - bound to existing data
        STREMIO_DATA_IMPORTED: 'streamgo_stremio_data_imported', // Flag to prevent re-importing
    };

    // Predefined avatars as inline SVGs
    const AVATARS = {
        'gradient-purple': {
            name: 'Purple',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gp" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#667eea"/><stop offset="100%" style="stop-color:#764ba2"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#gp)"/></svg>`
        },
        'gradient-blue': {
            name: 'Blue',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4facfe"/><stop offset="100%" style="stop-color:#00f2fe"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#gb)"/></svg>`
        },
        'gradient-green': {
            name: 'Green',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#11998e"/><stop offset="100%" style="stop-color:#38ef7d"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#gg)"/></svg>`
        },
        'gradient-orange': {
            name: 'Orange',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="go" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f093fb"/><stop offset="100%" style="stop-color:#f5576c"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#go)"/></svg>`
        },
        'gradient-pink': {
            name: 'Pink',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gpink" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ff9a9e"/><stop offset="100%" style="stop-color:#fecfef"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#gpink)"/></svg>`
        },
        'gradient-red': {
            name: 'Red',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f85032"/><stop offset="100%" style="stop-color:#e73827"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#gr)"/></svg>`
        },
        'icon-popcorn': {
            name: 'Popcorn',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2d3436"/><text x="50" y="62" font-size="40" text-anchor="middle" fill="white">🍿</text></svg>`
        },
        'icon-film': {
            name: 'Film',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2d3436"/><text x="50" y="62" font-size="40" text-anchor="middle" fill="white">🎬</text></svg>`
        },
        'icon-star': {
            name: 'Star',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2d3436"/><text x="50" y="62" font-size="40" text-anchor="middle" fill="white">⭐</text></svg>`
        },
        'icon-controller': {
            name: 'Controller',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2d3436"/><text x="50" y="62" font-size="40" text-anchor="middle" fill="white">🎮</text></svg>`
        },
        'icon-headphones': {
            name: 'Headphones',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2d3436"/><text x="50" y="62" font-size="40" text-anchor="middle" fill="white">🎧</text></svg>`
        },
        'icon-cat': {
            name: 'Cat',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2d3436"/><text x="50" y="62" font-size="40" text-anchor="middle" fill="white">🐱</text></svg>`
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
    // SUPABASE CLIENT
    // ============================================

    class SupabaseClient {
        constructor(configManager, accountManager) {
            this.configManager = configManager;
            this.accountManager = accountManager;
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
                // Test by checking if we can reach the Supabase REST API
                // We query the root endpoint which returns API info even without tables
                const response = await fetch(`${this.configManager.getProjectUrl()}/rest/v1/`, {
                    method: 'GET',
                    headers: {
                        'apikey': this.configManager.getAnonKey(),
                        'Authorization': `Bearer ${this.configManager.getAnonKey()}`
                    }
                });
                // 200 = success, 404 = no tables yet but API works
                return response.ok || response.status === 404;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Connection test failed:`, e);
                return false;
            }
        }

        // Execute SQL via Supabase Management API (requires personal access token)
        async executeSqlWithAccessToken(sql, accessToken) {
            // Extract project ref from URL (e.g., "bgocsegenqftqkfzwiqw" from "https://bgocsegenqftqkfzwiqw.supabase.co")
            const projectUrl = this.configManager.getProjectUrl();
            const projectRef = projectUrl.replace('https://', '').replace('.supabase.co', '');

            try {
                const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: sql })
                });

                if (!response.ok) {
                    const error = await response.text();
                    console.error(`[${PLUGIN_NAME}] Management API error:`, error);
                    throw new Error(error);
                }

                return { success: true };
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] SQL execution via Management API failed:`, e);
                throw e;
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
                const response = await fetch(url, {
                    method: 'GET',
                    headers: this.getHeaders()
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Select failed:`, e);
                return [];
            }
        }

        async insert(table, data) {
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

        async upsert(table, data, onConflict) {
            try {
                const headers = this.getHeaders();
                headers['Prefer'] = 'resolution=merge-duplicates,return=representation';

                console.log(`[${PLUGIN_NAME}] Upserting to ${table}:`, data.content_id || data.name || 'data');

                const response = await fetch(this.getUrl(table), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[${PLUGIN_NAME}] Upsert HTTP error ${response.status}:`, errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                console.log(`[${PLUGIN_NAME}] Upsert successful for ${table}`);
                return result[0] || result;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Upsert failed for ${table}:`, e);
                return null;
            }
        }

        async delete(table, match) {
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
    // ACCOUNT MANAGER
    // ============================================

    class AccountManager {
        constructor() {
            this.cachedHash = null;
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
            this.progressDebounceTimers = {};
            this.lastLibraryState = null;
            this.isImporting = false;
            this.initialized = false;
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
            if (!activeProfileId) return;

            const contentInfo = this.getCurrentContentInfo();
            if (!contentInfo || !contentInfo.contentId) return;

            const progress = video.currentTime;
            const duration = video.duration;

            // Only sync if meaningful progress (more than 30 seconds watched)
            if (progress < 30) return;

            console.log(`[${PLUGIN_NAME}] Updating progress for ${contentInfo.contentId}: ${Math.floor(progress)}s / ${Math.floor(duration)}s`);

            await this.dataManager.updateProgress(
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
        }

        getCurrentContentId() {
            // Try to extract content ID from URL or page
            const url = window.location.hash || window.location.href;

            // Match patterns like #/detail/movie/tt1234567 or #/detail/series/tt1234567
            const detailMatch = url.match(/detail\/(movie|series)\/([^\/\?]+)/);
            if (detailMatch) {
                return detailMatch[2]; // e.g., tt1234567
            }

            // Match player URL patterns
            const playerMatch = url.match(/player\/([^\/\?]+)/);
            if (playerMatch) {
                return playerMatch[1];
            }

            return null;
        }

        getCurrentContentInfo() {
            const contentId = this.getCurrentContentId();
            if (!contentId) return null;

            const url = window.location.hash || window.location.href;

            // Determine type
            let type = 'movie';
            if (url.includes('/series/') || url.includes('series')) {
                type = 'series';
            }

            // Try to get title from page
            let title = '';
            const titleEl = document.querySelector('[class*="title-"]');
            if (titleEl) {
                title = titleEl.textContent;
            }

            // Try to get poster
            let poster = '';
            const posterEl = document.querySelector('[class*="poster-"] img, [class*="background-"] img');
            if (posterEl) {
                poster = posterEl.src;
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

                const library = JSON.parse(libraryStr);
                let imported = 0;

                for (const [id, item] of Object.entries(library)) {
                    if (item.removed) continue; // Skip removed items

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

                const libraryRecent = JSON.parse(libraryRecentStr);

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
                    const libItem = library[id] || {};

                    // Get progress info
                    let progress = 0;
                    let duration = 0;
                    let videoId = recentItem.videoId || id;

                    // Try to get progress from cinemata
                    if (cinemata && cinemata[id]) {
                        const cinemataItem = cinemata[id];
                        if (cinemataItem.progress) {
                            progress = cinemataItem.progress;
                        }
                        if (cinemataItem.duration) {
                            duration = cinemataItem.duration;
                        }
                    }

                    // Extract season/episode from videoId
                    let season = null;
                    let episode = null;
                    const episodeMatch = videoId.match(/(\d+):(\d+)/);
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
                            type: libItem.type || recentItem.type || 'movie',
                            title: libItem.name || recentItem.name,
                            poster: libItem.poster || recentItem.poster,
                            season,
                            episode
                        }
                    );
                    imported++;
                }

                console.log(`[${PLUGIN_NAME}] Imported ${imported} continue watching items`);
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error importing continue watching:`, e);
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
            if (!accountId) return null;

            try {
                const profiles = await this.supabase.select('profiles', {
                    filter: { account_id: accountId },
                    order: 'created_at.asc'
                });

                // Filter out soft-deleted profiles
                const activeProfiles = profiles.filter(p => !p.deleted_at);
                this.cacheProfiles(activeProfiles);

                const activeProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
                if (activeProfileId) {
                    const watchlist = await this.supabase.select('profile_watchlist', {
                        filter: { profile_id: activeProfileId },
                        order: 'added_at.desc'
                    });
                    const activeWatchlist = watchlist.filter(w => !w.deleted_at);
                    this.cacheWatchlist(activeWatchlist);

                    const continueWatching = await this.supabase.select('profile_continue_watching', {
                        filter: { profile_id: activeProfileId },
                        order: 'last_watched_at.desc'
                    });
                    const activeContinueWatching = continueWatching.filter(c => !c.deleted_at);
                    this.cacheContinueWatching(activeContinueWatching);
                }

                this.setLastSyncAt();
                return activeProfiles;
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Full sync failed:`, e);
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
    }

    // ============================================
    // PROFILE MANAGER
    // ============================================

    class ProfileManager {
        constructor(supabaseClient, accountManager, syncEngine) {
            this.supabase = supabaseClient;
            this.accountManager = accountManager;
            this.syncEngine = syncEngine;
            this.stremioIntegration = null; // Set later via setStremioIntegration
        }

        setStremioIntegration(integration) {
            this.stremioIntegration = integration;
        }

        async getProfiles() {
            // Try cache first
            let profiles = this.syncEngine.getCachedProfiles();
            if (profiles.length === 0) {
                // Fetch from server
                const accountId = this.accountManager.getHashedAccountId();
                if (accountId) {
                    profiles = await this.supabase.select('profiles', {
                        filter: { account_id: accountId },
                        order: 'created_at.asc'
                    });
                    profiles = profiles.filter(p => !p.deleted_at);
                    this.syncEngine.cacheProfiles(profiles);
                }
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
                is_active: isFirstProfile // First profile is active by default
            });

            if (profile) {
                // If this is the first profile, import existing Stremio data
                if (isFirstProfile && this.stremioIntegration) {
                    console.log(`[${PLUGIN_NAME}] First profile created, importing existing Stremio data...`);
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, profile.id);
                    localStorage.setItem(STORAGE_KEYS.MAIN_PROFILE_ID, profile.id);
                    await this.stremioIntegration.importExistingStremioData(profile.id);
                }

                // Refresh cache
                await this.syncEngine.fullSync();
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
            // Soft delete
            const result = await this.supabase.update('profiles', {
                deleted_at: new Date().toISOString(),
                is_active: false
            }, { id: profileId });

            if (result) {
                // If this was the active profile, clear it
                if (localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID) === profileId) {
                    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
                }
                await this.syncEngine.fullSync();
            }

            return !!result;
        }

        async switchProfile(profileId) {
            const accountId = this.accountManager.getHashedAccountId();
            if (!accountId) return false;

            const previousProfileId = this.getActiveProfileId();

            // Deactivate all profiles for this account
            const profiles = await this.getProfiles();
            for (const profile of profiles) {
                if (profile.is_active) {
                    await this.supabase.update('profiles', { is_active: false }, { id: profile.id });
                }
            }

            // Activate selected profile
            await this.supabase.update('profiles', { is_active: true }, { id: profileId });

            // Update local storage
            localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);

            // Clear cached data for the old profile
            this.syncEngine.cacheWatchlist([]);
            this.syncEngine.cacheContinueWatching([]);

            console.log(`[${PLUGIN_NAME}] Switched from profile ${previousProfileId} to ${profileId}`);

            // Sync data for new profile
            await this.syncEngine.fullSync();

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
        }

        async getWatchlist() {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return [];

            // Try cache first
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

            console.log(`[${PLUGIN_NAME}] Adding to watchlist for profile ${profileId}: ${contentId} (${title})`);

            const item = await this.supabase.upsert('profile_watchlist', {
                profile_id: profileId,
                content_id: contentId,
                content_type: contentType,
                title: title,
                poster: poster,
                status: 'watching',
                updated_at: new Date().toISOString()
            });

            if (item) {
                console.log(`[${PLUGIN_NAME}] Watchlist item added successfully to backend`);
                // Refresh cache
                const watchlist = await this.supabase.select('profile_watchlist', {
                    filter: { profile_id: profileId },
                    order: 'added_at.desc'
                });
                this.syncEngine.cacheWatchlist(watchlist.filter(w => !w.deleted_at));
            } else {
                console.error(`[${PLUGIN_NAME}] Failed to add watchlist item to backend`);
            }

            return item;
        }

        async removeFromWatchlist(contentId) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return false;

            // Soft delete
            const result = await this.supabase.update('profile_watchlist', {
                deleted_at: new Date().toISOString()
            }, { profile_id: profileId, content_id: contentId });

            if (result) {
                const watchlist = this.syncEngine.getCachedWatchlist().filter(w => w.content_id !== contentId);
                this.syncEngine.cacheWatchlist(watchlist);
            }

            return !!result;
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
                console.log(`[${PLUGIN_NAME}] No active profile, skipping progress update`);
                return null;
            }

            console.log(`[${PLUGIN_NAME}] Updating progress for profile ${profileId}: ${contentId} at ${Math.floor(progress)}s`);

            const item = await this.supabase.upsert('profile_continue_watching', {
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
                last_watched_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            if (item) {
                console.log(`[${PLUGIN_NAME}] Progress updated successfully in backend`);
                // Refresh cache
                const continueWatching = await this.supabase.select('profile_continue_watching', {
                    filter: { profile_id: profileId },
                    order: 'last_watched_at.desc'
                });
                this.syncEngine.cacheContinueWatching(continueWatching.filter(c => !c.deleted_at));
            } else {
                console.error(`[${PLUGIN_NAME}] Failed to update progress in backend`);
            }

            return item;
        }

        async removeContinueWatching(contentId, videoId = null) {
            const profileId = this.profileManager.getActiveProfileId();
            if (!profileId) return false;

            const match = { profile_id: profileId, content_id: contentId };
            if (videoId) {
                match.video_id = videoId;
            }

            // Soft delete
            const result = await this.supabase.update('profile_continue_watching', {
                deleted_at: new Date().toISOString()
            }, match);

            if (result) {
                const items = this.syncEngine.getCachedContinueWatching().filter(c =>
                    !(c.content_id === contentId && (!videoId || c.video_id === videoId))
                );
                this.syncEngine.cacheContinueWatching(items);
            }

            return !!result;
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
                    grid-template-columns: repeat(6, 1fr);
                    gap: 12px;
                    margin-top: 16px;
                }
                .sgp-avatar-option {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
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
-- StreamGo Profiles Schema
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_id TEXT DEFAULT 'gradient-purple',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profile_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    title TEXT,
    poster TEXT,
    status TEXT DEFAULT 'watching',
    added_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(profile_id, content_id)
);

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
    last_watched_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(profile_id, content_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_watchlist_profile_id ON profile_watchlist(profile_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_updated_at ON profile_watchlist(updated_at);
CREATE INDEX IF NOT EXISTS idx_continue_profile_id ON profile_continue_watching(profile_id);
CREATE INDEX IF NOT EXISTS idx_continue_updated_at ON profile_continue_watching(updated_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_continue_watching ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access own profiles" ON profiles;
CREATE POLICY "Access own profiles" ON profiles FOR ALL
    USING (account_id = current_setting('request.headers', true)::json->>'x-account-id');

DROP POLICY IF EXISTS "Access own watchlist" ON profile_watchlist;
CREATE POLICY "Access own watchlist" ON profile_watchlist FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_watchlist.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

DROP POLICY IF EXISTS "Access own continue watching" ON profile_continue_watching;
CREATE POLICY "Access own continue watching" ON profile_continue_watching FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_continue_watching.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS watchlist_updated_at ON profile_watchlist;
CREATE TRIGGER watchlist_updated_at BEFORE UPDATE ON profile_watchlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS continue_watching_updated_at ON profile_continue_watching;
CREATE TRIGGER continue_watching_updated_at BEFORE UPDATE ON profile_continue_watching
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

        // Inject settings icon into the plugin card in Settings → Plugins
        injectPluginSettingsIcon() {
            this.injectStyles();

            // Find all plugin cards and look for StreamGo Profiles
            const pluginCards = document.querySelectorAll('[class*="addon-container"]');

            pluginCards.forEach(card => {
                // Check if this is the StreamGo Profiles plugin by looking for its name
                const nameEl = card.querySelector('[class*="name-container"]');
                if (nameEl && nameEl.textContent.includes('StreamGo Profiles')) {
                    // Check if we already added the settings button
                    if (card.querySelector('.sgp-plugin-settings-btn')) return;

                    // Make sure the card has position relative for absolute positioning
                    card.style.position = 'relative';

                    // Create the settings button
                    const settingsBtn = document.createElement('button');
                    settingsBtn.className = 'sgp-plugin-settings-btn';
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

                    card.appendChild(settingsBtn);
                }
            });
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
            this.initialized = false;
        }

        async init() {
            console.log(`[${PLUGIN_NAME}] Initializing...`);

            // Always initialize managers first so settings page can work
            // even if user is not logged in or config is broken
            this.supabaseClient = new SupabaseClient(this.configManager, this.accountManager);
            this.syncEngine = new SyncEngine(this.supabaseClient, this.accountManager);
            this.profileManager = new ProfileManager(this.supabaseClient, this.accountManager, this.syncEngine);
            this.dataManager = new DataManager(this.supabaseClient, this.profileManager, this.syncEngine);

            // Create Stremio integration (hooks into Stremio's UI)
            this.stremioIntegration = new StremioIntegration(this.dataManager, this.profileManager, this.syncEngine);

            // Wire up the integration to ProfileManager
            this.profileManager.setStremioIntegration(this.stremioIntegration);

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

            // Check if user is logged into Stremio
            if (!this.accountManager.isLoggedIn()) {
                console.log(`[${PLUGIN_NAME}] Not logged into Stremio, waiting...`);
                // Retry later
                setTimeout(() => this.init(), 5000);
                return;
            }

            // Compute account hash
            await this.accountManager.computeHashedAccountId();

            // Check if configured
            if (!this.configManager.isConfigured()) {
                console.log(`[${PLUGIN_NAME}] Not configured, showing setup wizard`);
                this.uiManager.showSetupWizard();
                return;
            }

            // Load config
            this.configManager.loadConfig();

            // Initial sync
            await this.syncEngine.fullSync();

            // Check for active profile
            const profiles = await this.profileManager.getProfiles();
            const activeProfile = this.profileManager.getActiveProfile();

            if (profiles.length === 0) {
                // No profiles, show create
                this.uiManager.showCreateProfileModal(true);
            } else if (!activeProfile) {
                // Has profiles but none active, show selector
                this.uiManager.showProfileSelector(true);
            } else {
                // Has active profile, inject switcher
                this.uiManager.injectSwitcher();
            }

            // Initialize Stremio integration (hooks into UI for watchlist/progress tracking)
            this.stremioIntegration.init();

            // Setup periodic sync - check more frequently now (every 30 seconds)
            setInterval(() => {
                if (this.syncEngine.shouldSync()) {
                    this.syncEngine.deltaSync();
                }
            }, 30000); // Check every 30 seconds

            this.initialized = true;
            console.log(`[${PLUGIN_NAME}] Initialized successfully`);
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

                // Check if we're on the plugins/addons page and inject settings icon
                const pluginCards = document.querySelectorAll('[class*="addon-container"]');
                if (pluginCards.length > 0) {
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

})();
