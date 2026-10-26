'use strict';

/**
 * Runs Shopify Theme Check (@shopify/theme-check-node) on the theme and prints a
 * readable report. Exits with 1 when there is at least one error.
 *
 * Usage: node scripts/theme-check.js [themeRoot] [--json]
 * The package ships an API but no CLI; the full Shopify CLI (`shopify theme check`)
 * runs the same checks and can be used instead when installed.
 */
const path = require('node:path');
const { themeCheckRun } = require('@shopify/theme-check-node');

const SEVERITY = ['error', 'warning', 'info'];

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const root = path.resolve(args.find((arg) => !arg.startsWith('--')) || '.');
  const configPath = path.join(__dirname, '..', '.theme-check.yml');

  const { offenses } = await themeCheckRun(root, configPath, () => {});
  const toPath = (uri) => path.relative(root, decodeURIComponent(uri.replace('file://', '')));

  if (json) {
    console.log(
      JSON.stringify(
        offenses.map((o) => ({ ...o, uri: toPath(o.uri) })),
        null,
        2
      )
    );
  } else {
    offenses
      .slice()
      .sort((a, b) => a.severity - b.severity || a.uri.localeCompare(b.uri))
      .forEach((o) => {
        const line = o.start ? o.start.line + 1 : 0;
        console.log(`${SEVERITY[o.severity]}\t${o.check}\t${toPath(o.uri)}:${line}\t${o.message}`);
      });
  }

  const counts = SEVERITY.map((name, severity) => `${offenses.filter((o) => o.severity === severity).length} ${name}s`);
  console.error(`\nTheme Check: ${counts.join(', ')}`);
  process.exitCode = offenses.some((o) => o.severity === 0) ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
