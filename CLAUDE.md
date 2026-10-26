# CLAUDE.md

Custom Shopify Online Store 2.0 theme for Daino Profumi, written in Liquid, CSS and vanilla JS with no build step. The theme root is the repository root.

## Commands

```bash
npm ci
npm run check          # lint + format:check + theme-check + unit + DOM tests (same as CI)
npm run theme-check    # Shopify Theme Check via scripts/theme-check.js
npm run test:unit      # node --test tests/unit
npm run test:dom       # Playwright on tests/dom/fixtures (needs Chromium: npx playwright install chromium)
npm run format         # Prettier, Liquid included
shopify theme dev --store <store>   # preview (Shopify CLI, store access required)
```

## Where things are

- Architecture: `docs/architecture.md`. Decisions (ADRs): `docs/decisions.md`. Manual QA: `docs/testing.md`.
- Plan, task status and the next step: `docs/refactoring-plan.md`. Read its "Execution status" first when resuming.

## Conventions

- **Never rename** section types, block types, setting ids or the wishlist storage key (`daino_wishlist`). Saved theme configuration depends on them. New settings need defaults that reproduce the current output.
- **CSS:**
  - Base tokens and utilities go in `assets/daino-base.css`.
  - Each section or component loads its own `section-*.css` or `component-*.css` with `stylesheet_tag`.
  - No static `<style>` in sections. Inline CSS is only for Liquid-driven values and the layout's critical CSS.
- **JS:**
  - One custom element per component (`<daino-…>`), defined with `Daino.define`.
  - Query inside the element only. Use an `AbortController` for listeners, and release everything in `disconnectedCallback`.
  - Pure logic goes in exported functions with unit tests (`module.exports` guard).
  - No inline handlers (`onclick`).
- **Liquid → JS:** data goes through `<script type="application/json">` with `| json`, never interpolated into JS strings.
- **DOM:** never build HTML from data strings. Use `<template>` or `createElement`, then `textContent` and `setAttribute`.
- **Scroll and modals:**
  - Lock scrolling only with `Daino.scrollLock`.
  - Build modal panels with `Daino.openOverlay`, which handles inert, focus trap, Escape and focus return.
  - Do not use `ScrollTrigger.normalizeScroll`.
- **Network:**
  - Build URLs from `routes` (Liquid) or `Daino.config().routes`. No hard-coded paths, so locale prefixes keep working.
  - Use `Daino.latestFetcher()` when a newer request must win.
- **Text:** user-facing strings go in `locales/it.json` and `locales/en.default.json` (identical key sets). A Liquid `t` filter goes last in its chain: use `{% if %}`, not `| default: 'key' | t`.
- **Vendor files** (`assets/vendor-*.js`) are pinned copies of npm packages. Do not edit them by hand (see ADR-007).
- **Tests:** a DOM fixture mirrors the markup of one section. When that section's markup changes, update the fixture too.

## Safety

- Never push, open PRs, publish the theme or touch the live store without explicit approval.
- Never place real orders when testing checkout. Stop at the checkout page.
