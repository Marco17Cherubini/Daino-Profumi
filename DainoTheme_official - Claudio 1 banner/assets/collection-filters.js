/**
 * Collection Filters - Daino Theme
 * Advanced filtering system using Shopify Storefront Filtering API
 */

class CollectionFilters {
    constructor() {
        this.selectors = {
            container: '[data-collection-filters]',
            drawer: '[data-filters-drawer]',
            overlay: '[data-filters-overlay]',
            openBtn: '[data-filters-open]',
            closeBtn: '[data-filters-close]',
            confirmBtn: '[data-filters-confirm]',
            resetBtn: '[data-filters-reset]',
            form: '[data-filters-form]',
            productGrid: '[data-product-grid]',
            productCount: '[data-product-count]',
            activeTags: '[data-active-filters]',
            sortSelect: '[data-sort-select]',
            filterSection: '[data-filter-section]',
            priceMin: '[data-price-min]',
            priceMax: '[data-price-max]',
            loadingOverlay: '[data-loading-overlay]'
        };

        this.container = document.querySelector(this.selectors.container);
        if (!this.container) return;

        this.drawer = this.container.querySelector(this.selectors.drawer);
        this.overlay = this.container.querySelector(this.selectors.overlay);
        this.form = this.container.querySelector(this.selectors.form);
        this.productGrid = this.container.querySelector(this.selectors.productGrid);
        this.productCount = this.container.querySelector(this.selectors.productCount);
        this.activeTags = this.container.querySelector(this.selectors.activeTags);
        this.sortSelect = this.container.querySelector(this.selectors.sortSelect);
        this.loadingOverlay = this.container.querySelector(this.selectors.loadingOverlay);

        this.sectionId = this.container.dataset.sectionId;
        this.baseUrl = window.location.pathname;
        this.debounceTimeout = null;
        this.isLoading = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.initCollapsibles();
        this.initBrandScroll();
        this.syncFromURL();
    }

    initBrandScroll() {
        // ✅ MOBILE-FIRST: Non intercettare più touch events qui
        // Lo scroll del brand è ora gestito completamente via CSS:
        // - touch-action: auto !important su .filter-options-scroll
        // - overflow-y: scroll !important
        // - overscroll-behavior-y: contain
        // Questa funzione rimane vuota per non interferire con lo scroll nativo
    }

    bindEvents() {
        // Open drawer buttons
        this.container.querySelectorAll(this.selectors.openBtn).forEach(btn => {
            btn.addEventListener('click', () => this.openDrawer());
        });

        // Close drawer
        this.container.querySelectorAll(this.selectors.closeBtn).forEach(btn => {
            btn.addEventListener('click', () => this.closeDrawer());
        });

        // Overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeDrawer());
        }

        // Confirm button
        this.container.querySelectorAll(this.selectors.confirmBtn).forEach(btn => {
            btn.addEventListener('click', () => this.closeDrawer());
        });

        // Reset button
        this.container.querySelectorAll(this.selectors.resetBtn).forEach(btn => {
            btn.addEventListener('click', () => this.resetFilters());
        });

        // Checkbox/radio changes
        if (this.form) {
            this.form.addEventListener('change', (e) => {
                if (e.target.matches('input[type="checkbox"], input[type="radio"]')) {
                    this.handleFilterChange();
                }
            });

            // Price inputs with debounce
            this.form.querySelectorAll(`${this.selectors.priceMin}, ${this.selectors.priceMax}`).forEach(input => {
                input.addEventListener('input', () => this.handlePriceChange());
            });
        }

