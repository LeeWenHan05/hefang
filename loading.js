(() => {
    'use strict';

    const root = document.documentElement;
    const screen = document.getElementById('hefangLoadingScreen');
    const transition = document.querySelector('.page-transition-liquid');
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
    const easeInOutSine = (value) => -(Math.cos(Math.PI * value) - 1) / 2;
    const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));
    const domReady = document.readyState === 'loading'
        ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
        : Promise.resolve();

    const buildWavePath = ({ width, height, level, amplitudeA, amplitudeB, frequencyA, frequencyB, phaseA, phaseB, segments }) => {
        const points = [];
        for (let index = 0; index <= segments; index += 1) {
            const x = width * index / segments;
            const normalizedX = x / width;
            const y = level
                + Math.sin(normalizedX * Math.PI * 2 * frequencyA + phaseA) * amplitudeA
                + Math.sin(normalizedX * Math.PI * 2 * frequencyB + phaseB) * amplitudeB;
            points.push([x, y]);
        }

        let path = `M 0 ${height} L ${points[0][0]} ${points[0][1]}`;
        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1];
            const current = points[index];
            const midpointX = (previous[0] + current[0]) / 2;
            const midpointY = (previous[1] + current[1]) / 2;
            path += ` Q ${previous[0]} ${previous[1]} ${midpointX} ${midpointY}`;
        }

        const last = points[points.length - 1];
        path += ` Q ${last[0]} ${last[1]} ${last[0]} ${last[1]} L ${width} ${height} Z`;
        return path;
    };

    const setPath = (element, options) => {
        if (element) element.setAttribute('d', buildWavePath(options));
    };

    const renderScreenWave = (paths, level, time) => {
        setPath(paths.body, {
            width: 100,
            height: 100,
            level: level + 3.8,
            amplitudeA: 1.8,
            amplitudeB: 0.9,
            frequencyA: 0.9,
            frequencyB: 1.9,
            phaseA: -time * 0.65 + 0.5,
            phaseB: time * 1.2 + 1.4,
            segments: 20
        });
        setPath(paths.back, {
            width: 100,
            height: 100,
            level: level + 2.2,
            amplitudeA: 2.4,
            amplitudeB: 1.1,
            frequencyA: 0.85,
            frequencyB: 1.8,
            phaseA: -time * 0.72 + 1.1,
            phaseB: time * 1.15 + 2.1,
            segments: 20
        });
        setPath(paths.highlight, {
            width: 100,
            height: 100,
            level: level - 1.4,
            amplitudeA: 1.5,
            amplitudeB: 0.65,
            frequencyA: 1,
            frequencyB: 2.15,
            phaseA: time * 0.95 + 0.7,
            phaseB: -time * 0.9 + 2.7,
            segments: 20
        });
        setPath(paths.front, {
            width: 100,
            height: 100,
            level,
            amplitudeA: 3,
            amplitudeB: 1.25,
            frequencyA: 1,
            frequencyB: 2.25,
            phaseA: time * 1.05,
            phaseB: time * 1.7 + 1.8,
            segments: 20
        });
    };

    const renderLogo = (paths, level, time) => {
        setPath(paths.body, {
            width: 1254,
            height: 1254,
            level: level + 12,
            amplitudeA: 18,
            amplitudeB: 9,
            frequencyA: 1,
            frequencyB: 2.05,
            phaseA: time * 1.2,
            phaseB: time * 2.15 + 0.6,
            segments: 16
        });
        setPath(paths.back, {
            width: 1254,
            height: 1254,
            level: level + 30,
            amplitudeA: 20,
            amplitudeB: 10,
            frequencyA: 0.92,
            frequencyB: 1.9,
            phaseA: -time * 0.8 + 0.5,
            phaseB: time * 1.45 + 1.4,
            segments: 16
        });
        setPath(paths.front, {
            width: 1254,
            height: 1254,
            level,
            amplitudeA: 28,
            amplitudeB: 12,
            frequencyA: 1.1,
            frequencyB: 2.4,
            phaseA: time * 1.55,
            phaseB: time * 2.6 + 1,
            segments: 16
        });
    };

    const animateScreenWave = (paths, fromLevel, toLevel, duration) => new Promise((resolve) => {
        if (reduceMotion || duration <= 0) {
            renderScreenWave(paths, toLevel, 0);
            resolve();
            return;
        }

        const start = performance.now();
        const frame = (now) => {
            const progress = clamp((now - start) / duration, 0, 1);
            const eased = easeInOutSine(progress);
            const level = fromLevel + (toLevel - fromLevel) * eased;
            renderScreenWave(paths, level, (now - start) / 1000);
            if (progress < 1) {
                requestAnimationFrame(frame);
                return;
            }
            resolve();
        };
        requestAnimationFrame(frame);
    });

    const animateLogoFill = (paths, duration) => new Promise((resolve) => {
        if (reduceMotion || duration <= 0) {
            renderLogo(paths, -100, 0);
            resolve();
            return;
        }

        const start = performance.now();
        const frame = (now) => {
            const progress = clamp((now - start) / duration, 0, 1);
            const level = 1260 - 1360 * easeOutCubic(progress);
            renderLogo(paths, level, (now - start) / 1000);
            if (progress < 1) {
                requestAnimationFrame(frame);
                return;
            }
            resolve();
        };
        requestAnimationFrame(frame);
    });

    const createInputLock = () => {
        const prevent = (event) => event.preventDefault();
        const preventKey = (event) => {
            if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) event.preventDefault();
        };
        window.addEventListener('wheel', prevent, { passive: false });
        window.addEventListener('touchmove', prevent, { passive: false });
        window.addEventListener('keydown', preventKey, { passive: false });
        return () => {
            window.removeEventListener('wheel', prevent);
            window.removeEventListener('touchmove', prevent);
            window.removeEventListener('keydown', preventKey);
        };
    };

    if (transition) {
        transition.innerHTML = '<svg class="page-transition-liquid-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path class="page-transition-liquid-body"></path><path class="page-transition-liquid-back"></path><path class="page-transition-liquid-highlight"></path><path class="page-transition-liquid-front"></path></svg>';
        const transitionPaths = {
            body: transition.querySelector('.page-transition-liquid-body'),
            back: transition.querySelector('.page-transition-liquid-back'),
            highlight: transition.querySelector('.page-transition-liquid-highlight'),
            front: transition.querySelector('.page-transition-liquid-front')
        };
        let transitionRunning = false;

        window.HefangLiquidTransition = {
            cover(onComplete) {
                if (transitionRunning) return;
                transitionRunning = true;
                window.__hefangTransitionCoverActive = true;
                window.dispatchEvent(new CustomEvent('hefang:transition-cover-start'));
                transition.style.display = 'block';
                transition.classList.add('is-active');
                const releaseInput = createInputLock();

                const finish = async () => {
                    await wait(reduceMotion ? 120 : 300);
                    transitionRunning = false;
                    releaseInput();
                    if (typeof onComplete === 'function') onComplete();
                };

                if (reduceMotion) {
                    renderScreenWave(transitionPaths, -8, 0);
                    finish();
                    return;
                }

                animateScreenWave(transitionPaths, 108, -8, 1180).then(finish);
            }
        };
    }

    if (!screen) {
        root.classList.remove('hefang-loader-active', 'hefang-transition-entry');
        window.__hefangLoaderComplete = true;
        window.dispatchEvent(new CustomEvent('hefang:loader-complete'));
        return;
    }

    const releaseLoaderInput = createInputLock();
    const mark = screen.querySelector('.hefang-loading-mark');
    const logoPaths = {
        body: document.getElementById('hefangLoadingLogoBody'),
        back: document.getElementById('hefangLoadingLogoBack'),
        front: document.getElementById('hefangLoadingLogoFront')
    };
    const floodPaths = {
        body: document.getElementById('hefangLoadingFloodBody'),
        back: document.getElementById('hefangLoadingFloodBack'),
        highlight: document.getElementById('hefangLoadingFloodHighlight'),
        front: document.getElementById('hefangLoadingFloodFront')
    };
    const enteredViaTransition = Boolean(window.__hefangEnteredViaTransition);
    let pageReady = Boolean(window.__hefangPageReadyForReveal);
    let resolvePageReady = null;
    let finished = false;

    window.__hefangLoaderComplete = false;
    window.__hefangLoaderCovered = false;
    window.__hefangLoaderPhase = enteredViaTransition ? 'cross-entry' : 'direct-loading';

    const pageReadyPromise = new Promise((resolve) => {
        resolvePageReady = resolve;
        if (pageReady) resolve();
    });

    window.addEventListener('hefang:page-ready', () => {
        pageReady = true;
        if (resolvePageReady) resolvePageReady();
    }, { once: true });

    const setPhase = (phase) => {
        window.__hefangLoaderPhase = phase;
        window.__hefangLoaderPhaseStartedAt = performance.now();
        window.dispatchEvent(new CustomEvent('hefang:loader-phase', { detail: { phase } }));
    };

    const markCovered = () => {
        if (window.__hefangLoaderCovered) return;
        window.__hefangLoaderCovered = true;
        setPhase('covered');
        window.dispatchEvent(new CustomEvent('hefang:loader-covered'));
    };

    const waitForPageReady = async () => {
        if (pageReady) return;
        await Promise.race([pageReadyPromise, wait(18000)]);
    };

    const complete = () => {
        if (finished) return;
        finished = true;
        releaseLoaderInput();
        screen.remove();
        root.classList.remove('hefang-loader-active', 'hefang-transition-entry');
        setPhase('complete');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.setTimeout(() => {
                    window.__hefangLoaderComplete = true;
                    window.dispatchEvent(new CustomEvent('hefang:loader-complete'));
                }, 160);
            });
        });
    };

    const run = async () => {
        renderLogo(logoPaths, 1260, 0);
        if (mark) mark.style.visibility = enteredViaTransition ? 'hidden' : 'visible';

        if (reduceMotion) {
            screen.classList.add('is-loader-surface');
            root.classList.remove('hefang-transition-entry');
            if (mark) mark.style.visibility = 'visible';
            renderLogo(logoPaths, -100, 0);
            renderScreenWave(floodPaths, -8, 0);
            markCovered();
            await waitForPageReady();
            screen.classList.add('is-revealing-page');
            renderScreenWave(floodPaths, 108, 0);
            await wait(120);
            complete();
            return;
        }

        if (enteredViaTransition) {
            setPhase('cross-entry-hold');
            renderScreenWave(floodPaths, -8, 0);
            await domReady;
            await wait(300);
            screen.classList.add('is-loader-surface');
            root.classList.remove('hefang-transition-entry');
            if (mark) mark.style.visibility = 'visible';
            setPhase('cross-entry-reveal-loader');
            await animateScreenWave(floodPaths, -8, 108, 1080);
            await wait(320);
        } else {
            setPhase('direct-loading');
            renderScreenWave(floodPaths, 108, 0);
            screen.classList.add('is-loader-surface');
            await domReady;
            await wait(280);
        }

        setPhase('logo-fill');
        await animateLogoFill(logoPaths, 1780);
        await wait(420);

        setPhase('loader-cover');
        await animateScreenWave(floodPaths, 108, -8, 1380);
        if (mark) mark.style.visibility = 'hidden';
        markCovered();

        const coveredAt = performance.now();
        await waitForPageReady();
        const remainingHold = Math.max(0, 460 - (performance.now() - coveredAt));
        if (remainingHold) await wait(remainingHold);

        setPhase('page-reveal');
        screen.classList.add('is-revealing-page');
        root.classList.remove('hefang-transition-entry');
        await animateScreenWave(floodPaths, -8, 108, 1320);
        complete();
    };

    run().catch(() => {
        if (finished) return;
        screen.classList.add('is-revealing-page');
        renderScreenWave(floodPaths, 108, 0);
        complete();
    });
})();
