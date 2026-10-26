'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore, normalize, STORAGE_KEY } = require('../../assets/wishlist.js');
const { collectProducts, toCardData } = require('../../assets/wishlist-page.js');

function memoryStorage(initial) {
  const data = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    raw: () => data.get(STORAGE_KEY),
  };
}

test('normalize keeps unique numeric ids as strings', () => {
  assert.deepEqual(normalize([123, '123', ' 456 ', 'abc', null, {}, 7.5]), ['123', '456']);
  assert.deepEqual(normalize({ 0: '1' }), []);
  assert.deepEqual(normalize('123'), []);
});

test('missing storage value is an empty wishlist', () => {
  assert.deepEqual(createStore(memoryStorage()).getAll(), []);
});

test('invalid JSON or a non-array value is an empty wishlist and does not throw', () => {
  assert.deepEqual(createStore(memoryStorage('{not json')).getAll(), []);
  assert.deepEqual(createStore(memoryStorage('{"a":1}')).getAll(), []);
  assert.equal(createStore(memoryStorage('{"a":1}')).has('1'), false);
});

test('blocked storage (throws on access) is an empty wishlist and writes are ignored', () => {
  const throwing = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  const store = createStore(throwing);
  assert.deepEqual(store.getAll(), []);
  assert.doesNotThrow(() => store.add('1'));
  assert.deepEqual(createStore(null).getAll(), []);
});

test('toggle, add, remove and removeMany keep the stored format (JSON array of strings)', () => {
  const storage = memoryStorage('["1"]');
  const store = createStore(storage);
  assert.equal(store.toggle('2'), true);
  assert.equal(store.toggle('1'), false);
  store.add(3);
  store.add('3');
  assert.equal(storage.raw(), '["2","3"]');
  store.removeMany(['2', 3]);
  assert.equal(storage.raw(), '[]');
});

test('subscribers are notified with the new list', () => {
  const store = createStore(memoryStorage());
  const seen = [];
  store.subscribe((ids) => seen.push(ids));
  store.add('9');
  assert.deepEqual(seen, [['9']]);
});

test('collectProducts reads past the first 250 products and reports missing ids', async () => {
  const page1 = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
  const page2 = [{ id: 251 }, { id: 300 }];
  const requested = [];
  const result = await collectProducts(['300', '5', '999'], async (page) => {
    requested.push(page);
    return page === 1 ? page1 : page2;
  });
  assert.deepEqual(requested, [1, 2]);
  assert.deepEqual([...result.found.keys()].sort(), ['300', '5']);
  assert.deepEqual(result.missing, ['999']);
});

test('collectProducts stops as soon as every id is found', async () => {
  const requested = [];
  const result = await collectProducts(['1'], async (page) => {
    requested.push(page);
    return Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
  });
  assert.deepEqual(requested, [1]);
  assert.deepEqual(result.missing, []);
});

test('toCardData converts prices to cents and detects sold-out products', () => {
  const card = toCardData(
    {
      id: 10,
      title: 'Oud "Royal" <b>',
      handle: 'oud royal',
      vendor: 'Kajal',
      images: [{ src: 'https://cdn.shopify.com/x.jpg' }],
      variants: [
        { price: '120.00', compare_at_price: '150.00', available: false },
        { price: '95.50', compare_at_price: null, available: false },
      ],
    },
    '/it'
  );
  assert.equal(card.price, 9550);
  assert.equal(card.compareAt, 15000);
  assert.equal(card.available, false);
  assert.equal(card.url, '/it/products/oud%20royal');
  assert.equal(card.title, 'Oud "Royal" <b>');
});
