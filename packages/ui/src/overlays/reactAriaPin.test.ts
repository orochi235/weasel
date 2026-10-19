import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Overlays set their portal container through `react-aria`'s portal
 * provider, which react-aria-components' overlays read from
 * their own `react-aria`. A second copy gives the provider a context no
 * overlay reads, and the overlay renders unthemed with no error.
 */
const uiDir = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(uiDir, 'package.json'));
const racManifest = require.resolve('react-aria-components/package.json');

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as {
    version: string;
    dependencies?: Record<string, string>;
  };
}

describe('react-aria is the copy react-aria-components uses', () => {
  const ui = readJson(join(uiDir, 'package.json'));
  const rac = readJson(racManifest);

  it("ui pins react-aria-components' react-aria exactly", () => {
    expect(ui.dependencies?.['react-aria']).toBe(rac.dependencies?.['react-aria']);
  });

  it('ui pins the installed react-aria-components', () => {
    expect(ui.dependencies?.['react-aria-components']).toBe(rac.version);
  });

  it('both resolve one installed react-aria', () => {
    const fromRac = createRequire(racManifest).resolve('react-aria/package.json');
    expect(require.resolve('react-aria/package.json')).toBe(fromRac);
  });
});
