const hefangCompactLayout = () => window.matchMedia('(max-width: 900px), (max-width: 1024px) and (orientation: portrait)').matches;
const hefangLowPowerViewport = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const limitedMemory = Number(navigator.deviceMemory || 8) <= 4;
    const limitedCpu = Number(navigator.hardwareConcurrency || 8) <= 4;
    const compactPointer = window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return compactPointer || saveData || limitedMemory || limitedCpu || reducedMotion;
};
document.documentElement.classList.toggle('hefang-low-power', hefangLowPowerViewport());
const hefangDesktopPointer = () => window.matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)').matches;

const HEFANG_INTRO_TARGET_KEY = 'hefang:intro-target';

const getHefangPageFromURL = (urlLike) => {
    try {
        const url = urlLike instanceof URL ? urlLike : new URL(urlLike, window.location.href);
        if (url.origin !== window.location.origin) return '';
        const path = url.pathname.replace(/\/+$/, '').toLowerCase();
        if (/(?:^|\/)drinks\.html$/.test(path)) return 'drinks';
        if (/(?:^|\/)index\.html$/.test(path)) return 'home';
        const currentDir = window.location.pathname.replace(/[^/]*$/, '').replace(/\/+$/, '').toLowerCase();
        if (path === currentDir || path === '') return 'home';
        return '';
    } catch {
        return '';
    }
};

const installHefangCrossPageIntroRouting = () => {
    let navigating = false;
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || navigating) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest && event.target.closest('a[href]');
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;

        let targetURL;
        try { targetURL = new URL(href, window.location.href); } catch { return; }
        const targetPage = getHefangPageFromURL(targetURL);
        const currentPage = window.__hefangCurrentPage || getHefangPageFromURL(window.location.href);
        if (!targetPage || targetPage === currentPage) return;

        try { sessionStorage.setItem(HEFANG_INTRO_TARGET_KEY, targetPage); } catch {}
        try { window.name = `hefang-intro:${targetPage}`; } catch {}

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion || !window.HefangLiquidTransition) return;

        event.preventDefault();
        navigating = true;
        document.documentElement.classList.remove('hefang-skip-page-intro');

        let navigated = false;
        const navigate = () => {
            if (navigated) return;
            navigated = true;
            window.location.assign(targetURL.href);
        };
        const fallback = window.setTimeout(navigate, 2400);
        window.HefangLiquidTransition.cover(() => {
            window.clearTimeout(fallback);
            navigate();
        });
    }, true);
};

let hefangStoryProgress = 0;
let navThemeFrame = 0;

const updateHefangNavTheme = () => {
    if (navThemeFrame) return;

    navThemeFrame = requestAnimationFrame(() => {
        navThemeFrame = 0;

        const nav = document.querySelector('.pill-nav-container');
        const story = document.getElementById('scrolly-track');
        const philosophy = document.getElementById('philosophy');
        const why = document.getElementById('why');
        const collection = document.getElementById('collection');
        if (!nav || !story || !philosophy) return;

        const navRect = nav.getBoundingClientRect();
        const navY = navRect.top + navRect.height * 0.5;
        const storyRect = story.getBoundingClientRect();
        const philosophyRect = philosophy.getBoundingClientRect();
        const whyRect = why ? why.getBoundingClientRect() : null;
        const collectionRect = collection ? collection.getBoundingClientRect() : null;

        const rootedIsBehindNav = storyRect.top <= navY
            && storyRect.bottom > navY
            && hefangStoryProgress >= 0.62;

        let philosophyDirtIsBehindNav = false;
        if (philosophyRect.top <= navY && philosophyRect.bottom > navY) {
            const localY = navY - philosophyRect.top;
            const fadeHeight = Math.min(window.innerHeight * 0.46, philosophyRect.height);
            const dirtEnd = philosophyRect.height - fadeHeight * 0.56;
            philosophyDirtIsBehindNav = localY < dirtEnd;
        }

        let whyDirtIsBehindNav = false;
        if (whyRect && whyRect.top <= navY && whyRect.bottom > navY) {
            const transitionImage = why.querySelector('.why-transition-image');
            if (transitionImage) {
                const imageRect = transitionImage.getBoundingClientRect();
                const localY = navY - imageRect.top;
                whyDirtIsBehindNav = localY >= 0 && localY < imageRect.height * 0.42;
            }
        }

        const collectionIsBehindNav = Boolean(
            collectionRect
            && collectionRect.top <= navY
            && collectionRect.bottom > navY
        );

        nav.classList.toggle(
            'on-dirt',
            rootedIsBehindNav || philosophyDirtIsBehindNav || whyDirtIsBehindNav || collectionIsBehindNav
        );
    });
};

let hefangHeroRuntimeSignalled = false;
let hefangHomeCoreReady = false;
let hefangPageReadySignalled = false;
const trySignalHefangPageReady = () => {
    if (hefangPageReadySignalled) return;
    const stage = document.getElementById('hero-interactive-stage');
    const video = document.querySelector('.hero-bg-media');
    const runtimeReady = !stage || document.documentElement.classList.contains('hero-runtime-ready');
    const videoReady = !video || Boolean(window.__hefangHeroVideoReady);
    if (!hefangHomeCoreReady || !runtimeReady || !videoReady) return;
    hefangPageReadySignalled = true;
    window.__hefangPageReadyForReveal = true;
    window.dispatchEvent(new CustomEvent('hefang:page-ready'));
};
const signalHefangHeroRuntimeReady = () => {
    if (hefangHeroRuntimeSignalled) return;
    hefangHeroRuntimeSignalled = true;
    document.documentElement.classList.add('hero-runtime-ready');
    window.dispatchEvent(new CustomEvent('hefang:hero-runtime-ready'));
    trySignalHefangPageReady();
};

