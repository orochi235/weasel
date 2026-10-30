// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { resolve } from 'node:path';

/** A consumer importing this package, bundled the way an app targeting older browsers bundles it. */
describe('bundling @weasel-js/text-shaping', () => {
  it.each(['browser', 'node'] as const)('builds for ES2020 on platform %s, with no top-level await', async (platform) => {
    const result = await build({
      stdin: {
        contents: `import { loadShaper } from './index'; loadShaper().then((s) => s.shape);`,
        resolveDir: resolve(import.meta.dirname),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      platform,
      logLevel: 'silent',
      outdir: 'out',
    });
    expect(result.errors).toEqual([]);
    expect(result.outputFiles.map((f) => f.text).join('\n')).not.toMatch(/^await /m);
  });
});
