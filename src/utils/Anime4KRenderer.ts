/**
 * Anime4K WebGL Renderer
 * Implements real-time anime upscaling shaders based on Anime4K algorithms
 * https://github.com/bloc97/Anime4K
 */

import logger from "./logger";

export type Anime4KMode = 'off' | 'modeA' | 'modeAA' | 'modeB' | 'modeBB' | 'modeC';

interface ShaderProgram {
    program: WebGLProgram;
    uniforms: { [key: string]: WebGLUniformLocation | null };
    attributes: { [key: string]: number };
}

// Vertex shader - shared by all modes
const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

// Anime4K Mode A - Restore (Line Sharpening)
// Based on Anime4K v4.0 Restore CNN (Soft) algorithm
const MODE_A_FRAGMENT = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_strength;

    varying vec2 v_texCoord;

    #define SIGMA 1.0

    vec4 getLuma(vec4 rgba) {
        float luma = dot(rgba.rgb, vec3(0.299, 0.587, 0.114));
        return vec4(luma);
    }

    // Compute gradient using Sobel operator
    vec2 computeGradient(vec2 uv, vec2 d) {
        float tl = getLuma(texture2D(u_texture, uv + vec2(-d.x, -d.y))).r;
        float t  = getLuma(texture2D(u_texture, uv + vec2( 0.0, -d.y))).r;
        float tr = getLuma(texture2D(u_texture, uv + vec2( d.x, -d.y))).r;
        float l  = getLuma(texture2D(u_texture, uv + vec2(-d.x,  0.0))).r;
        float r  = getLuma(texture2D(u_texture, uv + vec2( d.x,  0.0))).r;
        float bl = getLuma(texture2D(u_texture, uv + vec2(-d.x,  d.y))).r;
        float b  = getLuma(texture2D(u_texture, uv + vec2( 0.0,  d.y))).r;
        float br = getLuma(texture2D(u_texture, uv + vec2( d.x,  d.y))).r;

        float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
        float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

        return vec2(gx, gy);
    }

    // Line detection and enhancement
    vec4 lineEnhance(vec2 uv, vec2 d) {
        vec4 c = texture2D(u_texture, uv);
        vec2 gradient = computeGradient(uv, d);
        float edge = length(gradient);

        // Perpendicular to gradient for line direction
        vec2 lineDir = normalize(vec2(-gradient.y, gradient.x) + 0.0001);

        // Sample along the line
        vec4 c1 = texture2D(u_texture, uv + lineDir * d);
        vec4 c2 = texture2D(u_texture, uv - lineDir * d);

        // Bilateral-like weighting
        float w1 = exp(-pow(length(c1.rgb - c.rgb), 2.0) / (2.0 * SIGMA * SIGMA));
        float w2 = exp(-pow(length(c2.rgb - c.rgb), 2.0) / (2.0 * SIGMA * SIGMA));

        // Sharpen along the line
        vec4 sharpened = c + (c - (c1 * w1 + c2 * w2) / (w1 + w2 + 0.0001)) * edge * u_strength;

        return clamp(sharpened, 0.0, 1.0);
    }

    void main() {
        vec2 d = 1.0 / u_resolution;
        gl_FragColor = lineEnhance(v_texCoord, d);
    }
