# Testing

There are two kinds of check. Automated checks run locally and in CI on every push. Manual checks need a Shopify preview, and a check that has not been run is listed as **not verified**: it is never counted as passed.

## Automated checks

```bash
npm ci
npm run check          # everything below, in order
npm run lint           # ESLint (assets, tests, scripts) + Stylelint (assets/*.css)
npm run format:check   # Prettier, including Liquid via @shopify/prettier-plugin-liquid
npm run theme-check    # Shopify Theme Check (recommended config), see scripts/theme-check.js
npm run test:unit      # node:test — pure logic, no browser
npm run test:dom       # Playwright Chromium on static fixtures, Shopify endpoints mocked
```

The DOM tests use the Chromium that ships with Playwright. In a fresh environment, run `npx playwright install chromium` once.

### What the tests cover

| Area               | Unit (`tests/unit`)                                                                     | DOM (`tests/dom`)                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Money and core     | money formats, latest-wins fetch, HTTP errors, scroll-lock reference counting, debounce | —                                                                                                                                                                                                                                                |
| Product            | variant matching, quantity parsing, `?variant=` URL, cart error messages                | URL variant not overwritten on load, available / sold-out / non-existent combination, keyboard on options, quantity stepper, buy now (success leads to checkout, 422 shows an error), thumbnails, section re-render without duplicated listeners |
| Collection filters | query building, Section Rendering URL, literal value comparison (quotes, `=`)           | fast changes with slow responses (latest wins), back/forward, values with quotes from the URL, reset after loading with filters, active-filter links, drawer focus trap / Escape / focus return / inert background, debounced price filter       |
| Predictive search  | API URL, brand matching (accents, minimum length), price parsing                        | results, no results, error (distinct states), stale slow response ignored, product data rendered as text, arrow keys + Enter, Enter goes to the full search page, dialog focus behaviour                                                         |
| Wishlist           | storage missing / invalid / blocked, stored format, pagination past 250, card data      | empty states, more than 250 products, sold-out badge, deleted products removed with a notice, network error keeps the data, removal updates the header badge, titles cannot inject HTML                                                          |
| Cart               | —                                                                                       | +/− posts quantities, quantity floor at 0, checkout submits the note and quantities                                                                                                                                                              |
| Homepage           | —                                                                                       | gate: scroll locked, then opened by keyboard / click / PageDown; reduced motion and design mode skip it; without JavaScript the gate is hidden and the hero visible; carousel clones are inert; carousel teardown and transient re-attachment    |

**Limitation:** the fixtures in `tests/dom/fixtures` are hand-written copies of the HTML each Liquid section renders. They test the JavaScript against that markup. They do not render Liquid. Theme Check validates the Liquid statically (references, translations, schema, HTML), but only a Shopify preview proves that the real markup matches the fixtures.

## Manual checks on a Shopify preview

Run the theme on a development store or an unpublished theme:

```bash
shopify theme dev --store <your-store>.myshopify.com    # requires Shopify CLI and store access
```

Never place a real order. Stop at the checkout page.

Status legend: ☐ not verified · ☑ verified (add date and device).

### Before publishing (configuration compatibility)

- ☐ Pull the live theme's JSON (`shopify theme pull --only templates/*.json --only sections/*.json --only config/settings_data.json --path /tmp/live`) and diff it against the repository. Editor changes made on the live theme are not in git.
- ☐ Check that no live template references `search-header`, `header-group` or `footer-group` (removed, see ADR-008).
- ☐ Compare saved values for the colour, typography and footer settings. They had no effect before and are now applied (ADR-009, footer).
- ☐ Confirm the shop's primary language uses `it.json`. Many strings moved from hard-coded Italian to translations: if the primary language were English, `en.default.json` would be shown.

### Purchase path

- ☐ Product with a `?variant=` link opens on that variant (price, options, image).
- ☐ Product without `?variant=` opens on the cheapest available variant.
- ☐ Sold-out variant: buttons disabled, "Esaurito" badge.
- ☐ Non-existent combination: buttons disabled, "Non disponibile".
- ☐ Add to cart, then change the quantity in the cart, then remove a line (link).
- ☐ Order note survives "Procedi al Checkout" (visible in checkout or order notes).
- ☐ "Acquista ora" with something already in the cart: both items reach checkout. Stop at checkout.
- ☐ Discount code: cart summary shows subtotal, discount and total correctly.
- ☐ Gift card form (if used): line item properties appear in the cart.

### Catalogue and search

- ☐ Filters: change several quickly; URL, checked boxes and grid agree; pagination links keep the filters.
- ☐ Price filter with the shop's money format (comma decimals): typing `45` filters at €45, not €4,500.
- ☐ Back/forward after filtering.
- ☐ Predictive search: results, no results, brand shortcuts list every brand (from `collections/all?view=brands`).
- ☐ Enter in the search goes to `/search`, which shows results, pagination and the empty state.
- ☐ Wishlist: add from the product page, open the wishlist page, remove; with more than 250 products in the catalogue.

### Accessibility and design

- ☐ Homepage gate: Tab and Enter enter the site; screen reader announces the button.
- ☐ Filters drawer and search: focus stays inside; Escape closes; focus returns to the trigger.
- ☐ Variant pills reachable with Tab and arrows, with a visible focus ring.
- ☐ `prefers-reduced-motion`: no gate, no scroll animations, no carousel autoplay, no marquee.
- ☐ Desktop and mobile screenshots of home, collection, product, cart, wishlist match the previous identity. ADR-011 lists the deliberate visual corrections: customer pages, 404, blog and article, product badges, filter counts.
- ☐ Customer account, order and addresses pages (newly styled); province appears for Italy.
- ☐ Forgot-password flow: login, "Password dimenticata?", email; the link from the email opens the new-password form.

### Theme Editor

- ☐ Change settings of each homepage section: no duplicated behaviour, carousel rebuilt once, gate skipped.
- ☐ Add a new Gift Card Form section and select a product.
- ☐ Narrative, consulenza and footer: edit texts and check the storefront.

### Performance (comparable conditions only)

| Metric                                 | Before (`2930d82`)               | After                              | How                                                          |
| -------------------------------------- | -------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Blocking scripts in `<head>`           | 4 external + 1 inline            | 0 (6 deferred) + 1 one-line inline | source                                                       |
| Third-party script origins             | 2                                | 0                                  | source                                                       |
| Font bytes, heading font               | 666,632 (TTF after 404 on WOFF2) | 115,004 (WOFF2)                    | file sizes                                                   |
| Font bytes, script font (home only)    | 148,956 (TTF after 404)          | 57,504 (WOFF2)                     | file sizes                                                   |
| Missing assets requested on every page | 2                                | 0                                  | Theme Check `MissingAsset`                                   |
| Lighthouse / Web Vitals                | not measured                     | not measured                       | needs the same store, page, device and network for both runs |
