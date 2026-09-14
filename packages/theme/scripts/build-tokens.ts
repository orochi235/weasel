/**
 * Generates every token artifact from the theme definitions in themes/. Run via
 * `npm run gen:tokens -w @weasel-js/theme`; CI re-runs it and fails on a diff,
 * so the committed output under src/generated/ is never edited by hand.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumerateSelections } from '../src/axes';
import type { ThemeDefinition } from '../src/definition';
import { axisDependencies, bake, derive, emitCss, emitManifest, emitThemes, mergeChain } from '../src/engine';

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
const byName = new Map(definitions.map((d) => [d.name, d]));
const lookup = (name: string) => byName.get(name);

const roots = definitions.filter((d) => !d.extends);
if (roots.length !== 1) throw new Error(`themes/ needs exactly one theme that extends nothing; found ${roots.length}`);
const ordered = [roots[0], ...definitions.filter((d) => d.extends)];

const problems = ordered.flatMap((def) =>
  enumerateSelections(mergeChain(def, lookup).axes ?? {}).flatMap((sel) =>
    derive(def, sel, lookup).issues.map((issue) => `${def.name} ${JSON.stringify(sel)}: ${JSON.stringify(issue)}`),
  ),
);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const themes = ordered.map((definition) => ({
  definition,
  baked: bake(definition, lookup),
  deps: axisDependencies(definition, lookup),
  isDefault: definition === roots[0],
}));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'tokens.css'), emitCss(themes));
writeFileSync(resolve(OUT_DIR, 'themes.ts'), emitThemes(themes));
writeFileSync(resolve(OUT_DIR, 'manifest.ts'), emitManifest(themes[0]));

console.log(`Generated ${themes.length} theme(s) → ${OUT_DIR}`);