const unlockHefangHeroScroll = ({ refresh = false } = {}) => {
    if (window.__hefangHeroBootTimer) {
        window.clearTimeout(window.__hefangHeroBootTimer);
        window.__hefangHeroBootTimer = null;
    }

    if (typeof window.__hefangReleaseBootLock === 'function') {
        window.__hefangReleaseBootLock();
    } else {
        document.documentElement.classList.remove('hero-loading');
        if (window.__hefangPreventBootScroll) {
            window.removeEventListener('wheel', window.__hefangPreventBootScroll);
            window.removeEventListener('touchmove', window.__hefangPreventBootScroll);
        }
        if (window.__hefangPreventBootKeyScroll) {
            window.removeEventListener('keydown', window.__hefangPreventBootKeyScroll);
        }
    }

    if (refresh) {
        requestAnimationFrame(() => {
            if (window.ScrollTrigger) ScrollTrigger.refresh();
        });
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    installHefangCrossPageIntroRouting();

    const heroBgVideo = document.querySelector('.hero-bg-media');
    if (heroBgVideo) {
        let heroFrameRevealed = false;
        const revealHeroVideoFrame = () => {
            if (heroFrameRevealed) return;
            heroFrameRevealed = true;
            heroBgVideo.classList.add('is-frame-ready');
            window.__hefangHeroVideoReady = true;
            window.dispatchEvent(new CustomEvent('hefang:hero-video-ready'));
            trySignalHefangPageReady();
        };
        const revealAfterDrawableFrame = () => {
            requestAnimationFrame(() => requestAnimationFrame(revealHeroVideoFrame));
        };
        if (heroBgVideo.readyState >= 2) revealAfterDrawableFrame();
        else heroBgVideo.addEventListener('loadeddata', revealAfterDrawableFrame, { once: true });
    }

    const managedVideos = [...document.querySelectorAll('video')];
    const reducePageMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (document.documentElement.classList.contains('hefang-loader-active')) {
        managedVideos.forEach((video) => {
            if (video !== heroBgVideo) video.pause();
        });
        if (heroBgVideo) {
            const pauseHeroAfterFrame = () => {
                if (document.documentElement.classList.contains('hefang-loader-active') && !window.__hefangLoaderComplete) heroBgVideo.pause();
            };
            if (window.__hefangHeroVideoReady) pauseHeroAfterFrame();
            else window.addEventListener('hefang:hero-video-ready', pauseHeroAfterFrame, { once: true });
        }
    }
    window.addEventListener('hefang:transition-cover-start', () => {
        managedVideos.forEach((video) => video.pause());
    }, { once: true });
    if (reducePageMotion.matches) {
        managedVideos.forEach((video) => {
            video.autoplay = false;
            video.pause();
        });
        document.querySelectorAll('#hefang-water-still animate, #hefang-water-active animate').forEach((animation) => animation.remove());
    }
    document.addEventListener('visibilitychange', () => {
        managedVideos.forEach((video) => {
            if (document.hidden) {
                video.dataset.hefangWasPlaying = String(!video.paused);
                video.pause();
                return;
            }
            if (!reducePageMotion.matches && video.dataset.hefangWasPlaying === 'true') {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
            }
            delete video.dataset.hefangWasPlaying;
        });
    });

    await waitForHefangLoaderCovered();

    const cursor = document.querySelector('.custom-cursor');
    const hoverTargets = document.querySelectorAll('a, button, .hover-target, .pill-list li');
    const supportsCustomCursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (cursor && supportsCustomCursor) {
        document.documentElement.classList.add('has-custom-cursor');
        let cursorFrame = 0;
        let cursorX = 0;
        let cursorY = 0;
        document.addEventListener('mousemove', (event) => {
            cursorX = event.clientX;
            cursorY = event.clientY;
            if (cursorFrame) return;
            cursorFrame = requestAnimationFrame(() => {
                cursorFrame = 0;
                cursor.style.left = `${cursorX}px`;
                cursor.style.top = `${cursorY}px`;
            });
        }, { passive: true });
        hoverTargets.forEach((target) => {
            target.addEventListener('mouseenter', () => cursor.classList.add('active'));
            target.addEventListener('mouseleave', () => cursor.classList.remove('active'));
        });
    }
    function initGooeyNav() {
        const container = document.getElementById('gooey-menu-wrapper');
        const reduceNavMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!container) return;

        const items = container.querySelectorAll('.pill');
        const filter = container.querySelector('.effect.filter');
        if (!filter || items.length === 0) return;

        let activeIndex = 0;
        let defaultActiveIndex = 0;

        items.forEach((item, index) => {
            if (item.classList.contains('active')) {
                activeIndex = index;
                defaultActiveIndex = index;
            }
        });

        const colors = ['#879A73', '#A3B192', '#7A9A5B'];
        const noise = (n = 1) => n / 2 - Math.random() * n;

        const getXY = (distance, pointIndex, totalPoints) => {
            const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
            return [distance * Math.cos(angle), distance * Math.sin(angle)];
        };

        const createParticle = (i, t, d, r, pCount) => {
            let rotate = noise(r / 10);
            return {
                start: getXY(d[0], pCount - i, pCount),
                end: getXY(d[1] + noise(7), pCount - i, pCount),
                time: t,
                scale: 1 + noise(0.2),
                color: colors[Math.floor(Math.random() * colors.length)],
                rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10
            };
        };

        const makeParticles = (element, customCount = 6, customDist = [60, 15]) => {
            if (reduceNavMotion) return;
            const animationTime = 760;
            const bubbleTime = animationTime * 2 + 300;
            element.style.setProperty('--time', `${bubbleTime}ms`);

            for (let i = 0; i < customCount; i++) {
                const t = animationTime * 2 + noise(900);
                const p = createParticle(i, t, customDist, 100, customCount);

                setTimeout(() => {
                    const particle = document.createElement('span');
                    const point = document.createElement('span');

                    particle.classList.add('particle');
                    particle.style.setProperty('--start-x', `${p.start[0]}px`);
                    particle.style.setProperty('--start-y', `${p.start[1]}px`);
                    particle.style.setProperty('--end-x', `${p.end[0]}px`);
                    particle.style.setProperty('--end-y', `${p.end[1]}px`);
                    particle.style.setProperty('--time', `${p.time}ms`);
                    particle.style.setProperty('--scale', `${p.scale}`);
                    particle.style.setProperty('--color', p.color);
                    particle.style.setProperty('--rotate', `${p.rotate}deg`);

                    point.classList.add('point');
                    particle.appendChild(point);
                    element.appendChild(particle);

                    setTimeout(() => {
                        try { element.removeChild(particle); } catch(e) {}
                    }, t);
                }, 30);
            }
        };

        let particleTimeout;
        const updateEffectPosition = (liEl, animate = true) => {
            if (!liEl) return;
            const containerRect = container.getBoundingClientRect();
            const pos = liEl.getBoundingClientRect();
            const left = pos.left - containerRect.left;
            const top = pos.top - containerRect.top;

            if (animate && !reduceNavMotion && typeof gsap !== 'undefined') {
                gsap.to(filter, { left: left, top: top, width: pos.width, height: pos.height, duration: 1.9, ease: "elastic.out(1, 0.92)", overwrite: "auto" });
            } else {
                filter.style.left = `${left}px`; filter.style.top = `${top}px`; filter.style.width = `${pos.width}px`; filter.style.height = `${pos.height}px`;
            }
        };

        const handleHover = (liEl, index) => {
            if (activeIndex === index) return;
            if (items[activeIndex]) items[activeIndex].classList.remove('active');

            activeIndex = index;
            liEl.classList.add('active');
            updateEffectPosition(liEl, true);
            filter.innerHTML = '';
            clearTimeout(particleTimeout);
            particleTimeout = setTimeout(() => { makeParticles(filter); }, 340);
        };

        items.forEach((item, index) => {
            item.addEventListener('mouseenter', () => handleHover(item, index));
            item.addEventListener('mousedown', () => {
                if (!reduceNavMotion && typeof gsap !== 'undefined') {
                    gsap.fromTo(filter, { scale: 0.8 }, { scale: 1, duration: 0.9, ease: "elastic.out(1, 0.52)", overwrite: "auto" });
                    makeParticles(filter, 12, [90, 20]);
                }
            });
        });

        container.addEventListener('mouseleave', () => {
            if (activeIndex !== defaultActiveIndex && items[defaultActiveIndex]) {
                handleHover(items[defaultActiveIndex], defaultActiveIndex);
            }
        });

        if (items[activeIndex]) updateEffectPosition(items[activeIndex], false);
        window.addEventListener('load', () => { if(items[activeIndex]) updateEffectPosition(items[activeIndex], false); });
        window.addEventListener('resize', () => { if(items[activeIndex]) updateEffectPosition(items[activeIndex], false); });
    }
    initGooeyNav();
    let lastScrollY = window.scrollY;
    const navContainer = document.querySelector('.pill-nav-container');
    if (navContainer && typeof gsap !== 'undefined') {
        let navScrollFrame = 0;
        window.addEventListener('scroll', () => {
            if (navScrollFrame) return;
            navScrollFrame = requestAnimationFrame(() => {
                navScrollFrame = 0;
                const currentScrollY = window.scrollY;
                const shouldHide = hefangDesktopPointer() && currentScrollY > 100 && currentScrollY > lastScrollY;
                gsap.to(navContainer, {
                    y: shouldHide ? -150 : 0,
                    duration: shouldHide ? 1.05 : 0.75,
                    ease: shouldHide ? 'power3.inOut' : 'power3.out',
                    overwrite: 'auto'
                });
                lastScrollY = currentScrollY;
            });
        }, { passive: true });
    }

    const magneticElements = document.querySelectorAll('.nav-logo, #gooey-menu-wrapper');
    magneticElements.forEach(el => {
        if (typeof gsap === 'undefined' || !hefangDesktopPointer()) return;
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            const strength = el.classList.contains('nav-logo') ? 0.3 : 0.08;
            gsap.to(el, { x: x * strength, y: y * strength, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        });
        el.addEventListener('mouseleave', () => {
            gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' });
        });
    });

    const faders = document.querySelectorAll('.fade-in:not(#collection), section:not(#scrolly-track):not(#why):not(#signature):not(#collection)');
    const appearOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });

    faders.forEach(fader => {
        if(!fader.classList.contains('fade-in')) fader.classList.add('fade-in');
        appearOnScroll.observe(fader);
    });

    const transitionBg = document.querySelector('.page-transition-liquid');
    const finishHomePageIntro = () => {
        document.documentElement.classList.remove('hefang-page-intro');
        window.__hefangPlayPageIntro = false;
        window.dispatchEvent(new CustomEvent('hefang:page-intro-complete'));
    };
    if (transitionBg) transitionBg.style.display = 'none';
    if (window.__hefangLoaderComplete || !document.documentElement.classList.contains('hefang-loader-active')) {
        finishHomePageIntro();
    } else {
        window.addEventListener('hefang:loader-complete', finishHomePageIntro, { once: true });
    }
    hefangHomeCoreReady = true;
    trySignalHefangPageReady();
});

const loadHefang3DEngine = () => {
    return new Promise((resolve) => {
        if (window.THREE && window.THREE.GLTFLoader) return resolve(true);
        const coreScript = document.createElement('script');
        coreScript.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        coreScript.onload = () => {
            const extScript = document.createElement('script');
            extScript.src = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/js/loaders/GLTFLoader.js";
            extScript.onload = () => resolve(Boolean(window.THREE && window.THREE.GLTFLoader));
            extScript.onerror = () => resolve(false);
            document.head.appendChild(extScript);
        };
        coreScript.onerror = () => resolve(false);
        document.head.appendChild(coreScript);
    });
};

