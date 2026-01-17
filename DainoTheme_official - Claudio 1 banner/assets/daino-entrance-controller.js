/* ============================================
   DAINO THEME - ENTRANCE GATE CONTROLLER
   Converted from exo_sk.html
   v2.0 - Fixed scroll residue issues
   ============================================ */
(function () {
    'use strict';

    // Initialize Lenis smooth scroll - runs AFTER gate closes or immediately if no gate
    // ✅ FIX 1: MOBILE-FIRST - Lenis disabilitato su mobile (scroll nativo iOS)
    function initLenis() {
        if (typeof Lenis !== 'undefined' && typeof ScrollTrigger !== 'undefined' && typeof gsap !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            // ✅ FIX CRITICO: normalizeScroll SOLO su desktop
            if (ScrollTrigger.normalizeScroll) {
                const isMobile = /iphone|ipod|ipad|android|mobile/i.test(navigator.userAgent.toLowerCase());

                if (!isMobile) {
                    // Desktop: normalizeScroll attivo
                    ScrollTrigger.normalizeScroll(true);
                } else {
                    // Mobile: disabilita completamente (usa scroll nativo)
                    ScrollTrigger.normalizeScroll(false);
                }
            }

            // ✅ MOBILE DETECTION ROBUSTA
            const isMobile = () => {
                // Check 1: User Agent (più affidabile per device reali)
                const ua = navigator.userAgent.toLowerCase();
                const isMobileUA = /iphone|ipod|ipad|android|mobile|phone/i.test(ua);

                // Check 2: Touch + Small Screen (iPad, tablet)
                const isTouchAndSmall = 'ontouchstart' in window && window.innerWidth < 1024;

                return isMobileUA || isTouchAndSmall;
            };

            if (isMobile()) {
                // ✅ Mobile: ScrollTrigger diretto, NO Lenis (scroll nativo iOS)
                // ScrollTrigger funziona anche senza Lenis su mobile
                // Il scroll nativo iOS è già smooth e performante
                console.log('[Daino] Mobile detected: using native iOS scroll (Lenis disabled)');
                return; // ❌ NON inizializzare Lenis su mobile
            }

            // ✅ Desktop: Lenis attivo (migliora UX su desktop)
            window.lenis = new Lenis({
                duration: 1.2,
                smooth: true,
                smoothTouch: false
            });

            window.lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => window.lenis.raf(time * 1000));

            // ✅ RESIZE HANDLER: Distruggi Lenis se device ruota e diventa mobile
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (isMobile() && window.lenis) {
                        // Device è diventato mobile (es. iPad rotato) → distruggi Lenis
                        window.lenis.destroy();
                        window.lenis = null;
                        console.log('[Daino] Switched to mobile: Lenis destroyed');
                    }
                }, 250); // Debounce 250ms
            }, { passive: true });
        }
    }

    function initEntranceGate() {
        // FAILSAFE: Only activates if GSAP is missing
        if (typeof gsap === 'undefined') {
            // Fallback: nascondi gate e mostra contenuto
            const gate = document.getElementById('entranceGate');
            if (gate) gate.style.display = 'none';
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
            // Reveal hero elements without animation
            const heroMenu = document.getElementById('heroMenu');
            const heroBanner = document.getElementById('heroBanner');
            const heroBrandsBanner = document.getElementById('heroBrandsBanner');
            const heroBrandsBannerBottom = document.getElementById('heroBrandsBannerBottom');
            const videoContainer = document.getElementById('heroVideoContainer');
            if (heroMenu) { heroMenu.style.opacity = '1'; heroMenu.style.transform = 'translateY(0)'; }
            if (heroBanner) { heroBanner.style.opacity = '1'; heroBanner.style.transform = 'translateY(0)'; }
            if (heroBrandsBanner) { heroBrandsBanner.style.opacity = '1'; heroBrandsBanner.style.transform = 'translateY(0)'; heroBrandsBanner.classList.add('is-revealed'); }
            if (heroBrandsBannerBottom) { heroBrandsBannerBottom.style.opacity = '1'; heroBrandsBannerBottom.style.transform = 'translateY(0)'; heroBrandsBannerBottom.classList.add('is-revealed'); }
            if (videoContainer) videoContainer.classList.add('scrollable');
            return;
        }

        const EntranceGate = {
            elements: {},
            state: {
                hasScrolled: false,
                isTransitioning: false,
                scrollHandler: null
            },

            init() {
                // SKIP scroll blocking on pages that don't need the entrance gate
                const isSearchPage = window.location.pathname.includes('/search');
                const isCartPage = window.location.pathname.includes('/cart');
                const isAccountPage = window.location.pathname.includes('/account');
                const isCollectionPage = window.location.pathname.includes('/collections');
                const isProductPage = window.location.pathname.includes('/products');

                if (isSearchPage || isCartPage || isAccountPage || isCollectionPage || isProductPage) {
                    // These pages should scroll naturally - no gate logic
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    document.body.classList.remove('gate-active');
                    return;
                }

                this.elements.gate = document.getElementById('entranceGate');
                this.elements.logo = document.getElementById('logoEntrance');
                this.elements.indicator = document.getElementById('scrollIndicator');
                this.elements.heroVideo = document.getElementById('heroVideo');
                this.elements.heroMenu = document.getElementById('heroMenu');
                this.elements.heroBanner = document.getElementById('heroBanner');
                this.elements.heroBrandsBanner = document.getElementById('heroBrandsBanner');
                this.elements.heroBrandsBannerBottom = document.getElementById('heroBrandsBannerBottom');
                this.elements.videoContainer = document.getElementById('heroVideoContainer');
                this.elements.mainContent = document.getElementById('MainContent');
                this.elements.scrollSpacer = document.getElementById('gateScrollSpacer');

                if (!this.elements.gate || !this.elements.logo) {
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    document.body.classList.remove('gate-active');
                    // NO GATE: Reveal hero elements immediately
                    this.revealHeroElements();
                    return;
                }

                // LOCK EVERYTHING initially - page must NOT scroll until gate closes
                this.lockScroll();
                document.body.classList.add('gate-active');

                this.setupAnimation();
            },

            lockScroll() {
                // ✅ MOBILE-FIRST: Usa position:fixed + touch-action (via CSS class)
                // ❌ RIMOSSO: document.body.style.overflow = 'hidden'; (non funziona su iOS)
                // ❌ RIMOSSO: document.documentElement.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.top = '0';
                document.body.style.left = '0';
                document.body.style.right = '0';
                document.body.style.width = '100%';
                document.body.style.height = '100vh';
                // touch-action: none gestito via CSS class .gate-active
            },

            unlockScroll() {
                // ✅ MOBILE-FIRST: Rimuovi solo position, overflow gestito via CSS
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.width = '';
                document.body.style.height = '';
                // ❌ RIMOSSO: overflow (gestito via CSS class)
            },

            revealHeroElements() {
                // Reveal all hero elements when gate is not present or skipped
                if (this.elements.heroMenu) {
                    gsap.set(this.elements.heroMenu, { opacity: 1, y: 0 });
                }
                if (this.elements.heroBanner) {
                    gsap.set(this.elements.heroBanner, { opacity: 1, y: 0 });
                }
                if (this.elements.heroBrandsBanner) {
                    gsap.set(this.elements.heroBrandsBanner, { opacity: 1, y: 0 });
                    this.elements.heroBrandsBanner.classList.add('is-revealed');
                }
                if (this.elements.heroBrandsBannerBottom) {
                    gsap.set(this.elements.heroBrandsBannerBottom, { opacity: 1, y: 0 });
                    this.elements.heroBrandsBannerBottom.classList.add('is-revealed');
                }
                if (this.elements.heroVideo) {
                    this.elements.heroVideo.play().catch(e => console.warn('Video play failed:', e));
                }
                if (this.elements.videoContainer) {
                    this.elements.videoContainer.classList.add('scrollable');
                }
            },

            setupAnimation() {
                const tl = gsap.timeline();

                // Ensure gate is visible first
                gsap.set(this.elements.gate, { yPercent: 0, display: 'flex' });

                tl.to(this.elements.logo, { opacity: 1, duration: 2, ease: 'power2.out' });
                tl.to(this.elements.indicator, { opacity: 1, duration: 1.5, delay: 0.5 }, '-=1');

                // After animation, allow scroll detection via touch/wheel
                tl.call(() => {
                    this.enableGateInteraction();
                });
            },

            enableGateInteraction() {
                // Use wheel and touch events instead of scroll (more reliable when body is locked)
                const triggerGate = (e) => {
                    if (!this.state.hasScrolled && !this.state.isTransitioning) {
                        this.state.hasScrolled = true;
                        this.fadeOutGate();
                    }
                };

                // Store reference for cleanup
                this.state.wheelHandler = triggerGate;
                this.state.touchStartY = 0;

                // ✅ Wheel event (desktop) - mantieni logica esistente
                window.addEventListener('wheel', this.state.wheelHandler, { passive: true, once: true });

                // ✅ TOUCH LISTENER migliorato (mobile primary)
                this.state.touchStartHandler = (e) => {
                    this.state.touchStartY = e.touches[0].clientY;
                };

                // ✅ TOUCHEND invece di touchmove (più affidabile su iOS)
                this.state.touchEndHandler = (e) => {
                    if (this.state.hasScrolled || this.state.isTransitioning) return;
                    const touchEndY = e.changedTouches[0].clientY;
                    const swipeDistance = this.state.touchStartY - touchEndY;

                    // Swipe UP > 30px triggers gate exit
                    if (swipeDistance > 30) {
                        this.state.hasScrolled = true;
                        this.fadeOutGate();
                    }
                };

                // ✅ Aggiungi anche touchmove per feedback immediato
                this.state.touchMoveHandler = (e) => {
                    if (this.state.hasScrolled || this.state.isTransitioning) return;
                    const touchY = e.touches[0].clientY;
                    const diff = this.state.touchStartY - touchY;
                    // Trigger on swipe up (30px threshold)
                    if (diff > 30) {
                        this.state.hasScrolled = true;
                        this.fadeOutGate();
                    }
                };

                window.addEventListener('touchstart', this.state.touchStartHandler, { passive: true });
                window.addEventListener('touchmove', this.state.touchMoveHandler, { passive: true });
                window.addEventListener('touchend', this.state.touchEndHandler, { passive: true });
            },

            removeAllListeners() {
                // Clean up all event listeners
                if (this.state.wheelHandler) {
                    window.removeEventListener('wheel', this.state.wheelHandler);
                }
                if (this.state.touchStartHandler) {
                    window.removeEventListener('touchstart', this.state.touchStartHandler);
                }
                if (this.state.touchMoveHandler) {
                    window.removeEventListener('touchmove', this.state.touchMoveHandler);
                }
                // ✅ MOBILE-FIRST: Cleanup touchend handler
                if (this.state.touchEndHandler) {
                    window.removeEventListener('touchend', this.state.touchEndHandler);
                }
            },

            fadeOutGate() {
                // Prevent multiple triggers
                if (this.state.isTransitioning) return;
                this.state.isTransitioning = true;

                // Remove all listeners immediately
                this.removeAllListeners();

                // Keep scroll locked during transition
                this.lockScroll();

                // Start video immediately
                if (this.elements.heroVideo) {
                    this.elements.heroVideo.play().catch(e => console.warn('Video play failed:', e));
                }

                // ✅ SOLUZIONE 1: Gate più veloce su mobile
                const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
                const gateDuration = isMobile ? 0.6 : 1.2;  // ✅ 0.6s su mobile

                // Animate gate out
                gsap.to(this.elements.gate, {
                    yPercent: -100,
                    duration: gateDuration,  // ✅ Dinamico
                    ease: isMobile ? 'power2.out' : 'power3.inOut',  // ✅ Ease più leggero su mobile
                    onComplete: () => {
                        // Hide gate completely
                        this.elements.gate.style.display = 'none';
                        this.elements.gate.style.visibility = 'hidden';

                        // Remove spacer from DOM entirely
                        if (this.elements.scrollSpacer) {
                            this.elements.scrollSpacer.remove();
                        }

                        // Reset scroll position BEFORE unlocking
                        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

                        // Remove gate-active class
                        document.body.classList.remove('gate-active');

                        // Create reveal timeline for hero elements
                        const revealTl = gsap.timeline({
                            onComplete: () => {
                                // UNLOCK SCROLL only after all reveals complete
                                this.unlockScroll();

                                // Switch video container to relative for scrolling
                                if (this.elements.videoContainer) {
                                    this.elements.videoContainer.classList.add('scrollable');
                                }

                                // Show main content wrapper
                                if (this.elements.mainContent) {
                                    this.elements.mainContent.classList.add('visible');
                                }

                                // Init Lenis LAST - after everything is ready
                                requestAnimationFrame(() => {
                                    initLenis();
                                    // Final scroll position reset
                                    window.scrollTo(0, 0);
                                    // Refresh ScrollTrigger
                                    if (typeof ScrollTrigger !== 'undefined') {
                                        ScrollTrigger.refresh();
                                    }
                                });
                            }
                        });

                        // Reveal menu
                        revealTl.to(this.elements.heroMenu, {
                            opacity: 1,
                            y: 0,
                            duration: 0.8,
                            ease: 'power2.out'
                        });

                        // Reveal banner
                        revealTl.to(this.elements.heroBanner, {
                            opacity: 1,
                            y: 0,
                            duration: 0.8,
                            ease: 'power2.out'
                        }, '-=0.5');

                        // Reveal brands banner SUPERIORE
                        if (this.elements.heroBrandsBanner) {
                            revealTl.to(this.elements.heroBrandsBanner, {
                                opacity: 1,
                                y: 0,
                                duration: 0.8,
                                ease: 'power2.out',
                                onComplete: () => {
                                    gsap.set(this.elements.heroBrandsBanner, {
                                        opacity: 1,
                                        y: 0,
                                        clearProps: 'transform',
                                        willChange: 'auto'
                                    });
                                    this.elements.heroBrandsBanner.classList.add('is-revealed');
                                }
                            }, '-=0.5');
                        }

                        // Reveal brands banner INFERIORE
                        if (this.elements.heroBrandsBannerBottom) {
                            revealTl.to(this.elements.heroBrandsBannerBottom, {
                                opacity: 1,
                                y: 0,
                                duration: 0.8,
                                ease: 'power2.out',
                                onComplete: () => {
                                    gsap.set(this.elements.heroBrandsBannerBottom, {
                                        opacity: 1,
                                        y: 0,
                                        clearProps: 'transform',
                                        willChange: 'auto'
                                    });
                                    this.elements.heroBrandsBannerBottom.classList.add('is-revealed');
                                }
                            }, '-=0.6'); // Overlap per effetto cascata
                        }
                    }
                });
            }
        };

        EntranceGate.init();
    }

    // Check if entrance gate exists on page
    function hasEntranceGate() {
        return document.getElementById('entranceGate') !== null;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initEntranceGate();
            // Only init Lenis immediately if NO gate present
            if (!hasEntranceGate()) {
                initLenis();
            }
        });
    } else {
        initEntranceGate();
        // Only init Lenis immediately if NO gate present
        if (!hasEntranceGate()) {
            initLenis();
        }
    }
})();