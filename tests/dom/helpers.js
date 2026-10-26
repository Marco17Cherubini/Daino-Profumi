'use strict';

/**
 * DOM test helpers: a static server for the repository (fixtures + theme assets)
 * and a Playwright Chromium page per test. Network calls the theme makes to
 * Shopify endpoints are answered with `page.route()` mocks inside each spec.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Sets up a browser + server for a test file. Usage:
 *   const env = setup(); before(env.start); after(env.stop);
 *   const page = await env.page('/tests/dom/fixtures/x.html');
 */
function setup() {
  const state = { server: null, browser: null, contexts: [] };
  return {
    async start() {
      state.server = await startServer();
      state.browser = await chromium.launch();
    },
    async stop() {
      await Promise.all(state.contexts.map((context) => context.close()));
      if (state.browser) await state.browser.close();
      if (state.server) state.server.close();
    },
    origin() {
      return `http://127.0.0.1:${state.server.address().port}`;
    },
    /**
     * @param {string} pathname fixture path
     * @param {object} [options] { routes: async (page) => void, javaScriptEnabled, reducedMotion, query }
     */
    async page(pathname, options = {}) {
      const context = await state.browser.newContext({
        javaScriptEnabled: options.javaScriptEnabled !== false,
        reducedMotion: options.reducedMotion || 'no-preference',
        viewport: options.viewport || { width: 1280, height: 800 },
      });
      state.contexts.push(context);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error));
      page.errors = errors;
      if (options.routes) await options.routes(page);
      await page.goto(`${this.origin()}${pathname}${options.query || ''}`);
      return page;
    },
  };
}

/** Fulfils a route after `delay` ms (used to simulate slow Shopify responses). */
function delayedFulfil(route, body, { delay = 0, status = 200, contentType = 'text/html' } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      route.fulfill({ status, contentType, body }).then(resolve, resolve);
    }, delay);
  });
}

module.exports = { setup, delayedFulfil, ROOT };
