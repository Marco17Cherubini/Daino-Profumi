/**
 * Dark luxury 3D carousel — <daino-carousel> (sections/daino-carousel-3d.liquid).
 *
 * Infinite, draggable product carousel: cards scale, fade and blur with their
 * distance from the centre, and the track auto-scrolls. Scoped to its own section
 * instance; everything (Draggable, tweens, listeners, clones) is released in
 * disconnectedCallback so the Theme Editor can re-render it safely.
 *
 * Accessibility: cloned cards (used for the seamless loop) are inert and hidden from
 * assistive tech. Auto-scroll pauses on hover, focus and hidden tabs, and is off
 * when the visitor prefers reduced motion.
 */
(function (global) {
  'use strict';

  /** Pure helper: card width for a viewport width (45vw mobile, 22vw desktop, min 180px). */
  function cardWidthFor(viewportWidth) {
    return Math.max(180, viewportWidth < 768 ? viewportWidth * 0.45 : viewportWidth * 0.22);
  }

  /** Pure helper: wraps x into the window [start - set/2, start + set/2]. */
  function wrapX(x, startX, setWidth) {
    const threshold = setWidth / 2;
    if (x > startX + threshold) return x - setWidth;
    if (x < startX - threshold) return x + setWidth;
    return x;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { cardWidthFor, wrapX };
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  class DainoCarousel extends global.HTMLElement {
    connectedCallback() {
      // Ignore transient re-attachments (GSAP measuring transforms): see disconnectedCallback.
      if (this.initialized) return;
      this.initialized = true;
      this.track = this.querySelector('[data-carousel-track]');
      if (!this.track || typeof global.gsap === 'undefined' || typeof global.Draggable === 'undefined') return;
      global.gsap.registerPlugin(global.Draggable);
      this.listeners = new AbortController();
      this.originals = Array.from(this.track.children);
      this.build();

      const { signal } = this.listeners;
      let lastWidth = global.innerWidth;
      const onResize = Daino.debounce(() => {
        if (global.innerWidth === lastWidth) return;
        lastWidth = global.innerWidth;
        this.teardown();
        this.build();
      }, 250);
      global.addEventListener('resize', onResize, { passive: true, signal });

      const pause = () => this.autoScroll && this.autoScroll.pause();
      const resume = () => {
        if (this.autoScroll && !this.matches(':hover') && !this.contains(document.activeElement)) {
          this.autoScroll.resume();
        }
      };
      this.addEventListener('mouseenter', pause, { signal });
      this.addEventListener('mouseleave', resume, { signal });
      this.addEventListener('focusin', pause, { signal });
      this.addEventListener('focusout', () => setTimeout(resume), { signal });
      document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()), { signal });
    }

    disconnectedCallback() {
      queueMicrotask(() => {
        if (this.isConnected) return;
        this.initialized = false;
        if (this.listeners) this.listeners.abort();
        this.teardown();
      });
    }

    build() {
      const gsap = global.gsap;
      const track = this.track;
      const viewport = this.clientWidth || global.innerWidth;
      const cardWidth = cardWidthFor(global.innerWidth);
      const count = this.originals.length;
      if (count === 0) return;

      // Two extra copies of the set make the loop seamless.
      for (let copy = 0; copy < 2; copy++) {
        this.originals.forEach((card) => {
          const clone = card.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          clone.inert = true;
          clone.dataset.carouselClone = '';
          track.appendChild(clone);
        });
      }

      const cards = Array.from(track.children);
      const setWidth = cardWidth * count;
      const startX = -setWidth + viewport / 2 - cardWidth / 2;
      cards.forEach((card, i) => gsap.set(card, { x: i * cardWidth, left: 0, width: cardWidth, position: 'absolute' }));
      gsap.set(track, { x: startX });

      const updateVisuals = (trackX) => {
        const centre = viewport / 2;
        const maxDist = viewport * 0.55;
        const ease = gsap.parseEase('power2.in');
        cards.forEach((card, i) => {
          const dist = Math.abs(centre - (i * cardWidth + trackX + cardWidth / 2));
          const norm = Math.min(dist, maxDist) / maxDist;
          const eased = ease(norm);
          gsap.set(card, {
            scale: 1 - eased * 0.35,
            opacity: Math.max(0, 1 - eased * 0.95),
            filter: `blur(${eased * 12}px) brightness(${Math.max(0.1, 1 - eased * 0.9)})`,
            zIndex: 100 - Math.round(norm * 100),
          });
          const glow = card.querySelector('.glow');
          if (glow) gsap.set(glow, { opacity: dist < cardWidth * 0.6 ? 1 - dist / (cardWidth * 0.6) : 0 });
        });
      };

      const checkWrap = (draggable) => {
        const x = gsap.getProperty(track, 'x');
        const wrapped = wrapX(x, startX, setWidth);
        if (wrapped !== x) {
          gsap.set(track, { x: wrapped });
          if (draggable) draggable.update();
        }
        updateVisuals(wrapped);
      };

      const reducedMotion = Daino.prefersReducedMotion();
      let lastX = 0;
      let lastTime = 0;
      let velocity = 0;
      const self = this;

      this.dragger = global.Draggable.create(track, {
        type: 'x',
        inertia: false,
        edgeResistance: 0.5,
        onDragStart() {
          if (self.inertiaTween) self.inertiaTween.kill();
          if (self.autoScroll) self.autoScroll.kill();
          lastX = this.x;
          lastTime = Date.now();
          velocity = 0;
        },
        onDrag() {
          const now = Date.now();
          const dt = now - lastTime;
          if (dt > 0) {
            const speedFactor = global.innerWidth < 768 ? 0.6 : 1;
            velocity = ((this.x - lastX) / dt) * speedFactor * 0.8 + velocity * 0.2;
            if (Math.abs(velocity) > 3) velocity = 3 * Math.sign(velocity);
          }
          lastX = this.x;
          lastTime = now;
          checkWrap(this);
        },
        onDragEnd() {
          const throwDistance = Math.max(-2500, Math.min(2500, velocity * 400));
          self.inertiaTween = gsap.to(track, {
            x: this.x + throwDistance,
            duration: reducedMotion ? 0 : Math.min(2, Math.abs(throwDistance) / 300 + 0.5),
            ease: 'power3.out',
            onUpdate: () => {
              this.update();
              checkWrap(this);
            },
            onComplete: () => self.startAutoScroll(),
          });
        },
      })[0];

      this.startAutoScroll = () => {
        if (reducedMotion) return;
        this.autoScroll = gsap.to(track, {
          x: `-=${setWidth}`,
          duration: 20,
          ease: 'none',
          repeat: -1,
          onUpdate: () => checkWrap(this.dragger),
        });
        if (this.matches(':hover') || this.contains(document.activeElement)) this.autoScroll.pause();
      };

      checkWrap(this.dragger);
      if (reducedMotion) {
        gsap.set(cards, { opacity: 1 });
        updateVisuals(startX);
        return;
      }
      this.introTweens = [
        gsap.from(track, {
          x: startX + 800,
          duration: 2,
          ease: 'power3.out',
          onUpdate: () => checkWrap(this.dragger),
        }),
        gsap.to(cards, { opacity: 1, duration: 0.8, stagger: 0.02, delay: 0.2 }),
      ];
      this.startDelay = gsap.delayedCall(2.5, () => this.startAutoScroll());
    }

    teardown() {
      [this.autoScroll, this.inertiaTween, this.startDelay, ...(this.introTweens || [])].forEach((t) => t && t.kill());
      this.autoScroll = this.inertiaTween = this.startDelay = null;
      this.introTweens = [];
      if (this.dragger) this.dragger.kill();
      this.dragger = null;
      if (!this.track) return;
      this.track.querySelectorAll('[data-carousel-clone]').forEach((clone) => clone.remove());
      if (typeof global.gsap !== 'undefined') global.gsap.set([this.track, ...this.originals], { clearProps: 'all' });
    }
  }

  Daino.define('daino-carousel', DainoCarousel);
})(typeof window !== 'undefined' ? window : globalThis);
