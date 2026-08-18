(() => {
    'use strict';

    const VERTEX_SHADER = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
            vUv = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    const UPDATE_SHADER = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uPrevious;
        uniform vec2 uResolution;
        uniform vec2 uPointA;
        uniform vec2 uPointB;
        uniform vec2 uStrokeVelocity;
        uniform float uAspect;
        uniform float uRadius;
        uniform float uStrength;
        uniform float uForce;
        uniform float uActive;
        uniform float uDelta;
        uniform float uTime;
        uniform float uDecay;

        float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.52;
            mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
            for (int i = 0; i < 4; i++) {
                value += amplitude * noise2(p);
                p = rotation * p * 2.02 + 13.7;
                amplitude *= 0.5;
            }
            return value;
        }

        float segmentDistance(vec2 p, vec2 a, vec2 b) {
            vec2 pa = p - a;
            vec2 ba = b - a;
            float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
            return length(pa - ba * h);
        }

        vec2 decodeVelocity(vec2 encoded) {
            return (encoded * 2.0 - 1.0) * 0.12;
        }

        vec2 encodeVelocity(vec2 velocity) {
            return clamp(velocity / 0.12 * 0.5 + 0.5, 0.0, 1.0);
        }

        void main() {
            vec2 texel = 1.0 / uResolution;
            vec4 localState = texture2D(uPrevious, vUv);
            vec2 localVelocity = decodeVelocity(localState.gb);

            vec2 backtrace = clamp(vUv - localVelocity * uDelta * 2.25, texel, 1.0 - texel);
            vec4 state = texture2D(uPrevious, backtrace);
            float pigment = state.r;
            float wetness = state.a;
            vec2 velocity = decodeVelocity(state.gb);

            vec4 northState = texture2D(uPrevious, clamp(backtrace + vec2(0.0, texel.y), texel, 1.0 - texel));
            vec4 southState = texture2D(uPrevious, clamp(backtrace - vec2(0.0, texel.y), texel, 1.0 - texel));
            vec4 eastState = texture2D(uPrevious, clamp(backtrace + vec2(texel.x, 0.0), texel, 1.0 - texel));
            vec4 westState = texture2D(uPrevious, clamp(backtrace - vec2(texel.x, 0.0), texel, 1.0 - texel));

            float neighbourPigment = (northState.r + southState.r + eastState.r + westState.r) * 0.25;
            float neighbourWetness = (northState.a + southState.a + eastState.a + westState.a) * 0.25;
            vec2 neighbourVelocity = (
                decodeVelocity(northState.gb) + decodeVelocity(southState.gb) +
                decodeVelocity(eastState.gb) + decodeVelocity(westState.gb)
            ) * 0.25;

            float diffusion = clamp(uDelta * mix(0.8, 5.2, wetness), 0.0, 0.24);
            pigment = mix(pigment, neighbourPigment, diffusion);
            wetness = mix(wetness, neighbourWetness, clamp(uDelta * 2.8, 0.0, 0.18));
            velocity = mix(velocity, neighbourVelocity, clamp(uDelta * 4.4, 0.0, 0.22));

            float flowA = fbm(vUv * 5.2 + vec2(uTime * 0.055, -uTime * 0.032));
            float flowB = fbm(vUv * 5.2 + vec2(7.3, 11.8) + vec2(-uTime * 0.028, uTime * 0.047));
            vec2 paperFlow = vec2(flowA - 0.5, flowB - 0.5) * 0.0055 * wetness;
            velocity += paperFlow * uDelta * 3.0;

            if (uActive > 0.5) {
                vec2 p = vec2(vUv.x * uAspect, vUv.y);
                vec2 a = vec2(uPointA.x * uAspect, uPointA.y);
                vec2 b = vec2(uPointB.x * uAspect, uPointB.y);
                float distanceToStroke = segmentDistance(p, a, b);

                float broadNoise = fbm(vUv * 10.5 + vec2(uTime * 0.08, uTime * 0.035));
                float edgeNoise = fbm(vUv * 36.0 - vec2(uTime * 0.03, uTime * 0.025));
                float grainNoise = fbm(vUv * 92.0 + vec2(3.0, -uTime * 0.012));
                float localRadius = uRadius * mix(0.64, 1.38, broadNoise);
                float body = 1.0 - smoothstep(localRadius * 0.15, localRadius, distanceToStroke);
                float ragged = smoothstep(0.17, 0.76, edgeNoise + body * 0.52);
                float granulation = mix(0.66, 1.08, grainNoise);
                float deposit = body * mix(0.70, 1.0, ragged) * granulation;

                pigment = clamp(max(pigment, deposit * uStrength), 0.0, 1.0);
                wetness = clamp(max(wetness, body * 0.98), 0.0, 1.0);

                vec2 strokeDirection = uStrokeVelocity;
                vec2 perpendicular = vec2(-strokeDirection.y, strokeDirection.x);
                float swirl = (broadNoise - 0.5) * 0.38;
                velocity += (strokeDirection + perpendicular * swirl) * body * uForce * uDelta;
            }

            float dryingNoise = fbm(vUv * 12.0 + vec2(-uTime * 0.018, uTime * 0.021));
            float dryMultiplier = mix(0.72, 1.34, dryingNoise);
            pigment *= exp(-uDelta * uDecay * dryMultiplier);
            pigment = max(0.0, pigment - uDelta * mix(0.010, 0.042, dryingNoise) * (1.0 - wetness * 0.42));
            wetness *= exp(-uDelta * 1.35);
            velocity *= exp(-uDelta * 4.6);

            if (pigment < 0.002) pigment = 0.0;
            if (wetness < 0.002) wetness = 0.0;

            gl_FragColor = vec4(pigment, encodeVelocity(velocity), wetness);
        }
    `;

    const DISPLAY_SHADER = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uFront;
        uniform sampler2D uBack;
        uniform sampler2D uState;
        uniform vec2 uStateResolution;
        uniform float uTime;

        float hash21(vec2 p) {
            p = fract(p * vec2(443.897, 441.423));
            p += dot(p, p + 19.19);
            return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        vec2 decodeVelocity(vec2 encoded) {
            return (encoded * 2.0 - 1.0) * 0.12;
        }

        void main() {
            vec2 texel = 1.0 / uStateResolution;
            vec4 state = texture2D(uState, vUv);
            float pigment = state.r;
            float wetness = state.a;
            vec2 velocity = decodeVelocity(state.gb);

            float rightPigment = texture2D(uState, clamp(vUv + vec2(texel.x, 0.0), texel, 1.0 - texel)).r;
            float leftPigment = texture2D(uState, clamp(vUv - vec2(texel.x, 0.0), texel, 1.0 - texel)).r;
            float topPigment = texture2D(uState, clamp(vUv + vec2(0.0, texel.y), texel, 1.0 - texel)).r;
            float bottomPigment = texture2D(uState, clamp(vUv - vec2(0.0, texel.y), texel, 1.0 - texel)).r;
            vec2 gradient = vec2(rightPigment - leftPigment, topPigment - bottomPigment);

            float paper = noise2(vUv * vec2(790.0, 1030.0));
            float wash = noise2(vUv * 22.0 + vec2(uTime * 0.014, -uTime * 0.009));
            float fibres = noise2(vUv * vec2(118.0, 520.0) + vec2(4.7, 8.1));

            float noisyPigment = pigment + (wash - 0.5) * 0.08 * wetness + (paper - 0.5) * 0.035;
            float reveal = smoothstep(0.055, 0.44, noisyPigment);
            reveal *= smoothstep(0.0, 0.08, pigment);

            vec4 front = texture2D(uFront, vUv);
            vec2 wetUv = clamp(vUv + velocity * 0.48 * wetness + gradient * 0.022, 0.001, 0.999);
            vec4 back = texture2D(uBack, wetUv);

            vec3 colour = mix(front.rgb, back.rgb, reveal);

            float outer = smoothstep(0.035, 0.18, pigment);
            float inner = smoothstep(0.30, 0.68, pigment);
            float edge = max(0.0, outer - inner);
            colour *= 1.0 - edge * (0.018 + fibres * 0.028);
            colour += (paper - 0.5) * 0.006 * reveal;

            gl_FragColor = vec4(colour, 1.0);
        }
    `;

    const createShader = (gl, type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
            gl.deleteShader(shader);
            throw new Error(message);
        }
        return shader;
    };

    const createProgram = (gl, vertexSource, fragmentSource) => {
        const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(program) || 'Unknown shader link error';
            gl.deleteProgram(program);
            throw new Error(message);
        }
        return program;
    };

    const loadImage = (source) => new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load image: ${source}`));
        image.src = source;
    });

    class CanvasWatercolorFallback {
        constructor(element, canvas, frontImage, backImage, options) {
            this.element = element;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.frontImage = frontImage;
            this.backImage = backImage;
            this.options = options;
            this.pointerInside = false;
            this.pointerDown = false;
            this.strokes = [];
            this.last = { x: 0.5, y: 0.5 };
            this.lastTime = performance.now();
            this.lastInteraction = 0;
            this.hasPaint = false;
            this.resetDelay = Number(options.reset || 3000);
            this.running = false;
            this.brushCursor = element.querySelector('.watercolor-brush-cursor');
            this.hint = element.querySelector('.watercolor-hint');
        }

        init() {
            this.mask = document.createElement('canvas');
            this.maskCtx = this.mask.getContext('2d');
            this.composite = document.createElement('canvas');
            this.compositeCtx = this.composite.getContext('2d');
            this.resize();
            this.bindEvents();
            this.element.classList.add('is-ready', 'is-canvas-fallback');
            this.draw();
        }

        resize() {
            const rect = this.element.getBoundingClientRect();
            const ratio = Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches ? 1 : 1.5);
            const width = Math.max(2, Math.round(rect.width * ratio));
            const height = Math.max(2, Math.round(rect.height * ratio));
            [this.canvas, this.mask, this.composite].forEach((surface) => {
                surface.width = width;
                surface.height = height;
            });
            this.draw();
        }

        pointFromEvent(event) {
            const rect = this.element.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
                y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
            };
        }

        queueStroke(from, to) {
            this.strokes.push({ from, to });
            if (this.strokes.length > 24) this.strokes.splice(0, this.strokes.length - 24);
            this.lastInteraction = performance.now();
            this.hasPaint = true;
            this.element.classList.add('has-painted');
            this.hint?.setAttribute('aria-hidden', 'true');
            this.start();
        }

        moveCursor(event) {
            if (!this.brushCursor) return;
            const rect = this.element.getBoundingClientRect();
            this.brushCursor.style.setProperty('--brush-x', `${event.clientX - rect.left}px`);
            this.brushCursor.style.setProperty('--brush-y', `${event.clientY - rect.top}px`);
        }

        bindEvents() {
            this.element.addEventListener('pointerenter', (event) => {
                this.pointerInside = true;
                this.element.classList.add('is-pointer-inside');
                document.body.classList.add('is-watercolor-hover');
                this.last = this.pointFromEvent(event);
                this.moveCursor(event);
            });
            this.element.addEventListener('pointermove', (event) => {
                if (event.target.closest?.('button, a')) return;
                if (event.pointerType !== 'mouse' && !this.pointerDown) return;
                const next = this.pointFromEvent(event);
                const dx = next.x - this.last.x;
                const dy = next.y - this.last.y;
                if (Math.hypot(dx, dy) > 0.0012) this.queueStroke(this.last, next);
                this.last = next;
                this.moveCursor(event);
            });
            this.element.addEventListener('pointerdown', (event) => {
                if (event.target.closest?.('button, a')) return;
                this.pointerDown = true;
                this.element.setPointerCapture?.(event.pointerId);
                const next = this.pointFromEvent(event);
                this.queueStroke({ x: next.x - 0.001, y: next.y }, next);
                this.last = next;
            });
            const release = (event) => {
                this.pointerDown = false;
                if (this.element.hasPointerCapture?.(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
            };
            this.element.addEventListener('pointerup', release);
            this.element.addEventListener('pointercancel', release);
            this.element.addEventListener('pointerleave', () => {
                this.pointerInside = false;
                this.pointerDown = false;
                this.lastInteraction = performance.now();
                this.element.classList.remove('is-pointer-inside');
                document.body.classList.remove('is-watercolor-hover');
            });
            window.addEventListener('resize', () => {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => this.resize(), 120);
            }, { passive: true });
        }

        paintStroke(stroke) {
            const ctx = this.maskCtx;
            const width = this.mask.width;
            const height = this.mask.height;
            const radius = Math.min(width, height) * this.options.brush * 1.45;
            const steps = Math.max(2, Math.ceil(Math.hypot(
                (stroke.to.x - stroke.from.x) * width,
                (stroke.to.y - stroke.from.y) * height
            ) / Math.max(8, radius * 0.35)));
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i <= steps; i += 1) {
                const t = i / steps;
                const x = (stroke.from.x + (stroke.to.x - stroke.from.x) * t) * width;
                const y = (stroke.from.y + (stroke.to.y - stroke.from.y) * t) * height;
                const jitterX = (Math.random() - 0.5) * radius * 0.24;
                const jitterY = (Math.random() - 0.5) * radius * 0.24;
                const localRadius = radius * (0.76 + Math.random() * 0.46);
                const gradient = ctx.createRadialGradient(x + jitterX, y + jitterY, 0, x + jitterX, y + jitterY, localRadius);
                gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
                gradient.addColorStop(0.42, 'rgba(255,255,255,0.78)');
                gradient.addColorStop(0.78, 'rgba(255,255,255,0.24)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x + jitterX, y + jitterY, localRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawImageCover(ctx, image, width, height) {
            const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
            const drawWidth = image.naturalWidth * scale;
            const drawHeight = image.naturalHeight * scale;
            ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        }

        draw() {
            if (!this.ctx || !this.frontImage) return;
            const width = this.canvas.width;
            const height = this.canvas.height;
            this.ctx.clearRect(0, 0, width, height);
            this.drawImageCover(this.ctx, this.frontImage, width, height);

            this.compositeCtx.clearRect(0, 0, width, height);
            this.compositeCtx.globalCompositeOperation = 'source-over';
            this.drawImageCover(this.compositeCtx, this.backImage, width, height);
            this.compositeCtx.globalCompositeOperation = 'destination-in';
            this.compositeCtx.drawImage(this.mask, 0, 0);
            this.compositeCtx.globalCompositeOperation = 'source-over';
            this.ctx.drawImage(this.composite, 0, 0);
        }

        frame = (time) => {
            if (!this.running) return;
            const delta = Math.min(0.034, Math.max(0.001, (time - this.lastTime) / 1000));
            this.lastTime = time;

            const now = performance.now();
            const idleTime = this.lastInteraction ? now - this.lastInteraction : this.resetDelay + 1;
            const idleRamp = Math.min(1, Math.max(0, (idleTime - 140) / 1050));

            this.maskCtx.globalCompositeOperation = 'destination-out';
            const fadeRate = this.options.decay * (0.72 + idleRamp * 5.4);
            this.maskCtx.fillStyle = `rgba(0,0,0,${Math.min(0.24, 1 - Math.exp(-delta * fadeRate))})`;
            this.maskCtx.fillRect(0, 0, this.mask.width, this.mask.height);

            this.strokes.splice(0, 10).forEach((stroke) => this.paintStroke(stroke));

            if (this.hasPaint && idleTime >= this.resetDelay && this.strokes.length === 0) {
                this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
                this.hasPaint = false;
            }

            this.draw();
            if (!this.hasPaint && this.strokes.length === 0) {
                this.running = false;
                return;
            }
            requestAnimationFrame(this.frame);
        };

        start() {
            if (this.running) return;
            this.running = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.frame);
        }
    }

    class WatercolorReveal {
        constructor(element) {
            this.element = element;
            this.canvas = element.querySelector('canvas');
            this.frontSource = element.dataset.front;
            this.backSource = element.dataset.back;
            this.brushRadius = Number(element.dataset.brush || 0.064);
            this.brushStrength = Number(element.dataset.strength || 0.94);
            this.force = Number(element.dataset.force || 1.25);
            this.baseDecay = Number(element.dataset.decay || 1.12);
            this.resetDelay = Number(element.dataset.reset || 3000);
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            this.lowPower = Boolean(connection?.saveData)
                || Number(navigator.deviceMemory || 8) <= 4
                || Number(navigator.hardwareConcurrency || 8) <= 4
                || window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
            this.resolutionScale = Number(element.dataset.resolution || 0.5) * (this.lowPower ? 0.82 : 1);
            this.isVisible = false;
            this.isRunning = false;
            this.destroyed = false;
            this.lastFrameTime = performance.now();
            this.startTime = this.lastFrameTime;
            this.lastInteraction = 0;
            this.pointer = { x: 0.5, y: 0.5 };
            this.strokeQueue = [];
            this.pointerInside = false;
            this.pointerDown = false;
            this.stateIsClear = true;
            this.brushCursor = element.querySelector('.watercolor-brush-cursor');
            this.hint = element.querySelector('.watercolor-hint');
            this.boundRender = (time) => this.render(time);
        }

        async init() {
            if (!this.canvas || !this.frontSource || !this.backSource) {
                this.element.classList.add('watercolor-static');
                return;
            }

            try {
                const [frontImage, backImage] = await Promise.all([
                    loadImage(this.frontSource),
                    loadImage(this.backSource)
                ]);
                this.frontImage = frontImage;
                this.backImage = backImage;

                const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (reducedMotion) {
                    this.startCanvasFallback(frontImage, backImage);
                    return;
                }

                this.gl = this.canvas.getContext('webgl', {
                    alpha: false,
                    antialias: false,
                    depth: false,
                    stencil: false,
                    premultipliedAlpha: false,
                    preserveDrawingBuffer: false,
                    powerPreference: this.lowPower ? 'low-power' : 'high-performance'
                });
                if (!this.gl) throw new Error('WebGL is unavailable');

                this.setupPrograms();
                this.setupGeometry();
                this.frontTexture = this.createImageTexture(frontImage);
                this.backTexture = this.createImageTexture(backImage);
                this.resize();
                this.bindEvents();
                this.observe();
                this.element.classList.add('is-ready');
                this.drawDisplay();
            } catch (error) {
                console.warn('[HEFANG] WebGL watercolour reveal fallback:', error);
                if (this.frontImage && this.backImage) this.startCanvasFallback(this.frontImage, this.backImage);
                else this.element.classList.add('watercolor-static');
            }
        }

        startCanvasFallback(frontImage, backImage) {
            try {
                const fallback = new CanvasWatercolorFallback(this.element, this.canvas, frontImage, backImage, {
                    brush: this.brushRadius,
                    decay: this.baseDecay,
                    reset: this.resetDelay
                });
                fallback.init();
                this.element.__hefangCanvasWatercolor = fallback;
            } catch (error) {
                console.warn('[HEFANG] Canvas watercolour reveal unavailable:', error);
                this.element.classList.add('watercolor-static');
            }
        }

        setupPrograms() {
            const gl = this.gl;
            this.updateProgram = createProgram(gl, VERTEX_SHADER, UPDATE_SHADER);
            this.displayProgram = createProgram(gl, VERTEX_SHADER, DISPLAY_SHADER);

            this.updateLocations = {
                position: gl.getAttribLocation(this.updateProgram, 'aPosition'),
                previous: gl.getUniformLocation(this.updateProgram, 'uPrevious'),
                resolution: gl.getUniformLocation(this.updateProgram, 'uResolution'),
                pointA: gl.getUniformLocation(this.updateProgram, 'uPointA'),
                pointB: gl.getUniformLocation(this.updateProgram, 'uPointB'),
                strokeVelocity: gl.getUniformLocation(this.updateProgram, 'uStrokeVelocity'),
                aspect: gl.getUniformLocation(this.updateProgram, 'uAspect'),
                radius: gl.getUniformLocation(this.updateProgram, 'uRadius'),
                strength: gl.getUniformLocation(this.updateProgram, 'uStrength'),
                force: gl.getUniformLocation(this.updateProgram, 'uForce'),
                active: gl.getUniformLocation(this.updateProgram, 'uActive'),
                delta: gl.getUniformLocation(this.updateProgram, 'uDelta'),
                time: gl.getUniformLocation(this.updateProgram, 'uTime'),
                decay: gl.getUniformLocation(this.updateProgram, 'uDecay')
            };

            this.displayLocations = {
                position: gl.getAttribLocation(this.displayProgram, 'aPosition'),
                front: gl.getUniformLocation(this.displayProgram, 'uFront'),
                back: gl.getUniformLocation(this.displayProgram, 'uBack'),
                state: gl.getUniformLocation(this.displayProgram, 'uState'),
                stateResolution: gl.getUniformLocation(this.displayProgram, 'uStateResolution'),
                time: gl.getUniformLocation(this.displayProgram, 'uTime')
            };
        }

        setupGeometry() {
            const gl = this.gl;
            this.positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1, 1, -1, -1, 1,
                -1, 1, 1, -1, 1, 1
            ]), gl.STATIC_DRAW);
        }

        createImageTexture(image) {
            const gl = this.gl;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            return texture;
        }

        createStateTarget(width, height) {
            const gl = this.gl;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error('Watercolour state framebuffer is incomplete');
            }
            return { texture, framebuffer };
        }

        clearState(target) {
            const gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.viewport(0, 0, this.simWidth, this.simHeight);
            gl.clearColor(0, 0.5, 0.5, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        resize() {
            if (!this.gl) return;
            const rect = this.element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const displayRatio = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1 : 1.65);
            const canvasWidth = Math.max(2, Math.round(rect.width * displayRatio));
            const canvasHeight = Math.max(2, Math.round(rect.height * displayRatio));
            if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
                this.canvas.width = canvasWidth;
                this.canvas.height = canvasHeight;
            }

            const mobileScale = this.lowPower ? 0.58 : 1;
            const simWidth = Math.max(96, Math.round(rect.width * this.resolutionScale * mobileScale));
            const simHeight = Math.max(128, Math.round(rect.height * this.resolutionScale * mobileScale));
            if (simWidth !== this.simWidth || simHeight !== this.simHeight) {
                if (this.targets) {
                    this.targets.forEach((target) => {
                        this.gl.deleteTexture(target.texture);
                        this.gl.deleteFramebuffer(target.framebuffer);
                    });
                }
                this.simWidth = simWidth;
                this.simHeight = simHeight;
                this.targets = [this.createStateTarget(simWidth, simHeight), this.createStateTarget(simWidth, simHeight)];
                this.readIndex = 0;
                this.writeIndex = 1;
                this.clearState(this.targets[0]);
                this.clearState(this.targets[1]);
                this.stateIsClear = true;
            }
            this.aspect = rect.width / rect.height;
            this.drawDisplay();
        }

        bindPosition(program, location) {
            const gl = this.gl;
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        }

        updateState(stroke, delta, time) {
            const gl = this.gl;
            const read = this.targets[this.readIndex];
            const write = this.targets[this.writeIndex];
            gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
            gl.viewport(0, 0, this.simWidth, this.simHeight);
            this.bindPosition(this.updateProgram, this.updateLocations.position);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, read.texture);
            gl.uniform1i(this.updateLocations.previous, 0);
            gl.uniform2f(this.updateLocations.resolution, this.simWidth, this.simHeight);
            gl.uniform2f(this.updateLocations.pointA, stroke?.ax ?? 0.5, stroke?.ay ?? 0.5);
            gl.uniform2f(this.updateLocations.pointB, stroke?.bx ?? 0.5, stroke?.by ?? 0.5);
            gl.uniform2f(this.updateLocations.strokeVelocity, stroke?.vx ?? 0, stroke?.vy ?? 0);
            gl.uniform1f(this.updateLocations.aspect, this.aspect);
            gl.uniform1f(this.updateLocations.radius, stroke?.radius ?? this.brushRadius);
            gl.uniform1f(this.updateLocations.strength, stroke?.strength ?? this.brushStrength);
            gl.uniform1f(this.updateLocations.force, stroke?.force ?? this.force);
            gl.uniform1f(this.updateLocations.active, stroke ? 1 : 0);
            gl.uniform1f(this.updateLocations.delta, delta);
            gl.uniform1f(this.updateLocations.time, time);

            const idleTime = this.lastInteraction ? performance.now() - this.lastInteraction : this.resetDelay + 1;
            const idleRamp = Math.min(1, Math.max(0, (idleTime - 140) / 1050));
            const decayMultiplier = 0.72 + idleRamp * 5.4;
            gl.uniform1f(this.updateLocations.decay, this.baseDecay * decayMultiplier);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            const previousRead = this.readIndex;
            this.readIndex = this.writeIndex;
            this.writeIndex = previousRead;
        }

        drawDisplay() {
            if (!this.gl || !this.targets) return;
            const gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.bindPosition(this.displayProgram, this.displayLocations.position);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.frontTexture);
            gl.uniform1i(this.displayLocations.front, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.backTexture);
            gl.uniform1i(this.displayLocations.back, 1);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.targets[this.readIndex].texture);
            gl.uniform1i(this.displayLocations.state, 2);
            gl.uniform2f(this.displayLocations.stateResolution, this.simWidth, this.simHeight);
            gl.uniform1f(this.displayLocations.time, (performance.now() - this.startTime) / 1000);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        pointerCoordinates(event) {
            const rect = this.element.getBoundingClientRect();
            return {
                x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
                y: Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height))
            };
        }

        queueStroke(from, to, event) {
            const dx = (to.x - from.x) * this.aspect;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 0.0013 && event.type !== 'pointerdown') return;

            const speed = Math.min(1, distance * 25);
            const directionLength = Math.max(0.00001, Math.sqrt(dx * dx + dy * dy));
            const vx = (dx / directionLength) * Math.min(0.075, distance * 3.6);
            const vy = (dy / directionLength) * Math.min(0.075, distance * 3.6);
            this.strokeQueue.push({
                ax: from.x,
                ay: from.y,
                bx: to.x,
                by: to.y,
                vx,
                vy,
                radius: this.brushRadius * (1.12 - speed * 0.34),
                strength: this.brushStrength * (0.92 + (1 - speed) * 0.12),
                force: this.force * (0.86 + speed * 0.48)
            });
            if (this.strokeQueue.length > 30) this.strokeQueue.splice(0, this.strokeQueue.length - 30);
            this.lastInteraction = performance.now();
            this.stateIsClear = false;
            this.element.classList.add('has-painted');
            this.hint?.setAttribute('aria-hidden', 'true');
            this.start();
        }

        moveBrushCursor(event) {
            if (!this.brushCursor) return;
            const rect = this.element.getBoundingClientRect();
            this.brushCursor.style.setProperty('--brush-x', `${event.clientX - rect.left}px`);
            this.brushCursor.style.setProperty('--brush-y', `${event.clientY - rect.top}px`);
        }

        bindEvents() {
            this.onPointerEnter = (event) => {
                this.pointerInside = true;
                document.body.classList.add('is-watercolor-hover');
                this.element.classList.add('is-pointer-inside');
                this.pointer = this.pointerCoordinates(event);
                this.moveBrushCursor(event);
            };
            this.onPointerMove = (event) => {
                if (event.target.closest?.('button, a')) return;
                if (!this.pointerInside && event.pointerType === 'mouse') return;
                if (event.pointerType !== 'mouse' && !this.pointerDown) return;
                const point = this.pointerCoordinates(event);
                const previous = { ...this.pointer };
                this.pointer = point;
                this.queueStroke(previous, point, event);
                this.moveBrushCursor(event);
            };
            this.onPointerDown = (event) => {
                if (event.target.closest?.('button, a')) return;
                this.pointerDown = true;
                this.element.setPointerCapture?.(event.pointerId);
                const point = this.pointerCoordinates(event);
                this.pointer = point;
                this.queueStroke({ x: point.x - 0.001, y: point.y }, point, event);
                this.moveBrushCursor(event);
            };
            this.onPointerUp = (event) => {
                this.pointerDown = false;
                if (this.element.hasPointerCapture?.(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
            };
            this.onPointerLeave = () => {
                this.pointerInside = false;
                this.pointerDown = false;
                this.lastInteraction = performance.now();
                document.body.classList.remove('is-watercolor-hover');
                this.element.classList.remove('is-pointer-inside');
            };
            this.onResize = () => {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => this.resize(), 120);
            };
            this.onVisibility = () => {
                if (document.hidden) this.stop();
                else if (this.isVisible) this.start();
            };

            this.element.addEventListener('pointerenter', this.onPointerEnter);
            this.element.addEventListener('pointermove', this.onPointerMove);
            this.element.addEventListener('pointerdown', this.onPointerDown);
            this.element.addEventListener('pointerup', this.onPointerUp);
            this.element.addEventListener('pointercancel', this.onPointerUp);
            this.element.addEventListener('pointerleave', this.onPointerLeave);
            window.addEventListener('resize', this.onResize, { passive: true });
            document.addEventListener('visibilitychange', this.onVisibility);
        }

        observe() {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.target !== this.element) return;
                    this.isVisible = entry.isIntersecting;
                    if (this.isVisible) this.start();
                    else this.stop();
                });
            }, { rootMargin: '180px 0px', threshold: 0.02 });
            this.observer.observe(this.element);
        }

        start() {
            if (this.isRunning || this.destroyed || !this.gl) return;
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            this.frame = requestAnimationFrame(this.boundRender);
        }

        stop() {
            this.isRunning = false;
            if (this.frame) cancelAnimationFrame(this.frame);
            this.frame = 0;
        }

        render(timeMs) {
            if (!this.isRunning || this.destroyed || !this.gl) return;
            const delta = Math.min(0.033, Math.max(0.001, (timeMs - this.lastFrameTime) / 1000));
            const time = (timeMs - this.startTime) / 1000;
            this.lastFrameTime = timeMs;

            if (this.strokeQueue.length) {
                const strokes = this.strokeQueue.splice(0, 9);
                const stepDelta = delta / Math.max(1, strokes.length);
                strokes.forEach((stroke) => this.updateState(stroke, stepDelta, time));
            } else if (!this.stateIsClear) {
                this.updateState(null, delta, time);
            }

            const idleTime = this.lastInteraction ? performance.now() - this.lastInteraction : this.resetDelay + 1;
            if (!this.stateIsClear && idleTime >= this.resetDelay && this.strokeQueue.length === 0) {
                this.clearState(this.targets[0]);
                this.clearState(this.targets[1]);
                this.readIndex = 0;
                this.writeIndex = 1;
                this.stateIsClear = true;
            }

            this.drawDisplay();
            if (this.stateIsClear && this.strokeQueue.length === 0) {
                this.isRunning = false;
                this.frame = 0;
                return;
            }
            this.frame = requestAnimationFrame(this.boundRender);
        }
    }

    const initWatercolorReveals = ({ immediate = false } = {}) => {
        const elements = Array.from(document.querySelectorAll('[data-watercolor-reveal]'));
        const initialise = (element) => {
            if (element.dataset.watercolorStarted === 'true') return;
            element.dataset.watercolorStarted = 'true';
            const reveal = new WatercolorReveal(element);
            reveal.init();
            element.__hefangWatercolorReveal = reveal;
        };

        const lazyElements = elements.filter((element) => element.hasAttribute('data-watercolor-lazy'));
        elements.filter((element) => !element.hasAttribute('data-watercolor-lazy')).forEach(initialise);

        if (!lazyElements.length) return;
        if (immediate || !('IntersectionObserver' in window)) {
            lazyElements.forEach(initialise);
            return;
        }

        const lazyObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                initialise(entry.target);
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '520px 0px', threshold: 0.01 });
        lazyElements.forEach((element) => lazyObserver.observe(element));
    };

    const drinkPreloads = [];
    const primeDrinkWatercolorAssets = () => {
        if (document.body?.dataset.page !== 'drinks') return;
        const sources = new Set();
        document.querySelectorAll('[data-watercolor-reveal]').forEach((element) => {
            const front = element.getAttribute('data-front');
            const back = element.getAttribute('data-back');
            if (front) sources.add(front);
            if (back) sources.add(back);
        });
        sources.forEach((source) => {
            const image = new Image();
            image.decoding = 'async';
            if ('fetchPriority' in image) image.fetchPriority = 'high';
            image.src = source;
            drinkPreloads.push(image);
        });
    };

    let watercolorBooted = false;
    const bootWatercolors = ({ immediate = false } = {}) => {
        if (watercolorBooted) return;
        watercolorBooted = true;
        initWatercolorReveals({ immediate });
    };
    const scheduleWatercolorBoot = () => {
        const page = document.body?.dataset.page || '';
        const delay = page === 'home' ? 3200 : 900;
        const run = () => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => bootWatercolors(), { timeout: 2200 });
                return;
            }
            window.setTimeout(() => bootWatercolors(), 900);
        };
        window.setTimeout(run, delay);
    };
    const bootDrinkWatercolors = () => {
        requestAnimationFrame(() => bootWatercolors({ immediate: true }));
    };
    const scheduleWatercolors = () => {
        const page = document.body?.dataset.page || '';
        if (page === 'drinks') {
            primeDrinkWatercolorAssets();
            if (window.__hefangLoaderCovered || window.__hefangLoaderPhase === 'covered' || window.__hefangLoaderComplete) {
                bootDrinkWatercolors();
                return;
            }
            if (document.documentElement.classList.contains('hefang-loader-active')) {
                window.addEventListener('hefang:loader-covered', bootDrinkWatercolors, { once: true });
                window.addEventListener('hefang:loader-complete', bootDrinkWatercolors, { once: true });
                return;
            }
            bootDrinkWatercolors();
            return;
        }
        if (document.documentElement.classList.contains('hefang-loader-active') && !window.__hefangLoaderComplete) {
            window.addEventListener('hefang:loader-complete', scheduleWatercolorBoot, { once: true });
            return;
        }
        if (window.__hefangPlayPageIntro) {
            window.addEventListener('hefang:page-intro-complete', scheduleWatercolorBoot, { once: true });
            return;
        }
        scheduleWatercolorBoot();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleWatercolors, { once: true });
    } else {
        scheduleWatercolors();
    }
})();