        // Sort select
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => this.handleFilterChange());
        }

        // Active filter tag removal
        if (this.activeTags) {
            this.activeTags.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('[data-remove-filter]');
                if (removeBtn) {
                    e.preventDefault();
                    this.removeFilter(removeBtn.dataset.removeFilter);
                }

                const clearAll = e.target.closest('[data-clear-all]');
                if (clearAll) {
                    e.preventDefault();
                    this.resetFilters();
                }
            });
        }

        // Keyboard handling
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.drawer?.classList.contains('is-open')) {
                this.closeDrawer();
            }
        });

        // Browser back/forward
        window.addEventListener('popstate', () => {
            this.syncFromURL();
            this.fetchProducts();
        });
    }

    initCollapsibles() {
        this.container.querySelectorAll(this.selectors.filterSection).forEach(section => {
            const header = section.querySelector('[data-filter-header]');
            const content = section.querySelector('[data-filter-content]');

            if (header && content) {
                header.addEventListener('click', () => {
                    const isOpen = section.classList.contains('is-open');
                    section.classList.toggle('is-open', !isOpen);
                    header.setAttribute('aria-expanded', !isOpen);
                });
            }
        });
    }

    openDrawer() {
        if (!this.drawer) return;

        // ✅ SOLUZIONE: Disabilita normalizeScroll quando drawer aperto
        if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.normalizeScroll) {
            ScrollTrigger.normalizeScroll(false);
        }

        this.drawer.classList.add('is-open');
        this.overlay?.classList.add('is-visible');
        document.body.classList.add('filters-drawer-open');

        // Focus trap
        this.drawer.setAttribute('aria-hidden', 'false');
        const firstFocusable = this.drawer.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
        firstFocusable?.focus();

        // Store last focused element
        this.lastFocused = document.activeElement;

        // Prevent scroll propagation to body
        this.scrollHandler = this.preventScrollPropagation.bind(this);
        this.touchStartHandler = this.handleTouchStart.bind(this);

        this.drawer.addEventListener('wheel', this.scrollHandler, { passive: false });
        this.drawer.addEventListener('touchstart', this.touchStartHandler, { passive: true });
        this.drawer.addEventListener('touchmove', this.scrollHandler, { passive: false });
    }

    closeDrawer() {
        if (!this.drawer) return;

        // ✅ SOLUZIONE: Riabilita normalizeScroll quando drawer chiuso
        if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.normalizeScroll) {
            ScrollTrigger.normalizeScroll(true);
        }

        this.drawer.classList.remove('is-open');
        this.overlay?.classList.remove('is-visible');
        document.body.classList.remove('filters-drawer-open');

        this.drawer.setAttribute('aria-hidden', 'true');
        this.lastFocused?.focus();

        // Remove scroll handlers
        if (this.scrollHandler) {
            this.drawer.removeEventListener('wheel', this.scrollHandler);
            this.drawer.removeEventListener('touchmove', this.scrollHandler);
        }
        if (this.touchStartHandler) {
            this.drawer.removeEventListener('touchstart', this.touchStartHandler);
        }
    }

    handleTouchStart(e) {
        this.touchStartY = e.touches[0].clientY;
    }

    preventScrollPropagation(e) {
        const drawerBody = this.drawer.querySelector('.filters-drawer__body');
        if (!drawerBody) return;

        // ✅ NON intercettare scroll - lasciare che CSS gestisca tutto
        // Blocca solo il "rimbalzo" ai confini per evitare scroll della pagina sotto

        const { scrollTop, scrollHeight, clientHeight } = drawerBody;
        const isAtTop = scrollTop === 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        // Determine scroll direction
        let deltaY = 0;

        if (e.type === 'touchmove') {
            const currentY = e.touches[0].clientY;
            deltaY = this.touchStartY - currentY;
            this.touchStartY = currentY;
        } else {
            deltaY = e.deltaY;
        }

        // ✅ Block scroll SOLO ai confini per evitare scroll pagina dietro
        // NON usare stopPropagation - blocca lo scroll naturale!
        if ((isAtTop && deltaY < 0) || (isAtBottom && deltaY > 0)) {
            e.preventDefault();
        }
    }

    handleFilterChange() {
        this.updateURL();
        this.fetchProducts();
    }

    handlePriceChange() {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.handleFilterChange();
        }, 300);
    }

    getFormData() {
        if (!this.form) return new URLSearchParams();

        const formData = new FormData(this.form);
        const params = new URLSearchParams();

        for (const [key, value] of formData.entries()) {
            if (value) {
                params.append(key, value);
            }
        }

        // Add sort
        if (this.sortSelect?.value) {
            params.set('sort_by', this.sortSelect.value);
        }

        return params;
    }

    updateURL() {
        const params = this.getFormData();
        const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;

        history.pushState({}, '', url);
    }

    syncFromURL() {
        const params = new URLSearchParams(window.location.search);

        if (!this.form) return;

        // Reset form first
        this.form.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
            input.checked = false;
        });

        // Sync checkboxes/radios
        for (const [key, value] of params.entries()) {
            if (key === 'sort_by') {
                if (this.sortSelect) this.sortSelect.value = value;
                continue;
            }

            const input = this.form.querySelector(`input[name="${key}"][value="${value}"]`);
            if (input) {
                input.checked = true;
            }

            // Handle price inputs
            if (key.includes('filter.v.price.gte')) {
                const minInput = this.form.querySelector(this.selectors.priceMin);
                if (minInput) minInput.value = value;
            }
            if (key.includes('filter.v.price.lte')) {
                const maxInput = this.form.querySelector(this.selectors.priceMax);
                if (maxInput) maxInput.value = value;
            }
        }
    }

    async fetchProducts() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        const params = this.getFormData();
        params.set('section_id', this.sectionId);

        const url = `${this.baseUrl}?${params.toString()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network error');

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Update product grid
            const newGrid = doc.querySelector(this.selectors.productGrid);
            if (newGrid && this.productGrid) {
                this.productGrid.innerHTML = newGrid.innerHTML;
            }

            // Update product count
            const newCount = doc.querySelector(this.selectors.productCount);
            if (newCount && this.productCount) {
                this.productCount.innerHTML = newCount.innerHTML;
            }

            // Update active filters
            const newTags = doc.querySelector(this.selectors.activeTags);
            if (newTags && this.activeTags) {
                this.activeTags.innerHTML = newTags.innerHTML;
            }

            // Announce for screen readers
            this.announceResults();

        } catch (error) {
            console.error('Filter fetch error:', error);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    showLoading() {
        this.loadingOverlay?.classList.add('is-visible');
        this.productGrid?.classList.add('is-loading');
    }

    hideLoading() {
        this.loadingOverlay?.classList.remove('is-visible');
        this.productGrid?.classList.remove('is-loading');
    }

    removeFilter(paramString) {
        const params = new URLSearchParams(window.location.search);

        // Parse param string (format: "key=value")
        const [key, value] = paramString.split('=');

        // Handle multiple values for same key
        const values = params.getAll(key);
        if (values.length > 1) {
            params.delete(key);
            values.filter(v => v !== value).forEach(v => params.append(key, v));
        } else {
            params.delete(key);
        }

        // Update form
        if (this.form) {
            const input = this.form.querySelector(`input[name="${key}"][value="${value}"]`);
            if (input) input.checked = false;

            // Handle price
            if (key.includes('filter.v.price')) {
                const priceInputs = this.form.querySelectorAll(`${this.selectors.priceMin}, ${this.selectors.priceMax}`);
                priceInputs.forEach(input => input.value = '');
            }
        }

        const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
        history.pushState({}, '', url);
        this.fetchProducts();
    }

    resetFilters() {
        if (this.form) {
            this.form.reset();
            // Clear price inputs
            this.form.querySelectorAll(`${this.selectors.priceMin}, ${this.selectors.priceMax}`).forEach(input => {
                input.value = '';
            });
        }

        // Keep sort
        const sortValue = this.sortSelect?.value || '';
        const url = sortValue ? `${this.baseUrl}?sort_by=${sortValue}` : this.baseUrl;

        history.pushState({}, '', url);
        this.fetchProducts();
    }

    announceResults() {
        const count = this.productCount?.textContent?.trim();
        if (!count) return;

        const announcer = document.getElementById('filter-announce') || this.createAnnouncer();
        announcer.textContent = count;
    }

    createAnnouncer() {
        const announcer = document.createElement('div');
        announcer.id = 'filter-announce';
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'visually-hidden';
        document.body.appendChild(announcer);
        return announcer;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new CollectionFilters();
});
