# Daino Profumi — Shopify theme

A custom Shopify Online Store 2.0 theme for **Daino Profumi**, a niche perfumery with shops in Alessandria and Novi Ligure (Italy). Black-and-gold "dark luxury" design: an animated entrance gate, a hero video with brand marquees, a draggable 3D product carousel, and personal fragrance consultation by the shop's staff.

> **Material needed before publishing this README:** desktop and mobile screenshots of the home, collection, product, cart and wishlist pages, and any real-world results (traffic, conversion, merchant feedback) the author can share. None are included, because none have been verified.

## The story

### Context

The shop sells niche and Arabic perfumery and offers in-store fragrance consultation (both visible in the theme's content). The theme aims to bring that boutique feel online while keeping Shopify's standard purchase flow.

### The problem

The first version of the theme looked right, but it was hard to change safely:

- Sections mixed markup, hundreds of lines of CSS and inline scripts in single files.
- There were no tests and no automated checks. Theme Check reported **49 errors and 16 warnings**.
- Real purchase-path defects had crept in. Product links with `?variant=` were overwritten on load. Fast filter changes left the URL, the selected filters and the results out of sync. The order note was lost on checkout. The wishlist only knew the first 250 products. The password-recovery flow could not be completed.
- The homepage could not be entered with the keyboard.

### What was done

A structured refactor, planned and tracked in [`docs/refactoring-plan.md`](docs/refactoring-plan.md):

- Every template, section and snippet reference is valid. Theme Check now reports **0 errors and 0 warnings**.
- Static CSS and JS moved out of Liquid into layered assets. One shared product card replaced five copies.
- Each interactive feature became a small custom element with a clean lifecycle, so it keeps working while the merchant edits sections in the Theme Editor.
- Purchase flows fixed and covered by **69 automated tests** (27 unit, 42 browser), run in CI together with ESLint, Stylelint, Prettier and Theme Check.
- Accessibility: keyboard entry to the homepage, focus-trapped dialogs, keyboard-reachable variant options, reduced-motion support, a skip link, and content that stays visible without JavaScript.
- Performance hygiene, measured statically:
  - No render-blocking scripts.
  - No third-party script origins.
  - Lossless WOFF2 fonts: the heading font went from 667 KB to 115 KB.

### Results

The figures above are measured on the code (see [`docs/testing.md`](docs/testing.md#performance-comparable-conditions-only)). Store metrics are **not available yet**.

### Personal contribution

_To be completed by the author:_ your role (design, development, client relationship), the timeline, and what you would do next.

## Features

- **Entrance gate.** The logo fades in. Scroll, swipe, click, or press Enter / Space / ↓ / Page Down to enter. It is skipped in the Theme Editor and for visitors who prefer reduced motion.
- **Hero video** with two brand marquees that link to the catalogue already filtered by brand.
- **3D product carousel.** Infinite, draggable, auto-scrolling. It pauses on hover and focus, and stays static under reduced motion.
- **Consultation.** Staff profiles, each linking to their brand selection.
- **Catalogue filters.** A Storefront Filtering drawer with live results. Back/forward and links work; the last request always wins.
- **Predictive search.** Products, collections, pages and brand shortcuts, with an ARIA combobox and keyboard navigation. Enter opens the full search page.
- **Product page.** Variants with availability, sale prices and images. "Buy now" adds to the cart, then goes to checkout. Same-brand carousel and recommendations.
- **Wishlist.** Saved in the browser, with no account needed. Handles any catalogue size, sold-out and deleted products.
- **Native cart.** Works without JavaScript; the order note is kept on checkout.
- **Customer area.** Account, orders, addresses (with the province selector), and password recovery.
- **Translations.** Italian and English for every string.

## Under the hood

### Tech stack

- Shopify Liquid (Online Store 2.0: JSON templates, sections, blocks)
- Vanilla JavaScript (custom elements, no framework, no build step)
- CSS custom properties
- GSAP 3.12, ScrollTrigger, Draggable and Lenis 1.0, self-hosted at pinned versions
- Tooling: Theme Check, ESLint, Stylelint, Prettier (+ Liquid plugin), `node:test`, Playwright, GitHub Actions

### Architecture

```
layout/theme.liquid      critical CSS, global JSON config, deferred global scripts
assets/daino-core.js     shared helpers: money, latest-wins fetch, scroll lock, modal overlay, drag scroll
assets/<feature>.js      one custom element per feature (<daino-product>, <daino-collection-filters>, …)
assets/daino-base.css    tokens, reset, fonts, utilities
assets/component-*.css   shared components (product card, search overlay, …)
assets/section-*.css     one stylesheet per section, loaded by that section
snippets/                product card, header icons, pagination, wishlist URL, …
```

Key ideas (details in [`docs/architecture.md`](docs/architecture.md), decisions in [`docs/decisions.md`](docs/decisions.md)):

- **The URL is the source of truth** for filters. Results come from Shopify's Section Rendering API, so asynchronous markup matches server markup.
- **The initial variant is resolved in Liquid.** It is correct before and without JavaScript.
- **Data goes from Liquid to JS only as JSON.** Results are rendered with DOM APIs, never with HTML strings.
- **There is one owner for scroll locking and one for modal focus management.**

### Quality and safety

- CI runs on every push and pull request: lint → format → Theme Check → unit tests → browser tests.
- Lint exceptions are documented with their reasons (ADR-012).
- Saved theme configuration is respected: no section, block or setting id was renamed. Removed items are listed in the decisions.

## Getting started

Requirements:

- Node.js 20 or later.
- The [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli), for previews only.

```bash
npm ci
npx playwright install chromium   # once, for the browser tests
npm run check                     # everything CI runs
shopify theme dev --store <your-store>.myshopify.com
```

### Useful scripts

| Command                                  | What it does                                    |
| ---------------------------------------- | ----------------------------------------------- |
| `npm run check`                          | Full verification (same as CI)                  |
| `npm run theme-check`                    | Shopify Theme Check                             |
| `npm run lint` / `npm run format`        | ESLint + Stylelint / Prettier (Liquid included) |
| `npm run test:unit` / `npm run test:dom` | Unit tests / browser tests on fixtures          |

### Configuration

Theme settings:

- Colours and font scale.
- Main logo and the entrance-gate message.
- The wishlist page.

Section settings cover:

- The hero video and texts.
- The brands.
- The carousel collection.
- Staff profiles.
- The narrative text.
- Footer contacts, addresses and policies.
- Recommendations.
- Filter options.

## Development

- Conventions are in [`CLAUDE.md`](CLAUDE.md) and [`docs/architecture.md`](docs/architecture.md).
- Before you push, run `npm run check`.
- When a section's markup changes, update its DOM fixture in `tests/dom/fixtures`.

## Known limitations

- **Store verification pending.** The browser tests run on hand-written fixtures that mirror the Liquid output, with Shopify's endpoints mocked. The checklist in [`docs/testing.md`](docs/testing.md) (real templates, Theme Editor, checkout up to payment, discounts, money format) still has to be run on a development store.
- The same-brand carousel on the product page scans the first 50 products of the catalogue, a Liquid limit.
- The brand shortcuts in search rely on the `custom.brand` metafield filter being enabled in Search & Discovery.
- The wishlist lives in the browser (`localStorage`). It does not follow the customer across devices.
- The site has no navigation menu beyond the header icons. Adding one is a planned, separate change.
- The 18 MB hero video is a theme asset. Moving it to Shopify Files is proposed in the plan.

## Project structure

```
assets/  config/  layout/  locales/  sections/  snippets/  templates/   ← Shopify theme
docs/     architecture, decisions (ADRs), testing checklist, refactoring plan
tests/    unit/ (node:test) · dom/ (Playwright specs + fixtures)
scripts/  theme-check.js
```

## Author

Marco Cherubini — [@Marco17Cherubini](https://github.com/Marco17Cherubini)

## License

No licence has been chosen yet: all rights reserved. The bundled fonts (Cormorant Garamond, Pinyon Script) are under the SIL Open Font License 1.1. GSAP is used under its standard licence. Lenis is MIT-licensed.
