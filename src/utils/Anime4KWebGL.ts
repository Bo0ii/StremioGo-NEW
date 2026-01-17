/**
 * Anime4K WebGL Integration
 * Uses the anime4k.js library for real-time anime upscaling
 */

import * as Anime4KJS from 'anime4k.js';
import logger from './logger';

// Available Anime4K modes matching mpv presets
export type Anime4KMode =
    | 'off'
    | 'modeALite'  // Mode A- (Lite) - Lightweight line restore for laptops
    | 'modeBLite'  // Mode B- (Lite) - Lightweight soft restore for laptops
    | 'modeCLite'  // Mode C- (Lite) - Lightweight upscale denoise for laptops
    | 'modeA'      // Mode A (Fast) - Line restore
    | 'modeB'      // Mode B (Fast) - Soft restore
    | 'modeC'      // Mode C (Fast) - Upscale denoise
    | 'modeAHQ'    // Mode A (HQ) - Higher quality line restore
    | 'modeBHQ'    // Mode B (HQ) - Higher quality soft restore
    | 'modeCHQ'    // Mode C (HQ) - Higher quality upscale denoise
    | 'bo0ii';     // Bo0ii Exclusive - Double pass Mode A+ (GPU intensive)

// Helper to double shader passes for stronger effect
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function doublePass(preset: any): any {
    if (Array.isArray(preset)) {
        return [...preset, ...preset];
    }
    return preset;
}

// Map modes to Anime4K.js presets
const MODE_PRESETS: Record<Anime4KMode, unknown> = {
    'off': Anime4KJS.ANIME4KJS_EMPTY,
    // Lite modes for laptops (lower-end presets)
    'modeALite': Anime4KJS.ANIME4K_LOWEREND_MODE_A,
    'modeBLite': Anime4KJS.ANIME4K_LOWEREND_MODE_B,
    'modeCLite': Anime4KJS.ANIME4K_LOWEREND_MODE_C,
    // Standard modes (higher-end fast)
    'modeA': Anime4KJS.ANIME4K_HIGHEREND_MODE_A_FAST,
    'modeB': Anime4KJS.ANIME4K_HIGHEREND_MODE_B_FAST,
    'modeC': Anime4KJS.ANIME4K_HIGHEREND_MODE_C_FAST,
    // HQ modes (higher-end full)
    'modeAHQ': Anime4KJS.ANIME4K_HIGHEREND_MODE_A,
    'modeBHQ': Anime4KJS.ANIME4K_HIGHEREND_MODE_B,
    'modeCHQ': Anime4KJS.ANIME4K_HIGHEREND_MODE_C,
    // Bo0ii exclusive (double pass A+ for maximum quality)
    'bo0ii': doublePass(Anime4KJS.ANIME4K_HIGHEREND_MODE_A),
};

// Mode display names for UI
export const MODE_NAMES: Record<Anime4KMode, string> = {
    'off': 'Off',
    'modeALite': 'A-',
    'modeBLite': 'B-',
    'modeCLite': 'C-',
    'modeA': 'A',
    'modeB': 'B',
    'modeC': 'C',
    'modeAHQ': 'A+',
    'modeBHQ': 'B+',
    'modeCHQ': 'C+',
    'bo0ii': 'Bo0ii',
};

export class Anime4KWebGL {
    private video: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private upscaler: InstanceType<typeof Anime4KJS.VideoUpscaler> | null = null;
    private currentMode: Anime4KMode = 'off';
    private isRunning: boolean = false;
    private targetFPS: number = 60;

    constructor() {
        logger.info('[Anime4KWebGL] Instance created');
    }

