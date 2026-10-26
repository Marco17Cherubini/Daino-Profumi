'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { suggestUrl, matchBrands, priceToCents } = require('../../assets/predictive-search.js');

test('suggestUrl targets the localised predictive search route with at most 10 results', () => {
  const url = new URL(suggestUrl('/it/search/suggest', 'oud & rose'), 'https://shop.test');
  assert.equal(url.pathname, '/it/search/suggest.json');
  assert.equal(url.searchParams.get('q'), 'oud & rose');
  assert.equal(url.searchParams.get('resources[limit]'), '10');
  assert.equal(url.searchParams.get('resources[type]'), 'product,collection,page');
});

test('matchBrands is case- and accent-insensitive, needs 2 characters and returns at most 5', () => {
  const brands = ['Bois 1920', 'Électimuss', 'Kajal', 'Ojar', 'Orto Parisi', 'Oman Luxury', 'Ghawali', 'Jeroboam'].map(
    (label) => ({ label, value: label })
  );
  assert.deepEqual(
    matchBrands(brands, 'ELECT').map((b) => b.label),
    ['Électimuss']
  );
  assert.deepEqual(
    matchBrands(brands, 'bois').map((b) => b.label),
    ['Bois 1920']
  );
  assert.deepEqual(matchBrands(brands, 'o'), []);
  assert.equal(matchBrands(brands, 'a').length, 0);
  assert.ok(matchBrands(brands, 'ar').length <= 5);
});

test('priceToCents converts API prices in major units', () => {
  assert.equal(priceToCents('45.00'), 4500);
  assert.equal(priceToCents('99.9'), 9990);
  assert.equal(priceToCents(12), 1200);
  assert.equal(priceToCents(null), null);
  assert.equal(priceToCents('n/a'), null);
});
