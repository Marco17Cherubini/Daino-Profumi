'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildParams, sectionUrl, isChecked } = require('../../assets/collection-filters.js');

test('buildParams keeps repeated keys, drops empty values and sets sort_by', () => {
  const params = buildParams(
    [
      ['filter.p.m.custom.brand', 'Kajal'],
      ['filter.p.m.custom.brand', 'Bois 1920'],
      ['filter.v.price.gte', ''],
      ['filter.v.price.lte', ' 120 '],
    ],
    'price-ascending'
  );
  assert.equal(
    params.toString(),
    'filter.p.m.custom.brand=Kajal&filter.p.m.custom.brand=Bois+1920&filter.v.price.lte=120&sort_by=price-ascending'
  );
});

test('sectionUrl adds section_id without losing filters', () => {
  const params = new URLSearchParams('filter.v.availability=1&sort_by=manual');
  assert.equal(
    sectionUrl('/it/collections/catalogo', params, 'template--1__main'),
    '/it/collections/catalogo?filter.v.availability=1&sort_by=manual&section_id=template--1__main'
  );
  assert.equal(params.has('section_id'), false, 'input params are not mutated');
});

test('isChecked compares values literally (quotes, "=" and spaces are safe)', () => {
  const params = new URLSearchParams();
  params.append('filter.p.m.custom.brand', 'L\'Artisan "Parfumeur"');
  params.append('filter.p.m.custom.note', 'a=b');
  assert.equal(isChecked(params, 'filter.p.m.custom.brand', 'L\'Artisan "Parfumeur"'), true);
  assert.equal(isChecked(params, 'filter.p.m.custom.note', 'a=b'), true);
  assert.equal(isChecked(params, 'filter.p.m.custom.note', 'a'), false);
});
