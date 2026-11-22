import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// A comment, matched so an import inside one is skipped, or an import: `'x'`, `"x"`, `url(x)` or `url('x')`, then
// its conditions.
const IMPORT = /\/\*[\s\S]*?\*\/|@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);\n?/g;

/** What the parentheses opening at `open` hold, nested ones included, and where they close. */
function group(text: string, open: number): [inner: string, end: number] | null {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')' && (depth -= 1) === 0) return [text.slice(open + 1, i), i + 1];
  }
  return null;
}

/** An import's conditions as the blocks a bundler wraps its sheet in: `layer(…)`, then `supports(…)`, then media. */
function wrap(css: string, conditions: string): string {
  let rest = conditions;
  let layer: string | undefined;
  if (/^layer(?![\w-])/.test(rest)) {
    const named = rest[5] === '(' ? group(rest, 5) : null;
    layer = named?.[0].trim() ?? '';
    rest = rest.slice(named?.[1] ?? 5).trimStart();
  }
  let supports: string | undefined;
  const inner = /^supports\(/.test(rest) ? group(rest, 8) : null;
  if (inner) [supports, rest] = [inner[0], rest.slice(inner[1]).trimStart()];
  const media = rest.trim();
  const block = (head: string, body: string) => `${head} {\n${body.endsWith('\n') ? body : `${body}\n`}}\n`;
  let out = css;
  if (layer !== undefined) out = block(layer ? `@layer ${layer}` : '@layer', out);
  if (supports) out = block(`@supports (${supports})`, out);
  if (media) out = block(`@media ${media}`, out);
  return out;
}

/**
 * A stylesheet's text as the bundler assembles it: each relative `@import`
 * replaced by the sheet it names. For a test that reads rules off disk because
 * jsdom computes nothing; a module assembled from imports holds none itself.
 */
export function readModuleCss(file: string, importers: string[] = []): string {
  if (importers.includes(file)) throw new Error(`readModuleCss: ${[...importers, file].join(' → ')} imports itself`);
  return readFileSync(file, 'utf8').replace(
    IMPORT,
    (match, _q1, url: string | undefined, _q2, quoted: string | undefined, conditions: string | undefined) => {
      const rel = url ?? quoted;
      if (!rel || !/^\.\.?\//.test(rel)) return match;
      return wrap(readModuleCss(resolve(dirname(file), rel), [...importers, file]), conditions!.trim());
    },
  );
}
