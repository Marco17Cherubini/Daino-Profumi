/**
 * Wishlist — saved products in localStorage (no login required).
 *
 * Storage: key `daino_wishlist`, value a JSON array of product ids as strings
 * (format unchanged since the first version of the theme). Missing, corrupted or
 * blocked storage is treated as an empty list and never breaks the page.
 *
 * - Heart buttons: any element with [data-wishlist-btn][data-product-id] toggles.
 * - Count badges: [data-wishlist-count].
 * - The wishlist page itself is <daino-wishlist-page> (assets/wishlist-page.js).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'daino_wishlist';

  /** Normalises any stored value into a list of unique, non-empty id strings. */
  function normalize(value) {
    if (!Array.isArray(value)) return [];
    const ids = value
      .filter((id) => typeof id === 'string' || typeof id === 'number')
      .map((id) => String(id).trim())
      .filter((id) => /^\d+$/.test(id));
    return Array.from(new Set(ids));
  }

  /**
   * Creates a wishlist store on top of a Storage-like object.
   * @param {Storage|null} storage window.localStorage, or a stub in tests
   */
  function createStore(storage) {
    const listeners = new Set();

    function read() {
      try {
        const raw = storage ? storage.getItem(STORAGE_KEY) : null;
        return raw ? normalize(JSON.parse(raw)) : [];
      } catch {
        return [];
      }
    }

    function write(ids) {
      const list = normalize(ids);
      try {
        if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch (error) {
        console.warn('[Daino] Wishlist could not be saved', error);
      }
      listeners.forEach((listener) => listener(list));
      return list;
    }

    return {
      getAll: read,
      has: (id) => read().includes(String(id)),
      count: () => read().length,
      add: (id) => write([...read(), String(id)]),
      remove: (id) => write(read().filter((item) => item !== String(id))),
      /** Removes several ids at once (products that no longer exist). */
      removeMany: (ids) => {
        const drop = new Set(ids.map(String));
        return write(read().filter((item) => !drop.has(item)));
      },
      /** @returns {boolean} true when the product is now saved */
      toggle(id) {
        const saved = read().includes(String(id));
        if (saved) this.remove(id);
        else this.add(id);
        return !saved;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      /** Notifies subscribers without writing (e.g. after a change in another tab). */
      refresh: () => listeners.forEach((listener) => listener(read())),
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createStore, normalize, STORAGE_KEY };
  if (typeof global.document === 'undefined') return;

  // Accessing localStorage can throw (privacy settings, sandboxed iframes).
  const storage = (() => {
    try {
      return global.localStorage;
    } catch {
      return null;
    }
  })();

  const store = createStore(storage);
  const Daino = global.Daino;

  function updateUI(ids = store.getAll()) {
    document.querySelectorAll('[data-wishlist-count]').forEach((badge) => {
      badge.textContent = String(ids.length);
      badge.hidden = ids.length === 0;
    });
    document.querySelectorAll('[data-wishlist-btn][data-product-id]').forEach((button) => {
      const saved = ids.includes(button.dataset.productId);
      button.classList.toggle('active', saved);
      button.setAttribute('aria-pressed', String(saved));
      if (Daino) button.setAttribute('aria-label', Daino.t(saved ? 'wishlistRemove' : 'wishlistAdd'));
    });
  }

  store.subscribe(updateUI);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-wishlist-btn][data-product-id]');
    if (!button) return;
    event.preventDefault();
    store.toggle(button.dataset.productId);
    button.classList.add('wishlist-animate');
    setTimeout(() => button.classList.remove('wishlist-animate'), 300);
  });

  // Keep badges in sync when the wishlist changes in another tab.
  global.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) store.refresh();
  });

  // Section re-renders in the Theme Editor bring back unstyled buttons.
  document.addEventListener('shopify:section:load', () => updateUI());

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => updateUI());
  else updateUI();

  global.DainoWishlist = store;
})(typeof window !== 'undefined' ? window : globalThis);
