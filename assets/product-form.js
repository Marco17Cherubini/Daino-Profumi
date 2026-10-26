/**
 * Product page — <daino-product> (sections/main-product.liquid)
 * and <daino-related-products>.
 *
 * - Variant picker: keeps the hidden variant id, price, availability badge, buttons,
 *   URL and gallery image in sync with the selected options. A combination that does
 *   not exist disables the purchase buttons instead of silently keeping the previous
 *   variant.
 * - Quantity stepper, gallery thumbnails, "Buy now" (add to cart, then checkout).
 *
 * The initial variant (URL ?variant= or the cheapest available one) is resolved in
 * Liquid, so this script never overrides it on load.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Pure helpers (unit-tested in tests/unit/product-form.test.js)
  // ---------------------------------------------------------------------------

  /**
   * Finds the variant whose options match the selection exactly.
   * @param {Array<{options: string[]}>} variants
   * @param {Array<string|null>} selected one value per option, in option order
   * @returns {object|null} null when the combination does not exist or is incomplete
   */
  function findVariant(variants, selected) {
    if (!Array.isArray(variants) || selected.some((value) => value === null || value === undefined)) return null;
    return (
      variants.find(
        (variant) =>
          variant.options.length === selected.length && variant.options.every((value, i) => value === selected[i])
      ) || null
    );
  }

  /** Parses a quantity input value into an integer >= 1. */
  function normalizeQuantity(value) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= 1 ? number : 1;
  }

  /** Builds the product URL with ?variant= set, preserving other parameters and the hash. */
  function variantUrl(href, variantId) {
    const url = new URL(href);
    url.searchParams.set('variant', String(variantId));
    return url.toString();
  }

  /** Extracts a readable message from a Cart Ajax API error body. */
  function cartErrorMessage(body, fallback) {
    if (body && typeof body.description === 'string' && body.description) return body.description;
    if (body && typeof body.message === 'string' && body.message) return body.message;
    return fallback;
  }

  const helpers = { findVariant, normalizeQuantity, variantUrl, cartErrorMessage };

  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  // ---------------------------------------------------------------------------
  // <daino-product>
  // ---------------------------------------------------------------------------

  class DainoProduct extends global.HTMLElement {
    connectedCallback() {
      this.variants = Daino.readJSON(this.querySelector('[data-product-variants]'), []) || [];
      this.strings = Daino.readJSON(this.querySelector('[data-product-strings]'), {}) || {};
      this.form = this.querySelector('[data-product-form]');
      this.variantInput = this.querySelector('[data-variant-id]');
      this.quantityInput = this.querySelector('[data-quantity-input]');
      this.addButton = this.querySelector('[data-add-to-cart]');
      this.buyNowButton = this.querySelector('[data-buy-now]');
      this.errorEl = this.querySelector('[data-form-error]');
      this.statusEl = this.querySelector('[data-variant-status]');
      this.mainImage = this.querySelector('[data-gallery-main]');
      this.zoomLink = this.querySelector('[data-gallery-zoom]');
      this.abort = new AbortController();
      const { signal } = this.abort;

      this.currentVariant = this.variants.find((v) => String(v.id) === this.variantInput?.value) || null;

      this.addEventListener(
        'change',
        (event) => {
          if (event.target.matches('[data-option-group] input')) this.onOptionChange();
          if (event.target === this.quantityInput) {
            this.quantityInput.value = normalizeQuantity(this.quantityInput.value);
          }
        },
        { signal }
      );

      this.addEventListener(
        'click',
        (event) => {
          const step = event.target.closest('[data-quantity-step]');
          if (step) this.stepQuantity(Number(step.dataset.quantityStep));
          const thumb = event.target.closest('[data-gallery-thumb]');
          if (thumb) this.showImage(thumb.dataset.imageUrl, thumb.dataset.zoomUrl, thumb.dataset.imageAlt, thumb);
          if (event.target.closest('[data-buy-now]')) this.buyNow();
        },
        { signal }
      );

      // "Buy now" needs JavaScript (Cart Ajax API); without it the button stays hidden.
      if (this.buyNowButton) this.buyNowButton.hidden = false;

      this.dragScrollDestroyers = Array.from(this.querySelectorAll('[data-drag-scroll]')).map((el) =>
        Daino.dragScroll(el)
      );
    }

    disconnectedCallback() {
      this.abort.abort();
      this.dragScrollDestroyers.forEach((destroy) => destroy());
    }

    selectedOptions() {
      return Array.from(this.querySelectorAll('[data-option-group]')).map((group) => {
        const checked = group.querySelector('input:checked');
        return checked ? checked.value : null;
      });
    }

    onOptionChange() {
      const variant = findVariant(this.variants, this.selectedOptions());
      this.currentVariant = variant;
      this.clearError();

      if (!variant) {
        this.setPurchasable(false);
        this.setBadge('unavailable');
        this.announce(this.strings.unavailable);
        return;
      }

      this.variantInput.value = variant.id;
      this.renderPrice(variant);
      this.setPurchasable(variant.available);
      this.setBadge(variant.available ? 'available' : 'soldOut');
      this.announce(
        `${Daino.formatMoney(variant.price)} — ${variant.available ? this.strings.available : this.strings.soldOut}`
      );
      global.history.replaceState(global.history.state, '', variantUrl(global.location.href, variant.id));

      const image = variant.featured_image;
      if (image && image.src) {
        this.showImage(this.sizedImage(image.src, 1000), this.sizedImage(image.src, 2400), image.alt);
      }
    }

    renderPrice(variant) {
      const priceEl = this.querySelector('[data-product-price]');
      if (!priceEl) return;
      const amount = document.createElement('span');
      amount.dataset.productAmount = '';
      amount.textContent = Daino.formatMoney(variant.price);
      const nodes = [];
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        const compare = document.createElement('span');
        compare.className = 'product-price__compare';
        compare.dataset.productCompare = '';
        compare.textContent = Daino.formatMoney(variant.compare_at_price);
        nodes.push(compare);
      }
      nodes.push(amount);
      priceEl.replaceChildren(...nodes);
    }

    setBadge(state) {
      const badge = this.querySelector('[data-product-badge]');
      if (!badge) return;
      badge.classList.toggle('product-badge--available', state === 'available');
      badge.classList.toggle('product-badge--soldout', state !== 'available');
      badge.textContent = this.strings[state] || '';
    }

    setPurchasable(purchasable) {
      [this.addButton, this.buyNowButton].forEach((button) => {
        if (button) button.disabled = !purchasable;
      });
    }

    announce(message) {
      if (this.statusEl && message) this.statusEl.textContent = message;
    }

    stepQuantity(step) {
      if (!this.quantityInput) return;
      this.quantityInput.value = Math.max(1, normalizeQuantity(this.quantityInput.value) + step);
    }

    sizedImage(src, width) {
      const url = new URL(src, global.location.href);
      url.searchParams.set('width', String(width));
      return url.toString();
    }

    showImage(src, zoomSrc, alt, activeThumb) {
      if (!this.mainImage || !src) return;
      this.mainImage.src = src;
      this.mainImage.removeAttribute('srcset');
      if (alt) this.mainImage.alt = alt;
      if (this.zoomLink && zoomSrc) this.zoomLink.href = zoomSrc;
      this.querySelectorAll('[data-gallery-thumb]').forEach((thumb) => {
        const active = thumb === activeThumb;
        thumb.classList.toggle('product-gallery__thumb--active', active);
        thumb.setAttribute('aria-pressed', String(active));
      });
    }

    clearError() {
      if (!this.errorEl) return;
      this.errorEl.hidden = true;
      this.errorEl.textContent = '';
    }

    showError(message) {
      if (!this.errorEl) return;
      this.errorEl.textContent = message;
      this.errorEl.hidden = false;
    }

    /** Adds the current selection to the cart (keeping what is already there), then goes to checkout. */
    async buyNow() {
      const variant = this.currentVariant;
      if (!variant || !variant.available || this.buyNowButton.disabled) return;
      this.clearError();
      this.buyNowButton.disabled = true;
      this.buyNowButton.setAttribute('aria-busy', 'true');

      try {
        const response = await fetch(`${Daino.config().routes.cartAdd}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: variant.id, quantity: normalizeQuantity(this.quantityInput?.value) }] }),
          signal: this.abort.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(cartErrorMessage(body, this.strings.cartError));
        }
        const checkoutForm =
          this.querySelector('[data-checkout-form]') || document.querySelector('[data-checkout-form]');
        checkoutForm.submit();
      } catch (error) {
        if (Daino.isAbortError(error)) return;
        this.showError(error.message || this.strings.cartError);
        this.buyNowButton.disabled = false;
        this.buyNowButton.removeAttribute('aria-busy');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // <daino-related-products> — Liquid renders up to 20 cards; show a random subset.
  // ---------------------------------------------------------------------------

  class DainoRelatedProducts extends global.HTMLElement {
    connectedCallback() {
      const grid = this.querySelector('.product-related__grid');
      if (!grid) return;
      const limit = Number(this.dataset.limit) || 6;
      const cards = Array.from(grid.querySelectorAll(':scope > .product-card'));
      const cta = grid.querySelector(':scope > .related-cta-card');

      // Fisher–Yates shuffle, then keep `limit` cards (previous behaviour: 6 random of 20).
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      cards.forEach((card, index) => {
        card.hidden = index >= limit;
        grid.insertBefore(card, cta);
      });
      this.classList.add('is-ready');
      this.destroyDrag = Daino.dragScroll(grid);
    }

    disconnectedCallback() {
      if (this.destroyDrag) this.destroyDrag();
    }
  }

  Daino.define('daino-product', DainoProduct);
  Daino.define('daino-related-products', DainoRelatedProducts);
})(typeof window !== 'undefined' ? window : globalThis);
