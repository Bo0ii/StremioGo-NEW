/**
 * Anime4K WebGL Integration
 * Uses the anime4k.js library for real-time anime upscaling
 */

import * as Anime4KJS from 'anime4k.js';
import logger from './logger';

// Available Anime4K modes matching mpv presets
export type Anime4KMode =
    | 'off'
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
    'modeA': Anime4KJS.ANIME4K_HIGHEREND_MODE_A_FAST,
    'modeB': Anime4KJS.ANIME4K_HIGHEREND_MODE_B_FAST,
    'modeC': Anime4KJS.ANIME4K_HIGHEREND_MODE_C_FAST,
    'modeAHQ': Anime4KJS.ANIME4K_HIGHEREND_MODE_A,
    'modeBHQ': Anime4KJS.ANIME4K_HIGHEREND_MODE_B,
    'modeCHQ': Anime4KJS.ANIME4K_HIGHEREND_MODE_C,
    'bo0ii': doublePass(Anime4KJS.ANIME4K_HIGHEREND_MODE_A), // Double pass A+ for maximum quality
};

// Mode display names for UI
export const MODE_NAMES: Record<Anime4KMode, string> = {
    'off': 'Off',
    'modeA': 'A (Fast)',
    'modeB': 'B (Fast)',
    'modeC': 'C (Fast)',
    'modeAHQ': 'A (HQ)',
    'modeBHQ': 'B (HQ)',
    'modeCHQ': 'C (HQ)',
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
            z-index: 1;
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

        try {
            // Clean up existing upscaler
            if (this.upscaler) {
                this.upscaler.stop();
                this.upscaler = null;
            }

            // Get the preset for current mode (cast to expected type for VideoUpscaler)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const preset = MODE_PRESETS[this.currentMode] as any;

            // Create new upscaler
            this.upscaler = new Anime4KJS.VideoUpscaler(this.targetFPS, preset);
            this.upscaler.attachVideo(this.video, this.canvas);
            this.upscaler.start();

            // Show canvas and hide video
            this.canvas.style.display = 'block';
            this.video.style.opacity = '0';

            this.isRunning = true;
            logger.info(`[Anime4KWebGL] Started with mode: ${this.currentMode}, FPS: ${this.targetFPS}`);
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

        this.isRunning = false;
        logger.info('[Anime4KWebGL] Stopped');
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
        this.canvas?.remove();
        this.canvas = null;
        this.video = null;
        logger.info('[Anime4KWebGL] Cleaned up');
    }
}

export default Anime4KWebGL;
