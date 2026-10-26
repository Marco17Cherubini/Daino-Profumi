'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

const env = setup();
before(() => env.start());
after(() => env.stop());

const FIXTURE = '/tests/dom/fixtures/product.html';

async function state(page) {
  return page.evaluate(() => ({
    id: document.querySelector('[data-variant-id]').value,
    price: document.querySelector('[data-product-price]').textContent.trim(),
    badge: document.querySelector('[data-product-badge]').textContent.trim(),
    addDisabled: document.querySelector('[data-add-to-cart]').disabled,
    buyDisabled: document.querySelector('[data-buy-now]').disabled,
    buyHidden: document.querySelector('[data-buy-now]').hidden,
    url: location.search,
    status: document.querySelector('[data-variant-status]').textContent,
  }));
}

async function ready(page) {
  await page.waitForFunction(() => customElements.get('daino-product'));
}

test('a ?variant= in the URL is never overwritten on load', async () => {
  const page = await env.page(FIXTURE, { query: '?variant=2' });
  await ready(page);
  const s = await state(page);
  assert.equal(s.url, '?variant=2');
  assert.equal(s.buyHidden, false, 'buy now is revealed once JavaScript runs');
  assert.deepEqual(page.errors, []);
});

test('selecting an available variant updates id, price, badge, buttons and URL', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.click('label[for="o11"]'); // 50 ml + Extrait → variant 3
  const s = await state(page);
  assert.equal(s.id, '3');
  assert.equal(s.price, '€129,00');
  assert.equal(s.badge, 'Disponibile');
  assert.equal(s.addDisabled, false);
  assert.equal(s.url, '?variant=3');
  assert.match(s.status, /€129,00/);
});

test('a sold-out variant disables purchase and shows compare-at price and its image', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.click('label[for="o01"]'); // 100 ml + Eau de Parfum → variant 2 (sold out)
  const s = await state(page);
  assert.equal(s.id, '2');
  assert.equal(s.price, '€169,00€149,00');
  assert.equal(s.badge, 'Esaurito');
  assert.equal(s.addDisabled, true);
  assert.equal(s.buyDisabled, true);
  const image = await page.getAttribute('[data-gallery-main]', 'src');
  assert.match(image, /b\.png\?width=1000$/);
});

test('a combination that does not exist disables purchase instead of keeping the previous variant', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.click('label[for="o01"]'); // 100 ml + EdP → variant 2
  await page.click('label[for="o11"]'); // 100 ml + Extrait → does not exist
  const s = await state(page);
  assert.equal(s.badge, 'Non disponibile');
  assert.equal(s.addDisabled, true);
  assert.equal(s.buyDisabled, true);
  assert.equal(s.url, '?variant=2', 'URL keeps the last real variant');
});

test('variant options are reachable and changeable with the keyboard', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.focus('#o00');
  await page.keyboard.press('ArrowRight'); // radio group: moves to "100 ml"
  const s = await state(page);
  assert.equal(s.id, '2');
});

test('quantity stepper never goes below 1 and sanitises typed values', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.click('[data-quantity-step="1"]');
  await page.click('[data-quantity-step="1"]');
  assert.equal(await page.inputValue('[data-quantity-input]'), '3');
  await page.click('[data-quantity-step="-1"]');
  await page.click('[data-quantity-step="-1"]');
  await page.click('[data-quantity-step="-1"]');
  assert.equal(await page.inputValue('[data-quantity-input]'), '1');
  await page.fill('[data-quantity-input]', '-5');
  await page.dispatchEvent('[data-quantity-input]', 'change');
  assert.equal(await page.inputValue('[data-quantity-input]'), '1');
});

test('buy now adds the selection to the cart, then posts to /cart with checkout', async () => {
  let added = null;
  let checkoutPost = null;
  const page = await env.page(FIXTURE, {
    routes: async (p) => {
      await p.route('**/it/cart/add.js', async (route) => {
        added = JSON.parse(route.request().postData());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' });
      });
      await p.route('**/it/cart', async (route) => {
        checkoutPost = { method: route.request().method(), body: route.request().postData() };
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>checkout</p>' });
      });
    },
  });
  await ready(page);
  await page.click('label[for="o11"]'); // variant 3
  await page.click('[data-quantity-step="1"]');
  await Promise.all([page.waitForURL('**/it/cart'), page.click('[data-buy-now]')]);
  assert.deepEqual(added, { items: [{ id: 3, quantity: 2 }] });
  assert.equal(checkoutPost.method, 'POST');
  assert.match(checkoutPost.body, /checkout=/);
});

test('buy now shows the cart error and re-enables the button', async () => {
  const page = await env.page(FIXTURE, {
    routes: async (p) => {
      await p.route('**/it/cart/add.js', (route) =>
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ status: 422, message: 'Cart Error', description: 'Disponibili solo 2 pezzi' }),
        })
      );
    },
  });
  await ready(page);
  await page.click('[data-buy-now]');
  await page.waitForSelector('[data-form-error]:not([hidden])');
  assert.equal(await page.textContent('[data-form-error]'), 'Disponibili solo 2 pezzi');
  assert.equal(await page.isDisabled('[data-buy-now]'), false);
});

test('re-rendering the section (Theme Editor) does not duplicate listeners', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.evaluate(() => {
    const el = document.querySelector('daino-product');
    const parent = el.parentNode;
    parent.removeChild(el); // shopify:section:unload
    parent.appendChild(el); // shopify:section:load
  });
  await page.click('[data-quantity-step="1"]');
  assert.equal(await page.inputValue('[data-quantity-input]'), '2');
});

test('thumbnails swap the main image and the zoom link', async () => {
  const page = await env.page(FIXTURE);
  await ready(page);
  await page.click('[data-gallery-thumb]:nth-of-type(2)');
  assert.match(await page.getAttribute('[data-gallery-main]', 'src'), /c\.png$/);
  assert.equal(await page.getAttribute('[data-gallery-zoom]', 'href'), '/c-big.png');
  assert.equal(await page.getAttribute('[data-gallery-thumb]:nth-of-type(2)', 'aria-pressed'), 'true');
});
