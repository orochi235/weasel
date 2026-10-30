import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { browserPrebundle } from './vitest-browser-prebundle.ts';

const root = mkdtempSync(join(tmpdir(), 'browser-prebundle-'));
mkdirSync(join(root, 'pkg'));
mkdirSync(join(root, 'packages'));
writeFileSync(join(root, 'pkg/b.browser.test.tsx'), '');
afterAll(() => rmSync(root, { recursive: true, force: true }));

const options = { name: 'browser', tests: ['pkg/*.browser.test.tsx'] };
const on = (argv: string[], env: Record<string, string> = {}, tty = false) =>
  browserPrebundle(root, options, argv, env, tty).plugins.length > 0;

describe('browserPrebundle', () => {
  it('bundles a run of the project, or of every project', () => {
    expect(on(['run', '--project=browser', 'pkg/b.browser.test.tsx'])).toBe(true);
    expect(on(['run', '--project', 'browser'])).toBe(true);
    expect(on(['run'])).toBe(true);
  });

  it('leaves the packages to source in watch mode, where a package edit could not re-bundle', () => {
    expect(on(['--project=browser'], {}, true)).toBe(false);
    expect(on(['--project=browser', '--watch'])).toBe(false);
    expect(on(['--project=browser'], { CI: '1' }, true)).toBe(true);
  });

  it('configures nothing for a run naming only other projects', () => {
    expect(on(['run', '--project=core'])).toBe(false);
  });

  it('leaves the packages to source under WEASEL_DEV_SOURCE=1', () => {
    expect(on(['run'], { WEASEL_DEV_SOURCE: '1' })).toBe(false);
  });

  it('keeps its bundles in a cache directory of its own', () => {
    expect(browserPrebundle(root, options, ['run'], {}, false).cacheDir).toBe('node_modules/.vite-browser');
  });
});
