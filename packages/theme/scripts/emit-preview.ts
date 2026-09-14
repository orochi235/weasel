/** One-off: emit themes/weasel.json through the engine into a directory, for gate-conversion.ts. Usage: tsx emit-preview.ts <out-dir> */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumerateSelections, selectionKey } from '../src/axes';
import type { ThemeDefinition } from '../src/definition';
import { axisDependencies, bake, derive, emitCss, emitManifest, emitThemes } from '../src/engine';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2]);
const definition: ThemeDefinition = JSON.parse(readFileSync(resolve(here, '../themes/weasel.json'), 'utf8'));
const axes = definition.axes ?? {};

const problems: string[] = [];
for (const sel of enumerateSelections(axes)) {
  const { issues } = derive(definition, sel);
  if (issues.length) problems.push(`${definition.name} ${selectionKey(axes, sel)}: ${JSON.stringify(issues, null, 2)}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const input = { baked: bake(definition), deps: axisDependencies(definition), isDefault: true };
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'tokens.css'), emitCss([input]));
writeFileSync(resolve(out, 'manifest.ts'), emitManifest(input));
writeFileSync(resolve(out, 'themes.ts'), emitThemes([{ definition, baked: input.baked }]));
console.log(`emitted ${Object.keys(input.baked.tokens).length} tokens → ${out}`);
