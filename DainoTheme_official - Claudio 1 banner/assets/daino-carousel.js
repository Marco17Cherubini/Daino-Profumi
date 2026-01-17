/* ============================================
   DAINO THEME - DARK LUXURY CAROUSEL
   Converted from exo_sk.html
   ============================================ */
(function () {
    'use strict';

    function initCarousel() {
        if (typeof gsap === 'undefined' || typeof Draggable === 'undefined') {
            setTimeout(initCarousel, 100);
            return;
        }
        gsap.registerPlugin(Draggable);

        const track = document.getElementById("track");
        // NOTE: 'card' generic class might conflict. Ensure HTML uses specific class or scoped selector if possible.
        // For now, assuming standard structure from exo_sk.html
        let cards = Array.from(document.querySelectorAll("#track .card"));

        if (!track || cards.length === 0) {
            return;
        }

        // Determine width based on viewport immediately
        // Mobile: 45vw (matching CSS), Desktop: 22vw
        let cardWidth = window.innerWidth < 768 ? window.innerWidth * 0.45 : window.innerWidth * 0.22;
        if (cardWidth < 180) cardWidth = 180;

        // Clone logic (2 sets joined for infinite loop safety)
        const originalLength = cards.length;
        cards.forEach(card => track.appendChild(card.cloneNode(true)));
        cards.forEach(card => track.appendChild(card.cloneNode(true)));

        // Re-select all cards (original + clones)
        const allCards = Array.from(track.querySelectorAll(".card"));
        const itemWidth = cardWidth; // No gap
        const singleSetWidth = itemWidth * originalLength;

        // Position start in center
        const startX = -singleSetWidth + (window.innerWidth / 2) - (itemWidth / 2);

        // Initialize positions
        allCards.forEach((card, i) => {
            gsap.set(card, {
                x: i * itemWidth,
                left: 0,
                width: cardWidth,
                position: 'absolute'
            });
        });

        gsap.set(track, { x: startX });

        let lastX = 0, velocity = 0, lastTime = 0, inertiaTween, autoScrollTween;

        const draggable = Draggable.create(track, {
            type: "x",
            inertia: false,
            edgeResistance: 0.5,
            onDragStart() {
                if (inertiaTween) inertiaTween.kill();
                if (autoScrollTween) autoScrollTween.kill();
                lastX = this.x;
                lastTime = Date.now();
                velocity = 0;
            },
            onDrag() {
                const now = Date.now();
                const dt = now - lastTime;
                const dx = this.x - lastX;
                const isMobile = window.innerWidth < 768;  // ✅ Detect mobile
                
                if (dt > 0) {
                    // ✅ SPEED FACTOR mobile: 0.6x per drag più controllato
                    const speedFactor = isMobile ? 0.6 : 1.0;
                    velocity = ((dx / dt) * speedFactor * 0.8) + (velocity * 0.2);
                    // CLAMP VELOCITY to prevent vanishing items
                    if (Math.abs(velocity) > 3) velocity = 3 * Math.sign(velocity);
                }
                lastX = this.x;
                lastTime = now;
                checkWrap.call(this);
            },
            onDragEnd() {
                let throwDistance = velocity * 400;

                // CLAMP THROW DISTANCE
                const maxThrow = 2500;
                if (Math.abs(throwDistance) > maxThrow) {
                    throwDistance = maxThrow * Math.sign(throwDistance);
                }

                const targetX = this.x + throwDistance;
                const duration = Math.min(2.0, Math.abs(throwDistance) / 300 + 0.5);

                inertiaTween = gsap.to(track, {
                    x: targetX,
                    duration: duration,
                    ease: "power3.out",
                    onUpdate: () => {
                        this.update();
                        checkWrap.call(this);
                    },
                    onComplete: () => { startAutoScroll(); }
                });
            }
        })[0];

        function checkWrap() {
            let x = gsap.getProperty(track, "x");
            const threshold = singleSetWidth / 2;

            if (x > startX + threshold) {
                x -= singleSetWidth;
                gsap.set(track, { x: x });
                if (this.update) this.update();
            } else if (x < startX - threshold) {
                x += singleSetWidth;
                gsap.set(track, { x: x });
                if (this.update) this.update();
            }
            updateVisuals(x);
        }

        function updateVisuals(trackX) {
            const viewportCenter = window.innerWidth / 2;
            allCards.forEach((card, i) => {
                const cardX = (i * itemWidth) + trackX;
                const cardCenter = cardX + (cardWidth / 2);
                const dist = Math.abs(viewportCenter - cardCenter);

                const maxDist = window.innerWidth * 0.55;
                const normDist = Math.min(dist, maxDist) / maxDist;
                const easeDist = gsap.parseEase("power2.in")(normDist);

                const scale = 1 - (easeDist * 0.35);
                const opacity = 1 - (easeDist * 0.95);
                const blur = easeDist * 12;
                const brightness = 1 - (easeDist * 0.9);

                gsap.set(card, {
                    scale: scale,
                    opacity: Math.max(0, opacity),
                    filter: `blur(${blur}px) brightness(${Math.max(0.1, brightness)})`,
                    zIndex: 100 - Math.round(normDist * 100)
                });

                const glow = card.querySelector('.glow');
                if (glow) {
                    if (dist < cardWidth * 0.6) {
                        gsap.set(glow, { opacity: 1 - (dist / (cardWidth * 0.6)) });
                    } else {
                        gsap.set(glow, { opacity: 0 });
                    }
                }
            });
        }

        // Initial render
        checkWrap.call(draggable);

        // Animate In
        gsap.from(track, { x: startX + 800, duration: 2.0, ease: "power3.out", onUpdate: () => checkWrap.call(draggable) });
        gsap.to(allCards, { opacity: 1, duration: 0.8, stagger: 0.02, delay: 0.2 });

        // Auto-scroll loop (like brand marquee)

        function startAutoScroll() {
            autoScrollTween = gsap.to(track, {
                x: `-=${singleSetWidth}`,
                duration: 20,
                ease: "none",
                repeat: -1,
                onUpdate: () => checkWrap.call(draggable)
            });
        }

        // Start auto-scroll after entry animation
        gsap.delayedCall(2.5, startAutoScroll);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        initCarousel();
    }
})();
