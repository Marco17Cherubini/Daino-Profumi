/**
 * Daino core — helpers shared by every theme component.
 *
 * Loaded with `defer` from layout/theme.liquid, after the vendor libraries and
 * before any component script. Exposes `window.Daino`; in Node (unit tests) the
 * same object is exported through `module.exports` (see docs/decisions.md, ADR-001).
 */
(function (global) {
  'use strict';

  const Daino = global.Daino || {};
  const doc = global.document;

  // ---------------------------------------------------------------------------
  // Data passed from Liquid
  // ---------------------------------------------------------------------------

  /**
   * Parses the JSON content of a `<script type="application/json">` element.
   * @param {string|Element|null} source element or element id
   * @param {*} fallback value returned when the element is missing or invalid
   */
  function readJSON(source, fallback = null) {
    const el = typeof source === 'string' ? doc && doc.getElementById(source) : source;
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent);
    } catch (error) {
      console.error('[Daino] Invalid JSON in', el.id || el, error);
      return fallback;
    }
  }

  let configCache = null;

  /** Global settings rendered by layout/theme.liquid (#DainoConfig): routes, money format, strings. */
  function config() {
    if (!configCache) configCache = readJSON('DainoConfig', {}) || {};
    return configCache;
  }

  /** Translated string from #DainoConfig, with `{{ name }}` interpolation. */
  function t(key, values = {}) {
    const template = (config().strings || {})[key];
    if (typeof template !== 'string') return key;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => (name in values ? String(values[name]) : match));
  }

  // ---------------------------------------------------------------------------
  // Money — mirrors Shopify's `money` filter placeholders
  // ---------------------------------------------------------------------------

  const MONEY_PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/;

  function formatAmount(cents, precision, thousands, decimal) {
    const [integer, fraction] = (cents / 100).toFixed(precision).split('.');
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return fraction ? grouped + decimal + fraction : grouped;
  }

  /**
   * Formats an amount in cents with the shop's money format (`shop.money_format`).
   * @param {number|string} cents
   * @param {string} [format] defaults to the format in #DainoConfig
   */
  function formatMoney(cents, format) {
    const value = Number(cents);
    if (!Number.isFinite(value)) return '';
    const template = String(format || config().moneyFormat || '{{amount}}').replace(/<[^>]*>/g, '');
    const match = template.match(MONEY_PLACEHOLDER);
    if (!match) return template;

    const formats = {
      amount: [2, ',', '.'],
      amount_no_decimals: [0, ',', '.'],
      amount_with_comma_separator: [2, '.', ','],
      amount_no_decimals_with_comma_separator: [0, '.', ','],
      amount_with_space_separator: [2, ' ', ','],
      amount_no_decimals_with_space_separator: [0, ' ', ','],
      amount_with_apostrophe_separator: [2, "'", '.'],
    };
    const [precision, thousands, decimal] = formats[match[1]] || formats.amount;
    return template.replace(MONEY_PLACEHOLDER, formatAmount(value, precision, thousands, decimal));
  }

  // ---------------------------------------------------------------------------
  // Network
  // ---------------------------------------------------------------------------

  function isAbortError(error) {
    return Boolean(error) && error.name === 'AbortError';
  }

  /**
   * Returns a fetch function where every call aborts the previous in-flight one,
   * so only the latest response is ever applied ("latest wins").
   * Rejects with an Error carrying `status` on HTTP errors.
   */
  function latestFetcher(fetchImpl) {
    let controller = null;
    const request = async function (url, options = {}) {
      if (controller) controller.abort();
      controller = new AbortController();
      const doFetch = fetchImpl || global.fetch;
      const response = await doFetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response;
    };
    request.abort = () => {
      if (controller) controller.abort();
    };
    return request;
  }

  /** Parses an HTML string (e.g. a Section Rendering API response) into a Document. */
  function parseHTML(html) {
    return new global.DOMParser().parseFromString(html, 'text/html');
  }

  // ---------------------------------------------------------------------------
  // Motion preferences
  // ---------------------------------------------------------------------------

  function prefersReducedMotion() {
    return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------------------------------------------------------------------------
  // Smooth scroll (Lenis) — desktop pointers only, never with reduced motion
  // ---------------------------------------------------------------------------

  const smoothScroll = {
    instance: null,

    init() {
      if (this.instance || typeof global.Lenis === 'undefined' || prefersReducedMotion()) return;
      const finePointer = global.matchMedia && global.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!finePointer) return;

      this.instance = new global.Lenis({ duration: 1.2, smooth: true, smoothTouch: false });
      if (typeof global.ScrollTrigger !== 'undefined' && typeof global.gsap !== 'undefined') {
        this.instance.on('scroll', global.ScrollTrigger.update);
        global.gsap.ticker.add((time) => this.instance && this.instance.raf(time * 1000));
      } else {
        const loop = (time) => {
          if (!this.instance) return;
          this.instance.raf(time);
          global.requestAnimationFrame(loop);
        };
        global.requestAnimationFrame(loop);
      }
      if (scrollLock.isLocked()) this.instance.stop();
    },

    stop() {
      if (this.instance) this.instance.stop();
    },

    start() {
      if (this.instance) this.instance.start();
    },
  };

  // ---------------------------------------------------------------------------
  // Scroll lock — the single owner of "page cannot scroll" (ADR-004)
  // ---------------------------------------------------------------------------

  const scrollLock = (function () {
    const owners = new Set();

    function apply() {
      const locked = owners.size > 0;
      if (doc) doc.documentElement.classList.toggle('is-scroll-locked', locked);
      if (locked) smoothScroll.stop();
      else smoothScroll.start();
    }

    return {
      /** @param {string} owner unique id of the component requesting the lock */
      lock(owner) {
        owners.add(owner);
        apply();
      },
      unlock(owner) {
        owners.delete(owner);
        apply();
      },
      isLocked() {
        return owners.size > 0;
      },
      /** Test helper. */
      reset() {
        owners.clear();
        apply();
      },
    };
  })();

  // ---------------------------------------------------------------------------
  // Overlay — modal panels (filters drawer, search): inert background, focus
  // trap, Escape, focus return, scroll lock.
  // ---------------------------------------------------------------------------

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function focusableElements(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.closest('[inert]') && el.getClientRects().length > 0
    );
  }

  /**
   * Opens a modal panel.
   * @param {HTMLElement} panel the dialog element
   * @param {object} options
   * @param {string} options.id scroll-lock owner id
   * @param {HTMLElement} [options.trigger] element that receives focus back on close
   * @param {HTMLElement} [options.initialFocus] element focused on open
   * @param {HTMLElement[]} [options.keep] elements outside the panel that must stay interactive
   * @param {Function} [options.onRequestClose] called on Escape
   * @returns {{ close: Function }}
   */
  function openOverlay(panel, options = {}) {
    const returnFocusTo = options.trigger || doc.activeElement;
    const keep = new Set(options.keep || []);
    const inerted = [];

    // Make everything outside the panel inert, walking up to <body>.
    let node = panel;
    while (node && node !== doc.body && node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || keep.has(sibling) || sibling.inert) continue;
        if (Array.from(keep).some((kept) => sibling.contains(kept))) continue;
        if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
        sibling.inert = true;
        inerted.push(sibling);
      }
      node = node.parentElement;
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (options.onRequestClose) options.onRequestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableElements(panel);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (doc.activeElement === first || !panel.contains(doc.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (doc.activeElement === last || !panel.contains(doc.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    doc.addEventListener('keydown', onKeydown);
    scrollLock.lock(options.id || 'overlay');

    const target = options.initialFocus || focusableElements(panel)[0] || panel;
    if (target === panel && !panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    let closed = false;
    return {
      close({ restoreFocus = true } = {}) {
        if (closed) return;
        closed = true;
        doc.removeEventListener('keydown', onKeydown);
        inerted.forEach((el) => {
          el.inert = false;
        });
        scrollLock.unlock(options.id || 'overlay');
        if (restoreFocus && returnFocusTo && returnFocusTo.isConnected) returnFocusTo.focus({ preventScroll: true });
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Drag to scroll (mouse only — touch keeps native scrolling)
  // ---------------------------------------------------------------------------

  /**
   * Lets a horizontally scrollable container be dragged with the mouse.
   * Clicks are suppressed when the pointer moved, so dragging over a link does not navigate.
   * @returns {Function} destroy
   */
  function dragScroll(container) {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;

    const onDown = (event) => {
      if (event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.pageX;
      startScroll = container.scrollLeft;
      container.classList.add('is-dragging');
      event.preventDefault();
    };
    const onMove = (event) => {
      if (!dragging) return;
      const delta = event.pageX - startX;
      if (Math.abs(delta) > 5) moved = true;
      container.scrollLeft = startScroll - delta * 2;
    };
    const onUp = () => {
      dragging = false;
      container.classList.remove('is-dragging');
    };
    const onClick = (event) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    };

    container.addEventListener('mousedown', onDown);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseup', onUp);
    container.addEventListener('mouseleave', onUp);
    container.addEventListener('click', onClick, true);

    return function destroy() {
      container.removeEventListener('mousedown', onDown);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseup', onUp);
      container.removeEventListener('mouseleave', onUp);
      container.removeEventListener('click', onClick, true);
    };
  }

  // ---------------------------------------------------------------------------
  // Components — custom elements give lifecycle for free: connectedCallback on
  // render, disconnectedCallback when the Theme Editor removes or re-renders a
  // section (ADR-002).
  // ---------------------------------------------------------------------------

  /** Defines a custom element once; scripts can run again when the Theme Editor adds a section. */
  function define(name, constructor) {
    if (global.customElements && !global.customElements.get(name)) global.customElements.define(name, constructor);
  }

  function debounce(fn, wait) {
    let timer = null;
    const debounced = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
  }

  Object.assign(Daino, {
    readJSON,
    config,
    t,
    formatMoney,
    isAbortError,
    latestFetcher,
    parseHTML,
    prefersReducedMotion,
    smoothScroll,
    scrollLock,
    openOverlay,
    focusableElements,
    dragScroll,
    define,
    debounce,
  });

  global.Daino = Daino;
  if (typeof module !== 'undefined' && module.exports) module.exports = Daino;
})(typeof window !== 'undefined' ? window : globalThis);
