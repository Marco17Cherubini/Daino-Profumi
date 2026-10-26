# Architecture

This page explains how the theme is put together: where each kind of code lives, how a page loads, how data and state move through the purchase flow, and the conventions for adding code. The reasons behind the main choices are recorded in [`decisions.md`](decisions.md).

## Repository layout

```
assets/      CSS, JS, fonts, images, vendor libraries (flat: Shopify requirement)
config/      Theme settings schema and presets
layout/      theme.liquid — document shell, critical CSS, global data, global scripts
locales/     it.json (Italian copy) and en.default.json (English, default fallback)
sections/    Page building blocks shown in the Theme Editor
snippets/    Reusable Liquid partials (product card, header icons, pagination, …)
templates/   JSON templates (sections + order) and the customer/legacy .liquid templates
docs/        This documentation, decisions, testing checklist, refactoring plan
tests/       unit/ (node:test) and dom/ (Playwright on static fixtures)
scripts/     Tooling (Theme Check wrapper)
```

`.shopifyignore` keeps `docs/`, `tests/`, `scripts/` and the tooling files out of theme uploads.

## How a page loads

1. `layout/theme.liquid` swaps `no-js` for `js` on `<html>` (a one-line inline script). The critical CSS paints the black background and the entrance gate. It also hides the gate when JavaScript is off.
2. `daino-base.css` loads: tokens, reset, fonts, utilities, shared buttons and header icons.
3. `#DainoConfig` (`<script type="application/json">`) carries routes, `shop.money_format` and global strings.
4. Deferred scripts run in order, before `DOMContentLoaded`:
   - `vendor-gsap.min.js` and `vendor-scrolltrigger.min.js`
   - `vendor-lenis.min.js`
   - `daino-core.js`
   - `daino-animations.js`
   - `wishlist.js`
5. Each section loads its own CSS (`stylesheet_tag`) and, when it needs one, its own deferred script.

## CSS layers

| Layer      | Files                                                                                                                   | Loaded by                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Base       | `daino-base.css`                                                                                                        | layout, every page                         |
| Components | `component-product-card.css`, `component-predictive-search.css`, `component-address-form.css`, `collection-filters.css` | the sections and snippets that render them |
| Sections   | `section-*.css` (one per section or template)                                                                           | the section itself                         |

Rules:

- Colours come from the tokens in `:root`. The theme colour settings override the five base colours in the layout (ADR-009).
- Only two kinds of inline `<style>` remain:
  - The layout's critical CSS, which needs Liquid values.
  - The two standalone templates (`gift_card.liquid`, `password.liquid`), which use `layout none` and so have no stylesheet pipeline.

## JavaScript

`daino-core.js` exposes `window.Daino`.

| API                                   | Purpose                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `readJSON`, `config()`, `t()`         | Read data and strings passed from Liquid (ADR-003)                                    |
| `formatMoney(cents, format?)`         | Same placeholders as Shopify's `money` filter                                         |
| `latestFetcher()`                     | Fetch where every call aborts the previous one ("latest wins")                        |
| `scrollLock.lock(id)` / `.unlock(id)` | The only way to stop page scrolling. Reference-counted, and stops Lenis too (ADR-004) |
| `openOverlay(panel, options)`         | Modal behaviour: inert background, focus trap, Escape, focus return, scroll lock      |
| `dragScroll(el)`                      | Mouse drag for horizontal scrollers. Returns `destroy`                                |
| `define(name, Class)`                 | Guarded `customElements.define`                                                       |
| `smoothScroll`                        | Lenis, only for fine pointers and never under reduced motion                          |

### Components

Every component is a custom element (ADR-002):

| Element                                       | File                    | Section                     |
| --------------------------------------------- | ----------------------- | --------------------------- |
| `<daino-product>`, `<daino-related-products>` | `product-form.js`       | `main-product`              |
| `<daino-collection-filters>`                  | `collection-filters.js` | `main-collection`           |
| `<daino-predictive-search>`                   | `predictive-search.js`  | snippet `predictive-search` |
| `<daino-wishlist-page>`                       | `wishlist-page.js`      | `wishlist`                  |
| `<daino-cart>`                                | `cart.js`               | `main-cart`                 |
| `<daino-entrance-gate>`                       | `entrance-gate.js`      | `daino-entrance-gate`       |
| `<daino-carousel>`                            | `carousel-3d.js`        | `daino-carousel-3d`         |
| `<daino-addresses>`                           | `customer-addresses.js` | `customers/addresses`       |
| `<daino-giftcard-plaque>`                     | `giftcard-form.js`      | `daino-giftcard-form`       |

Conventions:

- Query inside the element only (`this.querySelector`), never through global ids, so several instances can coexist.
- Register listeners with an `AbortController` signal and abort it in `disconnectedCallback`. Kill tweens and timers there too.
- Elements that GSAP animates may be re-attached for a moment while GSAP measures them. `<daino-entrance-gate>` and `<daino-carousel>` therefore ignore a disconnect that is followed by a reconnect in the same task.
- Pure logic (variant matching, URL building, storage normalisation, price parsing) lives in plain functions exported for Node tests. The element class only connects that logic to the DOM.
- Never build HTML from strings that hold data. Clone a `<template>` or create elements, then set `textContent` and attributes.

## Data flow of the purchase path

```
collection ──(filters: URL → Section Rendering → [data-results])──► product card
     ▲                                                                   │
     └── predictive search (Predictive Search API) ── Enter ──► /search  │
                                                                         ▼
product page: initial variant resolved in Liquid (?variant= or cheapest available)
   └─ <daino-product>: options → variant → id / price / badge / URL / image
        ├─ "Aggiungi al carrello": native form POST /cart/add
        └─ "Acquista ora": POST /cart/add.js → native POST /cart with `checkout`
cart: native form (quantities, note, remove links, checkout in the same form)
```

## Vendor libraries

These are self-hosted copies of the npm packages, at the same versions the theme previously loaded from a CDN (ADR-007):

| File                          | Package                                            | SHA-256                                                            |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `vendor-gsap.min.js`          | gsap 3.12.5 (`dist/gsap.min.js`)                   | `28033e449a31ebcc396e5be8b13b63152bf03094288fb5867034321927bce087` |
| `vendor-scrolltrigger.min.js` | gsap 3.12.5 (`dist/ScrollTrigger.min.js`)          | `ad33c2df9ada8a663c2147357828f980d0b7ca731ef33eb3c6e4f327c3b2cda5` |
| `vendor-draggable.min.js`     | gsap 3.12.5 (`dist/Draggable.min.js`)              | `7851a6e073db7e856a91241c222624ca463042b17666cff2772b5e4ac64436a1` |
| `vendor-lenis.min.js`         | @studio-freight/lenis 1.0.42 (`dist/lenis.min.js`) | `7949f2d87aa5eaa05baa6ba843ad2eeae786d9e09954a41a1b282ac023eabae8` |

Vendor files are excluded from ESLint and Prettier. To update one, replace the file with the matching `dist` file from the new package version, then re-run the checks.

## Theme Editor compatibility

- Section types, block types and setting ids are unchanged. New settings have defaults that reproduce the previous output.
- Removed settings: the two unused font pickers (ADR-009) and `show_vendor` on the product section. Removed sections: `search-header`, `header-group`, `footer-group` (ADR-008). Each was unused, and the reasons are documented.
- In design mode the entrance gate and the scroll animations are skipped, so sections stay visible and editable.
