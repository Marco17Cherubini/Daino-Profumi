/**
 * Scroll animations shared by every page (loaded globally by layout/theme.liquid).
 *
 * - `.scroll-reveal`: sections fade up once when they enter the viewport.
 * - `.scroll-reveal-card`: grid items fade up, staggered by `data-delay`.
 * - `.reveal-text`: narrative lines fade up.
 *
 * Nothing is animated in the Theme Editor, when the visitor prefers reduced motion or
 * when GSAP is missing:
 * `html.animations-off` keeps everything visible (assets/daino-base.css).
 * Smooth scrolling (Lenis) starts here on pages without the entrance gate; on the
 * homepage the gate starts it after the visitor enters.
 */
(function (global) {
  'use strict';

  const Daino = global.Daino;

  function init() {
    if (!document.querySelector('daino-entrance-gate')) Daino.smoothScroll.init();

    const hasGsap = typeof global.gsap !== 'undefined' && typeof global.ScrollTrigger !== 'undefined';
    // No scroll animations inside the Theme Editor: re-rendered sections would not be
    // re-registered with ScrollTrigger and would stay hidden.
    const designMode = Boolean(global.Shopify && global.Shopify.designMode);
    if (!hasGsap || designMode || Daino.prefersReducedMotion()) {
      document.documentElement.classList.add('animations-off');
      return;
    }

    const gsap = global.gsap;
    gsap.registerPlugin(global.ScrollTrigger);

    // Touch devices: play once (no reverse) to save CPU.
    const touch = global.innerWidth < 768 || 'ontouchstart' in global;
    const toggleActions = touch ? 'play none none none' : 'play none none reverse';

    if (document.querySelector('.scroll-reveal')) {
      global.ScrollTrigger.batch('.scroll-reveal', {
        start: 'top 85%',
        once: true,
        onEnter: (elements) => {
          gsap.to(elements, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            overwrite: true,
            onComplete: () => elements.forEach((el) => (el.style.willChange = 'auto')),
          });
        },
      });
    }

    gsap.utils.toArray('.scroll-reveal-card').forEach((card) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: parseFloat(card.dataset.delay) || 0,
          scrollTrigger: { trigger: card, start: 'top 90%', toggleActions },
        }
      );
    });

    gsap.utils.toArray('.reveal-text').forEach((line) => {
      gsap.fromTo(
        line,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, scrollTrigger: { trigger: line, start: 'top 90%', toggleActions } }
      );
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