`;

// Anime4K Mode B - Upscale (Perceptual)
// Uses directional interpolation for edge-aware upscaling
const MODE_B_FRAGMENT = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_strength;

    varying vec2 v_texCoord;

    float getLuma(vec3 rgb) {
        return dot(rgb, vec3(0.299, 0.587, 0.114));
    }

    // Directional scaling kernel
    vec4 directionalScale(vec2 uv, vec2 d) {
        // Sample 3x3 neighborhood
        vec4 tl = texture2D(u_texture, uv + vec2(-d.x, -d.y));
        vec4 t  = texture2D(u_texture, uv + vec2( 0.0, -d.y));
        vec4 tr = texture2D(u_texture, uv + vec2( d.x, -d.y));
        vec4 l  = texture2D(u_texture, uv + vec2(-d.x,  0.0));
        vec4 c  = texture2D(u_texture, uv);
        vec4 r  = texture2D(u_texture, uv + vec2( d.x,  0.0));
        vec4 bl = texture2D(u_texture, uv + vec2(-d.x,  d.y));
        vec4 b  = texture2D(u_texture, uv + vec2( 0.0,  d.y));
        vec4 br = texture2D(u_texture, uv + vec2( d.x,  d.y));

        // Compute luminance
        float lumaTL = getLuma(tl.rgb);
        float lumaT  = getLuma(t.rgb);
        float lumaTR = getLuma(tr.rgb);
        float lumaL  = getLuma(l.rgb);
        float lumaC  = getLuma(c.rgb);
        float lumaR  = getLuma(r.rgb);
        float lumaBL = getLuma(bl.rgb);
        float lumaB  = getLuma(b.rgb);
        float lumaBR = getLuma(br.rgb);

        // Detect edge direction using diagonal differences
        float d1 = abs(lumaTL - lumaBR);  // Diagonal 1
        float d2 = abs(lumaTR - lumaBL);  // Diagonal 2
        float dH = abs(lumaL - lumaR);     // Horizontal
        float dV = abs(lumaT - lumaB);     // Vertical

        // Find minimum direction (most likely edge direction)
        float minD = min(min(d1, d2), min(dH, dV));

        vec4 result;
        if (minD == d1) {
            // Edge along TL-BR diagonal, interpolate perpendicular
            result = mix(c, (tr + bl) * 0.5, u_strength * 0.5);
        } else if (minD == d2) {
            // Edge along TR-BL diagonal
            result = mix(c, (tl + br) * 0.5, u_strength * 0.5);
        } else if (minD == dH) {
            // Horizontal edge
            result = mix(c, (t + b) * 0.5, u_strength * 0.5);
        } else {
            // Vertical edge
            result = mix(c, (l + r) * 0.5, u_strength * 0.5);
        }

        // Clamp to prevent overshoot
        vec4 minC = min(min(min(tl, tr), min(bl, br)), min(min(t, b), min(l, r)));
        vec4 maxC = max(max(max(tl, tr), max(bl, br)), max(max(t, b), max(l, r)));

        return clamp(result, minC, maxC);
    }

    void main() {
        vec2 d = 1.0 / u_resolution;
        gl_FragColor = directionalScale(v_texCoord, d);
    }
`;

// Anime4K Mode C - Combined Upscale + Restore
// Best quality, combines both algorithms
const MODE_C_FRAGMENT = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_strength;

    varying vec2 v_texCoord;

    #define SIGMA 1.0
    #define SHARPEN_STRENGTH 0.8

    float getLuma(vec3 rgb) {
        return dot(rgb, vec3(0.299, 0.587, 0.114));
    }

    vec2 computeGradient(vec2 uv, vec2 d) {
        float tl = getLuma(texture2D(u_texture, uv + vec2(-d.x, -d.y)).rgb);
        float t  = getLuma(texture2D(u_texture, uv + vec2( 0.0, -d.y)).rgb);
        float tr = getLuma(texture2D(u_texture, uv + vec2( d.x, -d.y)).rgb);
        float l  = getLuma(texture2D(u_texture, uv + vec2(-d.x,  0.0)).rgb);
        float r  = getLuma(texture2D(u_texture, uv + vec2( d.x,  0.0)).rgb);
        float bl = getLuma(texture2D(u_texture, uv + vec2(-d.x,  d.y)).rgb);
        float b  = getLuma(texture2D(u_texture, uv + vec2( 0.0,  d.y)).rgb);
        float br = getLuma(texture2D(u_texture, uv + vec2( d.x,  d.y)).rgb);

        return vec2(
            -tl - 2.0*l - bl + tr + 2.0*r + br,
            -tl - 2.0*t - tr + bl + 2.0*b + br
        );
    }

    vec4 anime4k(vec2 uv, vec2 d) {
        // Sample neighborhood
        vec4 tl = texture2D(u_texture, uv + vec2(-d.x, -d.y));
        vec4 t  = texture2D(u_texture, uv + vec2( 0.0, -d.y));
        vec4 tr = texture2D(u_texture, uv + vec2( d.x, -d.y));
        vec4 l  = texture2D(u_texture, uv + vec2(-d.x,  0.0));
        vec4 c  = texture2D(u_texture, uv);
        vec4 r  = texture2D(u_texture, uv + vec2( d.x,  0.0));
        vec4 bl = texture2D(u_texture, uv + vec2(-d.x,  d.y));
        vec4 b  = texture2D(u_texture, uv + vec2( 0.0,  d.y));
        vec4 br = texture2D(u_texture, uv + vec2( d.x,  d.y));

        // === UPSCALE PASS ===
        float lumaTL = getLuma(tl.rgb);
        float lumaTR = getLuma(tr.rgb);
        float lumaBL = getLuma(bl.rgb);
        float lumaBR = getLuma(br.rgb);
        float lumaL  = getLuma(l.rgb);
        float lumaR  = getLuma(r.rgb);
        float lumaT  = getLuma(t.rgb);
        float lumaB  = getLuma(b.rgb);

        float d1 = abs(lumaTL - lumaBR);
        float d2 = abs(lumaTR - lumaBL);
        float dH = abs(lumaL - lumaR);
        float dV = abs(lumaT - lumaB);
        float minD = min(min(d1, d2), min(dH, dV));

        vec4 upscaled;
        if (minD == d1) {
            upscaled = mix(c, (tr + bl) * 0.5, u_strength * 0.3);
        } else if (minD == d2) {
            upscaled = mix(c, (tl + br) * 0.5, u_strength * 0.3);
        } else if (minD == dH) {
            upscaled = mix(c, (t + b) * 0.5, u_strength * 0.3);
        } else {
            upscaled = mix(c, (l + r) * 0.5, u_strength * 0.3);
        }

        // === RESTORE PASS ===
        vec2 gradient = computeGradient(uv, d);
        float edge = length(gradient);
        vec2 lineDir = normalize(vec2(-gradient.y, gradient.x) + 0.0001);

        vec4 c1 = texture2D(u_texture, uv + lineDir * d);
        vec4 c2 = texture2D(u_texture, uv - lineDir * d);

        float w1 = exp(-pow(length(c1.rgb - upscaled.rgb), 2.0) / (2.0 * SIGMA * SIGMA));
        float w2 = exp(-pow(length(c2.rgb - upscaled.rgb), 2.0) / (2.0 * SIGMA * SIGMA));

        vec4 sharpened = upscaled + (upscaled - (c1 * w1 + c2 * w2) / (w1 + w2 + 0.0001)) * edge * u_strength * SHARPEN_STRENGTH;

        // Clamp to prevent artifacts
        vec4 minC = min(min(min(tl, tr), min(bl, br)), min(min(t, b), min(l, r)));
        vec4 maxC = max(max(max(tl, tr), max(bl, br)), max(max(t, b), max(l, r)));

        return clamp(sharpened, minC, maxC);
    }

    void main() {
        vec2 d = 1.0 / u_resolution;
        gl_FragColor = anime4k(v_texCoord, d);
    }
