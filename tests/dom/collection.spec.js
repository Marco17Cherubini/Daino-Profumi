'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, delayedFulfil } = require('./helpers');

const env = setup();
before(() => env.start());
after(() => env.stop());

const FIXTURE = '/tests/dom/fixtures/collection.html';

/** Section Rendering mock: the response echoes the filter query it was asked for. */
function sectionResponse(query) {
  const label = query || 'none';
  return `<div id="shopify-section-main">
    <span data-product-count>${label} risultati</span>
    <div data-results>
      <div class="active-filters" data-active-filters>
        <a class="filter-tag" href="/tests/dom/fixtures/collection.html?sort_by=manual" data-filter-link>Rimuovi tutto</a>
      </div>
      <div class="collection-grid-wrapper">
        <div class="collection-loading" data-loading-overlay></div>
        <div class="collection-grid" data-product-grid><p data-marker>${label}</p></div>
      </div>
    </div>
  </div>`;
}

/** Mocks section requests; `delayFor(query)` returns the response delay in ms. */
async function open({ delayFor = () => 0, query = '' } = {}) {
  const served = [];
  const page = await env.page(FIXTURE, {
    query,
    routes: async (p) => {
      await p.route('**/collection.html?*section_id=*', (route) => {
        const url = new URL(route.request().url());
        url.searchParams.delete('section_id');
        const q = decodeURIComponent(url.searchParams.toString());
        served.push(q);
        return delayedFulfil(route, sectionResponse(q), { delay: delayFor(q) });
      });
    },
  });
  await page.waitForFunction(() => customElements.get('daino-collection-filters'));
  page.served = served;
  return page;
}

const marker = (page) => page.textContent('[data-marker]');

async function openDrawer(page) {
  await page.click('[data-filters-open]');
  await page.waitForSelector('[data-filters-drawer].is-open');
}

test('fast changes: the latest selection wins even when an older response arrives later', async () => {
  // The first request (Kajal only) is slow; the second (Kajal + Bois) is fast.
  const page = await open({ delayFor: (q) => (q.includes('Bois') ? 0 : 600) });
  await openDrawer(page);
  await page.check('input[value="Kajal"]');
  await page.check('input[value="Bois 1920"]');
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('Bois'));
  await page.waitForTimeout(800); // let the slow, aborted response time out
  const url = await page.evaluate(() => decodeURIComponent(location.search));
  assert.match(await marker(page), /Kajal.*Bois\+1920/);
  assert.match(url, /Kajal.*Bois\+1920/);
  assert.equal(page.served.length, 2, 'both requests were sent; the first one was aborted');
  assert.deepEqual(
    await page.$$eval('[data-filters-form] input[type=checkbox]', (els) => els.map((el) => el.checked)),
    [true, true, false]
  );
});

test('back and forward restore URL, inputs and results together', async () => {
  const page = await open();
  await openDrawer(page);
  await page.check('input[value="Kajal"]');
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('Kajal'));
  await page.check('input[value="Bois 1920"]');
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('Bois'));

  await page.goBack();
  await page.waitForFunction(() => !document.querySelector('[data-marker]').textContent.includes('Bois'));
  assert.equal(await page.isChecked('input[value="Kajal"]'), true);
  assert.equal(await page.isChecked('input[value="Bois 1920"]'), false);

  await page.goForward();
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('Bois'));
  assert.equal(await page.isChecked('input[value="Bois 1920"]'), true);
});

test('values with quotes are restored from the URL without errors', async () => {
  const query = `?${new URLSearchParams({ 'filter.p.m.custom.brand': 'L\'Artisan "P"' })}`;
  const page = await open({ query });
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('Artisan'));
  assert.equal(await page.isChecked('input[value^="L\'Artisan"]'), true);
  assert.deepEqual(page.errors, []);
});

test('reset clears filters loaded with the page (no form.reset() back to server state)', async () => {
  const page = await open({ query: '?filter.p.m.custom.brand=Kajal' });
  await page.evaluate(() => {
    // Simulate the server-rendered checked state of a page loaded with a filter.
    const input = document.querySelector('input[value="Kajal"]');
    input.defaultChecked = true;
    input.checked = true;
  });
  await openDrawer(page);
  await page.click('[data-filters-reset]');
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('sort_by=manual'));
  assert.equal(await page.isChecked('input[value="Kajal"]'), false);
  assert.equal(await page.evaluate(() => location.search), '?sort_by=manual');
});

test('active-filter links from the response are fetched in place', async () => {
  const page = await open({ query: '?filter.p.m.custom.brand=Kajal' });
  await openDrawer(page);
  await page.check('input[value="Bois 1920"]');
  await page.waitForSelector('[data-filter-link]');
  await page.click('[data-filters-close]');
  await page.click('[data-filter-link]');
  await page.waitForFunction(() => location.search === '?sort_by=manual');
  assert.equal(await page.isChecked('input[value="Bois 1920"]'), false);
});

test('drawer: focus moves in, Tab is trapped, Escape closes and focus returns to the button', async () => {
  const page = await open();
  await openDrawer(page);
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-filters-drawer]') !== null), true);
  assert.equal(await page.getAttribute('[data-filters-open]', 'aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.querySelector('header').inert), true, 'page behind is inert');

  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-filters-drawer]') !== null), true);

  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-filters-drawer]:not(.is-open)');
  assert.equal(await page.evaluate(() => document.activeElement.matches('[data-filters-open]')), true);
  assert.equal(await page.evaluate(() => document.querySelector('[data-filters-drawer]').inert), true);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-scroll-locked')), false);
});

test('price inputs are debounced into a single request', async () => {
  const page = await open();
  await openDrawer(page);
  await page.fill('input[name="filter.v.price.gte"]', '50');
  await page.fill('input[name="filter.v.price.lte"]', '150');
  await page.waitForFunction(() => document.querySelector('[data-marker]').textContent.includes('lte=150'));
  assert.equal(page.served.length, 1);
  assert.match(page.served[0], /filter\.v\.price\.gte=50&filter\.v\.price\.lte=150/);
});
