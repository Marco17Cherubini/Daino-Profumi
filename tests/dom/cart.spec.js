'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

const env = setup();
before(() => env.start());
after(() => env.stop());

const FIXTURE = '/tests/dom/fixtures/cart.html';

async function open() {
  const posts = [];
  const page = await env.page(FIXTURE, {
    routes: async (p) => {
      await p.route('**/it/cart', (route) => {
        posts.push(new URLSearchParams(route.request().postData()));
        return route.fulfill({ contentType: 'text/html', body: '<p>ok</p>' });
      });
    },
  });
  await page.waitForFunction(() => customElements.get('daino-cart'));
  page.posts = posts;
  return page;
}

test('+/− buttons are revealed by JavaScript and post the updated quantities', async () => {
  const page = await open();
  assert.equal(await page.isVisible('[data-quantity-step="1"]'), true);
  await Promise.all([page.waitForURL('**/it/cart'), page.click('.cart-item:nth-of-type(2) [data-quantity-step="1"]')]);
  const body = page.posts[0];
  assert.deepEqual(body.getAll('updates[]'), ['2', '2']);
  assert.equal(body.has('update'), true);
});

test('quantity never goes below zero (zero removes the line)', async () => {
  const page = await open();
  await Promise.all([page.waitForURL('**/it/cart'), page.click('.cart-item:nth-of-type(2) [data-quantity-step="-1"]')]);
  assert.deepEqual(page.posts[0].getAll('updates[]'), ['2', '0']);
});

test('checkout submits the order note and quantities together with checkout', async () => {
  const page = await open();
  await page.fill('#cart-note', 'Confezione regalo, grazie');
  await page.fill('.cart-item:nth-of-type(1) [data-quantity-input]', '3');
  await Promise.all([page.waitForURL('**/it/cart'), page.click('[name="checkout"]')]);
  const body = page.posts[0];
  assert.equal(body.get('note'), 'Confezione regalo, grazie');
  assert.deepEqual(body.getAll('updates[]'), ['3', '1']);
  assert.equal(body.has('checkout'), true);
});
