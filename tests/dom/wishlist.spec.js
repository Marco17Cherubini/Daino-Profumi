'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

const env = setup();
before(() => env.start());
after(() => env.stop());

const FIXTURE = '/tests/dom/fixtures/wishlist.html';

function product(id, overrides = {}) {
  return {
    id,
    title: `Profumo ${id}`,
    handle: `profumo-${id}`,
    vendor: 'Kajal',
    images: [],
    variants: [{ price: '99.00', compare_at_price: null, available: true }],
    ...overrides,
  };
}

/** Opens the fixture with a given localStorage value and a products.json mock. */
async function open({ stored, pages = {}, failStatus } = {}) {
  const requests = [];
  const page = await env.page('/tests/dom/fixtures/blank.html');
  if (stored !== undefined) {
    await page.evaluate((value) => localStorage.setItem('daino_wishlist', value), stored);
  }
  await page.route('**/it/products.json*', async (route) => {
    const url = new URL(route.request().url());
    const n = Number(url.searchParams.get('page'));
    requests.push(n);
    if (failStatus) return route.fulfill({ status: failStatus, body: 'error' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ products: pages[n] || [] }) });
  });
  await page.goto(`${env.origin()}${FIXTURE}`);
  await page.waitForFunction(() => customElements.get('daino-wishlist-page'));
  page.requests = requests;
  return page;
}

async function settled(page) {
  await page.waitForFunction(() => document.querySelector('[data-wishlist-loading]').hidden);
}

test('missing storage shows the empty state without any request', async () => {
  const page = await open();
  await page.waitForSelector('[data-wishlist-empty]:not([hidden])');
  assert.equal(await page.textContent('[data-wishlist-count-text]'), '0 prodotti salvati');
  assert.deepEqual(page.requests, []);
  assert.deepEqual(page.errors, []);
});

test('invalid storage is treated as an empty wishlist', async () => {
  const page = await open({ stored: '{"broken":' });
  await page.waitForSelector('[data-wishlist-empty]:not([hidden])');
  assert.deepEqual(page.errors, []);
});

test('reads beyond 250 products, shows sold-out badges and drops products that no longer exist', async () => {
  const page1 = Array.from({ length: 250 }, (_, i) => product(i + 1));
  page1[4] = product(5, { variants: [{ price: '50.00', available: false }] });
  const page2 = [
    product(300, {
      title: '<img src=x onerror="window.pwned=1">',
      variants: [{ price: '120.00', compare_at_price: '150.00', available: true }],
    }),
  ];
  const page = await open({ stored: '["300","5","999"]', pages: { 1: page1, 2: page2 } });
  await settled(page);

  const cards = await page.$$eval('[data-card]', (els) =>
    els.map((el) => ({
      id: el.dataset.productId,
      title: el.querySelector('[data-card-title]').textContent,
      price: el.querySelector('[data-card-price]').textContent,
      soldOut: !el.querySelector('[data-card-soldout]').hidden,
      href: el.querySelector('[data-card-link]').getAttribute('href'),
    }))
  );
  assert.deepEqual(page.requests, [1, 2]);
  assert.deepEqual(
    cards.map((c) => c.id),
    ['300', '5'],
    'wishlist order is preserved'
  );
  assert.equal(cards[0].title, '<img src=x onerror="window.pwned=1">', 'titles are text, never HTML');
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(cards[0].price, '€150,00 €120,00');
  assert.equal(cards[1].soldOut, true);
  assert.equal(cards[0].href, '/it/products/profumo-300');
  assert.match(await page.textContent('[data-wishlist-notice]'), /^1 prodotti non sono più disponibili/);
  assert.equal(await page.evaluate(() => localStorage.getItem('daino_wishlist')), '["300","5"]');
  assert.equal(await page.textContent('[data-wishlist-count-text]'), '2 prodotti salvati');
  assert.equal(await page.textContent('[data-wishlist-count]'), '2');
});

test('a network error keeps the saved ids and shows an error', async () => {
  const page = await open({ stored: '["1","2"]', failStatus: 500 });
  await page.waitForSelector('[data-wishlist-error]:not([hidden])');
  assert.equal(await page.evaluate(() => localStorage.getItem('daino_wishlist')), '["1","2"]');
});

test('removing a card updates storage, the count and the header badge', async () => {
  const page = await open({ stored: '["1","2"]', pages: { 1: [product(1), product(2)] } });
  await settled(page);
  await page.click('[data-card][data-product-id="1"] [data-card-remove]');
  assert.equal(await page.evaluate(() => localStorage.getItem('daino_wishlist')), '["2"]');
  assert.equal(await page.textContent('[data-wishlist-count-text]'), '1 prodotti salvati');
  assert.equal(await page.textContent('[data-wishlist-count]'), '1');
  await page.click('[data-card-remove]');
  await page.waitForSelector('[data-wishlist-empty]:not([hidden])');
  assert.equal(await page.isHidden('[data-wishlist-count]'), true);
});
