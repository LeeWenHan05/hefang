(() => {
    'use strict';

    const HEFANG_INTRO_TARGET_KEY = 'hefang:intro-target';

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
        window.setTimeout(finish, 18000);
    });

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

    document.addEventListener('DOMContentLoaded', async () => {
        await waitForHefangLoaderCovered();
        installHefangCrossPageIntroRouting();
        const cursor = document.querySelector('.custom-cursor');
        const hoverTargets = document.querySelectorAll('a, button, .hover-target, .pill-list li');
        if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
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
                const rotateNoise = noise(r / 10);
                return {
                    start: getXY(d[0], pCount - i, pCount),
                    end: getXY(d[1] + noise(7), pCount - i, pCount),
                    time: t,
                    scale: 1 + noise(0.2),
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotate: rotateNoise > 0
                        ? (rotateNoise + r / 20) * 10
                        : (rotateNoise - r / 20) * 10
                };
            };

            const makeParticles = (element, customCount = 6, customDist = [60, 15]) => {
                if (reduceNavMotion) return;
                const animationTime = 760;
                const bubbleTime = animationTime * 2 + 300;
                element.style.setProperty('--time', `${bubbleTime}ms`);

                for (let i = 0; i < customCount; i += 1) {
                    const t = animationTime * 2 + noise(900);
                    const particleData = createParticle(i, t, customDist, 100, customCount);

                    window.setTimeout(() => {
                        const particle = document.createElement('span');
                        const point = document.createElement('span');

                        particle.classList.add('particle');
                        particle.style.setProperty('--start-x', `${particleData.start[0]}px`);
                        particle.style.setProperty('--start-y', `${particleData.start[1]}px`);
                        particle.style.setProperty('--end-x', `${particleData.end[0]}px`);
                        particle.style.setProperty('--end-y', `${particleData.end[1]}px`);
                        particle.style.setProperty('--time', `${particleData.time}ms`);
                        particle.style.setProperty('--scale', `${particleData.scale}`);
                        particle.style.setProperty('--color', particleData.color);
                        particle.style.setProperty('--rotate', `${particleData.rotate}deg`);

                        point.classList.add('point');
                        particle.appendChild(point);
                        element.appendChild(particle);

                        window.setTimeout(() => particle.remove(), Math.max(0, t));
                    }, 30);
                }
            };

            let particleTimeout = 0;
            const updateEffectPosition = (pill, animate = true) => {
                if (!pill) return;
                const containerRect = container.getBoundingClientRect();
                const pillRect = pill.getBoundingClientRect();
                const values = {
                    left: pillRect.left - containerRect.left,
                    top: pillRect.top - containerRect.top,
                    width: pillRect.width,
                    height: pillRect.height
                };

                if (animate && !reduceNavMotion && window.gsap) {
                    gsap.to(filter, {
                        ...values,
                        duration: 1.9,
                        ease: 'elastic.out(1, 0.92)',
                        overwrite: 'auto'
                    });
                } else {
                    Object.assign(filter.style, {
                        left: `${values.left}px`,
                        top: `${values.top}px`,
                        width: `${values.width}px`,
                        height: `${values.height}px`
                    });
                }
            };

            const handleHover = (pill, index) => {
                if (activeIndex === index) return;
                items[activeIndex]?.classList.remove('active');
                activeIndex = index;
                pill.classList.add('active');
                updateEffectPosition(pill, true);
                filter.replaceChildren();
                window.clearTimeout(particleTimeout);
                particleTimeout = window.setTimeout(() => makeParticles(filter), 340);
            };

            items.forEach((item, index) => {
                item.addEventListener('mouseenter', () => handleHover(item, index));
                item.addEventListener('mousedown', () => {
                    if (!window.gsap || reduceNavMotion) return;
                    gsap.fromTo(filter,
                        { scale: 0.8 },
                        { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.52)', overwrite: 'auto' }
                    );
                    makeParticles(filter, 12, [90, 20]);
                });
            });

            container.addEventListener('mouseleave', () => {
                if (activeIndex !== defaultActiveIndex && items[defaultActiveIndex]) {
                    handleHover(items[defaultActiveIndex], defaultActiveIndex);
                }
            });

            const resetPosition = () => {
                if (items[activeIndex]) updateEffectPosition(items[activeIndex], false);
            };
            resetPosition();
            window.addEventListener('load', resetPosition, { once: true });
            window.addEventListener('resize', resetPosition, { passive: true });
        }
        initGooeyNav();

        const navContainer = document.querySelector('.pill-nav-container');
        let previousScroll = window.scrollY;
        const desktopNavMotion = window.matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)');
        if (navContainer && window.gsap) {
            let navScrollFrame = 0;
            window.addEventListener('scroll', () => {
                if (navScrollFrame) return;
                navScrollFrame = requestAnimationFrame(() => {
                    navScrollFrame = 0;
                    const currentScroll = window.scrollY;
                    const shouldHide = desktopNavMotion.matches && currentScroll > 100 && currentScroll > previousScroll;
                    gsap.to(navContainer, {
                        y: shouldHide ? -150 : 0,
                        duration: shouldHide ? 1.05 : 0.75,
                        ease: shouldHide ? 'power3.inOut' : 'power3.out',
                        overwrite: 'auto'
                    });
                    previousScroll = currentScroll;
                });
            }, { passive: true });
        }

        document.querySelectorAll('.nav-logo, #gooey-menu-wrapper').forEach((element) => {
            if (!window.gsap || !window.matchMedia('(pointer: fine)').matches) return;
            element.addEventListener('mousemove', (event) => {
                const rect = element.getBoundingClientRect();
                const x = event.clientX - rect.left - rect.width / 2;
                const y = event.clientY - rect.top - rect.height / 2;
                const strength = element.classList.contains('nav-logo') ? 0.3 : 0.08;
                gsap.to(element, {
                    x: x * strength,
                    y: y * strength,
                    duration: 0.3,
                    ease: 'power2.out',
                    overwrite: 'auto'
                });
            });
            element.addEventListener('mouseleave', () => {
                gsap.to(element, {
                    x: 0,
                    y: 0,
                    duration: 1,
                    ease: 'elastic.out(1, 0.3)',
                    overwrite: 'auto'
                });
            });
        });

        let innerNavThemeFrame = 0;
        const updateInnerNavTheme = () => {
            if (!navContainer || innerNavThemeFrame) return;
            innerNavThemeFrame = requestAnimationFrame(() => {
                innerNavThemeFrame = 0;
                const navRect = navContainer.getBoundingClientRect();
                const navY = navRect.top + navRect.height * 0.5;
                const containsNavY = (section) => {
                    const rect = section.getBoundingClientRect();
                    return rect.top <= navY && rect.bottom > navY;
                };

                const lightSections = document.querySelectorAll('[data-nav-theme="light"]');
                const darkSections = document.querySelectorAll('.hefang-process, .hefang-footer, [data-nav-theme="dark"]');
                const isOverLight = Array.from(lightSections).some(containsNavY);
                const isOverDark = !isOverLight && Array.from(darkSections).some(containsNavY);

                navContainer.classList.toggle('on-dirt', isOverDark);
            });
        };
        updateInnerNavTheme();
        window.addEventListener('scroll', updateInnerNavTheme, { passive: true });
        window.addEventListener('resize', updateInnerNavTheme, { passive: true });

        const transition = document.querySelector('.page-transition-liquid');
        const finishPageIntro = () => {
            document.documentElement.classList.remove('hefang-page-intro');
            window.__hefangPlayPageIntro = false;
            window.dispatchEvent(new CustomEvent('hefang:page-intro-complete'));
        };
        if (transition) transition.style.display = 'none';
        if (window.__hefangLoaderComplete || !document.documentElement.classList.contains('hefang-loader-active')) {
            finishPageIntro();
        } else {
            window.addEventListener('hefang:loader-complete', finishPageIntro, { once: true });
        }

        const revealItems = document.querySelectorAll('[data-inner-reveal]');
        const heroRevealItems = document.querySelectorAll('.drinks-gallery-heading, .ritual-card');
        let heroSelectionRevealed = false;
        let heroSelectionTimer = 0;
        const revealHeroSelection = () => {
            if (heroSelectionRevealed) return;
            heroSelectionRevealed = true;
            if (heroSelectionTimer) window.clearTimeout(heroSelectionTimer);
            window.removeEventListener('hefang:loader-phase', handleLoaderPhase);
            heroRevealItems.forEach((item) => item.classList.add('is-visible'));
        };
        const scheduleHeroSelectionReveal = () => {
            if (heroSelectionRevealed || heroSelectionTimer) return;
            const phaseStartedAt = Number(window.__hefangLoaderPhaseStartedAt) || performance.now();
            const elapsed = window.__hefangLoaderPhase === 'page-reveal' ? performance.now() - phaseStartedAt : 0;
            const delay = Math.max(0, 600 - elapsed);
            heroSelectionTimer = window.setTimeout(() => {
                heroSelectionTimer = 0;
                revealHeroSelection();
            }, delay);
        };
        const handleLoaderPhase = (event) => {
            if (event.detail?.phase === 'page-reveal') scheduleHeroSelectionReveal();
        };
        window.addEventListener('hefang:loader-phase', handleLoaderPhase);
        if (window.__hefangLoaderPhase === 'page-reveal') scheduleHeroSelectionReveal();
        else if (window.__hefangLoaderComplete || !document.documentElement.classList.contains('hefang-loader-active')) revealHeroSelection();
        const startInnerReveal = () => {
            if (!revealItems.length) return;
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
            revealItems.forEach((item) => observer.observe(item));
        };
        const scheduleInnerReveal = () => {
            requestAnimationFrame(() => window.setTimeout(startInnerReveal, 100));
        };
        if (window.__hefangLoaderComplete || !document.documentElement.classList.contains('hefang-loader-active')) {
            scheduleInnerReveal();
        } else {
            window.addEventListener('hefang:loader-complete', scheduleInnerReveal, { once: true });
        }

        function initProcessTimeline() {
            const journey = document.querySelector('[data-process-timeline]');
            if (!journey) return;

            const steps = [...journey.querySelectorAll('[data-process-step]')];
            const nodes = steps.map((step) => step.querySelector('.process-step-node'));
            const rail = journey.querySelector('.process-timeline-rail');
            const segments = [...journey.querySelectorAll('[data-process-segment]')];
            if (steps.length === 0 || !rail || nodes.some((node) => !node)) return;

            const desktopTimeline = window.matchMedia('(min-width: 1025px)');
            let frame = 0;
            let measuredNodeCenters = [];

            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const getViewportMarker = () => {
                if (desktopTimeline.matches) return window.innerHeight * 0.50;
                return window.innerHeight * (window.innerWidth <= 680 ? 0.64 : 0.52);
            };

            const measureSegments = () => {
                const journeyRect = journey.getBoundingClientRect();
                measuredNodeCenters = nodes.map((node) => {
                    const rect = node.getBoundingClientRect();
                    return rect.top + rect.height * 0.5 - journeyRect.top;
                });

                segments.forEach((segment, index) => {
                    if (index >= measuredNodeCenters.length - 1) {
                        segment.style.display = 'none';
                        return;
                    }
                    segment.style.display = 'block';
                    const nodeRect = nodes[index].getBoundingClientRect();
                    const nextRect = nodes[index + 1].getBoundingClientRect();
                    const startGap = clamp(nodeRect.height * 0.43, 20, 27);
                    const endGap = clamp(nextRect.height * 0.43, 20, 27);
                    const top = measuredNodeCenters[index] + startGap;
                    const bottom = measuredNodeCenters[index + 1] - endGap;
                    segment.style.top = `${top}px`;
                    segment.style.height = `${Math.max(1, bottom - top)}px`;
                });

                updateTimeline();
            };

            const updateTimeline = () => {
                frame = 0;

                const viewportMarker = getViewportMarker();
                const markerY = window.scrollY + viewportMarker;
                const nodePositions = nodes.map((node) => {
                    const rect = node.getBoundingClientRect();
                    return window.scrollY + rect.top + rect.height * 0.5;
                });
                const journeyRect = journey.getBoundingClientRect();
                const journeyIsPastMarker = journeyRect.bottom < viewportMarker;
                const journeyHasReachedMarker = journeyRect.top <= viewportMarker;

                segments.forEach((segment, index) => {
                    if (index >= nodePositions.length - 1) return;
                    const localProgress = clamp(
                        (markerY - nodePositions[index]) /
                        Math.max(1, nodePositions[index + 1] - nodePositions[index]),
                        0,
                        1
                    );
                    segment.style.setProperty('--segment-progress', localProgress);
                });

                let currentIndex = -1;
                if (journeyHasReachedMarker && !journeyIsPastMarker) {
                    nodePositions.forEach((position, index) => {
                        if (markerY >= position - 1) currentIndex = index;
                    });
                }

                steps.forEach((step, index) => {
                    const reached = markerY >= nodePositions[index] - 1;
                    step.classList.toggle('is-reached', reached);
                    step.classList.toggle('is-current', index === currentIndex);
                });
            };

            const requestUpdate = () => {
                if (frame) return;
                frame = window.requestAnimationFrame(updateTimeline);
            };

            journey.classList.add('process-timeline-ready');
            measureSegments();
            window.addEventListener('scroll', requestUpdate, { passive: true });
            window.addEventListener('resize', () => window.requestAnimationFrame(measureSegments), { passive: true });
            window.addEventListener('load', measureSegments, { once: true });

            if (document.fonts?.ready) {
                document.fonts.ready.then(() => window.requestAnimationFrame(measureSegments));
            }
        }
        initProcessTimeline();

        const deepLinkCards = [...document.querySelectorAll('.ritual-card[id]')];
        const focusDeepLinkedDrink = () => {
            const rawId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
            if (!rawId) return;

            const shouldOpenDetail = rawId.endsWith('-detail');
            const cardId = shouldOpenDetail ? rawId.replace(/-detail$/, '') : rawId;
            const target = document.getElementById(cardId);
            if (!target?.classList.contains('ritual-card')) return;

            deepLinkCards.forEach((card) => card.classList.remove('is-deep-linked'));
            target.classList.add('is-deep-linked');

            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            window.setTimeout(() => {
                target.scrollIntoView({
                    behavior: shouldOpenDetail || reducedMotion ? 'auto' : 'smooth',
                    block: 'center'
                });
            }, shouldOpenDetail ? 70 : 180);

            if (shouldOpenDetail) {
                const opener = target.querySelector('[data-dialog-target]')
                    || target.querySelector('[data-dialog-surface]');
                const dialogId = opener?.dataset.dialogTarget
                    || opener?.dataset.dialogSurface;

                window.setTimeout(() => {
                    if (dialogId) openDialog(dialogId, opener);
                }, reducedMotion ? 80 : 220);
            }

            window.setTimeout(() => target.classList.remove('is-deep-linked'), 2200);
        };

        focusDeepLinkedDrink();
        window.addEventListener('hashchange', focusDeepLinkedDrink);

        function initFAQConversation() {
            const faq = document.querySelector('.hefang-faq--conversation');
            if (!faq) return;

            const tabRail = faq.querySelector('[data-faq-tabs]');
            const tabs = Array.from(faq.querySelectorAll('[data-faq-filter]'));
            const indicator = faq.querySelector('.faq-tab-indicator');
            const items = Array.from(faq.querySelectorAll('[data-faq-item]'));
            const questions = Array.from(faq.querySelectorAll('.faq-chat-question'));
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

            const answerTimers = new WeakMap();

            const setItemOpen = (item, open, immediate = false) => {
                if (!item) return;
                const question = item.querySelector('.faq-chat-question');
                const answer = item.querySelector('.faq-chat-answer');
                if (!answer) {
                    item.classList.toggle('is-open', open);
                    question?.setAttribute('aria-expanded', String(open));
                    return;
                }

                const previousTimer = answerTimers.get(answer);
                if (previousTimer) window.clearTimeout(previousTimer);

                const reduced = reduceMotion.matches || immediate;
                const currentlyOpen = item.classList.contains('is-open');
                question?.setAttribute('aria-expanded', String(open));

                if (reduced) {
                    item.classList.toggle('is-open', open);
                    answer.style.height = open ? 'auto' : '0px';
                    answer.style.opacity = open ? '1' : '0';
                    answer.style.visibility = open ? 'visible' : 'hidden';
                    answer.style.pointerEvents = open ? 'auto' : 'none';
                    return;
                }

                const startHeight = answer.getBoundingClientRect().height;
                if (open) {
                    answer.style.visibility = 'visible';
                    answer.style.pointerEvents = 'auto';
                    answer.style.height = `${startHeight}px`;
                    item.classList.add('is-open');
                    answer.getBoundingClientRect();
                    const endHeight = answer.scrollHeight;
                    requestAnimationFrame(() => {
                        answer.style.height = `${endHeight}px`;
                        answer.style.opacity = '1';
                    });
                    const timer = window.setTimeout(() => {
                        if (item.classList.contains('is-open')) answer.style.height = 'auto';
                    }, 620);
                    answerTimers.set(answer, timer);
                } else {
                    if (!currentlyOpen && startHeight === 0) {
                        item.classList.remove('is-open');
                        answer.style.height = '0px';
                        answer.style.opacity = '0';
                        answer.style.visibility = 'hidden';
                        answer.style.pointerEvents = 'none';
                        return;
                    }
                    answer.style.height = `${Math.max(startHeight, answer.scrollHeight)}px`;
                    answer.style.opacity = '1';
                    answer.getBoundingClientRect();
                    item.classList.remove('is-open');
                    requestAnimationFrame(() => {
                        answer.style.height = '0px';
                        answer.style.opacity = '0';
                    });
                    const timer = window.setTimeout(() => {
                        if (!item.classList.contains('is-open')) {
                            answer.style.visibility = 'hidden';
                            answer.style.pointerEvents = 'none';
                        }
                    }, 590);
                    answerTimers.set(answer, timer);
                }
            };

            const closeOthers = (activeItem) => {
                items.forEach((item) => {
                    if (item !== activeItem) setItemOpen(item, false);
                });
            };

            const syncIndicator = (tab, immediate = false) => {
                if (!tabRail || !indicator || !tab) return;
                const railStyle = getComputedStyle(tabRail);
                const padLeft = parseFloat(railStyle.paddingLeft) || 0;
                const x = tab.offsetLeft - padLeft;
                if (immediate) indicator.style.transition = 'none';
                indicator.style.width = `${tab.offsetWidth}px`;
                indicator.style.transform = `translate3d(${x}px,0,0)`;
                if (immediate) {
                    requestAnimationFrame(() => { indicator.style.transition = ''; });
                }
            };

            const activateFilter = (tab) => {
                const filter = tab?.dataset.faqFilter || 'all';
                tabs.forEach((candidate) => {
                    const active = candidate === tab;
                    candidate.classList.toggle('is-active', active);
                    candidate.setAttribute('aria-pressed', String(active));
                });
                syncIndicator(tab);

                let visibleIndex = 0;
                items.forEach((item) => {
                    const visible = filter === 'all' || item.dataset.faqCategory === filter;
                    item.classList.toggle('is-filtered-out', !visible);
                    item.setAttribute('aria-hidden', String(!visible));
                    if (!visible) {
                        setItemOpen(item, false);
                        return;
                    }
                    item.style.animationDelay = reduceMotion.matches ? '0ms' : `${Math.min(visibleIndex * 45, 180)}ms`;
                    visibleIndex += 1;
                });

                const visibleItems = items.filter((item) => !item.classList.contains('is-filtered-out'));
                const hasOpenVisible = visibleItems.some((item) => item.classList.contains('is-open'));
                if (!hasOpenVisible && visibleItems.length) {
                    closeOthers(visibleItems[0]);
                    setItemOpen(visibleItems[0], true);
                }
            };

            questions.forEach((question) => {
                question.addEventListener('click', () => {
                    const item = question.closest('[data-faq-item]');
                    if (!item) return;
                    const willOpen = question.getAttribute('aria-expanded') !== 'true';
                    closeOthers(item);
                    setItemOpen(item, willOpen);
                });
            });

            tabs.forEach((tab) => {
                tab.addEventListener('click', () => activateFilter(tab));
            });

            items.forEach((item) => setItemOpen(item, item.classList.contains('is-open'), true));

            const activeTab = tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0];
            requestAnimationFrame(() => syncIndicator(activeTab, true));
            window.addEventListener('resize', () => syncIndicator(tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0], true), { passive: true });
        }
        initFAQConversation();

        function initOrderRitual() {
            const ritual = document.querySelector('[data-order-ritual]');
            if (!ritual) return;

            const choices = Array.from(ritual.querySelectorAll('[data-order-blend]'));
            const message = ritual.querySelector('[data-order-message]');
            const messageBlend = ritual.querySelector('[data-order-message-blend]');
            const messagePaper = ritual.querySelector('.order-message-paper');
            const copyButton = ritual.querySelector('[data-order-copy]');
            const instagram = ritual.querySelector('[data-order-instagram]');
            const progressSteps = Array.from(ritual.querySelectorAll('[data-order-progress-step]'));
            const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            let selectedBlend = '';
            let selectedButton = null;
            let preparedMessage = '';

            const applyAccent = (button) => {
                ritual.style.setProperty('--order-accent', button?.dataset.orderAccent || 'var(--brand-sage-muted)');
                ritual.style.setProperty('--order-soft', button?.dataset.orderSoft || '#EEF0DE');
                ritual.style.setProperty('--order-ink', button?.dataset.orderInk || 'var(--brand-sage-text)');
            };

            const setStage = (stage) => {
                const progress = stage <= 1 ? '0%' : stage === 2 ? '50%' : '100%';
                ritual.style.setProperty('--order-progress', progress);
                progressSteps.forEach((step, index) => {
                    const stepNumber = index + 1;
                    const current = stepNumber === stage;
                    step.classList.toggle('is-complete', stepNumber < stage);
                    step.classList.toggle('is-current', current);
                    if (current) step.setAttribute('aria-current', 'step');
                    else step.removeAttribute('aria-current');
                });
            };

            const setInstagramAvailable = (available, blend = selectedBlend) => {
                if (!instagram) return;
                instagram.setAttribute('aria-label', available && blend
                    ? `Open HEFANG Instagram to send the ${blend} enquiry`
                    : 'Open HEFANG Instagram after copying your prepared message');
                instagram.setAttribute('aria-disabled', available ? 'false' : 'true');
                if (available) {
                    instagram.removeAttribute('tabindex');
                    instagram.classList.remove('is-disabled');
                } else {
                    instagram.setAttribute('tabindex', '-1');
                    instagram.classList.add('is-disabled');
                }
            };

            const selectBlend = (button) => {
                const blend = button.dataset.orderBlend || '';
                if (!blend) return;

                selectedBlend = blend;
                selectedButton = button;
                preparedMessage = `Hi HEFANG, I’d like to ask about ${blend}.`;

                choices.forEach((choice) => {
                    const active = choice === button;
                    choice.classList.toggle('is-selected', active);
                    choice.setAttribute('aria-pressed', active ? 'true' : 'false');
                });

                applyAccent(button);

                if (message) message.textContent = preparedMessage;
                if (messageBlend) messageBlend.textContent = blend.toUpperCase();
                messagePaper?.classList.add('is-ready');
                if (copyButton) {
                    copyButton.disabled = false;
                    const label = copyButton.querySelector('span');
                    if (label) label.textContent = 'COPY MESSAGE';
                    copyButton.classList.remove('is-copied', 'is-copy-failed');
                }
                setInstagramAvailable(false, blend);
                setStage(2);

                if (!reduceMotion.matches && window.gsap && messagePaper) {
                    gsap.fromTo(messagePaper,
                        { y: 5, scale: 0.993 },
                        { y: -3, scale: 1, duration: .72, ease: 'power3.out', overwrite: 'auto' }
                    );
                }
            };

            choices.forEach((button) => {
                button.style.setProperty('--blend-accent', button.dataset.orderAccent || 'var(--brand-sage-muted)');
                button.addEventListener('click', () => selectBlend(button));
                if (finePointer.matches) {
                    button.addEventListener('pointerenter', () => applyAccent(button));
                    button.addEventListener('pointerleave', () => applyAccent(selectedButton));
                }
            });

            copyButton?.addEventListener('click', async () => {
                if (!preparedMessage) return;
                let copied = false;
                try {
                    await navigator.clipboard.writeText(preparedMessage);
                    copied = true;
                } catch {
                    const textarea = document.createElement('textarea');
                    textarea.value = preparedMessage;
                    textarea.setAttribute('readonly', '');
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try { copied = document.execCommand('copy'); } catch { copied = false; }
                    textarea.remove();
                }

                const label = copyButton.querySelector('span');
                if (copied) {
                    if (label) label.textContent = 'COPIED';
                    copyButton.classList.remove('is-copy-failed');
                    copyButton.classList.add('is-copied');
                    setInstagramAvailable(true, selectedBlend);
                    setStage(3);
                    window.setTimeout(() => {
                        if (!selectedBlend) return;
                        const currentLabel = copyButton.querySelector('span');
                        if (currentLabel) currentLabel.textContent = 'COPY MESSAGE';
                        copyButton.classList.remove('is-copied');
                    }, 1800);
                } else {
                    if (message) {
                        const selection = window.getSelection?.();
                        const range = document.createRange?.();
                        if (selection && range) {
                            range.selectNodeContents(message);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    }
                    if (label) label.textContent = 'COPY MANUALLY';
                    copyButton.classList.remove('is-copied');
                    copyButton.classList.add('is-copy-failed');
                    setInstagramAvailable(true, selectedBlend);
                    setStage(3);
                }
            });

            instagram?.addEventListener('click', (event) => {
                if (instagram.getAttribute('aria-disabled') === 'true') {
                    event.preventDefault();
                    return;
                }
                setStage(3);
            });

            ritual.addEventListener('hefang:select-blend', (event) => {
                const blend = event.detail?.blend || '';
                const match = choices.find((choice) => choice.dataset.orderBlend === blend);
                if (match) selectBlend(match);
            });

            if (finePointer.matches) {
                ritual.addEventListener('pointermove', (event) => {
                    const rect = ritual.getBoundingClientRect();
                    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
                    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
                    ritual.style.setProperty('--order-pointer-x', `${x}%`);
                    ritual.style.setProperty('--order-pointer-y', `${y}%`);
                });
            }

            setInstagramAvailable(false);
            setStage(1);
        }
        initOrderRitual();

        const dialogOpeners = document.querySelectorAll('[data-dialog-target]');
        const dialogSurfaces = document.querySelectorAll('[data-dialog-surface]');
        const dialogs = document.querySelectorAll('.blend-dialog');
        const reduceDialogMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let dialogReturnFocus = null;
        let activeDialogTimeline = null;
        let dialogFrameOne = 0;
        let dialogFrameTwo = 0;

        const cancelDialogFrames = () => {
            window.cancelAnimationFrame(dialogFrameOne);
            window.cancelAnimationFrame(dialogFrameTwo);
            dialogFrameOne = 0;
            dialogFrameTwo = 0;
        };

        const getDialogParts = (dialog) => ({
            panel: dialog.querySelector('.blend-dialog-panel'),
            backdrop: dialog.querySelector('.blend-dialog-backdrop'),
            header: dialog.querySelector('.blend-dialog-header'),
            scroll: dialog.querySelector('.blend-dialog-scroll'),
            closeButton: dialog.querySelector('.blend-dialog-close')
        });

        const focusDialogEntry = (dialog) => {
            if (!dialog) return;
            const title = dialog.querySelector('.blend-dialog-header h2');
            if (title) {
                title.setAttribute('tabindex', '-1');
                title.focus({ preventScroll: true });
                return;
            }
            dialog.focus?.({ preventScroll: true });
        };

        const suppressNativeCloseAutofocus = (dialog) => {
            const closeButton = dialog?.querySelector('.blend-dialog-close');
            if (!closeButton) return () => {};
            const hadTabIndex = closeButton.hasAttribute('tabindex');
            const previousTabIndex = closeButton.getAttribute('tabindex');
            closeButton.setAttribute('tabindex', '-1');
            return () => {
                if (hadTabIndex) closeButton.setAttribute('tabindex', previousTabIndex ?? '0');
                else closeButton.removeAttribute('tabindex');
            };
        };

        const clearDialogAnimation = (dialog) => {
            cancelDialogFrames();
            activeDialogTimeline?.kill();
            activeDialogTimeline = null;

            const { panel, backdrop, header, scroll, closeButton } = getDialogParts(dialog);
            if (window.gsap) {
                gsap.set([panel, backdrop, header, scroll, closeButton], {
                    clearProps: 'opacity,transform,transformOrigin,willChange'
                });
            }

            dialog.classList.remove('is-preparing', 'is-opening', 'is-open-ready', 'is-closing');
        };

        const prepareDialogOpeningFrame = (dialog) => {
            const { panel, backdrop, header, scroll, closeButton } = getDialogParts(dialog);
            gsap.set(backdrop, {
                opacity: 0,
                willChange: 'opacity'
            });
            gsap.set(panel, {
                opacity: 0,
                y: 16,
                scale: 0.985,
                force3D: true,
                transformOrigin: '50% 50%',
                willChange: 'transform, opacity'
            });
            gsap.set([header, scroll], {
                opacity: 0,
                y: 9,
                force3D: true,
                willChange: 'transform, opacity'
            });
            gsap.set(closeButton, {
                opacity: 0,
                scale: 0.94,
                force3D: true,
                willChange: 'transform, opacity'
            });
        };

        const clearDialogDeepLink = (dialog) => {
            if (!dialog?.id || !window.location.hash) return;
            let rawId = '';
            try { rawId = decodeURIComponent(window.location.hash.replace(/^#/, '')); } catch { return; }
            if (!rawId.endsWith('-detail')) return;
            const cardId = rawId.replace(/-detail$/, '');
            const card = document.getElementById(cardId);
            if (!card?.classList.contains('ritual-card')) return;
            const linkedDialogId = card.querySelector('[data-dialog-target]')?.dataset.dialogTarget
                || card.querySelector('[data-dialog-surface]')?.dataset.dialogSurface
                || '';
            if (linkedDialogId !== dialog.id) return;
            const cleanURL = `${window.location.pathname}${window.location.search}`;
            try { window.history.replaceState(window.history.state, '', cleanURL); } catch {}
            card.classList.remove('is-deep-linked');
        };

        const finishDialogClose = (dialog) => {
            if (dialog.open) dialog.close();
        };

        const closeDialog = (dialog) => {
            if (!dialog?.open || dialog.classList.contains('is-closing')) return;

            clearDialogDeepLink(dialog);
            cancelDialogFrames();
            activeDialogTimeline?.kill();
            activeDialogTimeline = null;

            const { panel, backdrop, header, scroll, closeButton } = getDialogParts(dialog);
            dialog.classList.remove('is-preparing', 'is-opening', 'is-open-ready');
            dialog.classList.add('is-closing');

            if (!window.gsap || reduceDialogMotion.matches) {
                finishDialogClose(dialog);
                return;
            }

            activeDialogTimeline = gsap.timeline({
                defaults: { overwrite: 'auto' },
                onComplete: () => finishDialogClose(dialog)
            });

            activeDialogTimeline
                .to([header, scroll], {
                    opacity: 0,
                    y: -4,
                    duration: 0.18,
                    ease: 'power1.in'
                }, 0)
                .to(closeButton, {
                    opacity: 0,
                    scale: 0.96,
                    duration: 0.16,
                    ease: 'power1.in'
                }, 0)
                .to(panel, {
                    opacity: 0,
                    y: 8,
                    scale: 0.988,
                    duration: 0.42,
                    force3D: true,
                    ease: 'power2.inOut'
                }, 0.04)
                .to(backdrop, {
                    opacity: 0,
                    duration: 0.38,
                    ease: 'power1.inOut'
                }, 0.03);
        };

        const openDialog = (dialogId, opener) => {
            const dialog = document.getElementById(dialogId || '');
            if (!dialog || typeof dialog.showModal !== 'function' || dialog.open) return;

            clearDialogAnimation(dialog);
            dialogReturnFocus = opener;
            dialog.classList.add('is-preparing');

            if (window.gsap && !reduceDialogMotion.matches) {
                prepareDialogOpeningFrame(dialog);
            }

            const restoreCloseTabOrder = suppressNativeCloseAutofocus(dialog);
            dialog.showModal();
            focusDialogEntry(dialog);
            window.requestAnimationFrame(restoreCloseTabOrder);

            document.documentElement.classList.add('has-open-dialog');
            document.body.classList.add('has-open-dialog');
            cursor?.classList.remove('active');
            dialog.querySelector('.blend-dialog-scroll')?.scrollTo({ top: 0, behavior: 'auto' });

            const { panel, backdrop, header, scroll, closeButton } = getDialogParts(dialog);

            if (!window.gsap || reduceDialogMotion.matches) {
                dialog.classList.remove('is-preparing');
                dialog.classList.add('is-open-ready');
                focusDialogEntry(dialog);
                return;
            }

            dialogFrameOne = window.requestAnimationFrame(() => {
                dialogFrameTwo = window.requestAnimationFrame(() => {
                    dialog.classList.remove('is-preparing');
                    dialog.classList.add('is-opening');

                    activeDialogTimeline = gsap.timeline({
                        defaults: { overwrite: 'auto' },
                        onComplete: () => {
                            dialog.classList.remove('is-opening');
                            dialog.classList.add('is-open-ready');
                            gsap.set([panel, backdrop, header, scroll, closeButton], { clearProps: 'willChange' });
                            focusDialogEntry(dialog);
                        }
                    });

                    activeDialogTimeline
                        .to(backdrop, {
                            opacity: 1,
                            duration: 0.46,
                            ease: 'power2.out'
                        }, 0)
                        .to(panel, {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            duration: 0.62,
                            force3D: true,
                            ease: 'power3.out'
                        }, 0.015)
                        .to([header, scroll], {
                            opacity: 1,
                            y: 0,
                            duration: 0.44,
                            force3D: true,
                            ease: 'power2.out'
                        }, 0.18)
                        .to(closeButton, {
                            opacity: 1,
                            scale: 1,
                            duration: 0.34,
                            force3D: true,
                            ease: 'power2.out'
                        }, 0.24);
                });
            });
        };

        dialogOpeners.forEach((opener) => {
            opener.addEventListener('click', () => openDialog(opener.dataset.dialogTarget, opener));
        });

        dialogSurfaces.forEach((surface) => {
            let pressPoint = null;
            surface.addEventListener('pointerdown', (event) => {
                pressPoint = { x: event.clientX, y: event.clientY };
            });
            surface.addEventListener('pointerup', (event) => {
                if (!pressPoint) return;
                const distance = Math.hypot(event.clientX - pressPoint.x, event.clientY - pressPoint.y);
                pressPoint = null;
                if (distance <= 7) openDialog(surface.dataset.dialogSurface, surface);
            });
            surface.addEventListener('pointercancel', () => { pressPoint = null; });
            surface.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openDialog(surface.dataset.dialogSurface, surface);
            });
        });

        dialogs.forEach((dialog) => {
            dialog.addEventListener('wheel', (event) => {
                if (!dialog.open) return;
                const scroller = dialog.querySelector('.blend-dialog-scroll');
                if (!scroller) return;

                const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
                const overScroller = path.includes(scroller);
                const movingDown = event.deltaY > 0;
                const movingUp = event.deltaY < 0;
                const atTop = scroller.scrollTop <= 0;
                const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight - 1;

                if (overScroller) {
                    if ((movingUp && atTop) || (movingDown && atBottom)) event.preventDefault();
                    return;
                }

                event.preventDefault();
                scroller.scrollTop += event.deltaY;
            }, { passive: false });

            let modalTouchY = null;
            dialog.addEventListener('touchstart', (event) => {
                if (!dialog.open || !event.touches.length) return;
                modalTouchY = event.touches[0].clientY;
            }, { passive: true });
            dialog.addEventListener('touchmove', (event) => {
                if (!dialog.open || modalTouchY === null || !event.touches.length) return;
                const scroller = dialog.querySelector('.blend-dialog-scroll');
                if (!scroller) return;
                const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
                if (path.includes(scroller)) {
                    modalTouchY = event.touches[0].clientY;
                    return;
                }
                const nextY = event.touches[0].clientY;
                const delta = modalTouchY - nextY;
                modalTouchY = nextY;
                event.preventDefault();
                scroller.scrollTop += delta;
            }, { passive: false });
            dialog.addEventListener('touchend', () => { modalTouchY = null; }, { passive: true });
            dialog.addEventListener('touchcancel', () => { modalTouchY = null; }, { passive: true });

            dialog.addEventListener('keydown', (event) => {
                if (!dialog.open) return;

                const title = dialog.querySelector('.blend-dialog-header h2');
                const closeButton = dialog.querySelector('.blend-dialog-close');
                if (event.key === 'Tab' && !event.shiftKey && document.activeElement === title && closeButton) {
                    event.preventDefault();
                    closeButton.focus({ preventScroll: true });
                    return;
                }

                const interactive = event.target?.closest?.('button, a, input, textarea, select, summary');
                if (interactive) return;
                const scroller = dialog.querySelector('.blend-dialog-scroll');
                if (!scroller) return;
                const amounts = { ArrowDown: 48, ArrowUp: -48, PageDown: scroller.clientHeight * .82, PageUp: -scroller.clientHeight * .82, Home: -Infinity, End: Infinity, ' ': scroller.clientHeight * .82 };
                if (!(event.key in amounts)) return;
                event.preventDefault();
                if (event.key === 'Home') scroller.scrollTop = 0;
                else if (event.key === 'End') scroller.scrollTop = scroller.scrollHeight;
                else if (event.key === ' ' && event.shiftKey) scroller.scrollTop -= scroller.clientHeight * .82;
                else scroller.scrollTop += amounts[event.key];
            });

            dialog.querySelectorAll('[data-dialog-close]').forEach((control) => {
                control.addEventListener('click', () => closeDialog(dialog));
            });

            dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                closeDialog(dialog);
            });

            dialog.addEventListener('close', () => {
                clearDialogAnimation(dialog);
                document.documentElement.classList.remove('has-open-dialog');
                document.body.classList.remove('has-open-dialog');
                cursor?.classList.remove('active');
                dialogReturnFocus?.focus?.({ preventScroll: true });
                dialogReturnFocus = null;
            });
        });

        document.querySelectorAll('[data-order-start]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const blend = link.dataset.orderStart || '';
                const order = document.getElementById('order');
                const ritual = order?.querySelector('[data-order-ritual]');
                const dialog = link.closest('.blend-dialog');

                if (dialog?.open) {
                    dialogReturnFocus = null;
                    closeDialog(dialog);
                }

                const continueToOrder = () => {
                    ritual?.dispatchEvent(new CustomEvent('hefang:select-blend', {
                        detail: { blend }
                    }));
                    order?.scrollIntoView({
                        behavior: reduceDialogMotion.matches ? 'auto' : 'smooth',
                        block: 'start'
                    });
                };

                window.setTimeout(continueToOrder,
                    dialog?.open && window.gsap && !reduceDialogMotion.matches ? 470 : 40
                );
            });
        });
        window.__hefangPageReadyForReveal = true;
        window.dispatchEvent(new CustomEvent('hefang:page-ready'));
    });
})();
