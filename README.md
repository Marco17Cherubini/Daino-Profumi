# Daino Profumi

**A custom Shopify store for a niche perfumery. It brings the boutique's luxury atmosphere, curated selection and the personal guidance of its staff online.**

[![CI](https://github.com/Marco17Cherubini/Daino-Profumi/actions/workflows/ci.yml/badge.svg)](https://github.com/Marco17Cherubini/Daino-Profumi/actions/workflows/ci.yml)
![Shopify](https://img.shields.io/badge/Shopify-Online%20Store%202.0-7AB55C)
![License](https://img.shields.io/badge/license-MIT-blue)
![Liquid](https://img.shields.io/badge/Liquid-theme-004999)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E)

> The storefront is in Italian, the language of the shop's customers. Every interface string is also translated into English.

---

## The story

### Context

Daino Profumi is a recently opened niche perfumery. Its identity combines luxury fragrances with personal guidance from its staff. When the project started, the business sold only through its physical store and had no e-commerce presence.

### The problem

The challenge was to turn the boutique's identity into a digital shopping experience: its visual elegance, its curated selection, and the personal way it helps customers discover fragrances.

Customers rely on the staff, so showing their role was essential to bringing the in-store experience online.

### How we solved it

I designed and developed a custom Shopify e-shop whose visual identity and shopping experience match the atmosphere of the physical boutique.

The work focused on two things: presenting the fragrances through a distinctive luxury aesthetic, and creating a dedicated staff section that keeps the personal character of the business.

The agreed scope was the visual shopping experience. At the client's request, paid advertising, performance marketing campaigns and customer acquisition funnels were outside the engagement.

A visitor's journey: enter the boutique, discover the selection, choose a fragrance, then check out.

> **Screenshots to add** (`docs/images/`): entrance gate and hero · collections and staff section · product page · cart.

### Results

The e-shop launched with its own month of sales. That launch month is the only one in which I managed the e-shop directly:

- the online channel generated **€1,581 in sales**;
- this created an **additional revenue stream** alongside the physical store;
- the result came **without paid advertising or performance marketing campaigns** as part of my work.

> **Screenshot to add** (`docs/images/`): Shopify sales report for the launch month.

---

## What makes it different

Daino Profumi is not a stock theme with a new logo. Each custom feature answers a need of this specific boutique.

### An entrance like stepping into the shop

The site opens on a full-screen logo: the visitor scrolls, swipes, clicks or presses a key to "enter". The hero video and the brand marquees then appear in sequence, so the first moment online feels like crossing the boutique's threshold. The entrance is skipped for visitors who prefer reduced motion and inside Shopify's theme editor.

> **Screenshot to add:** entrance gate → hero video.

### The staff, front and centre

The consultation section introduces each member of the staff with a photo, their personality and the brands they love. A "Discover the selection" link opens the catalogue already filtered by those brands. This brings the in-store advice ("ask Davide, he loves intense scents") online. Texts, photos and links are editable from the theme editor.

> **Screenshot to add:** consultation section.

### A curated selection, not a catalogue dump

- Two scrolling brand marquees show the houses the shop carries. Each brand links to its own filtered catalogue.
- A draggable 3D carousel puts the products on stage, with depth, blur and a soft gold glow.
- On the product page, a "more from this brand" strip and a set of recommendations keep the discovery going.

> **Screenshot to add:** 3D carousel and brand marquees.

### Shopping that stays simple

- **Collections** filter by brand, price and format, with live results.
- **Predictive search** suggests products, collections and brand shortcuts as you type.
- **Product page:** clear variants and prices. "Acquista ora" goes straight to checkout, keeping anything already in the cart.
- **Wishlist:** customers save fragrances without creating an account.
- **Checkout** is Shopify's native one: secure and familiar.

> **Screenshot to add:** collection with filters · product page · wishlist.

---

## Under the hood

### Tech stack

| Layer     | Choice                                             | Why                                                                                                              |
| --------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Platform  | Shopify, Online Store 2.0                          | Hosted checkout, payments and orders. The merchant edits content from the theme editor.                          |
| Templates | Liquid, JSON templates and sections                | Every visual block is a configurable section that the merchant can reorder and edit.                             |
| Front end | Vanilla JavaScript, custom elements, no build step | The deployed files are the source files. Each component manages its own lifecycle in the theme editor.           |
| Styling   | CSS custom properties, one stylesheet per section  | The black-and-gold palette is driven by tokens and theme settings. Each page loads only the CSS it uses.         |
| Motion    | GSAP 3.12 (ScrollTrigger, Draggable), Lenis        | Smooth entrance, carousel and scroll effects. Self-hosted at pinned versions, loaded without blocking rendering. |
| Fonts     | Cormorant Garamond, Pinyon Script (WOFF2)          | The boutique's typography, served from the theme.                                                                |

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

- **The URL is the source of truth** for filters. Results come from Shopify's Section Rendering API, so the markup updated in the browser matches what the server renders.
- **The initial variant is resolved in Liquid**, so a product link with `?variant=` opens on the right variant, even without JavaScript.
- **Data goes from Liquid to JavaScript only as JSON.** Content is rendered with DOM APIs, never with HTML strings.

More detail is in [`docs/architecture.md`](docs/architecture.md). Every design decision is recorded in [`docs/decisions.md`](docs/decisions.md).

### Code quality

After launch, the theme went through a structured refactor, planned and tracked in [`docs/refactoring-plan.md`](docs/refactoring-plan.md).

|                         | Before                 | After                                              |
| ----------------------- | ---------------------- | -------------------------------------------------- |
| Shopify Theme Check     | 49 errors, 16 warnings | **0 errors, 0 warnings**                           |
| Automated tests         | none                   | **69** (27 unit, 42 in the browser)                |
| Lint and formatting     | none                   | ESLint, Stylelint, Prettier with the Liquid plugin |
| Render-blocking scripts | 5                      | **0**                                              |
| Heading font size       | 667 KB (TTF)           | **115 KB** (WOFF2, lossless)                       |

The refactor also fixed real purchase-path defects:

- links with `?variant=` were overwritten on load;
- fast filter changes left the URL, the checkboxes and the results out of sync;
- the order note was lost at checkout;
- the wishlist only knew the first 250 products;
- the password-recovery flow could not be completed.

### Security

- Checkout, payments and customer accounts are Shopify's own.
- Product data is always inserted as text, never as HTML. Browser tests check this with injection payloads.
- No third-party script origins: the animation libraries are served from Shopify's CDN.

### Accessibility

- The entrance can be opened with the keyboard.
- The filter drawer and the search are real dialogs: the background is inert, focus stays inside and returns to the trigger, and Escape closes them.
- Variant options can be reached with the keyboard, and a skip link leads to the content.
- Animations are turned off under `prefers-reduced-motion`.
- Content stays visible without JavaScript.

### Tests

- Every push runs GitHub Actions: lint → format → Theme Check → unit tests → browser tests.
- Unit tests (`node:test`) cover the pure logic: variants, prices, filter URLs, wishlist storage.
- Browser tests (Playwright) drive each component on HTML fixtures, with Shopify's endpoints mocked.

---

## Getting started

### Requirements

- Node.js 20 or later.
- The [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli) and access to a Shopify store, for previews and deployment.

### Installation

```bash
git clone https://github.com/Marco17Cherubini/Daino-Profumi.git
cd Daino-Profumi
npm ci
npx playwright install chromium   # once, for the browser tests
npm run check                     # everything CI runs
```

### Useful scripts

| Command                                  | What it does                                    |
| ---------------------------------------- | ----------------------------------------------- |
| `npm run check`                          | Full verification (same as CI)                  |
| `npm run theme-check`                    | Shopify Theme Check                             |
| `npm run lint` / `npm run format`        | ESLint + Stylelint / Prettier (Liquid included) |
| `npm run test:unit` / `npm run test:dom` | Unit tests / browser tests                      |
| `shopify theme dev --store <store>`      | Local preview against a store                   |

### Configuration

Everything is set from the Shopify theme editor:

| Where                  | Settings                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Theme settings         | colours, font scale, main logo, entrance message, wishlist page                                                                  |
| Homepage sections      | entrance gate, hero video and texts, brand marquees, collections gallery, 3D carousel collection, staff profiles, narrative text |
| Product and collection | recommendations collection and count, filter drawer options, products per page                                                   |
| Footer                 | addresses, contacts, map, social links, company details                                                                          |

### Deployment

The repository root is the theme root. Upload it with `shopify theme push` (to an unpublished theme first) or connect the repository through Shopify's GitHub integration. `.shopifyignore` keeps documentation, tests and tooling out of the store.

Before publishing, run the manual checklist in [`docs/testing.md`](docs/testing.md). It includes comparing the live theme's settings with the repository.

---

## Development

Before pushing, run `npm run check`. CI runs the same checks.

- **Components:** each interactive feature is a custom element (`<daino-…>`) in its own file in `assets/`. It queries only inside itself and releases its listeners, timers and animations when it is removed. That is what keeps it working while the merchant edits sections.
- **Shared code:** `assets/daino-core.js` holds the only scroll lock, the modal overlay and the money formatter.
- **Product cards:** one snippet renders every card, `snippets/product-card.liquid`.
- **CSS:** the layers are `daino-base.css` → `component-*.css` → `section-*.css`. No static `<style>` blocks in sections. Colours come from tokens.
- **Liquid → JavaScript:** data goes only through `<script type="application/json">`. No inline handlers.
- **Text:** every string lives in `locales/it.json` and `locales/en.default.json`, which have identical keys.
- **Compatibility:** never rename section types, block types or setting ids, because saved theme configurations depend on them.
- **Tests:** when a section's markup changes, update its fixture in `tests/dom/fixtures`.

The full conventions are in [`CLAUDE.md`](CLAUDE.md).

## Known limitations

- **Store verification of the refactor is pending.** The browser tests run on hand-written fixtures that mirror the Liquid output. The manual checklist in [`docs/testing.md`](docs/testing.md) still has to be run on a development store: real templates, theme editor, checkout up to payment, discounts, money format.
- The "more from this brand" strip scans the first 50 products of the catalogue, a Liquid limit.
- Brand shortcuts in search rely on the `custom.brand` metafield filter being enabled in Search & Discovery.
- The wishlist is stored in the browser, so it does not follow the customer across devices.
- There is no navigation menu beyond the header icons. Customers move through the homepage sections, search and collections.
- The 18 MB hero video is a theme asset. Moving it to Shopify Files would lighten the theme.

## Project structure

```
assets/  config/  layout/  locales/  sections/  snippets/  templates/   ← Shopify theme
docs/        architecture, decisions (ADRs), testing checklist, refactoring plan
tests/       unit/ (node:test) · dom/ (Playwright specs and fixtures)
scripts/     theme-check.js
.github/     CI workflow
```

## Author

Designed and built by **Marco Cherubini**: visual identity, shopping experience, theme development, launch, and management of the e-shop during the launch month. [github.com/Marco17Cherubini](https://github.com/Marco17Cherubini)

## License

[MIT](LICENSE) © Marco Cherubini

Third-party assets keep their own licences, and the MIT licence does not cover them:

- the bundled fonts Cormorant Garamond and Pinyon Script are under the SIL Open Font License 1.1;
- GSAP is used under its standard licence;
- Lenis is MIT-licensed;
- brand names, product photos and staff photos belong to Daino Profumi and their respective owners.
