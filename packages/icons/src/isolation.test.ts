import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DEPS = ['unplugin', 'magic-string', 'oxc-parser'];

/** Every module the package barrel reaches through relative imports, and every bare specifier on the way. */
function closure(entry: string) {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1]!;
      if (spec.startsWith('.')) visit(resolve(dirname(file), spec.replace(/\.[jt]s$/, '')) + '.ts');
      else bare.add(spec);
    }
  };
  visit(entry);
  return { files: [...seen], bare: [...bare] };
}

describe('@weasel-js/icons', () => {
  it('reaches neither the build plugin nor any Node built-in from its barrel', () => {
    const { files, bare } = closure(resolve(src, 'index.ts'));
    expect(files.length).toBeGreaterThan(1);
    expect(files.filter((f) => !f.startsWith(src))).toEqual([]);
    expect(bare.filter((s) => s.startsWith('node:') || PLUGIN_DEPS.includes(s))).toEqual([]);
  });

  it('installs none of the build plugin dependencies', () => {
    const manifest = JSON.parse(readFileSync(resolve(src, '../package.json'), 'utf8'));
    const installed = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies });
    expect(installed.filter((d) => PLUGIN_DEPS.includes(d) || d === 'vite')).toEqual([]);
  });
});
