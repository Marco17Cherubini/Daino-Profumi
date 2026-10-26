/**
 * Predictive search — <daino-predictive-search> (snippets/predictive-search.liquid).
 *
 * - Opens from any [data-predictive-search-trigger]; modal behaviour (inert
 *   background, focus trap, Escape, focus return, scroll lock) comes from
 *   Daino.openOverlay.
 * - Suggestions from the Predictive Search API; every keystroke aborts the previous
 *   request, so a slow old response can never overwrite a newer one.
 * - Distinct states: results, no results, error.
 * - ARIA combobox: ↑/↓ move the highlighted option, Enter opens it; Enter with
 *   nothing highlighted submits the form to the full search page.
 * - Results are built with DOM APIs and textContent — no HTML strings.
 */
(function (global) {
  'use strict';

  const DEBOUNCE_MS = 200;
  const MAX_BRANDS = 5;
  const BRANDS_CACHE_KEY = 'daino_brands_v1';

  /** Predictive Search API URL (the API returns at most 10 results per type). */
  function suggestUrl(base, query) {
    const params = new URLSearchParams({
      q: query,
      'resources[type]': 'product,collection,page',
      'resources[limit]': '10',
      'resources[options][unavailable_products]': 'last',
    });
    return `${base}.json?${params.toString()}`;
  }

  /** Brands whose label contains the query (case- and accent-insensitive), max 5. */
  function matchBrands(brands, query) {
    const fold = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const needle = fold(query);
    if (needle.length < 2) return [];
    return brands.filter((brand) => fold(brand.label).includes(needle)).slice(0, MAX_BRANDS);
  }

  /** Converts an API price ("45.00", "45", 45) in major units to cents. */
  function priceToCents(price) {
    const value = parseFloat(price);
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { suggestUrl, matchBrands, priceToCents };
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  class DainoPredictiveSearch extends global.HTMLElement {
    connectedCallback() {
      this.strings = Daino.readJSON(this.querySelector('[data-search-strings]'), {}) || {};
      this.panel = this.querySelector('[data-search-panel]');
      this.form = this.querySelector('[data-search-form]');
      this.input = this.querySelector('[data-search-input]');
      this.results = this.querySelector('[data-search-results]');
      this.status = this.querySelector('[data-search-status]');
      this.request = Daino.latestFetcher();
      this.listeners = new AbortController();
      this.selectedIndex = -1;
      this.brands = null;
      const { signal } = this.listeners;

      document.addEventListener(
        'click',
        (event) => {
          const trigger = event.target.closest('[data-predictive-search-trigger]');
          if (!trigger) return;
          event.preventDefault();
          this.open(trigger);
        },
        { signal }
      );
      this.querySelector('[data-search-close]').addEventListener('click', () => this.close(), { signal });
      this.addEventListener('click', (event) => event.target === this && this.close(), { signal });

      this.debouncedSearch = Daino.debounce((query) => this.search(query), DEBOUNCE_MS);
      this.input.addEventListener('input', () => this.onInput(), { signal });
      this.input.addEventListener('keydown', (event) => this.onKeydown(event), { signal });
    }

    disconnectedCallback() {
      this.listeners.abort();
      this.request.abort();
      this.debouncedSearch.cancel();
      if (this.overlay) this.overlay.close({ restoreFocus: false });
    }

    get isOpen() {
      return Boolean(this.overlay);
    }

    open(trigger) {
      if (this.isOpen) return;
      this.trigger = trigger;
      this.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      this.overlay = Daino.openOverlay(this.panel, {
        id: 'predictive-search',
        trigger,
        initialFocus: this.input,
        keep: [this],
        onRequestClose: () => this.close(),
      });
      this.loadBrands();
    }

    close() {
      if (!this.isOpen) return;
      this.debouncedSearch.cancel();
      this.request.abort();
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      if (this.trigger) this.trigger.setAttribute('aria-expanded', 'false');
      this.overlay.close();
      this.overlay = null;
      this.input.value = '';
      this.reset();
    }

    async loadBrands() {
      if (this.brands) return;
      try {
        const cached = global.sessionStorage && global.sessionStorage.getItem(BRANDS_CACHE_KEY);
        if (cached) {
          this.brands = JSON.parse(cached);
          return;
        }
      } catch {
        // sessionStorage unavailable: fetch every time.
      }
      try {
        const response = await fetch(this.dataset.brandsUrl, { signal: this.listeners.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const list = JSON.parse(await response.text());
        this.brands = Array.isArray(list) ? list.filter((b) => b && typeof b.label === 'string') : [];
        try {
          global.sessionStorage.setItem(BRANDS_CACHE_KEY, JSON.stringify(this.brands));
        } catch {
          // Not cached: fine.
        }
      } catch (error) {
        if (!Daino.isAbortError(error)) this.brands = []; // Brand shortcuts are optional.
      }
    }

    onInput() {
      const query = this.input.value.trim();
      if (!query) {
        this.debouncedSearch.cancel();
        this.request.abort();
        this.reset();
        return;
      }
      this.debouncedSearch(query);
    }

    async search(query) {
      this.setLoading(true);
      try {
        const response = await this.request(suggestUrl(Daino.config().routes.predictiveSearch, query), {
          headers: { Accept: 'application/json' },
        });
        const data = await response.json();
        if (query !== this.input.value.trim()) return;
        this.render((data.resources && data.resources.results) || {}, query);
      } catch (error) {
        if (Daino.isAbortError(error)) return;
        console.error('[Daino] Predictive search failed', error);
        this.showError();
      } finally {
        if (query === this.input.value.trim()) this.setLoading(false);
      }
    }

    setLoading(loading) {
      this.querySelector('[data-search-spinner]').classList.toggle('is-loading', loading);
      this.results.setAttribute('aria-busy', String(loading));
    }

    reset() {
      this.querySelectorAll('[data-search-group]').forEach((group) => {
        group.hidden = true;
        group.querySelector('ul').replaceChildren();
      });
      this.querySelector('[data-search-empty]').hidden = true;
      this.querySelector('[data-search-error]').hidden = true;
      this.querySelector('[data-search-view-all]').hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      this.input.removeAttribute('aria-activedescendant');
      this.status.textContent = '';
      this.options = [];
      this.selectedIndex = -1;
      this.setLoading(false);
    }

    showError() {
      this.reset();
      const error = this.querySelector('[data-search-error]');
      error.textContent = this.strings.error || '';
      error.hidden = false;
      this.status.textContent = this.strings.error || '';
    }

    render(results, query) {
      this.reset();
      const brands = matchBrands(this.brands || [], query);
      const groups = {
        brands: brands.map((brand) => this.brandOption(brand)),
        products: (results.products || []).map((product) => this.productOption(product)),
        collections: (results.collections || []).map((item) => this.simpleOption(item.title, item.url)),
        pages: (results.pages || []).map((item) => this.simpleOption(item.title, item.url)),
      };

      let total = 0;
      Object.entries(groups).forEach(([name, options]) => {
        if (!options.length) return;
        const group = this.querySelector(`[data-search-group="${name}"]`);
        group.querySelector('ul').replaceChildren(
          ...options.map((option) => {
            const li = element('li');
            li.setAttribute('role', 'presentation');
            li.append(option);
            return li;
          })
        );
        group.hidden = false;
        total += options.length;
      });

      if (total === 0) {
        const empty = this.querySelector('[data-search-empty]');
        this.querySelector('[data-search-empty-text]').textContent = (this.strings.noResults || '').replace(
          '__TERMS__',
          query
        );
        empty.hidden = false;
        this.status.textContent = this.querySelector('[data-search-empty-text]').textContent;
        return;
      }

      const viewAll = this.querySelector('[data-search-view-all]');
      viewAll.textContent = (this.strings.viewAll || '').replace('__TERMS__', query);
      viewAll.href = `${this.form.action}?${new URLSearchParams({ q: query, 'options[prefix]': 'last' })}`;
      viewAll.hidden = false;

      this.options = Array.from(this.results.querySelectorAll('[role="option"]'));
      this.options.forEach((option, index) => (option.id = `PredictiveSearchOption-${index}`));
      this.input.setAttribute('aria-expanded', 'true');
      this.status.textContent = (this.strings.resultsCount || '').replace('__QUANTITY__', String(total));
    }

    option(href, modifier) {
      const link = element('a', `predictive-search-item${modifier ? ` predictive-search-item--${modifier}` : ''}`);
      link.href = href;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-selected', 'false');
      link.tabIndex = -1;
      return link;
    }

    brandOption(brand) {
      const base = Daino.config().routes.allProducts || '/collections/all';
      const link = this.option(
        `${base}?${new URLSearchParams({ 'filter.p.m.custom.brand': brand.value || brand.label })}`,
        'brand'
      );
      const info = element('div', 'predictive-search-item__info');
      info.append(
        element('h4', 'predictive-search-item__title', brand.label),
        element('span', 'predictive-search-item__action', this.strings.brandAction)
      );
      link.append(info);
      return link;
    }

    productOption(product) {
      const link = this.option(product.url);
      const imageUrl = product.featured_image && product.featured_image.url;
      if (imageUrl) {
        const img = element('img', 'predictive-search-item__image');
        const src = new URL(imageUrl, global.location.href);
        src.searchParams.set('width', '100');
        img.src = src.toString();
        img.alt = '';
        img.loading = 'lazy';
        img.width = 50;
        img.height = 65;
        link.append(img);
      } else {
        link.append(element('div', 'predictive-search-item__image-placeholder'));
      }

      const info = element('div', 'predictive-search-item__info');
      if (product.vendor) info.append(element('div', 'predictive-search-item__vendor', product.vendor));
      info.append(element('h4', 'predictive-search-item__title', product.title));

      const priceRow = element('div', 'predictive-search-item__price');
      const price = priceToCents(product.price);
      const compare = priceToCents(product.compare_at_price_max);
      const onSale = compare !== null && price !== null && compare > price;
      if (price !== null) {
        priceRow.append(element('span', onSale ? 'predictive-search-item__price--sale' : '', Daino.formatMoney(price)));
      }
      if (onSale) {
        priceRow.append(element('span', 'predictive-search-item__price--compare', Daino.formatMoney(compare)));
      }
      info.append(priceRow);
      link.append(info);
      return link;
    }

    simpleOption(title, url) {
      const link = this.option(url, 'simple');
      const info = element('div', 'predictive-search-item__info');
      info.append(element('h4', 'predictive-search-item__title', title));
      link.append(info);
      return link;
    }

    onKeydown(event) {
      const options = this.options || [];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!options.length) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.selectedIndex = (this.selectedIndex + step + options.length) % options.length;
        options.forEach((option, index) => option.setAttribute('aria-selected', String(index === this.selectedIndex)));
        const selected = options[this.selectedIndex];
        this.input.setAttribute('aria-activedescendant', selected.id);
        selected.scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter' && this.selectedIndex >= 0 && options[this.selectedIndex]) {
        event.preventDefault();
        global.location.assign(options[this.selectedIndex].href);
      }
      // Enter without a highlighted option submits the form to the search page.
    }
  }

  Daino.define('daino-predictive-search', DainoPredictiveSearch);
})(typeof window !== 'undefined' ? window : globalThis);