    /**
     * Check if WebGL is supported for Anime4K
     */
    public static isSupported(): boolean {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return false;

            // Check for required extensions
            const floatTexture = (gl as WebGLRenderingContext).getExtension('OES_texture_float');
            const floatLinear = (gl as WebGLRenderingContext).getExtension('OES_texture_float_linear');

            return !!(floatTexture && floatLinear);
        } catch {
            return false;
        }
    }

    /**
     * Initialize with a video element
     */
    public init(video: HTMLVideoElement): boolean {
        if (!Anime4KWebGL.isSupported()) {
            logger.warn('[Anime4KWebGL] WebGL not supported or missing required extensions');
            return false;
        }

        this.video = video;
        this.createCanvas();

        logger.info('[Anime4KWebGL] Initialized successfully');
        return true;
    }

    /**
     * Create the overlay canvas for rendering
     */
    private createCanvas(): void {
        // Remove existing canvas if present
        this.canvas?.remove();

        // Create new canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'anime4k-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
            display: none;
        `;

        // Insert canvas after video
        if (this.video?.parentElement) {
            // Make sure parent has position relative for absolute positioning
            const parent = this.video.parentElement;
            const computedStyle = window.getComputedStyle(parent);
            if (computedStyle.position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(this.canvas);
        }

        logger.info('[Anime4KWebGL] Canvas created');
    }

    /**
     * Set the Anime4K mode
     */
    public setMode(mode: Anime4KMode): void {
        if (mode === this.currentMode) return;

        // Stop current upscaler if running
        if (this.isRunning) {
            this.stop();
        }

        this.currentMode = mode;

        // Start with new mode if mode is not off
        if (mode !== 'off') {
            this.start();
        }

        logger.info(`[Anime4KWebGL] Mode changed to: ${mode}`);
    }

    /**
     * Get current mode
     */
    public getMode(): Anime4KMode {
        return this.currentMode;
    }

    /**
     * Set target FPS for upscaling
     */
    public setTargetFPS(fps: number): void {
        this.targetFPS = Math.max(24, Math.min(144, fps));

        // Restart if running to apply new FPS
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * Start the upscaler
     */
    public start(): void {
        if (!this.video || !this.canvas || this.currentMode === 'off') {
            return;
        }

        // Wait for video to have valid dimensions
        if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
            logger.info('[Anime4KWebGL] Waiting for video metadata...');
            this.video.addEventListener('loadedmetadata', () => this.start(), { once: true });
            return;
        }

        try {
            // Clean up existing upscaler
            if (this.upscaler) {
                this.upscaler.stop();
                this.upscaler = null;
            }

            // Ensure canvas has proper dimensions before starting WebGL
            this.updateCanvasSize();

            // Verify canvas has valid dimensions
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                logger.warn('[Anime4KWebGL] Canvas still has zero dimensions, using fallback');
                this.canvas.width = 1920;
                this.canvas.height = 1080;
            }

            // Show canvas BEFORE creating WebGL context (required for some browsers)
            this.canvas.style.display = 'block';

            // Use requestAnimationFrame to ensure canvas is rendered before WebGL starts
            requestAnimationFrame(() => {
                if (!this.video || !this.canvas) return;

                try {
                    // Get the preset for current mode (cast to expected type for VideoUpscaler)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const preset = MODE_PRESETS[this.currentMode] as any;

                    // Create new upscaler
                    this.upscaler = new Anime4KJS.VideoUpscaler(this.targetFPS, preset);
                    this.upscaler.attachVideo(this.video, this.canvas);
                    this.upscaler.start();

                    // Hide video (but keep subtitles visible)
                    this.video.style.opacity = '0';

                    // Ensure subtitle containers appear above the canvas
                    this.ensureSubtitlesVisible();

                    this.isRunning = true;
                    logger.info(`[Anime4KWebGL] Started with mode: ${this.currentMode}, FPS: ${this.targetFPS}, Canvas: ${this.canvas.width}x${this.canvas.height}`);
                } catch (err) {
                    logger.error(`[Anime4KWebGL] Failed to start upscaler: ${err}`);
                    this.isRunning = false;
                    this.canvas!.style.display = 'none';
                }
            });
        } catch (err) {
            logger.error(`[Anime4KWebGL] Failed to start: ${err}`);
            this.isRunning = false;
        }
    }

    /**
     * Stop the upscaler
     */
    public stop(): void {
        if (this.upscaler) {
            try {
                this.upscaler.stop();
            } catch (err) {
                logger.warn(`[Anime4KWebGL] Error stopping upscaler: ${err}`);
            }
            this.upscaler = null;
        }

        // Hide canvas and show video
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
        if (this.video) {
            this.video.style.opacity = '1';
        }

        // Remove subtitle fix
        this.removeSubtitleFix();

        this.isRunning = false;
        logger.info('[Anime4KWebGL] Stopped');
    }

    /**
     * Update canvas dimensions to match video
     */
    private updateCanvasSize(): void {
        if (!this.video || !this.canvas) return;

        // Get video dimensions
        const videoWidth = this.video.videoWidth || this.video.clientWidth || 1920;
        const videoHeight = this.video.videoHeight || this.video.clientHeight || 1080;

        // Set canvas pixel dimensions (required for WebGL)
        this.canvas.width = videoWidth;
        this.canvas.height = videoHeight;

        logger.info(`[Anime4KWebGL] Canvas size set to ${videoWidth}x${videoHeight}`);
    }

    /**
     * Ensure subtitle containers appear above the canvas
     */
    private ensureSubtitlesVisible(): void {
        // Add a style element to boost subtitle z-index
        let styleEl = document.getElementById('anime4k-subtitle-fix');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'anime4k-subtitle-fix';
            document.head.appendChild(styleEl);
        }

        styleEl.textContent = `
            /* Ensure subtitles appear above Anime4K canvas */
            [class*="subtitle"],
            [class*="Subtitle"],
            [class*="caption"],
            [class*="Caption"],
            .vtt-container,
            .text-track-container {
                z-index: 2 !important;
                position: relative !important;
            }

            /* For native video subtitles - style the cue */
            video::cue {
                background: rgba(0, 0, 0, 0.8);
                color: white;
            }
        `;

        logger.info('[Anime4KWebGL] Subtitle visibility fix applied');
    }

    /**
     * Remove subtitle fix styles
     */
    private removeSubtitleFix(): void {
        document.getElementById('anime4k-subtitle-fix')?.remove();
    }

    /**
     * Check if upscaler is running
     */
    public isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        this.stop();
        this.removeSubtitleFix();
        this.canvas?.remove();
        this.canvas = null;
        this.video = null;
        logger.info('[Anime4KWebGL] Cleaned up');
    }
}

export default Anime4KWebGL;
