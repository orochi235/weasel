/** One-off: tokens/weasel/ (DTCG) → themes/weasel.json. Deleted once the conversion lands. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from '../src/definition';
import { flattenTokens } from '../src/dtcg/flatten';
import type { RawToken } from '../src/dtcg/types';
import { DEFAULT_CONSTRAINTS } from '../src/engine/color/generate';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../tokens/weasel');
const read = (p: string) => JSON.parse(readFileSync(resolve(src, p), 'utf8'));

const manifest: { name: string; defaultMode: string; modes: Record<string, { colorScheme: 'dark' | 'light' }> } = read('theme.json');
const primitives = flattenTokens(read('primitives.tokens.json'));
const modeNames = Object.keys(manifest.modes);
const modes = Object.fromEntries(modeNames.map((m) => [m, flattenTokens(read(`modes/${m}.tokens.json`))]));

/** `{color.gray-800}` → `gray-800`, or null for a literal. */
const refName = (t: RawToken) => {
  const m = typeof t.value === 'string' ? /^\{(?:[\w-]+\.)?([^}.]+)\}$/.exec(t.value.trim()) : null;
  return m ? m[1] : null;
};
const extra = (t: RawToken) => ({
  ...(t.alpha !== undefined ? { alpha: t.alpha } : {}),
  ...(t.description ? { description: t.description } : {}),
});

const pin = (t: RawToken) => {
  const ref = refName(t);
  return { value: ref ? `{${ref}}` : t.value, type: t.type, ...extra(t) };
};
const rule = (t: RawToken) => {
  const ref = refName(t);
  return ref ? { ref, type: t.type, ...extra(t) } : { value: t.value, type: t.type, ...extra(t) };
};

const { count: _count, anchors: _anchors, ...gates } = DEFAULT_CONSTRAINTS;

const definition = {
  name: manifest.name,
  axes: {
    mode: {
      default: manifest.defaultMode,
      values: Object.fromEntries(modeNames.map((m) => [m, { scheme: manifest.modes[m].colorScheme }])),
    },
  },
  ramps: {
    gray: {
      kind: 'lightness',
      steps: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      lightness: [0.973, 0.163],
      curve: 0.41,
      hue: 266,
      chroma: { peak: 0.0116, darkBias: 0.84 },
    },
    accent: { kind: 'lightness', steps: ['soft', 'base', 'strong'], lightness: [0.252, 0.471], curve: 0, anchor: { base: '#2e1f7a' } },
    swatch: {
      kind: 'categorical',
      steps: ['fuchsia', 'green', 'sky', 'amber', 'teal', 'red', 'blue', 'citron', 'rose', 'violet'],
      gates,
    },
  },
  semantics: Object.fromEntries(
    Object.keys(modes[manifest.defaultMode]).map((name) => [
      name,
      { by: 'mode', ...Object.fromEntries(modeNames.map((m) => [m, rule(modes[m][name])])) },
    ]),
  ),
  pins: Object.fromEntries(Object.entries(primitives).map(([name, t]) => [name, pin(t)])),
} satisfies ThemeDefinition;

mkdirSync(resolve(here, '../themes'), { recursive: true });
writeFileSync(resolve(here, '../themes/weasel.json'), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`wrote themes/weasel.json: ${Object.keys(definition.pins).length} pins, ${Object.keys(definition.semantics).length} semantics`);
