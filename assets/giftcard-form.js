/**
 * Gift card plaque — <daino-giftcard-plaque> (sections/daino-giftcard-form.liquid).
 * Tilts the plaque in 3D with the pointer or finger. Disabled under reduced motion.
 */
(function (global) {
  'use strict';

  const MAX_ROTATE = 10;

  /** Pure helper: rotation in degrees for a pointer position relative to the element. */
  function tiltFor(x, y, rect) {
    const px = (x - rect.left) / rect.width;
    const py = (y - rect.top) / rect.height;
    return { rotateX: (py - 0.5) * 2 * MAX_ROTATE, rotateY: -(px - 0.5) * 2 * MAX_ROTATE };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { tiltFor };
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  class DainoGiftcardPlaque extends global.HTMLElement {
    connectedCallback() {
      if (Daino.prefersReducedMotion()) return;
      this.abort = new AbortController();
      const { signal } = this.abort;
      const tilt = (x, y) => {
        const { rotateX, rotateY } = tiltFor(x, y, this.getBoundingClientRect());
        this.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`;
        this.style.transition = 'transform 0.1s ease-out';
      };
      const reset = () => {
        this.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)';
        this.style.transition = 'transform 0.5s ease-out';
      };
      this.addEventListener('mousemove', (e) => tilt(e.clientX, e.clientY), { signal });
      this.addEventListener('mouseleave', reset, { signal });
      this.addEventListener('touchmove', (e) => tilt(e.touches[0].clientX, e.touches[0].clientY), {
        passive: true,
        signal,
      });
      this.addEventListener('touchend', reset, { signal });
    }

    disconnectedCallback() {
      if (this.abort) this.abort.abort();
    }
  }

  Daino.define('daino-giftcard-plaque', DainoGiftcardPlaque);
})(typeof window !== 'undefined' ? window : globalThis);
