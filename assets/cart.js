/**
 * Cart page — <daino-cart> (sections/main-cart.liquid).
 *
 * Progressive enhancement only: shows the +/− buttons and submits the native cart
 * form (with the `update` action) after a step. Removal, notes and checkout are
 * plain form posts and links that work without JavaScript.
 */
(function (global) {
  'use strict';

  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  class DainoCart extends global.HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('#cart-form');
      this.abort = new AbortController();
      this.querySelectorAll('[data-quantity-step]').forEach((button) => (button.hidden = false));
      this.addEventListener(
        'click',
        (event) => {
          const button = event.target.closest('[data-quantity-step]');
          if (!button) return;
          const input = button.parentElement.querySelector('[data-quantity-input]');
          const next = Math.max(0, (parseInt(input.value, 10) || 0) + Number(button.dataset.quantityStep));
          if (next === Number(input.value)) return;
          input.value = next;
          const update = this.form.querySelector('[name="update"]');
          this.form.requestSubmit(update || undefined);
        },
        { signal: this.abort.signal }
      );
    }

    disconnectedCallback() {
      this.abort.abort();
    }
  }

  Daino.define('daino-cart', DainoCart);
})(typeof window !== 'undefined' ? window : globalThis);
