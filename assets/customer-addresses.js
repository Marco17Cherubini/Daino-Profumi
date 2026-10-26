/**
 * Customer addresses — <daino-addresses> (templates/customers/addresses.liquid).
 *
 * - Wires Shopify's CountryProvinceSelector (shopify_common.js) to every address
 *   form, so the province field appears for countries that require it (it was
 *   always hidden before, which blocks addresses in Italy).
 * - Asks for confirmation before deleting an address.
 */
(function (global) {
  'use strict';

  if (typeof global.HTMLElement === 'undefined' || !global.Daino) return;
  const Daino = global.Daino;

  class DainoAddresses extends global.HTMLElement {
    connectedCallback() {
      const strings = Daino.readJSON(this.querySelector('[data-addresses-strings]'), {}) || {};
      this.abort = new AbortController();

      if (global.Shopify && global.Shopify.CountryProvinceSelector) {
        this.querySelectorAll('select[name="address[country]"]').forEach((country) => {
          const id = country.id;
          const prefix = id.slice(0, -'_country'.length);
          new global.Shopify.CountryProvinceSelector(id, `${prefix}_province`, {
            hideElement: `${prefix}_province_container`,
          });
        });
      }

      this.addEventListener(
        'click',
        (event) => {
          const button = event.target.closest('[data-confirm-delete]');
          if (button && !global.confirm(strings.confirmDelete || '')) event.preventDefault();
        },
        { signal: this.abort.signal }
      );
    }

    disconnectedCallback() {
      this.abort.abort();
    }
  }

  Daino.define('daino-addresses', DainoAddresses);
})(typeof window !== 'undefined' ? window : globalThis);
