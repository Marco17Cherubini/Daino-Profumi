'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Daino = require('../../assets/daino-core.js');

test('formatMoney follows the shop money format placeholders', () => {
  assert.equal(Daino.formatMoney(4500, '€{{amount_with_comma_separator}}'), '€45,00');
  assert.equal(Daino.formatMoney(123456789, '€{{amount_with_comma_separator}}'), '€1.234.567,89');
  assert.equal(Daino.formatMoney(123456, '${{amount}}'), '$1,234.56');
  assert.equal(Daino.formatMoney(123456, '{{amount_no_decimals}} kr'), '1,235 kr');
  assert.equal(Daino.formatMoney(123456, '{{ amount_no_decimals_with_comma_separator }} €'), '1.235 €');
  assert.equal(Daino.formatMoney(123456, 'CHF {{amount_with_apostrophe_separator}}'), "CHF 1'234.56");
  assert.equal(Daino.formatMoney(123456, '{{amount_with_space_separator}} zł'), '1 234,56 zł');
});

test('formatMoney accepts numeric strings, strips HTML and rejects invalid input', () => {
  assert.equal(Daino.formatMoney('990', '€{{amount_with_comma_separator}}'), '€9,90');
  assert.equal(Daino.formatMoney(990, '<span class="money">€{{amount_with_comma_separator}}</span>'), '€9,90');
  assert.equal(Daino.formatMoney('abc', '€{{amount}}'), '');
  assert.equal(Daino.formatMoney(null, '€{{amount}}'), '€0.00');
});

test('latestFetcher aborts the previous request so only the latest wins', async () => {
  const signals = [];
  const fakeFetch = (url, { signal }) => {
    signals.push(signal);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ ok: true, url }), url === 'slow' ? 30 : 5);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };
  const request = Daino.latestFetcher(fakeFetch);
  const first = request('slow');
  const second = request('fast');
  await assert.rejects(first, (error) => Daino.isAbortError(error));
  assert.equal((await second).url, 'fast');
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
});

test('latestFetcher rejects with the HTTP status on errors', async () => {
  const request = Daino.latestFetcher(async () => ({ ok: false, status: 503 }));
  await assert.rejects(request('/x'), (error) => error.status === 503);
});

test('scrollLock is reference counted per owner', () => {
  Daino.scrollLock.reset();
  Daino.scrollLock.lock('drawer');
  Daino.scrollLock.lock('search');
  Daino.scrollLock.unlock('drawer');
  assert.equal(Daino.scrollLock.isLocked(), true);
  Daino.scrollLock.unlock('search');
  assert.equal(Daino.scrollLock.isLocked(), false);
  Daino.scrollLock.unlock('search');
  assert.equal(Daino.scrollLock.isLocked(), false);
});

test('debounce runs once after the last call', async () => {
  let calls = 0;
  const fn = Daino.debounce(() => calls++, 10);
  fn();
  fn();
  fn();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(calls, 1);
});
