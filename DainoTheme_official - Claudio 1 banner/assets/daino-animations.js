/* ============================================
   DAINO THEME - SCROLL ANIMATIONS & GIANT VISUAL
   Converted from exo_sk.html
   ============================================ */
(function () {
    'use strict';

    function initAnimations() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            return;
        }

        gsap.registerPlugin(ScrollTrigger);

        // ✅ FIX 2: MOBILE-FIRST - toggleActions ottimizzato
        // Mobile: "play none none none" (no reverse, meno CPU)
        // Desktop: "play none none reverse" (animazioni bidirezionali)
        const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
        const toggleActions = isMobile ? "play none none none" : "play none none reverse";

        // ========================================
        // 1. GLOBAL SCROLL REVEAL (Standard Sections)
        // ✅ DOPO (efficiente - usa ScrollTrigger.batch):
        // ========================================
        const revealSections = document.querySelectorAll('.scroll-reveal');
        if (revealSections.length > 0) {
            ScrollTrigger.batch('.scroll-reveal', {
                onEnter: (elements) => {
                    gsap.to(elements, {
                        opacity: 1,
                        y: 0,
                        duration: 0.8,
                        stagger: 0.1,  // ✅ Stagger automatico nel batch
                        overwrite: true
                    });
                    // ✅ FIX: Pulisci will-change dopo animazione
                    elements.forEach(el => {
                        setTimeout(() => {
                            el.style.willChange = 'auto';
                        }, 1500);
                    });
                },
                start: "top 85%",
                once: true  // ✅ MOBILE: Anima solo una volta, poi ignora
            });
        }

        // ========================================
        // 1B. SCROLL REVEAL CARDS (Staggered Grid Items)
        // ========================================
        const revealCards = document.querySelectorAll('.scroll-reveal-card');
        if (revealCards.length > 0) {
            gsap.utils.toArray(revealCards).forEach((card) => {
                const delay = parseFloat(card.dataset.delay) || 0;
                gsap.fromTo(card,
                    { opacity: 0, y: 40 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.8,
                        delay: delay,
                        scrollTrigger: {
                            trigger: card,
                            start: "top 90%",
                            toggleActions: toggleActions // ✅ Mobile: no reverse
                        }
                    }
                );
            });
        }

        // Narrative text lines
        gsap.utils.toArray('.reveal-text').forEach((line) => {
            gsap.fromTo(line,
                { opacity: 0, y: 30 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 1,
                    scrollTrigger: {
                        trigger: line,
                        start: "top 90%",
                        toggleActions: toggleActions // ✅ Mobile: no reverse
                    }
                }
            );
        });

        // ========================================
        // 2. GIANT VISUAL SECTION (STICKY PINNING)
        // ========================================
        const giantSection = document.querySelector('.giant-visual-section');
        if (giantSection) {
            // ✅ FIX 3: MOBILE-FIRST - scrub ottimizzato
            // Mobile: scrub 0.5 (interpolazione smooth, meno CPU)
            // Desktop: scrub true (sincronizzazione pixel-per-pixel)
            const scrubValue = isMobile ? 0.5 : true;

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: ".giant-visual-section",
                    start: "top top",
                    end: "bottom bottom",
                    scrub: scrubValue, // ✅ Mobile: scrub 0.5 (più fluido)
                    // pin: true is NOT needed on section because .giant-sticky-container is position:sticky
                }
            });

            // Parallax/Scale Effect on Background
            tl.to('.giant-visual-wrapper', { scale: 1.25, duration: 1 }, 0);

            // Sequential Text Reveal
            // Block 1: 0% -> 25% (Fade In), 25% -> 35% (Fade Out)
            tl.to('.giant-copy-block:nth-child(1)', { opacity: 1, duration: 0.15 }, 0.05);
            tl.to('.giant-copy-block:nth-child(1)', { opacity: 0, duration: 0.15 }, 0.30);

            // Block 2: 35% -> 60% (Fade In), 60% -> 70% (Fade Out)
            tl.to('.giant-copy-block:nth-child(2)', { opacity: 1, duration: 0.15 }, 0.35);
            tl.to('.giant-copy-block:nth-child(2)', { opacity: 0, duration: 0.15 }, 0.65);

            // Block 3: 70% -> 95% (Fade In)
            tl.to('.giant-copy-block:nth-child(3)', { opacity: 1, duration: 0.15 }, 0.70);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnimations);
    } else {
        initAnimations();
    }
})();
