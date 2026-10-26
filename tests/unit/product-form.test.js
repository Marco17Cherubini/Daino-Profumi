'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findVariant, normalizeQuantity, variantUrl, cartErrorMessage } = require('../../assets/product-form.js');

const variants = [
  { id: 1, options: ['50 ml', 'Eau de Parfum'], available: true },
  { id: 2, options: ['100 ml', 'Eau de Parfum'], available: false },
  { id: 3, options: ['50 ml', 'Extrait'], available: true },
];

test('findVariant returns the exact match', () => {
  assert.equal(findVariant(variants, ['100 ml', 'Eau de Parfum']).id, 2);
});

test('findVariant returns null for a combination that does not exist', () => {
  assert.equal(findVariant(variants, ['100 ml', 'Extrait']), null);
});

test('findVariant returns null when an option is not selected', () => {
  assert.equal(findVariant(variants, ['50 ml', null]), null);
});

test('normalizeQuantity keeps integers >= 1', () => {
  assert.equal(normalizeQuantity('3'), 3);
  assert.equal(normalizeQuantity('2.7'), 2);
  assert.equal(normalizeQuantity('0'), 1);
  assert.equal(normalizeQuantity('-4'), 1);
  assert.equal(normalizeQuantity('abc'), 1);
  assert.equal(normalizeQuantity(''), 1);
});

test('variantUrl sets ?variant= and keeps other parameters and the hash', () => {
  assert.equal(
    variantUrl('https://shop.test/it/products/oud?variant=1&ref=ad#reviews', 3),
    'https://shop.test/it/products/oud?variant=3&ref=ad#reviews'
  );
});

test('cartErrorMessage prefers the API description', () => {
  assert.equal(cartErrorMessage({ description: 'Only 2 left' }, 'fallback'), 'Only 2 left');
  assert.equal(cartErrorMessage({ message: 'Cart Error' }, 'fallback'), 'Cart Error');
  assert.equal(cartErrorMessage(null, 'fallback'), 'fallback');
});
