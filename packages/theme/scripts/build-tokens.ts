/**
 * Generates every token artifact from the theme definitions in themes/. Run via
 * `npm run gen:tokens -w @weasel-js/theme`; CI re-runs it and fails on a diff,
 * so the committed output under src/generated/ is never edited by hand.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from '../src/definition';
import { generateTokens } from '../src/engine';

const here = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = resolve(here, '../themes');
// Overridable so the determinism check can generate into a temp dir instead of
// rewriting the committed files other tests are reading from concurrently.
const OUT_DIR = process.env.WZL_TOKENS_OUT_DIR
  ? resolve(process.env.WZL_TOKENS_OUT_DIR)
  : resolve(here, '../src/generated');

const definitions: ThemeDefinition[] = readdirSync(THEMES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(resolve(THEMES_DIR, f), 'utf8')));

const result = generateTokens(definitions);
if (!result.ok) {
  console.error(result.problems.join('\n'));
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
for (const [file, text] of Object.entries(result.files)) writeFileSync(resolve(OUT_DIR, file), text);

console.log(`Generated ${definitions.length} theme(s) → ${OUT_DIR}`);
