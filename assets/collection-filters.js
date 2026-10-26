/**
 * Collection filters — <daino-collection-filters> (sections/main-collection.liquid).
 *
 * The URL is the single source of truth:
 *   user input → URL (pushState) → fetch section → replace [data-results]
 *   back/forward (popstate) → form synced from URL → fetch section
 * Every request aborts the previous one, so fast changes can never leave results
 * that disagree with the URL and the selected filters (previously, changes made
 * while a request was running were dropped).
 *
 * The drawer is a modal dialog (Daino.openOverlay): background inert, focus trap,
 * Escape, focus returned to the "Filters" button. Active-filter tags, "clear all",
 * "reset" and pagination are links that work without JavaScript; with JavaScript
 * the filter links are fetched in place.
 */
(function (global) {
  'use strict';

  const PRICE_DEBOUNCE_MS = 400;

  /**
   * Builds the query string for the current form state.
   * Empty values are dropped; `sort_by` is preserved from the sort select.
   * @param {Array<[string, string]>} entries FormData entries of the filters form
   * @param {string} [sortBy]
   */
  function buildParams(entries, sortBy) {
    const params = new URLSearchParams();
    entries.forEach(([key, value]) => {
      if (String(value).trim() !== '') params.append(key, String(value).trim());
    });
    if (sortBy) params.set('sort_by', sortBy);
    return params;
  }

  /** URL for the Section Rendering API (keeps the filters, adds section_id). */
  function sectionUrl(pathname, params, sectionId) {
    const query = new URLSearchParams(params);
    query.set('section_id', sectionId);
    return `${pathname}?${query.toString()}`;
  }

  /**
   * Which inputs should be checked for a given query string — compared by value,
   * so filter values containing quotes or "=" are handled (no selector building).
   */
  function isChecked(params, name, value) {
    return params.getAll(name).includes(value);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { buildParams, sectionUrl, isChecked };
  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  class DainoCollectionFilters extends global.HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.drawer = this.querySelector('[data-filters-drawer]');
      this.overlayEl = this.querySelector('[data-filters-overlay]');
      this.form = this.querySelector('[data-filters-form]');
      this.sortSelect = this.querySelector('[data-sort-select]');
      this.openButton = this.querySelector('[data-filters-open]');
      this.status = this.querySelector('[data-filters-status]');
      this.request = Daino.latestFetcher();
      this.listeners = new AbortController();
      const { signal } = this.listeners;

      this.debouncedApply = Daino.debounce(() => this.applyForm(), PRICE_DEBOUNCE_MS);

      if (this.openButton) this.openButton.addEventListener('click', () => this.openDrawer(), { signal });
      this.querySelectorAll('[data-filters-close]').forEach((button) =>
        button.addEventListener('click', () => this.closeDrawer(), { signal })
      );
      if (this.overlayEl) this.overlayEl.addEventListener('click', () => this.closeDrawer(), { signal });

      if (this.form) {
        this.form.addEventListener(
          'change',
          (event) => {
            if (event.target.matches('input[type="checkbox"], input[type="radio"]')) this.applyForm();
            // Price fields: typing is debounced (input event); leaving a field must not fire
            // an extra request while the visitor moves from "min" to "max".
            if (event.target.matches('[data-price-input]')) this.debouncedApply();
          },
          { signal }
        );
        this.form.addEventListener(
          'input',
          (event) => {
            if (event.target.matches('[data-price-input]')) this.debouncedApply();
          },
          { signal }
        );
        this.form.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();
            this.debouncedApply.cancel();
            this.applyForm();
          },
          { signal }
        );
      }
      if (this.sortSelect) this.sortSelect.addEventListener('change', () => this.applyForm(), { signal });

      // Filter links (active tags, clear all, reset) are fetched in place.
      this.addEventListener(
        'click',
        (event) => {
          const link = event.target.closest('[data-filter-link], [data-filters-reset]');
          if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          const url = new URL(link.href, global.location.href);
          this.navigate(url.searchParams);
        },
        { signal }
      );

      this.querySelectorAll('[data-filter-header]').forEach((header) => {
        header.addEventListener(
          'click',
          () => {
            const section = header.closest('[data-filter-section]');
            const open = !section.classList.contains('is-open');
            section.classList.toggle('is-open', open);
            header.setAttribute('aria-expanded', String(open));
          },
          { signal }
        );
      });

      global.addEventListener(
        'popstate',
        () => {
          const params = new URLSearchParams(global.location.search);
          this.syncForm(params);
          this.render(params);
        },
        { signal }
      );
    }

    disconnectedCallback() {
      this.listeners.abort();
      this.request.abort();
      this.debouncedApply.cancel();
      if (this.overlayHandle) this.overlayHandle.close({ restoreFocus: false });
    }

    openDrawer() {
      if (!this.drawer || this.overlayHandle) return;
      this.drawer.inert = false;
      this.drawer.classList.add('is-open');
      this.drawer.setAttribute('aria-hidden', 'false');
      if (this.overlayEl) this.overlayEl.classList.add('is-visible');
      this.openButton.setAttribute('aria-expanded', 'true');
      this.overlayHandle = Daino.openOverlay(this.drawer, {
        id: 'collection-filters',
        trigger: this.openButton,
        keep: [this.overlayEl, this.status].filter(Boolean),
        onRequestClose: () => this.closeDrawer(),
      });
    }

    closeDrawer() {
      if (!this.overlayHandle) return;
      this.drawer.classList.remove('is-open');
      this.drawer.setAttribute('aria-hidden', 'true');
      if (this.overlayEl) this.overlayEl.classList.remove('is-visible');
      this.openButton.setAttribute('aria-expanded', 'false');
      this.overlayHandle.close();
      this.overlayHandle = null;
      this.drawer.inert = true;
    }

    currentParams() {
      const entries = this.form ? Array.from(new FormData(this.form).entries()) : [];
      return buildParams(entries, this.sortSelect ? this.sortSelect.value : '');
    }

    applyForm() {
      this.navigate(this.currentParams());
    }

    /** Pushes the new URL (single source of truth) and renders it. */
    navigate(params) {
      params.delete('page'); // a new filter set starts from the first page
      const query = params.toString();
      const url = `${global.location.pathname}${query ? `?${query}` : ''}`;
      if (url !== `${global.location.pathname}${global.location.search}`) global.history.pushState({}, '', url);
      this.syncForm(params);
      this.render(params);
    }

    /** Makes inputs, price fields and sort match the given params. */
    syncForm(params) {
      if (this.form) {
        this.form.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((input) => {
          input.checked = isChecked(params, input.name, input.value);
        });
        this.form.querySelectorAll('[data-price-input]').forEach((input) => {
          if (document.activeElement !== input) input.value = params.get(input.name) || '';
        });
      }
      if (this.sortSelect) {
        const sort = params.get('sort_by');
        if (sort) this.sortSelect.value = sort;
        else this.sortSelect.selectedIndex = Array.from(this.sortSelect.options).findIndex((o) => o.defaultSelected);
      }
    }

    async render(params) {
      this.setLoading(true);
      try {
        const response = await this.request(sectionUrl(global.location.pathname, params, this.sectionId));
        const doc = Daino.parseHTML(await response.text());
        const results = doc.querySelector('[data-results]');
        const count = doc.querySelector('[data-product-count]');
        if (results) this.querySelector('[data-results]').replaceChildren(...results.childNodes);
        const countEl = this.querySelector('[data-product-count]');
        if (count && countEl) countEl.textContent = count.textContent;
        if (this.status) this.status.textContent = (count ? count.textContent : '').trim();
        this.setLoading(false);
      } catch (error) {
        if (Daino.isAbortError(error)) return;
        // The URL already reflects the request: fall back to a full page load so the
        // page can never stay out of sync with it.
        console.error('[Daino] Filter request failed, reloading', error);
        global.location.reload();
      }
    }

    setLoading(loading) {
      const overlay = this.querySelector('[data-loading-overlay]');
      const grid = this.querySelector('[data-product-grid]');
      if (overlay) overlay.classList.toggle('is-visible', loading);
      if (grid) grid.classList.toggle('is-loading', loading);
      this.setAttribute('aria-busy', String(loading));
    }
  }

  Daino.define('daino-collection-filters', DainoCollectionFilters);
})(typeof window !== 'undefined' ? window : globalThis);
