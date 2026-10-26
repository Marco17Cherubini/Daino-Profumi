/**
 * Entrance gate — <daino-entrance-gate> (sections/daino-entrance-gate.liquid).
 *
 * Full-screen logo shown on arrival on the homepage. The visitor enters by
 * scrolling, swiping up, clicking the indicator button or pressing Enter, Space,
 * ArrowDown or PageDown. The hero elements marked [data-gate-reveal] (hero video
 * section) are then revealed in sequence and the page becomes scrollable.
 *
 * The gate is skipped — content revealed immediately — in the Theme Editor, when the
 * visitor prefers reduced motion, or when GSAP is unavailable. Without JavaScript it
 * is hidden by CSS (`.no-js`).
 */
(function (global) {
  'use strict';

  /** Keys that open the gate when pressed anywhere on the page. */
  const ENTER_KEYS = ['Enter', ' ', 'Spacebar', 'ArrowDown', 'PageDown'];
  const SWIPE_THRESHOLD = 30;

  /** Pure helper: should this swipe (touch start/end Y) open the gate? */
  function isSwipeUp(startY, currentY) {
    return startY - currentY > SWIPE_THRESHOLD;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { isSwipeUp, ENTER_KEYS };
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  function heroElements() {
    return {
      reveal: Array.from(document.querySelectorAll('[data-gate-reveal]')),
      video: document.querySelector('[data-hero-video]'),
      container: document.querySelector('[data-hero-container]'),
    };
  }

  function playVideo(video) {
    if (!video) return;
    const playing = video.play();
    if (playing && playing.catch) playing.catch((error) => console.warn('[Daino] Hero video autoplay failed', error));
  }

  /** Shows the hero immediately (no gate, or gate skipped). */
  function revealHeroNow() {
    const { reveal, video, container } = heroElements();
    reveal.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      if (el.matches('[data-brands-banner]')) el.classList.add('is-revealed');
    });
    if (container) container.classList.add('scrollable');
    playVideo(video);
  }

  class DainoEntranceGate extends global.HTMLElement {
    connectedCallback() {
      // GSAP briefly re-parents fixed elements to measure their transform, which fires
      // disconnected/connected callbacks: ignore those moves (see disconnectedCallback).
      if (this.initialized) return;
      this.initialized = true;
      this.spacer = document.querySelector('[data-gate-spacer]');
      this.logo = this.querySelector('.logo-entrance');
      this.indicator = this.querySelector('[data-gate-enter]');
      this.listeners = new AbortController();
      this.tweens = [];

      const skip =
        this.hasAttribute('data-design-mode') || Daino.prefersReducedMotion() || typeof global.gsap === 'undefined';
      if (skip) {
        if (typeof global.gsap === 'undefined') document.documentElement.classList.add('animations-off');
        this.finish({ animate: false });
        return;
      }

      Daino.scrollLock.lock('entrance-gate');
      document.body.classList.add('gate-active');

      const intro = global.gsap.timeline();
      intro.to(this.logo, { opacity: 1, duration: 2, ease: 'power2.out' });
      intro.to(this.indicator, { opacity: 1, duration: 1.5, delay: 0.5 }, '-=1');
      intro.call(() => this.enableEntry());
      this.tweens.push(intro);

      // The button is usable at once, even while the intro is still fading in.
      this.indicator.addEventListener('click', () => this.open(), { signal: this.listeners.signal });
    }

    disconnectedCallback() {
      // Tear down only if the element is really gone (section removed or re-rendered
      // in the Theme Editor), not when it is moved and re-attached in the same task.
      queueMicrotask(() => {
        if (this.isConnected) return;
        this.initialized = false;
        this.listeners.abort();
        this.tweens.forEach((tween) => tween.kill());
        Daino.scrollLock.unlock('entrance-gate');
        document.body.classList.remove('gate-active');
      });
    }

    enableEntry() {
      const { signal } = this.listeners;
      let touchStartY = 0;
      global.addEventListener('wheel', () => this.open(), { passive: true, once: true, signal });
      global.addEventListener('touchstart', (event) => (touchStartY = event.touches[0].clientY), {
        passive: true,
        signal,
      });
      global.addEventListener(
        'touchmove',
        (event) => {
          if (isSwipeUp(touchStartY, event.touches[0].clientY)) this.open();
        },
        { passive: true, signal }
      );
      global.addEventListener(
        'touchend',
        (event) => {
          if (isSwipeUp(touchStartY, event.changedTouches[0].clientY)) this.open();
        },
        { passive: true, signal }
      );
      document.addEventListener(
        'keydown',
        (event) => {
          if (!ENTER_KEYS.includes(event.key)) return;
          event.preventDefault();
          this.open();
        },
        { signal }
      );
      this.indicator.focus({ preventScroll: true });
    }

    open() {
      if (this.isOpening) return;
      this.isOpening = true;
      this.listeners.abort();
      playVideo(heroElements().video);

      const touch = global.innerWidth < 768 || 'ontouchstart' in global;
      const out = global.gsap.to(this, {
        yPercent: -100,
        duration: touch ? 0.6 : 1.2,
        ease: touch ? 'power2.out' : 'power3.inOut',
        onComplete: () => this.finish({ animate: true }),
      });
      this.tweens.push(out);
    }

    /** Removes the gate and reveals the hero, with or without the staggered animation. */
    finish({ animate }) {
      this.hidden = true;
      if (this.spacer) this.spacer.remove();
      global.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.classList.remove('gate-active');

      const done = () => {
        Daino.scrollLock.unlock('entrance-gate');
        const { container } = heroElements();
        if (container) container.classList.add('scrollable');
        Daino.smoothScroll.init();
        if (typeof global.ScrollTrigger !== 'undefined') global.ScrollTrigger.refresh();
        const main = document.getElementById('MainContent');
        if (
          main &&
          (!document.activeElement || document.activeElement === document.body || this.contains(document.activeElement))
        ) {
          main.focus({ preventScroll: true });
        }
      };

      if (!animate) {
        revealHeroNow();
        done();
        return;
      }

      const { reveal } = heroElements();
      const timeline = global.gsap.timeline({ onComplete: done });
      reveal.forEach((el, index) => {
        const isBanner = el.matches('[data-brands-banner]');
        timeline.to(
          el,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out',
            onComplete: isBanner
              ? () => {
                  global.gsap.set(el, { clearProps: 'transform', willChange: 'auto' });
                  el.classList.add('is-revealed');
                }
              : undefined,
          },
          index === 0 ? 0 : index === reveal.length - 1 && isBanner ? '-=0.6' : '-=0.5'
        );
      });
      this.tweens.push(timeline);
    }
  }

  Daino.define('daino-entrance-gate', DainoEntranceGate);
})(typeof window !== 'undefined' ? window : globalThis);
