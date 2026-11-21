import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

/** Each `name.classname` a story reads from a stylesheet it imports as `name`. */
function reads(file: string): { sheet: string; name: string }[] {
  const source = readFileSync(join(here, file), 'utf8');
  const dir = dirname(file);
  const sheets = [...source.matchAll(/^import (\w+) from '\.\/([\w.]+\.module\.css)';$/gm)];
  return sheets.flatMap(([, local, sheet]) =>
    [...source.matchAll(new RegExp(`\\b${local}\\.(\\w+)`, 'g'))].map(([, name]) => ({ sheet: join(dir, sheet!), name: name! })));
}

it("defines every class the bar's stories read from their stylesheets", () => {
  const missing = readdirSync(here, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.stories.tsx'))
    .flatMap((file) => reads(file).map((read) => ({ file, ...read })))
    .filter(({ sheet, name }) => !new RegExp(`\\.${name}\\b`).test(readFileSync(join(here, sheet), 'utf8')))
    .map(({ file, sheet, name }) => `${file}: ${sheet} .${name}`);
  expect([...new Set(missing)]).toEqual([]);
});
