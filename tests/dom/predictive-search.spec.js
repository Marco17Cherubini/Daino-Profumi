'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, delayedFulfil } = require('./helpers');

const env = setup();
before(() => env.start());
after(() => env.stop());

const FIXTURE = '/tests/dom/fixtures/predictive-search.html';

const BRANDS = [
  { label: 'Kajal', value: 'Kajal' },
  { label: 'Bois 1920', value: 'Bois 1920' },
];

function suggest(products = [], collections = [], pages = []) {
  return JSON.stringify({ resources: { results: { products, collections, pages } } });
}

/** `respond(query)` returns { body, status, delay } for each suggest request. */
async function open(respond) {
  const queries = [];
  const page = await env.page(FIXTURE, {
    routes: async (p) => {
      await p.route('**/it/collections/all?view=brands', (route) =>
        route.fulfill({ contentType: 'text/html', body: JSON.stringify(BRANDS) })
      );
      await p.route('**/it/search/suggest.json*', (route) => {
        const q = new URL(route.request().url()).searchParams.get('q');
        queries.push(q);
        const { body = suggest(), status = 200, delay = 0 } = respond(q) || {};
        return delayedFulfil(route, body, { status, delay, contentType: 'application/json' });
      });
    },
  });
  await page.waitForFunction(() => customElements.get('daino-predictive-search'));
  page.queries = queries;
  await page.click('#trigger');
  await page.waitForSelector('daino-predictive-search.is-open');
  return page;
}

const product = (title, price = '45.00') => ({
  title,
  url: `/it/products/${encodeURIComponent(title)}`,
  vendor: 'Kajal',
  price,
  compare_at_price_max: '0.00',
  featured_image: null,
});

test('results: products and matching brands are listed and announced', async () => {
  const page = await open(() => ({ body: suggest([product('Kajal Almaz'), product('Kajal Dahab', '120.50')]) }));
  await page.fill('[data-search-input]', 'kaj');
  await page.waitForSelector('[data-search-group="products"]:not([hidden])');
  const titles = await page.$$eval('[role="option"] .predictive-search-item__title', (els) =>
    els.map((e) => e.textContent)
  );
  assert.deepEqual(titles, ['Kajal', 'Kajal Almaz', 'Kajal Dahab']);
  assert.equal(
    await page.textContent('[data-search-group="products"] li:nth-child(2) .predictive-search-item__price'),
    '€120,50'
  );
  assert.equal(await page.getAttribute('[data-search-input]', 'aria-expanded'), 'true');
  assert.equal(await page.textContent('[data-search-status]'), '3 suggerimenti disponibili');
  assert.match(await page.getAttribute('[data-search-view-all]', 'href'), /\/it\/search\?q=kaj/);
});

test('no results: a dedicated empty state', async () => {
  const page = await open(() => ({ body: suggest() }));
  await page.fill('[data-search-input]', 'zzzz');
  await page.waitForSelector('[data-search-empty]:not([hidden])');
  assert.equal(await page.textContent('[data-search-empty-text]'), 'Nessun risultato trovato per "zzzz"');
  assert.equal(await page.isHidden('[data-search-error]'), true);
});

test('error: a dedicated error state, distinct from "no results"', async () => {
  const page = await open(() => ({ status: 500, body: '{}' }));
  await page.fill('[data-search-input]', 'oud');
  await page.waitForSelector('[data-search-error]:not([hidden])');
  assert.equal(await page.isHidden('[data-search-empty]'), true);
});

test('a slow response for an old query never replaces newer results', async () => {
  const page = await open((q) =>
    q === 'ou' ? { body: suggest([product('OLD')]), delay: 700 } : { body: suggest([product('Oud Royal')]) }
  );
  await page.fill('[data-search-input]', 'ou');
  await page.waitForTimeout(300); // debounce elapsed, slow request in flight
  await page.fill('[data-search-input]', 'oud');
  await page.waitForSelector('text=Oud Royal');
  await page.waitForTimeout(900);
  const titles = await page.$$eval('[data-search-group="products"] .predictive-search-item__title', (els) =>
    els.map((e) => e.textContent)
  );
  assert.deepEqual(titles, ['Oud Royal']);
});

test('product data is rendered as text, never as HTML', async () => {
  const page = await open(() => ({ body: suggest([product('<img src=x onerror="window.pwned=1">')]) }));
  await page.fill('[data-search-input]', 'img');
  await page.waitForSelector('[data-search-group="products"]:not([hidden])');
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(await page.$('[data-search-results] img[src="x"]'), null);
});

test('keyboard: arrows move the active option, Enter opens it', async () => {
  const page = await open(() => ({ body: suggest([product('Uno'), product('Due')]) }));
  await page.fill('[data-search-input]', 'xx');
  await page.waitForSelector('[data-search-group="products"]:not([hidden])');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const active = await page.getAttribute('[data-search-input]', 'aria-activedescendant');
  assert.equal(await page.textContent(`#${active} .predictive-search-item__title`), 'Due');
  await page.route('**/it/products/**', (route) => route.fulfill({ body: 'product page' }));
  await Promise.all([page.waitForURL('**/it/products/Due'), page.keyboard.press('Enter')]);
});

test('Enter without an active option submits to the full search page', async () => {
  const page = await open(() => ({ body: suggest([product('Uno')]) }));
  await page.route('**/it/search?*', (route) => route.fulfill({ body: 'search page' }));
  await page.fill('[data-search-input]', 'rose');
  await Promise.all([page.waitForURL('**/it/search?q=rose*'), page.keyboard.press('Enter')]);
});

test('dialog: background inert, Escape closes and returns focus to the trigger', async () => {
  const page = await open(() => ({ body: suggest() }));
  assert.equal(await page.evaluate(() => document.activeElement.matches('[data-search-input]')), true);
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), true);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-search-panel]') !== null), true);
  await page.keyboard.press('Escape');
  await page.waitForSelector('daino-predictive-search:not(.is-open)', { state: 'attached' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'trigger');
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), false);
});
