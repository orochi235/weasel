/**
 * Generate the LEGO and Copic swatch sets from their upstream sources.
 *
 * Both are fetched rather than transcribed, so a wrong hex would have to be
 * wrong upstream. Re-run when either source moves:
 *
 *   node apps/theme-editor/scripts/gen-brand-colors.mjs
 *
 * LEGO  — brickset.com/colours/status-Current, which is the piece LDraw's
 *         LDConfig has no field for: what LEGO is currently producing.
 * Copic — github.com/meodai/copic-colors (MIT), whose values are sampled from
 *         the swatch images on copic.jp rather than someone's idealisation.
 */
import { writeFileSync } from 'node:fs';
import { PALETTE_FILES, parseCopic, parseLego, renderCopic, renderLego } from './brand-colors.mjs';

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

/** A fetch that fails on a non-2xx answer, so a block page is never parsed as the source. */
async function get(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`gen-brand-colors: ${url} answered ${r.status} ${r.statusText}`);
  return r;
}

const [legoRows, copicRows] = await Promise.all([
  get('https://brickset.com/colours/status-Current', { headers: UA }).then((r) => r.text()).then(parseLego),
  get('https://raw.githubusercontent.com/meodai/copic-colors/main/colors.json').then((r) => r.json()).then(parseCopic),
]);

// Both render before either is written, so a failure leaves both files as they were.
const lego = renderLego(legoRows);
const copic = renderCopic(copicRows);
writeFileSync(PALETTE_FILES.lego, lego);
writeFileSync(PALETTE_FILES.copic, copic);
console.log(`lego: ${legoRows.length} current solid chromatic colours`);
console.log(`copic: ${copicRows.length} markers`);
