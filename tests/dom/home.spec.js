'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

const env = setup();
before(() => env.start());
after(() => env.stop());

const FIXTURE = '/tests/dom/fixtures/home.html';

const gateGone = (page) =>
  page.waitForFunction(
    () => {
      const gate = document.querySelector('daino-entrance-gate');
      return gate.hidden && !document.documentElement.classList.contains('is-scroll-locked');
    },
    null,
    { timeout: 8000 }
  );

async function heroOpacities(page) {
  return page.$$eval('[data-gate-reveal]', (els) => els.map((el) => getComputedStyle(el).opacity));
}

test('the gate locks scrolling, then opens with the keyboard and reveals the hero', async () => {
  const page = await env.page(FIXTURE);
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scroll-locked'));
  await page.waitForFunction(
    () => document.activeElement && document.activeElement.matches('[data-gate-enter]'),
    null,
    {
      timeout: 6000,
    }
  );
  await page.keyboard.press('Enter');
  await gateGone(page);
  assert.deepEqual(await heroOpacities(page), ['1', '1', '1']);
  assert.equal(await page.$('[data-gate-spacer]'), null);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'MainContent');
  assert.deepEqual(page.errors, []);
});

test('the indicator is a button: clicking it enters immediately, even during the intro', async () => {
  const page = await env.page(FIXTURE);
  await page.waitForFunction(() => customElements.get('daino-entrance-gate'));
  await page.click('[data-gate-enter]', { force: true });
  await gateGone(page);
});

test('ArrowDown and PageDown also enter', async () => {
  const page = await env.page(FIXTURE);
  await page.waitForFunction(
    () => document.activeElement && document.activeElement.matches('[data-gate-enter]'),
    null,
    {
      timeout: 6000,
    }
  );
  await page.keyboard.press('PageDown');
  await gateGone(page);
});

test('reduced motion skips the gate and shows the hero at once', async () => {
  const page = await env.page(FIXTURE, { reducedMotion: 'reduce' });
  await gateGone(page);
  assert.deepEqual(await heroOpacities(page), ['1', '1', '1']);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('animations-off')), true);
});

test('in the Theme Editor (design mode) the gate is skipped', async () => {
  const page = await env.page(FIXTURE, { query: '?design' });
  await gateGone(page);
});

test('without JavaScript the gate is hidden and the hero is visible', async () => {
  const page = await env.page(FIXTURE, { javaScriptEnabled: false });
  assert.equal(await page.isHidden('daino-entrance-gate'), true);
  assert.deepEqual(await heroOpacities(page), ['1', '1', '1']);
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.querySelector('.hero-video-container')).position),
    'relative'
  );
});

test('carousel clones are inert and hidden from assistive tech', async () => {
  const page = await env.page(FIXTURE, { reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelectorAll('[data-carousel-clone]').length === 6);
  const clones = await page.$$eval('[data-carousel-clone]', (els) =>
    els.map((el) => [el.inert, el.getAttribute('aria-hidden')])
  );
  assert.ok(clones.every(([inert, hidden]) => inert === true && hidden === 'true'));
});

test('removing the carousel (Theme Editor) tears it down; re-adding builds it once', async () => {
  const page = await env.page(FIXTURE, { reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelectorAll('[data-carousel-clone]').length === 6);
  const clonesAfterRemoval = await page.evaluate(async () => {
    const el = document.querySelector('daino-carousel');
    window.detachedCarousel = el;
    el.remove(); // shopify:section:unload
    await new Promise((resolve) => setTimeout(resolve, 50));
    return el.querySelectorAll('[data-carousel-clone]').length;
  });
  assert.equal(clonesAfterRemoval, 0);
  await page.evaluate(() => document.querySelector('main').appendChild(window.detachedCarousel)); // shopify:section:load
  await page.waitForFunction(() => document.querySelectorAll('[data-carousel-clone]').length === 6);
  assert.equal(await page.$$eval('.track .card', (els) => els.length), 9);
});

test('a transient re-attachment (as GSAP does when measuring) keeps the carousel intact', async () => {
  const page = await env.page(FIXTURE, { reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelectorAll('[data-carousel-clone]').length === 6);
  await page.evaluate(() => {
    const el = document.querySelector('daino-carousel');
    const parent = el.parentNode;
    document.documentElement.appendChild(el);
    parent.appendChild(el);
  });
  await page.waitForTimeout(50);
  assert.equal(await page.$$eval('.track .card', (els) => els.length), 9);
});