function runHefang3DStage() {
    const stage = document.getElementById('hero-interactive-stage');
    if (!stage) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 1000);
    camera.position.z = 5.5;

    const isMobileViewport = hefangLowPowerViewport();
    const reduceRuntimeMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobileViewport,
        powerPreference: isMobileViewport ? 'low-power' : 'high-performance'
    });
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileViewport ? 1 : 1.6));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.physicallyCorrectLights = true;
    stage.appendChild(renderer.domElement);
    const studioCanvas = document.createElement('canvas');
    studioCanvas.width = 1024;
    studioCanvas.height = 512;
    const studioContext = studioCanvas.getContext('2d');
    const studioGradient = studioContext.createLinearGradient(0, 0, 0, studioCanvas.height);
    studioGradient.addColorStop(0, '#f7f3e9');
    studioGradient.addColorStop(0.34, '#8f9886');
    studioGradient.addColorStop(0.62, '#2b302b');
    studioGradient.addColorStop(1, '#d9cdb7');
    studioContext.fillStyle = studioGradient;
    studioContext.fillRect(0, 0, studioCanvas.width, studioCanvas.height);
    studioContext.fillStyle = 'rgba(255,255,255,0.96)';
    studioContext.fillRect(72, 42, 104, 418);
    studioContext.fillRect(742, 24, 142, 444);
    studioContext.fillStyle = 'rgba(255,213,142,0.78)';
    studioContext.fillRect(390, 70, 88, 368);
    const studioTexture = new THREE.CanvasTexture(studioCanvas);
    studioTexture.encoding = THREE.sRGBEncoding;
    studioTexture.mapping = THREE.EquirectangularReflectionMapping;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const studioEnvironment = pmremGenerator.fromEquirectangular(studioTexture);
    scene.environment = studioEnvironment.texture;
    studioTexture.dispose();
    pmremGenerator.dispose();
    const metalCanvas = document.createElement('canvas');
    metalCanvas.width = 256;
    metalCanvas.height = 256;
    const metalContext = metalCanvas.getContext('2d');
    const metalImage = metalContext.createImageData(256, 256);
    for (let y = 0; y < 256; y += 1) {
        const band = 158 + Math.sin(y * 0.72) * 18 + Math.sin(y * 2.35) * 7;
        for (let x = 0; x < 256; x += 1) {
            const noise = (Math.random() - 0.5) * 9;
            const value = Math.max(82, Math.min(218, band + noise));
            const index = (y * 256 + x) * 4;
            metalImage.data[index] = value;
            metalImage.data[index + 1] = value;
            metalImage.data[index + 2] = value;
            metalImage.data[index + 3] = 255;
        }
    }
    metalContext.putImageData(metalImage, 0, 0);
    const brushedMetalTexture = new THREE.CanvasTexture(metalCanvas);
    brushedMetalTexture.wrapS = THREE.RepeatWrapping;
    brushedMetalTexture.wrapT = THREE.RepeatWrapping;
    brushedMetalTexture.repeat.set(2.2, 7.5);
    brushedMetalTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    brushedMetalTexture.needsUpdate = true;
    scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.92);
    keyLight.position.set(6, 12, 8);
    scene.add(keyLight);

    const backLight = new THREE.DirectionalLight(0x879A73, 0.32);
    backLight.position.set(-6, -3, 3);
    scene.add(backLight);

    const warmFillLight = new THREE.DirectionalLight(0xffc86a, 0.24);
    warmFillLight.position.set(-4, 3, 7);
    scene.add(warmFillLight);
    const bottleBaseGroup = new THREE.Group();
    bottleBaseGroup.position.set(0, 0, 0);
    scene.add(bottleBaseGroup);

    const bottleInteractionGroup = new THREE.Group();
    bottleBaseGroup.add(bottleInteractionGroup);

    let model = null;
    let modelFloatBaseY = 0;
    let bottleRenderOccluded = false;
    const loader = new THREE.GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const configureLabelTexture = (texture, flipY) => {
        texture.encoding = THREE.sRGBEncoding;
        texture.flipY = flipY;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.premultiplyAlpha = false;
        texture.needsUpdate = true;
        return texture;
    };
    const pearAppleLabelForPlane = configureLabelTexture(
        textureLoader.load('images/crisp-pear-label-new.png'),
        true
    );

    const srgbToLinearColor = (hex) => {
        const color = new THREE.Color(hex);
        if (typeof color.convertSRGBToLinear === 'function') color.convertSRGBToLinear();
        return color;
    };
    const createPearAppleLiquidMaterial = () => {
        const material = new THREE.MeshPhysicalMaterial({
            color: srgbToLinearColor(0xeba51b),
            roughness: 0.18,
            metalness: 0,
            transparent: false,
            opacity: 1,
            transmission: 0.055,
            ior: 1.34,
            thickness: 0.58,
            attenuationColor: srgbToLinearColor(0xf2b52c),
            attenuationDistance: 1.35,
            clearcoat: 0.10,
            clearcoatRoughness: 0.24,
            depthWrite: true,
            depthTest: true,
            side: THREE.FrontSide
        });
        material.emissive = srgbToLinearColor(0x241000);
        material.emissiveIntensity = 0.045;
        material.toneMapped = true;
        return material;
    };

    const createClearGlassMaterial = () => {
        const material = new THREE.MeshPhysicalMaterial({
            color: srgbToLinearColor(0xffffff),
            roughness: 0.075,
            metalness: 0,
            transparent: true,
            opacity: 1,
            transmission: 0.965,
            ior: 1.49,
            thickness: 0.18,
            attenuationColor: srgbToLinearColor(0xfff6e8),
            attenuationDistance: 10,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            reflectivity: 0.74,
            envMapIntensity: 1.65,
            depthWrite: false,
            depthTest: true,
            side: THREE.FrontSide
        });
        material.toneMapped = true;
        return material;
    };

    const createBrushedCapMaterial = () => {
        const material = new THREE.MeshPhysicalMaterial({
            color: srgbToLinearColor(0xe5e1d7),
            roughness: 0.23,
            roughnessMap: brushedMetalTexture,
            bumpMap: brushedMetalTexture,
            bumpScale: 0.012,
            metalness: 0.94,
            clearcoat: 0.34,
            clearcoatRoughness: 0.13,
            envMapIntensity: 1.9,
            side: THREE.FrontSide
        });
        material.toneMapped = true;
        return material;
    };
    const createLabelPrintMaterial = (texture) => {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uLabel: { value: texture },
                uCutoff: { value: 0.30 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform sampler2D uLabel;
                uniform float uCutoff;
                varying vec2 vUv;
                void main() {
                    float labelAlpha = texture2D(uLabel, vUv).a;
                    if (labelAlpha < uCutoff) discard;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
                }
            `,
            transparent: false,
            depthWrite: false,
            depthTest: false,
            side: THREE.FrontSide,
            blending: THREE.NoBlending
        });
        material.toneMapped = false;
        return material;
    };

    const createRoundedLiquidBody = (glassMeshes, fallbackBox) => {
        const glassBox = new THREE.Box3();
        let hasGlassBounds = false;
        glassMeshes.forEach((mesh) => {
            const meshBox = new THREE.Box3().setFromObject(mesh);
            if (meshBox.isEmpty()) return;
            if (!hasGlassBounds) {
                glassBox.copy(meshBox);
                hasGlassBounds = true;
            } else {
                glassBox.union(meshBox);
            }
        });
        if (!hasGlassBounds) glassBox.copy(fallbackBox);

        const glassSize = glassBox.getSize(new THREE.Vector3());
        const glassCenter = glassBox.getCenter(new THREE.Vector3());
        const width = glassSize.x * 0.80;
        const height = glassSize.y * 0.70;
        const depth = glassSize.z * 0.70;
        const radius = Math.min(width * 0.12, height * 0.055);
        if (width <= 0 || height <= 0 || depth <= 0) return null;

        const shape = new THREE.Shape();
        const left = -width / 2;
        const right = width / 2;
        const bottom = -height / 2;
        const top = height / 2;
        shape.moveTo(left + radius, bottom);
        shape.lineTo(right - radius, bottom);
        shape.quadraticCurveTo(right, bottom, right, bottom + radius);
        shape.lineTo(right, top - radius);
        shape.quadraticCurveTo(right, top, right - radius, top);
        shape.lineTo(left + radius, top);
        shape.quadraticCurveTo(left, top, left, top - radius);
        shape.lineTo(left, bottom + radius);
        shape.quadraticCurveTo(left, bottom, left + radius, bottom);

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth,
            steps: 1,
            curveSegments: 20,
            bevelEnabled: true,
            bevelSegments: 5,
            bevelSize: Math.min(radius * 0.34, depth * 0.08),
            bevelThickness: Math.min(radius * 0.28, depth * 0.07)
        });
        geometry.translate(0, 0, -depth / 2);
        geometry.computeVertexNormals();

        const liquidBody = new THREE.Mesh(geometry, createPearAppleLiquidMaterial());
        liquidBody.name = 'HEFANG_Runtime_Smooth_PearApple_Liquid';
        liquidBody.position.set(
            glassCenter.x,
            glassBox.min.y + glassSize.y * 0.43,
            glassCenter.z
        );
        liquidBody.renderOrder = 1;
        liquidBody.frustumCulled = false;
        return liquidBody;
    };

    loader.load('images/Hefangbottle.glb', (gltf) => {
        model = gltf.scene;
        model.position.set(0, 0, 0);

        const glassMeshes = [];
        const liquidMeshes = [];
        const capMeshes = [];
        const unclassifiedMeshes = [];
        const originalLabelMeshes = [];

        model.traverse((child) => {
            if (!child.isMesh) return;

            const materialNames = Array.isArray(child.material)
                ? child.material.map((material) => material?.name || '').join(' ')
                : (child.material?.name || '');
            const meshName = `${child.name || ''} ${materialNames}`;
            const meshKey = meshName.toLowerCase();
            child.frustumCulled = false;

            const isLabel = /label|print|decal|sticker|artwork|graphic/.test(meshKey);
            const isCap = /cap|lid|closure|metal|aluminium|aluminum/.test(meshKey);
            const isLiquid = /liquid|tea|drink|juice|water|beverage|content|inside|fill/.test(meshKey);
            const isGlass = /glass|bottle|container|body|flask/.test(meshKey) && !isCap && !isLabel && !isLiquid;

            if (isLabel) {
                child.visible = false;
                originalLabelMeshes.push(child);
                return;
            }

            if (isCap) {
                capMeshes.push(child);
                child.material = Array.isArray(child.material)
                    ? child.material.map(() => createBrushedCapMaterial())
                    : createBrushedCapMaterial();
                child.renderOrder = 5;
                return;
            }

            if (isLiquid) {
                liquidMeshes.push(child);
                child.material = Array.isArray(child.material)
                    ? child.material.map(() => createPearAppleLiquidMaterial())
                    : createPearAppleLiquidMaterial();
                child.renderOrder = 1;
                return;
            }

            if (isGlass) {
                glassMeshes.push(child);
                child.material = Array.isArray(child.material)
                    ? child.material.map(() => createClearGlassMaterial())
                    : createClearGlassMaterial();
                child.renderOrder = 3;
                return;
            }

            unclassifiedMeshes.push(child);
        });

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        if (liquidMeshes.length === 0 && glassMeshes.length > 0) {
            const runtimeLiquid = createRoundedLiquidBody(glassMeshes, box);
            if (runtimeLiquid) {
                model.add(runtimeLiquid);
                liquidMeshes.push(runtimeLiquid);
            }
        }
        if (capMeshes.length === 0) {
            unclassifiedMeshes.forEach((candidate) => {
                const candidateBox = new THREE.Box3().setFromObject(candidate);
                const candidateCenter = candidateBox.getCenter(new THREE.Vector3());
                if (candidateCenter.y < box.max.y - size.y * 0.22) return;
                candidate.material = Array.isArray(candidate.material)
                    ? candidate.material.map(() => createBrushedCapMaterial())
                    : createBrushedCapMaterial();
                candidate.renderOrder = 5;
                capMeshes.push(candidate);
            });
        }
        const labelWidthScale = 837 / 844;
        const labelHeightScale = 2099 / 2047;
        let runtimeLabelApplied = false;
        originalLabelMeshes.forEach((labelMesh) => {
            if (!labelMesh.geometry) return;
            labelMesh.geometry.computeBoundingBox();
            const labelBounds = labelMesh.geometry.boundingBox;
            if (!labelBounds) return;

            const localSize = labelBounds.getSize(new THREE.Vector3());
            const labelArtworkAspect = 837 / 2099;
            const cleanHeight = localSize.y * labelHeightScale;
            const cleanWidth = Math.min(
                localSize.x * 0.94 * labelWidthScale,
                cleanHeight * labelArtworkAspect
            );
            const cleanGeometry = new THREE.PlaneGeometry(cleanWidth, cleanHeight, 1, 1);
            cleanGeometry.translate(
                0,
                -cleanHeight * 0.035,
                Math.max(cleanHeight * 0.0036, 0.12)
            );

            if (labelMesh.geometry && typeof labelMesh.geometry.dispose === 'function') {
                labelMesh.geometry.dispose();
            }
            labelMesh.geometry = cleanGeometry;
            labelMesh.material = createLabelPrintMaterial(pearAppleLabelForPlane);
            labelMesh.visible = true;
            labelMesh.renderOrder = 50;
            labelMesh.frustumCulled = false;
            runtimeLabelApplied = true;
        });
        if (!runtimeLabelApplied) {
            const labelArtworkAspect = 837 / 2099;
            let labelHeight = size.y * 0.66 * labelHeightScale;
            let labelWidth = labelHeight * labelArtworkAspect;
            const maximumLabelWidth = size.x * 0.60 * labelWidthScale;
            if (labelWidth > maximumLabelWidth) {
                labelWidth = maximumLabelWidth;
                labelHeight = labelWidth / labelArtworkAspect;
            }

            const labelGeometry = new THREE.PlaneGeometry(labelWidth, labelHeight, 1, 1);
            labelGeometry.translate(0, -labelHeight * 0.035, 0);
            const pearAppleLabelPlane = new THREE.Mesh(
                labelGeometry,
                createLabelPrintMaterial(pearAppleLabelForPlane)
            );
            pearAppleLabelPlane.name = 'HEFANG_PearApple_Label_Runtime_Fallback';
            pearAppleLabelPlane.position.set(
                center.x,
                center.y,
                box.max.z + Math.max(size.z * 0.018, 0.0025)
            );
            pearAppleLabelPlane.renderOrder = 50;
            pearAppleLabelPlane.frustumCulled = false;
            model.add(pearAppleLabelPlane);
        }

        const targetHeight = hefangCompactLayout() ? 3.05 : 3.28;
        const modelScale = targetHeight / Math.max(size.y, 0.001);
        model.scale.setScalar(modelScale);
        model.position.set(-center.x * modelScale, -center.y * modelScale, -center.z * modelScale);
        modelFloatBaseY = model.position.y;

        bottleInteractionGroup.add(model);
        if (window.gsap) {
            const heroVideoLayer = document.querySelector('.hero-video-wrapper');
            const heroVideoMedia = document.querySelector('.hero-bg-media');
            const teaTransition = document.querySelector('.hero-tea-transition');
            const teaVideoScene = document.querySelector('.hero-tea-video-scene');
            const bottomLeafSeam = document.querySelector('.hero-leaf-seam-bottom');
            const leafBanks = gsap.utils.toArray('.hero-leaf-bank-parallax');
            const teaVideoMedia = document.querySelector('.hero-tea-video-media');
            const storyBackground = document.querySelector('.hero-story-background');
            const heroCopy = document.querySelector('.hero-text-container-new');
            const getTeaTransitionY = (phase) => {
                if (!teaTransition) return 0;
                const parentRect = teaTransition.getBoundingClientRect();

                if (phase === 'reveal' && teaVideoScene) {
                    const videoRect = teaVideoScene.getBoundingClientRect();
                    return parentRect.top - videoRect.top;
                }

                if (phase === 'exit' && bottomLeafSeam) {
                    const bottomRect = bottomLeafSeam.getBoundingClientRect();
                    const safetyGap = Math.max(28, window.innerHeight * 0.045);
                    return parentRect.top - bottomRect.bottom - safetyGap;
                }

                return -window.innerHeight;
            };
            const mediaState = new WeakMap();
            const setVideoPlayback = (video, shouldPlay) => {
                const nextPlayback = reduceRuntimeMotion ? false : shouldPlay;
                if (!video || mediaState.get(video) === nextPlayback) return;
                mediaState.set(video, nextPlayback);
                video.muted = true;
                if (nextPlayback) {
                    const playPromise = video.play();
                    if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
                } else {
                    video.pause();
                }
            };
            setVideoPlayback(heroVideoMedia, Boolean(window.__hefangLoaderComplete));
            setVideoPlayback(teaVideoMedia, false);

            renderer.domElement.style.opacity = 0;
            renderer.domElement.style.filter = 'blur(12px)';
            let heroIntroComplete = false;
            let heroHasResetAtAbsoluteTop = false;

            const resetHeroToIntro = () => {
                bottleBaseGroup.position.set(0, 0, 0);
                bottleBaseGroup.rotation.set(0, 0, 0);
                bottleBaseGroup.scale.set(1, 1, 1);

                if (heroVideoLayer) gsap.set(heroVideoLayer, { yPercent: 0, scale: 1, autoAlpha: 1 });
                if (teaTransition && heroIntroComplete) gsap.set(teaTransition, { y: 0, autoAlpha: 1 });
                if (storyBackground) gsap.set(storyBackground, { yPercent: 0, autoAlpha: 1 });
                if (heroCopy) gsap.set(heroCopy, {
                    x: hefangCompactLayout() ? 0 : 80,
                    y: hefangCompactLayout() ? 34 : 0,
                    autoAlpha: 0
                });
            };

            resetHeroToIntro();

            const buildScrollStory = () => {
                if (typeof ScrollTrigger === 'undefined') return;

                gsap.registerPlugin(ScrollTrigger);

                const storyTimeline = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '#scrolly-track',
                        start: 'top top',
                        end: () => `+=${Math.round(window.innerHeight * 4.8)}`,
                        pin: true,
                        scrub: 1,
                        pinType: 'fixed',
                        anticipatePin: 2,
                        invalidateOnRefresh: true,
                        onUpdate: (self) => {
                            const progress = self.progress;
                            hefangStoryProgress = progress;
                            updateHefangNavTheme();
                            if (progress > 0.004) heroHasResetAtAbsoluteTop = false;
                            if (heroIntroComplete && progress <= 0.0015 && !heroHasResetAtAbsoluteTop) {
                                heroHasResetAtAbsoluteTop = true;
                                resetHeroToIntro();
                            }

                            const rootedBoundaryActive = progress >= 0.72;
                            document.getElementById('scrolly-track')?.classList.toggle('is-rooted-boundary', rootedBoundaryActive);
                            setVideoPlayback(heroVideoMedia, progress < 0.36);
                            setVideoPlayback(teaVideoMedia, progress > 0.025 && progress < 0.82);
                            bottleRenderOccluded = progress > 0.31 && progress < 0.58;
                            stage.classList.toggle('is-bottle-occluded', bottleRenderOccluded);
                        },
                        onEnterBack: (self) => {
                            document.getElementById('scrolly-track')?.classList.add('is-rooted-boundary');
                            requestAnimationFrame(() => {
                                self.update();
                                updateHefangNavTheme();
                            });
                        },
                        onLeave: () => {
                            document.getElementById('scrolly-track')?.classList.add('is-rooted-boundary');
                            setVideoPlayback(heroVideoMedia, false);
                            setVideoPlayback(teaVideoMedia, false);
                            bottleRenderOccluded = false;
                            stage.classList.remove('is-bottle-occluded');
                        }
                    }
                });
                storyTimeline
                    .addLabel('leafRise', 0)
                    .to(bottleBaseGroup.position, {
                        x: () => hefangCompactLayout() ? 0.02 : 0.10,
                        y: () => hefangCompactLayout() ? -1.18 : -1.30,
                        z: 0.04,
                        duration: 1.14,
                        ease: 'power2.inOut'
                    }, 'leafRise')
                    .to(bottleBaseGroup.rotation, {
                        x: 0.045,
                        y: 0.56,
                        z: 0.055,
                        duration: 1.14,
                        ease: 'power2.inOut'
                    }, 'leafRise');

                if (heroVideoLayer) {
                    storyTimeline.to(heroVideoLayer, { scale: 1.035, duration: 1.16 }, 'leafRise');
                }
                if (teaTransition) {
                    storyTimeline.to(teaTransition, {
                        y: () => getTeaTransitionY('reveal'),
                        duration: 1.34,
                        ease: 'power2.inOut'
                    }, 0.20);
                }
                if (leafBanks[0]) {
                    storyTimeline.to(leafBanks[0], { xPercent: -0.8, yPercent: -2.2, rotation: -0.25, duration: 1.20, ease: 'power1.out' }, 0.16);
                }
                if (leafBanks[1]) {
                    storyTimeline.to(leafBanks[1], { xPercent: 0.7, yPercent: 1.2, rotation: 0.22, duration: 1.20, ease: 'power1.out' }, 0.16);
                }
                storyTimeline
                    .to(bottleBaseGroup.position, {
                        x: () => hefangCompactLayout() ? -0.02 : -0.12,
                        y: () => hefangCompactLayout() ? -1.72 : -1.88,
                        z: 0,
                        duration: 0.62,
                        ease: 'power2.in'
                    }, 0.72)
                    .to(bottleBaseGroup.rotation, {
                        x: -0.025,
                        y: 0.72,
                        z: 0.045,
                        duration: 0.62,
                        ease: 'power2.in'
                    }, 0.72)
                    .set(bottleBaseGroup.position, {
                        x: () => hefangCompactLayout() ? 0 : -0.42,
                        y: () => hefangCompactLayout() ? -2.35 : -2.18,
                        z: 0
                    }, 1.60)
                    .set(bottleBaseGroup.rotation, { x: 0.03, y: -0.34, z: -0.04 }, 1.60)
                    .set(bottleBaseGroup.scale, { x: 1, y: 1, z: 1 }, 1.60);
                storyTimeline.to({}, { duration: 0.66 }, 1.62);
                storyTimeline.addLabel('leaveDense', 2.28);
                if (teaTransition) {
                    storyTimeline.to(teaTransition, {
                        y: () => getTeaTransitionY('exit'),
                        duration: 1.52,
                        ease: 'power2.inOut'
                    }, 'leaveDense');
                }
                if (heroVideoLayer) {
                    storyTimeline.to(heroVideoLayer, {
                        yPercent: -100,
                        autoAlpha: 0,
                        duration: 1.14,
                        ease: 'power2.inOut'
                    }, 'leaveDense');
                }
                storyTimeline
                    .to(bottleBaseGroup.position, {
                        x: () => hefangCompactLayout() ? 0 : -1.66,
                        y: () => hefangCompactLayout() ? -0.64 : -0.04,
                        z: 0,
                        duration: 1.16,
                        ease: 'power3.out'
                    }, 2.88)
                    .to(bottleBaseGroup.rotation, {
                        x: 0,
                        y: 0.55,
                        z: 0,
                        duration: 1.16,
                        ease: 'power2.out'
                    }, 2.88)
                    .to(bottleBaseGroup.scale, { x: 1, y: 1, z: 1, duration: 1.16 }, 2.88);

                if (heroCopy) {
                    storyTimeline.to(heroCopy, {
                        x: 0,
                        y: 0,
                        autoAlpha: 1,
                        duration: 0.68,
                        ease: 'power2.out'
                    }, 3.34);
                }

                storyTimeline.to({}, { duration: 0.82 }, 4.02);

                requestAnimationFrame(() => {
                    const pinSpacer = storyTimeline.scrollTrigger?.pin?.parentElement;
                    if (pinSpacer) pinSpacer.classList.add('hefang-story-pin-spacer');
                });

                ScrollTrigger.refresh();
                return storyTimeline;
            };
            const storyTimeline = buildScrollStory();
            const introScrollThreshold = Math.max(24, window.innerHeight * 0.04);
            const shouldPlayHeroIntro = !reduceRuntimeMotion
                && !window.__hefangSkipHeroIntro
                && window.scrollY <= introScrollThreshold
                && (!storyTimeline || !storyTimeline.scrollTrigger
                    || storyTimeline.scrollTrigger.progress <= 0.012);

            if (!shouldPlayHeroIntro) {
                heroIntroComplete = true;
                renderer.domElement.style.transition = 'none';
                renderer.domElement.style.opacity = 1;
                renderer.domElement.style.filter = 'none';
                stage.classList.add('is-ready');
                signalHefangHeroRuntimeReady();
                unlockHefangHeroScroll();
                requestAnimationFrame(() => {
                    if (storyTimeline && storyTimeline.scrollTrigger) {
                        storyTimeline.scrollTrigger.update();
                    }
                });
            } else {
                const introDepth = 3.72;
                const introScaleValue = hefangCompactLayout() ? 1.82 : 2.18;
                const distanceToCamera = Math.max(0.1, camera.position.z - introDepth);
                const verticalHalfView = Math.tan(
                    THREE.MathUtils.degToRad(camera.fov * 0.5)
                ) * distanceToCamera;
                const horizontalHalfView = verticalHalfView * camera.aspect;
                const modelWidth = size.x * modelScale;
                const modelHeight = size.y * modelScale;
                const modelDepth = size.z * modelScale;
                const projectedHalfWidth = Math.max(modelWidth, modelDepth)
                    * introScaleValue * 0.58;
                const projectedHalfHeight = modelHeight
                    * introScaleValue * 0.54;
                const horizontalMargin = hefangCompactLayout() ? 0.72 : 1.06;
                const verticalMargin = hefangCompactLayout() ? 0.56 : 0.82;
                const introStartX = horizontalHalfView
                    + projectedHalfWidth
                    + horizontalMargin;
                const introStartY = -(
                    verticalHalfView
                    + projectedHalfHeight
                    + verticalMargin
                );
                gsap.set(bottleBaseGroup.position, {
                    x: introStartX,
                    y: introStartY,
                    z: introDepth
                });
                gsap.set(bottleBaseGroup.rotation, {
                    x: 0.80,
                    y: Math.PI * 2.5,
                    z: -0.60
                });
                gsap.set(bottleBaseGroup.scale, {
                    x: introScaleValue,
                    y: introScaleValue,
                    z: introScaleValue
                });

                renderer.domElement.style.transition = 'none';
                gsap.set(renderer.domElement, {
                    opacity: 0,
                    filter: 'blur(14px) brightness(1.26)'
                });
                let rendererPrepared = false;
                const prepareRenderer = () => {
                    if (rendererPrepared) return;
                    rendererPrepared = true;
                    if (typeof renderer.compile === 'function') renderer.compile(scene, camera);
                    renderer.render(scene, camera);
                    stage.classList.add('is-ready');
                    signalHefangHeroRuntimeReady();
                };
                if (window.__hefangLoaderCovered || window.__hefangLoaderComplete) {
                    prepareRenderer();
                } else {
                    window.addEventListener('hefang:loader-covered', prepareRenderer, { once: true });
                }

                const introTimeline = gsap.timeline({
                    paused: true,
                    onComplete: () => {
                        heroIntroComplete = true;
                        renderer.domElement.style.filter = 'none';
                        unlockHefangHeroScroll();
                        if (storyTimeline && storyTimeline.scrollTrigger) {
                            storyTimeline.scrollTrigger.update();
                        }
                    }
                });
                gsap.set(keyLight, { intensity: 1.80 });
                gsap.set(backLight, { intensity: 0.78 });
                gsap.set(warmFillLight, { intensity: 0.80 });

                introTimeline
                    .to(bottleBaseGroup.position, {
                        x: 0,
                        y: 0,
                        z: 0,
                        duration: 2.40,
                        ease: 'expo.out'
                    }, 0)
                    .to(bottleBaseGroup.rotation, {
                        x: 0,
                        y: 0,
                        z: 0,
                        duration: 2.80,
                        ease: 'power4.out'
                    }, 0)
                    .to(bottleBaseGroup.scale, {
                        x: 1,
                        y: 1,
                        z: 1,
                        duration: 2.40,
                        ease: 'expo.out'
                    }, 0)
                    .to(renderer.domElement, {
                        opacity: 1,
                        filter: 'blur(0px) brightness(1)',
                        duration: 1.20,
                        ease: 'power2.out'
                    }, 0.10)
                    .to(keyLight, {
                        intensity: 0.92,
                        duration: 2.00,
                        ease: 'power2.out'
                    }, 0.50)
                    .to(backLight, {
                        intensity: 0.45,
                        duration: 2.00,
                        ease: 'power2.out'
                    }, 0.50)
                    .to(warmFillLight, {
                        intensity: 0.24,
                        duration: 2.00,
                        ease: 'power2.out'
                    }, 0.50);

                let introStarted = false;
                const startHeroIntro = () => {
                    if (introStarted) return;
                    introStarted = true;
                    requestAnimationFrame(() => {
                        window.setTimeout(() => {
                            setVideoPlayback(heroVideoMedia, true);
                            introTimeline.play(0);
                        }, 140);
                    });
                };
                if (window.__hefangLoaderComplete) {
                    startHeroIntro();
                } else {
                    window.addEventListener('hefang:loader-complete', startHeroIntro, { once: true });
                }
            }
        } else {
            renderer.domElement.style.opacity = 1;
            const teaTransition = document.querySelector('.hero-tea-transition');
            const storyBackground = document.querySelector('.hero-story-background');
            const heroCopy = document.querySelector('.hero-text-container-new');
            if (teaTransition) teaTransition.style.display = 'none';
            if (storyBackground) storyBackground.style.transform = 'translateY(0)';
            if (heroCopy) {
                heroCopy.style.opacity = 1;
                heroCopy.style.visibility = 'visible';
                heroCopy.style.transform = 'translateY(-50%) translateX(0)';
            }
            signalHefangHeroRuntimeReady();
            unlockHefangHeroScroll();
        }
    }, undefined, () => {
        stage.classList.add('stage-fallback');
        const teaTransition = document.querySelector('.hero-tea-transition');
        const storyBackground = document.querySelector('.hero-story-background');
        const heroCopy = document.querySelector('.hero-text-container-new');
        if (teaTransition) teaTransition.style.display = 'none';
        if (storyBackground) storyBackground.style.transform = 'translateY(0)';
        if (heroCopy) {
            heroCopy.style.opacity = 1;
            heroCopy.style.visibility = 'visible';
            heroCopy.style.transform = 'translateY(-50%) translateX(0)';
        }
        signalHefangHeroRuntimeReady();
        unlockHefangHeroScroll();
    });
    const dragRotation = {
        active: false,
        yaw: 0,
        pitch: 0,
        lastX: 0,
        lastY: 0,
        pointerId: null,
        returnTween: null
    };
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const canvas = renderer.domElement;
    const bottleBaseCameraZ = camera.position.z;
    const bottleMaxPitch = 0.72;

    if (hasFinePointer) {
        canvas.addEventListener('pointerdown', (e) => {
            if (bottleRenderOccluded || !model || e.button !== 0) return;
            if (dragRotation.returnTween) {
                dragRotation.returnTween.kill();
                dragRotation.returnTween = null;
            }
            dragRotation.active = true;
            dragRotation.pointerId = e.pointerId;
            dragRotation.lastX = e.clientX;
            dragRotation.lastY = e.clientY;
            stage.classList.add('is-dragging');
            canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!dragRotation.active || e.pointerId !== dragRotation.pointerId) return;
            const dx = e.clientX - dragRotation.lastX;
            const dy = e.clientY - dragRotation.lastY;
            dragRotation.lastX = e.clientX;
            dragRotation.lastY = e.clientY;
            dragRotation.yaw += dx * 0.0062;
            dragRotation.pitch = THREE.MathUtils.clamp(
                dragRotation.pitch + dy * 0.0038,
                -bottleMaxPitch,
                bottleMaxPitch
            );
            e.preventDefault();
        });

        const finishBottleDrag = (e) => {
            if (!dragRotation.active) return;
            if (e && dragRotation.pointerId !== null && e.pointerId !== dragRotation.pointerId) return;

            dragRotation.active = false;
            stage.classList.remove('is-dragging');
            if (dragRotation.pointerId !== null && canvas.hasPointerCapture(dragRotation.pointerId)) {
                canvas.releasePointerCapture(dragRotation.pointerId);
            }
            dragRotation.pointerId = null;
            const fullTurn = Math.PI * 2;
            const nearestFrontYaw = Math.round(dragRotation.yaw / fullTurn) * fullTurn;
            if (window.gsap) {
                dragRotation.returnTween = gsap.to(dragRotation, {
                    yaw: nearestFrontYaw,
                    pitch: 0,
                    duration: 0.92,
                    ease: 'power3.out',
                    overwrite: true,
                    onComplete: () => {
                        dragRotation.yaw = 0;
                        dragRotation.pitch = 0;
                        dragRotation.returnTween = null;
                    }
                });
            } else {
                dragRotation.yaw = 0;
                dragRotation.pitch = 0;
            }
        };

        canvas.addEventListener('pointerup', finishBottleDrag);
        canvas.addEventListener('pointercancel', finishBottleDrag);
        canvas.addEventListener('lostpointercapture', finishBottleDrag);
    }
    const clock = new THREE.Clock();
    const frameInterval = 1000 / (isMobileViewport ? 30 : 60);
    let lastFrameTime = 0;
    let stageIsVisible = true;
    const stageObserver = new IntersectionObserver((entries) => {
        stageIsVisible = Boolean(entries[0] && entries[0].isIntersecting);
    }, { threshold: 0.01 });
    stageObserver.observe(stage);

    function animate(now = 0) {
        requestAnimationFrame(animate);
        if (!window.__hefangLoaderComplete || window.__hefangTransitionCoverActive || !stageIsVisible || document.hidden || bottleRenderOccluded || now - lastFrameTime < frameInterval) return;
        lastFrameTime = now;

        if (model) {
            const time = clock.getElapsedTime();
            const isReturning = Boolean(dragRotation.returnTween);
            const idlePitch = reduceRuntimeMotion || dragRotation.active || isReturning ? 0 : Math.sin(time * 0.62) * 0.005;
            const idleRoll = reduceRuntimeMotion || dragRotation.active || isReturning ? 0 : Math.sin(time * 0.42) * 0.003;
            const tiltRatio = THREE.MathUtils.clamp(
                Math.abs(dragRotation.pitch) / bottleMaxPitch,
                0,
                1
            );

            bottleInteractionGroup.position.y = (reduceRuntimeMotion ? 0 : Math.sin(time * 1.55) * 0.032)
                + (dragRotation.pitch > 0 ? tiltRatio * 0.055 : 0);
            bottleInteractionGroup.rotation.y = dragRotation.yaw;
            bottleInteractionGroup.rotation.x = dragRotation.pitch + idlePitch;
            bottleInteractionGroup.rotation.z = idleRoll;
            bottleInteractionGroup.scale.setScalar(1 - tiltRatio * 0.045);
            camera.position.z = bottleBaseCameraZ + tiltRatio * 0.20;
        } else {
            camera.position.z = bottleBaseCameraZ;
        }

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = stage.clientWidth / stage.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(stage.clientWidth, stage.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hefangCompactLayout() ? 1 : 1.6));
        if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, { passive: true });
}

const waitForHefangLoaderCovered = () => new Promise((resolve) => {
    if (window.__hefangLoaderCovered || !document.documentElement.classList.contains('hefang-loader-active')) {
        resolve();
        return;
    }
    let resolved = false;
    const finish = () => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('hefang:loader-covered', finish);
        resolve();
    };
    window.addEventListener('hefang:loader-covered', finish, { once: true });
    window.setTimeout(finish, 12000);
});

document.addEventListener("DOMContentLoaded", async () => {
    const stage = document.getElementById('hero-interactive-stage');
    if (!stage) {
        signalHefangHeroRuntimeReady();
        unlockHefangHeroScroll();
        return;
    }

    await waitForHefangLoaderCovered();
    const engineReady = await loadHefang3DEngine();
    if (engineReady) {
        runHefang3DStage();
        return;
    }

    stage.classList.add('stage-fallback');
    const teaTransition = document.querySelector('.hero-tea-transition');
    const storyBackground = document.querySelector('.hero-story-background');
    const heroCopy = document.querySelector('.hero-text-container-new');
    if (teaTransition) teaTransition.style.display = 'none';
    if (storyBackground) storyBackground.style.transform = 'translateY(0)';
    if (heroCopy) {
        heroCopy.style.opacity = 1;
        heroCopy.style.visibility = 'visible';
        heroCopy.style.transform = 'translateY(-50%) translateX(0)';
    }
    signalHefangHeroRuntimeReady();
    unlockHefangHeroScroll();
});

document.addEventListener('DOMContentLoaded', () => {
    const philosophyHeading = document.querySelector('.philosophy-heading');
    const philosophyStage = document.getElementById('philosophy-stage');
    const philosophySection = document.getElementById('philosophy');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (philosophyHeading && philosophyStage && philosophySection && window.gsap) {
        const eyebrow = philosophyHeading.querySelector('.eyebrow-light');
        const titleLines = philosophyHeading.querySelectorAll('.philosophy-title h2 span');
        const summary = philosophyHeading.querySelector('.philosophy-title p');

        if (!reduceMotion && eyebrow && titleLines.length >= 2 && summary) {
            const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
            const range = (value, startAt, endAt) => clamp((value - startAt) / (endAt - startAt));
            let frameRequested = false;

            const renderPhilosophyIntro = () => {
                frameRequested = false;

                const headingRect = philosophyHeading.getBoundingClientRect();
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

                const revealStart = viewportHeight * 0.58;
                const revealEnd = viewportHeight * 0.04;
                const progress = clamp((revealStart - headingRect.top) / (revealStart - revealEnd));

                const eyebrowProgress = range(progress, 0.00, 0.24);
                const firstLineProgress = range(progress, 0.08, 0.52);
                const secondLineProgress = range(progress, 0.26, 0.72);
                const summaryProgress = range(progress, 0.42, 0.74);
                const stageProgress = range(progress, 0.56, 0.86);

                philosophyHeading.classList.toggle('is-entering', progress > 0 && progress < 1);

                gsap.set(eyebrow, {
                    autoAlpha: eyebrowProgress,
                    x: -72 * (1 - eyebrowProgress)
                });

                gsap.set(titleLines[0], {
                    autoAlpha: firstLineProgress,
                    x: -42 * (1 - firstLineProgress),
                    y: 86 * (1 - firstLineProgress),
                    rotationX: -10 * (1 - firstLineProgress),
                    filter: `blur(${7 * (1 - firstLineProgress)}px)`
                });

                gsap.set(titleLines[1], {
                    autoAlpha: secondLineProgress,
                    x: 42 * (1 - secondLineProgress),
                    y: 86 * (1 - secondLineProgress),
                    rotationX: 10 * (1 - secondLineProgress),
                    filter: `blur(${7 * (1 - secondLineProgress)}px)`
                });

                gsap.set(summary, {
                    autoAlpha: summaryProgress,
                    y: 42 * (1 - summaryProgress)
                });

                gsap.set(philosophyStage, {
                    autoAlpha: stageProgress,
                    y: 72 * (1 - stageProgress),
                    scale: 0.98 + 0.02 * stageProgress
                });
            };

            const requestPhilosophyRender = () => {
                if (frameRequested) return;
                frameRequested = true;
                requestAnimationFrame(renderPhilosophyIntro);
            };

            window.addEventListener('scroll', requestPhilosophyRender, { passive: true });
            window.addEventListener('resize', requestPhilosophyRender, { passive: true });
            window.addEventListener('load', requestPhilosophyRender, { once: true });
            requestPhilosophyRender();
        } else {
            gsap.set([eyebrow, titleLines, summary, philosophyStage], {
                clearProps: 'opacity,visibility,transform,clipPath,filter'
            });
        }
    }

    const balanceSlider = document.getElementById('balance-slider');
    const balanceLogo = document.getElementById('balance-morph-logo');
    const balanceStatement = document.getElementById('balance-statement');
    const dividerGrip = document.getElementById('divider-grip');

    if (philosophyStage && balanceSlider && balanceLogo && balanceStatement && dividerGrip) {
        let balance = 50;
        let isDragging = false;
        let queuedClientX = null;
        let pointerFrame = 0;
        let visualMode = '';

        const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
        const smoothStep = (value) => value * value * (3 - 2 * value);

        const setVisualMode = (nextMode) => {
            if (nextMode === visualMode) return;
            visualMode = nextMode;
            philosophyStage.classList.toggle('is-he', nextMode === 'he');
            philosophyStage.classList.toggle('is-fang', nextMode === 'fang');
            philosophyStage.classList.toggle('is-balanced', nextMode === 'balanced');
        };

        const updateBalance = (nextValue, animate = false) => {
            balance = clampValue(Number(nextValue) || 50, 20, 80);
            const distanceFromCenter = Math.abs(balance - 50);
            const centerAmount = smoothStep(1 - clampValue((distanceFromCenter - 1.5) / 8.5, 0, 1));
            const compactSize = hefangCompactLayout() ? 42 : 50;
            const expandedSize = hefangCompactLayout() ? 74 : 88;
            const logoSize = compactSize + (expandedSize - compactSize) * centerAmount;
            const logoTop = 50 - 10.2 * centerAmount;
            const nextMode = balance < 44 ? 'he' : balance > 56 ? 'fang' : centerAmount > 0.48 ? 'balanced' : 'neutral';

            philosophyStage.style.setProperty('--split', `${balance}%`);
            balanceSlider.setAttribute('aria-valuenow', String(Math.round(balance)));
            balanceSlider.setAttribute(
                'aria-valuetext',
                balance < 44 ? 'More HE — harmony and softness' :
                balance > 56 ? 'More FANG — structure and clarity' :
                'Balanced — harmony meets structure'
            );
            setVisualMode(nextMode);

            balanceLogo.style.left = `${balance}%`;
            balanceLogo.style.top = `${logoTop}%`;
            balanceLogo.style.width = `${logoSize}px`;
            balanceLogo.style.height = `${logoSize}px`;
            balanceLogo.style.transform = `translate(-50%, -50%) rotate(${(balance - 50) * 0.16 * (1 - centerAmount)}deg)`;

            balanceStatement.style.opacity = String(centerAmount);
            balanceStatement.style.visibility = centerAmount > 0.01 ? 'visible' : 'hidden';
            balanceStatement.style.transform = `translate(-50%, -50%) translateY(${18 * (1 - centerAmount)}px) scale(${0.96 + 0.04 * centerAmount})`;

            dividerGrip.style.opacity = String(centerAmount);
            dividerGrip.style.transform = `translate(-50%, -50%) scale(${0.72 + 0.28 * centerAmount})`;

            if (animate && typeof gsap !== 'undefined') {
                gsap.fromTo(balanceLogo, { scale: 0.9 }, { scale: 1, duration: 0.42, ease: 'back.out(2)' });
            }
        };

        const renderQueuedPointer = () => {
            pointerFrame = 0;
            if (queuedClientX === null) return;
            const bounds = philosophyStage.getBoundingClientRect();
            const nextBalance = ((queuedClientX - bounds.left) / bounds.width) * 100;
            queuedClientX = null;
            updateBalance(nextBalance);
        };

        const queuePointerUpdate = (event, immediate = false) => {
            const coalesced = typeof event.getCoalescedEvents === 'function'
                ? event.getCoalescedEvents()
                : null;
            const latestEvent = coalesced && coalesced.length
                ? coalesced[coalesced.length - 1]
                : event;
            queuedClientX = latestEvent.clientX;

            if (immediate) {
                if (pointerFrame) cancelAnimationFrame(pointerFrame);
                renderQueuedPointer();
                return;
            }

            if (!pointerFrame) pointerFrame = requestAnimationFrame(renderQueuedPointer);
        };

        philosophyStage.addEventListener('pointermove', (event) => {
            if (event.pointerType === 'mouse' || isDragging) {
                queuePointerUpdate(event);
            }
        }, { passive: true });

        let touchIntent = null;
        balanceSlider.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'touch') {
                touchIntent = { id: event.pointerId, x: event.clientX, y: event.clientY };
                return;
            }
            isDragging = true;
            balanceSlider.setPointerCapture(event.pointerId);
            queuePointerUpdate(event, true);
            event.preventDefault();
        });

        balanceSlider.addEventListener('pointermove', (event) => {
            if (event.pointerType !== 'touch' || !touchIntent || touchIntent.id !== event.pointerId) return;
            const dx = event.clientX - touchIntent.x;
            const dy = event.clientY - touchIntent.y;
            if (!isDragging) {
                if (Math.hypot(dx, dy) < 8) return;
                if (Math.abs(dy) >= Math.abs(dx) * 0.9) {
                    touchIntent = null;
                    return;
                }
                isDragging = true;
                balanceSlider.setPointerCapture(event.pointerId);
            }
            event.preventDefault();
            queuePointerUpdate(event);
        }, { passive: false });

        const stopDragging = (event) => {
            touchIntent = null;
            if (!isDragging) return;
            isDragging = false;
            if (balanceSlider.hasPointerCapture(event.pointerId)) {
                balanceSlider.releasePointerCapture(event.pointerId);
            }
        };

        balanceSlider.addEventListener('pointerup', stopDragging);
        balanceSlider.addEventListener('pointercancel', stopDragging);

        balanceSlider.addEventListener('keydown', (event) => {            if (event.key === 'ArrowLeft') {
                updateBalance(balance - 4, true);
                event.preventDefault();
            }
            if (event.key === 'ArrowRight') {
                updateBalance(balance + 4, true);
                event.preventDefault();
            }
            if (event.key === 'Home') {
                updateBalance(20, true);
                event.preventDefault();
            }
            if (event.key === 'End') {
                updateBalance(80, true);
                event.preventDefault();
            }
        });

        window.addEventListener('resize', () => updateBalance(balance), { passive: true });
        updateBalance(50);
    }

    const philosophyNav = document.querySelector('.pill-nav-container');
    if (philosophyNav) philosophyNav.classList.remove('philosophy-title-clearance');

    const whySection = document.getElementById('why');
    if (whySection) {
        const splitWords = (element, className) => {
            if (!element || element.querySelector(`.${className}`)) return;

            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {
                        return node.nodeValue.trim()
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);

            textNodes.forEach((node) => {
                const fragment = document.createDocumentFragment();

                node.nodeValue.split(/(\s+)/).forEach((part) => {
                    if (!part) return;

                    if (/^\s+$/.test(part)) {
                        fragment.appendChild(document.createTextNode(part));
                        return;
                    }

                    const word = document.createElement('span');
                    word.className = className;
                    word.textContent = part;
                    fragment.appendChild(word);
                });

                node.parentNode.replaceChild(fragment, node);
            });
        };

        const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
        const smoothstep = (value) => {
            const progress = clamp(value);
            return progress * progress * (3 - 2 * progress);
        };
        const range = (value, start, end) => clamp((value - start) / Math.max(0.0001, end - start));
        const presence = (value, enterStart, enterEnd, exitStart, exitEnd) => {
            const enter = smoothstep(range(value, enterStart, enterEnd));
            const exit = 1 - smoothstep(range(value, exitStart, exitEnd));
            return {
                enter,
                visibility: Math.min(enter, exit)
            };
        };

        const heading = whySection.querySelector('[data-why-heading]');
        const headingText = whySection.querySelector('.why-heading-text');
        const headingEyebrow = whySection.querySelector('.why-heading-eyebrow');
        const headingRule = whySection.querySelector('.why-heading-rule');
        const panels = Array.from(whySection.querySelectorAll('[data-why-step]'));

        splitWords(headingText, 'why-heading-word');
        panels.forEach((panel) => splitWords(panel.querySelector('.why-reveal-text'), 'why-reveal-word'));
        whySection.classList.add('why-scroll-ready');

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const compactWhyQuery = window.matchMedia('(max-width: 680px), (max-height: 560px) and (orientation: landscape) and (pointer: coarse)');

        const setWords = (words, reveal, visibility, blurStrength = 9) => {
            const count = Math.max(words.length, 1);

            words.forEach((word, index) => {
                const offset = index / Math.max(count * 2.8, 1);
                const progress = smoothstep((reveal - offset) / Math.max(0.001, 1 - offset));
                const opacity = progress * visibility;
                const blur = (1 - progress) * blurStrength + (1 - visibility) * 3;
                const y = (1 - progress) * 16 + (1 - visibility) * -4;

                word.style.opacity = String(opacity);
                word.style.filter = `blur(${blur}px)`;
                word.style.transform = `translate3d(0, ${y}px, 0)`;
            });
        };

        const setSupport = (element, reveal, visibility, yDistance = 12) => {
            if (!element) return;
            const progress = smoothstep(reveal);
            element.style.opacity = String(progress * visibility);
            element.style.filter = `blur(${(1 - progress) * 7 + (1 - visibility) * 2}px)`;
            element.style.transform = `translate3d(0, ${(1 - progress) * yDistance}px, 0)`;
        };

        const showEverything = () => {
            whySection.querySelectorAll(
                '.why-heading-block, .why-heading-word, .why-reveal-word, .why-copy, .why-heading-eyebrow, .why-heading-rule, .why-panel-kicker, .why-ghost-glyph, .why-final-mark, .why-support-reveal'
            ).forEach((element) => {
                element.style.opacity = '1';
                element.style.filter = 'none';
                element.style.transform = 'none';
            });
        };

        if (reducedMotion) {
            showEverything();
        } else {
            const timings = [
                [0.08, 0.15, 0.27, 0.34],
                [0.27, 0.34, 0.47, 0.54],
                [0.47, 0.54, 0.67, 0.74],
                [0.67, 0.75, 0.96, 1.04]
            ];

            let frame = 0;

            const updateWhyStory = () => {
                frame = 0;
                if (compactWhyQuery.matches) {
                    showEverything();
                    return;
                }
                const rect = whySection.getBoundingClientRect();
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                const scrollable = Math.max(1, rect.height - viewportHeight);
                const progress = clamp(-rect.top / scrollable);

                const headingReveal = smoothstep(range(progress, 0.01, 0.11));
                const headingCompact = smoothstep(range(progress, 0.17, 0.31));
                const headingLateFade = smoothstep(range(progress, 0.78, 0.96));
                const headingVisibility = 1 - headingCompact * 0.38 - headingLateFade * 0.16;
                const headingScale = 1 - headingCompact * 0.29;
                const headingShiftY = (1 - headingReveal) * 16 - headingCompact * 8;

                if (heading && headingText) {
                    const words = Array.from(headingText.querySelectorAll('.why-heading-word'));
                    heading.style.opacity = String(headingVisibility);
                    heading.style.filter = `blur(${(1 - headingReveal) * 2}px)`;
                    heading.style.transform = `translate3d(0, ${headingShiftY}px, 0) rotate(${(1 - headingReveal) * 2.5}deg) scale(${headingScale})`;
                    setWords(words, headingReveal, headingVisibility, 8);
                    setSupport(headingEyebrow, range(progress, 0.01, 0.08), headingVisibility);

                    if (headingRule) {
                        const ruleProgress = smoothstep(range(progress, 0.05, 0.14));
                        const compactRule = 1 - headingCompact * 0.34;
                        headingRule.style.opacity = String(ruleProgress * headingVisibility);
                        headingRule.style.filter = 'none';
                        headingRule.style.transform = `scaleX(${ruleProgress * compactRule})`;
                    }
                }

                panels.forEach((panel, index) => {
                    const copy = panel.querySelector('.why-copy');
                    const text = panel.querySelector('.why-reveal-text');
                    if (!copy || !text) return;

                    const [enterStart, enterEnd, exitStart, exitEnd] = timings[index];
                    const isFinalPanel = index === panels.length - 1;
                    const finalEnter = smoothstep(range(progress, enterStart, enterEnd));
                    const phase = isFinalPanel
                        ? { enter: finalEnter, visibility: finalEnter }
                        : presence(progress, enterStart, enterEnd, exitStart, exitEnd);
                    const exitAmount = isFinalPanel ? 0 : smoothstep(range(progress, exitStart, exitEnd));
                    const words = Array.from(text.querySelectorAll('.why-reveal-word'));
                    const centered = panel.classList.contains('why-panel-opening') || panel.classList.contains('why-panel-final');
                    const x = centered ? '-50%' : '0%';
                    const y = (1 - phase.enter) * 28 - exitAmount * 24;
                    const scale = 0.985 + phase.visibility * 0.015;

                    copy.style.opacity = String(phase.visibility);
                    copy.style.filter = `blur(${(1 - phase.visibility) * 7}px)`;
                    copy.style.transform = `translate3d(${x}, ${y}px, 0) scale(${scale})`;
                    setWords(words, phase.enter, phase.visibility, 9);

                    setSupport(
                        panel.querySelector('.why-panel-kicker'),
                        range(progress, enterStart + 0.015, enterEnd + 0.025),
                        phase.visibility
                    );
                    setSupport(
                        panel.querySelector('.why-final-mark'),
                        range(progress, enterStart + 0.01, enterEnd + 0.03),
                        phase.visibility
                    );
                    setSupport(
                        panel.querySelector('.why-support-reveal'),
                        range(progress, enterStart + 0.035, enterEnd + 0.055),
                        phase.visibility
                    );

                    const glyph = panel.querySelector('.why-ghost-glyph');
                    if (glyph) {
                        const glyphReveal = smoothstep(range(progress, enterStart + 0.015, enterEnd + 0.04));
                        glyph.style.opacity = String(glyphReveal * phase.visibility);
                        glyph.style.filter = `blur(${(1 - glyphReveal) * 18 + (1 - phase.visibility) * 4}px)`;
                        glyph.style.transform = `translate3d(0, ${(1 - glyphReveal) * 22 - exitAmount * 14}px, 0) scale(${0.94 + glyphReveal * 0.06})`;
                    }
                });
            };

            const requestUpdate = () => {
                if (frame) return;
                frame = requestAnimationFrame(updateWhyStory);
            };

            window.addEventListener('scroll', requestUpdate, { passive: true });
            window.addEventListener('resize', requestUpdate, { passive: true });
            window.addEventListener('load', requestUpdate, { once: true });
            requestUpdate();
        }
    }
    const signatureSection = document.getElementById('signature');
    if (signatureSection) {
        const signatureItems = signatureSection.querySelectorAll('[data-signature-reveal]');
        const signatureObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                signatureSection.classList.add('is-visible');
                if (window.gsap) {
                    gsap.fromTo(signatureItems,
                        { autoAlpha: 0, y: 34 },
                        { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.13, ease: 'power3.out', overwrite: true }
                    );
                }
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
        signatureObserver.observe(signatureSection);
    }

    const collectionGateway = document.getElementById('collection');
    const collectionPreviewImage = document.getElementById('collection-preview-image');
    const collectionPreviewNote = document.getElementById('collection-preview-note');
    const collectionPreviewGlyph = document.getElementById('collection-preview-glyph');
    const collectionLinks = collectionGateway?.querySelectorAll('[data-collection-preview]') || [];
    if (collectionGateway && collectionPreviewImage && collectionLinks.length) {
        const showCollectionPreview = (link) => {
            const nextSource = link.dataset.collectionPreview;
            const accent = link.dataset.collectionAccent || 'var(--drink-crisp-accent)';
            const note = link.dataset.collectionNote || '';
            const glyph = link.dataset.collectionGlyph || '';
            if (!nextSource) return;

            collectionGateway.style.setProperty('--collection-accent', accent);
            collectionLinks.forEach((item) => item.classList.toggle('is-active', item === link));

            const applyImage = () => {
                collectionPreviewImage.src = nextSource;
                if (collectionPreviewNote) collectionPreviewNote.textContent = note;
                if (collectionPreviewGlyph) collectionPreviewGlyph.textContent = glyph;
                if (window.gsap) {
                    gsap.fromTo(collectionPreviewImage,
                        { autoAlpha: 0, scale: 0.965, rotation: -0.8 },
                        { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.62, ease: 'power3.out', overwrite: true }
                    );
                    if (collectionPreviewNote) {
                        gsap.fromTo(collectionPreviewNote, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.46, ease: 'power2.out', overwrite: true });
                    }
                    if (collectionPreviewGlyph) {
                        gsap.fromTo(collectionPreviewGlyph, { autoAlpha: 0.35, scale: 0.94, rotation: -2 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.72, ease: 'power3.out', overwrite: true });
                    }
                }
            };

            if (window.gsap) {
                gsap.to(collectionPreviewImage, { autoAlpha: 0, scale: 1.025, duration: 0.18, ease: 'power2.in', overwrite: true, onComplete: applyImage });
            } else {
                applyImage();
            }
        };

        const preloadCollectionImages = () => {
            collectionLinks.forEach((link) => {
                if (!link.dataset.collectionPreview || link.dataset.collectionPreloaded === 'true') return;
                const preload = new Image();
                preload.src = link.dataset.collectionPreview;
                link.dataset.collectionPreloaded = 'true';
            });
        };
        if ('IntersectionObserver' in window) {
            const preloadObserver = new IntersectionObserver((entries, observer) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                preloadCollectionImages();
                observer.disconnect();
            }, { rootMargin: '1200px 0px' });
            preloadObserver.observe(collectionGateway);
        } else {
            preloadCollectionImages();
        }

        collectionLinks.forEach((link) => {
            link.addEventListener('mouseenter', () => showCollectionPreview(link));
            link.addEventListener('focus', () => showCollectionPreview(link));
        });
    }

    updateHefangNavTheme();
    window.addEventListener('scroll', updateHefangNavTheme, { passive: true });
    window.addEventListener('resize', updateHefangNavTheme);

});
