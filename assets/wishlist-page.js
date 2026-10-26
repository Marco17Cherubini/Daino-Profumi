/**
 * Wishlist page — <daino-wishlist-page> (sections/wishlist.liquid).
 *
 * Loads the saved products from the storefront `products.json` endpoint, page by
 * page (250 per page), until every saved id is found or the catalogue ends — the
 * previous version read only the first 250 products. Then:
 * - products that are sold out are shown with the "sold out" badge;
 * - ids that no longer exist in the catalogue are removed from storage, with a notice;
 * - network errors leave storage untouched and show an error message.
 *
 * Cards are cloned from a <template> rendered by snippets/product-card.liquid and
 * filled with textContent/setAttribute only (no HTML strings).
 */
(function (global) {
  'use strict';

  const PAGE_SIZE = 250;
  const MAX_PAGES = 40; // 10,000 products: a safety stop, far above this catalogue.

  /**
   * Fetches catalogue pages until all `ids` are found.
   * @param {string[]} ids saved product ids
   * @param {(page: number) => Promise<object[]>} fetchPage resolves to the products of a page
   * @returns {Promise<{found: Map<string, object>, missing: string[], complete: boolean}>}
   */
  async function collectProducts(ids, fetchPage) {
    const wanted = new Set(ids);
    const found = new Map();
    let complete = false;
    for (let page = 1; page <= MAX_PAGES && found.size < wanted.size; page++) {
      const products = await fetchPage(page);
      products.forEach((product) => {
        const id = String(product.id);
        if (wanted.has(id)) found.set(id, product);
      });
      if (products.length < PAGE_SIZE) {
        complete = true;
        break;
      }
    }
    if (found.size === wanted.size) complete = true;
    // Only ids missing from a *complete* scan are known to be gone.
    const missing = complete ? ids.filter((id) => !found.has(id)) : [];
    return { found, missing, complete };
  }

  /** Maps a products.json product to the fields a card needs (prices in cents). */
  function toCardData(product, rootUrl) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const prices = variants.map((v) => Math.round(parseFloat(v.price) * 100)).filter(Number.isFinite);
    const compares = variants.map((v) => Math.round(parseFloat(v.compare_at_price) * 100)).filter(Number.isFinite);
    const price = prices.length ? Math.min(...prices) : 0;
    const compareAt = compares.length ? Math.max(...compares) : 0;
    const image = Array.isArray(product.images) && product.images[0] ? product.images[0].src : '';
    return {
      id: String(product.id),
      title: product.title || '',
      vendor: product.vendor || '',
      url: `${rootUrl.replace(/\/?$/, '/')}products/${encodeURIComponent(product.handle)}`,
      image,
      price,
      compareAt: compareAt > price ? compareAt : 0,
      available: variants.some((v) => v.available),
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { collectProducts, toCardData, PAGE_SIZE };
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  class DainoWishlistPage extends global.HTMLElement {
    connectedCallback() {
      this.strings = Daino.readJSON(this.querySelector('[data-wishlist-strings]'), {}) || {};
      this.grid = this.querySelector('[data-wishlist-grid]');
      this.template = this.querySelector('[data-wishlist-card-template]');
      this.abort = new AbortController();
      this.grid.addEventListener('click', (event) => this.onRemove(event), { signal: this.abort.signal });
      this.load();
    }

    disconnectedCallback() {
      this.abort.abort();
    }

    get store() {
      return global.DainoWishlist;
    }

    setCount(count) {
      this.querySelector('[data-wishlist-count-text]').textContent = (this.strings.count || '').replace(
        '__QUANTITY__',
        String(count)
      );
    }

    show(selector, visible) {
      const el = this.querySelector(selector);
      if (el) el.hidden = !visible;
    }

    async load() {
      const ids = this.store ? this.store.getAll() : [];
      this.setCount(ids.length);
      if (ids.length === 0) {
        this.show('[data-wishlist-empty]', true);
        return;
      }

      this.show('[data-wishlist-loading]', true);
      const root = Daino.config().routes.root || '/';
      const fetchPage = async (page) => {
        const response = await fetch(`${root.replace(/\/?$/, '/')}products.json?limit=${PAGE_SIZE}&page=${page}`, {
          signal: this.abort.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        return Array.isArray(body.products) ? body.products : [];
      };

      try {
        const { found, missing } = await collectProducts(ids, fetchPage);
        if (missing.length) {
          this.store.removeMany(missing);
          const notice = this.querySelector('[data-wishlist-notice]');
          notice.textContent = (this.strings.removedMissing || '').replace('__QUANTITY__', String(missing.length));
          notice.hidden = false;
        }
        const cards = ids.filter((id) => found.has(id)).map((id) => this.renderCard(toCardData(found.get(id), root)));
        this.grid.replaceChildren(...cards);
        this.setCount(cards.length);
        this.show('[data-wishlist-empty]', cards.length === 0);
      } catch (error) {
        if (Daino.isAbortError(error)) return;
        console.error('[Daino] Wishlist load failed', error);
        const errorEl = this.querySelector('[data-wishlist-error]');
        errorEl.textContent = this.strings.error || '';
        errorEl.hidden = false;
      } finally {
        this.show('[data-wishlist-loading]', false);
      }
    }

    renderCard(data) {
      const card = this.template.content.firstElementChild.cloneNode(true);
      card.dataset.productId = data.id;
      card.querySelector('[data-card-link]').href = data.url;
      card.querySelector('[data-card-title]').textContent = data.title;
      const vendor = card.querySelector('[data-card-vendor]');
      if (data.vendor) vendor.textContent = data.vendor;
      else vendor.remove();

      const image = card.querySelector('[data-card-image]');
      if (data.image) {
        const src = new URL(data.image, global.location.href);
        src.searchParams.set('width', '600');
        image.src = src.toString();
        image.alt = data.title;
        image.hidden = false;
      } else {
        image.remove();
      }

      const price = card.querySelector('[data-card-price]');
      const parts = [];
      if (data.compareAt) {
        const compare = document.createElement('span');
        compare.className = 'product-card__price--compare';
        compare.textContent = Daino.formatMoney(data.compareAt);
        parts.push(compare, ' ');
      }
      parts.push(Daino.formatMoney(data.price));
      price.replaceChildren(...parts);

      card.querySelector('[data-card-soldout]').hidden = data.available;
      const remove = card.querySelector('[data-card-remove]');
      if (remove) remove.dataset.productId = data.id;
      return card;
    }

    onRemove(event) {
      const button = event.target.closest('[data-card-remove]');
      if (!button) return;
      event.preventDefault();
      this.store.remove(button.dataset.productId);
      const card = button.closest('[data-card]');
      const next = card.nextElementSibling || card.previousElementSibling;
      card.remove();
      const remaining = this.grid.children.length;
      this.setCount(remaining);
      this.show('[data-wishlist-empty]', remaining === 0);
      const focusTarget = next ? next.querySelector('a, button') : this.querySelector('[data-wishlist-empty] a');
      if (focusTarget) focusTarget.focus();
    }
  }

  Daino.define('daino-wishlist-page', DainoWishlistPage);
})(typeof window !== 'undefined' ? window : globalThis);