`;

// Pass-through shader for multi-pass rendering
const PASSTHROUGH_FRAGMENT = `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_texCoord;

    void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
    }
`;

export default class Anime4KRenderer {
    private canvas: HTMLCanvasElement | null = null;
    private gl: WebGLRenderingContext | null = null;
    private video: HTMLVideoElement | null = null;
    private videoTexture: WebGLTexture | null = null;
    private frameBuffer: WebGLFramebuffer | null = null;
    private frameTexture: WebGLTexture | null = null;

    private shaders: Map<string, ShaderProgram> = new Map();
    private positionBuffer: WebGLBuffer | null = null;
    private texCoordBuffer: WebGLBuffer | null = null;

    private currentMode: Anime4KMode = 'off';
    private strength: number = 0.5;
    private animationFrameId: number | null = null;
    private isRunning: boolean = false;

    constructor() {
        logger.info('[Anime4K] Renderer created');
    }

    public init(video: HTMLVideoElement): boolean {
        this.video = video;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'anime4k-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
        `;

        // Insert canvas after video
        video.parentElement?.insertBefore(this.canvas, video.nextSibling);

        // Initialize WebGL
        this.gl = this.canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            premultipliedAlpha: false,
        });

        if (!this.gl) {
            logger.error('[Anime4K] WebGL not supported');
            return false;
        }

        // Initialize shaders and buffers
        this.initShaders();
        this.initBuffers();
        this.initTextures();

        logger.info('[Anime4K] Initialized successfully');
        return true;
    }

    private initShaders(): void {
        if (!this.gl) return;

        // Compile all shader programs
        const programs: [string, string][] = [
            ['modeA', MODE_A_FRAGMENT],
            ['modeB', MODE_B_FRAGMENT],
            ['modeC', MODE_C_FRAGMENT],
            ['passthrough', PASSTHROUGH_FRAGMENT],
        ];

        for (const [name, fragmentSource] of programs) {
            const program = this.createProgram(VERTEX_SHADER, fragmentSource);
            if (program) {
                this.shaders.set(name, {
                    program,
                    uniforms: {
                        u_texture: this.gl.getUniformLocation(program, 'u_texture'),
                        u_resolution: this.gl.getUniformLocation(program, 'u_resolution'),
                        u_strength: this.gl.getUniformLocation(program, 'u_strength'),
                    },
                    attributes: {
                        a_position: this.gl.getAttribLocation(program, 'a_position'),
                        a_texCoord: this.gl.getAttribLocation(program, 'a_texCoord'),
                    },
                });
            }
        }
    }

    private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
        if (!this.gl) return null;

        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) return null;

        const program = this.gl.createProgram();
        if (!program) return null;

        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            logger.error('[Anime4K] Program link error:', this.gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    private compileShader(type: number, source: string): WebGLShader | null {
        if (!this.gl) return null;

        const shader = this.gl.createShader(type);
        if (!shader) return null;

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            logger.error('[Anime4K] Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    private initBuffers(): void {
        if (!this.gl) return;

        // Position buffer (full-screen quad)
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]), this.gl.STATIC_DRAW);

        // Texture coordinate buffer
        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ]), this.gl.STATIC_DRAW);
    }

    private initTextures(): void {
        if (!this.gl) return;

        // Video texture
        this.videoTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // Frame buffer texture for multi-pass
        this.frameTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // Frame buffer for multi-pass rendering
        this.frameBuffer = this.gl.createFramebuffer();
    }

    public setMode(mode: Anime4KMode): void {
        this.currentMode = mode;

        if (mode === 'off') {
            this.stop();
        } else if (!this.isRunning) {
            this.start();
        }

        logger.info(`[Anime4K] Mode set to: ${mode}`);
    }

    public setStrength(strength: number): void {
        this.strength = Math.max(0, Math.min(1, strength));
    }

    public start(): void {
        if (this.isRunning || !this.video || !this.canvas) return;

        this.isRunning = true;

        // Hide original video, show canvas
        this.video.style.opacity = '0';
        this.canvas.style.display = 'block';

        this.render();
        logger.info('[Anime4K] Started rendering');
    }

    public stop(): void {
        this.isRunning = false;

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Show original video, hide canvas
        if (this.video) {
            this.video.style.opacity = '1';
        }
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }

        logger.info('[Anime4K] Stopped rendering');
    }

    private render = (): void => {
        if (!this.isRunning || !this.gl || !this.video || !this.canvas) return;

        // Update canvas size to match video
        const videoWidth = this.video.videoWidth || this.video.clientWidth;
        const videoHeight = this.video.videoHeight || this.video.clientHeight;

        if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            this.gl.viewport(0, 0, videoWidth, videoHeight);

            // Resize frame texture
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
            this.gl.texImage2D(
                this.gl.TEXTURE_2D, 0, this.gl.RGBA,
                videoWidth, videoHeight, 0,
                this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
            );
        }

        // Upload video frame to texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
        this.gl.texImage2D(
            this.gl.TEXTURE_2D, 0, this.gl.RGBA,
            this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.video
        );

        // Render based on current mode
        switch (this.currentMode) {
            case 'modeA':
                this.renderPass('modeA', this.videoTexture, null);
                break;
            case 'modeAA':
                this.renderPass('modeA', this.videoTexture, this.frameBuffer);
                this.renderPass('modeA', this.frameTexture, null);
                break;
            case 'modeB':
                this.renderPass('modeB', this.videoTexture, null);
                break;
            case 'modeBB':
                this.renderPass('modeB', this.videoTexture, this.frameBuffer);
                this.renderPass('modeB', this.frameTexture, null);
                break;
            case 'modeC':
                this.renderPass('modeC', this.videoTexture, null);
                break;
            default:
                this.renderPass('passthrough', this.videoTexture, null);
        }

        this.animationFrameId = requestAnimationFrame(this.render);
    };

    private renderPass(
        shaderName: string,
        inputTexture: WebGLTexture | null,
        outputFramebuffer: WebGLFramebuffer | null
    ): void {
        if (!this.gl || !this.canvas) return;

        const shader = this.shaders.get(shaderName);
        if (!shader) return;

        // Bind output framebuffer (null = render to canvas)
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, outputFramebuffer);

        if (outputFramebuffer) {
            // Attach frame texture to framebuffer
            this.gl.framebufferTexture2D(
                this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0,
                this.gl.TEXTURE_2D, this.frameTexture, 0
            );
        }

        // Use shader program
        this.gl.useProgram(shader.program);

        // Set uniforms
        this.gl.uniform1i(shader.uniforms.u_texture, 0);
        this.gl.uniform2f(shader.uniforms.u_resolution, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(shader.uniforms.u_strength, this.strength);

        // Bind input texture
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);

        // Set up attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(shader.attributes.a_position);
        this.gl.vertexAttribPointer(shader.attributes.a_position, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(shader.attributes.a_texCoord);
        this.gl.vertexAttribPointer(shader.attributes.a_texCoord, 2, this.gl.FLOAT, false, 0, 0);

        // Draw
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    public getMode(): Anime4KMode {
        return this.currentMode;
    }

    public getStrength(): number {
        return this.strength;
    }

    public isActive(): boolean {
        return this.isRunning && this.currentMode !== 'off';
    }

    public cleanup(): void {
        this.stop();

        if (this.gl) {
            // Delete textures
            if (this.videoTexture) this.gl.deleteTexture(this.videoTexture);
            if (this.frameTexture) this.gl.deleteTexture(this.frameTexture);

            // Delete buffers
            if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
            if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);
            if (this.frameBuffer) this.gl.deleteFramebuffer(this.frameBuffer);

            // Delete shaders
            for (const shader of this.shaders.values()) {
                this.gl.deleteProgram(shader.program);
            }
        }

        // Remove canvas
        this.canvas?.remove();

        this.canvas = null;
        this.gl = null;
        this.video = null;
        this.shaders.clear();

        logger.info('[Anime4K] Cleaned up');
    }
}
