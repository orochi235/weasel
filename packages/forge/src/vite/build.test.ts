// @vitest-environment node
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hoistPages, writePages } from './build';

describe('forge build pages', () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('writes a document per entry under node_modules/.forge and returns them as inputs', () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-build-')));
    const input = writePages(root);
    expect(input).toEqual({
      index: join(root, 'node_modules/.forge/index.html'),
      frame: join(root, 'node_modules/.forge/frame.html'),
    });
    expect(readFileSync(input.index!, 'utf8')).toContain('<script type="module" src="virtual:forge/shell-entry.js">');
    expect(readFileSync(input.frame!, 'utf8')).toContain('<script type="module" src="virtual:forge/frame-entry.js">');
  });

  it('moves the emitted documents to the output root and leaves every other file alone', () => {
    const bundle: Record<string, { type: string; fileName: string; source?: string }> = {
      'node_modules/.forge/index.html': { type: 'asset', fileName: 'node_modules/.forge/index.html', source: 'shell' },
      'node_modules/.forge/frame.html': { type: 'asset', fileName: 'node_modules/.forge/frame.html', source: 'frame' },
      'assets/index.js': { type: 'chunk', fileName: 'assets/index.js' },
      'other/page.html': { type: 'asset', fileName: 'other/page.html', source: 'other' },
    };
    const emitted: { fileName: string; source: unknown }[] = [];
    hoistPages(bundle as never, (file) => emitted.push(file));
    expect(Object.keys(bundle).sort()).toEqual(['assets/index.js', 'other/page.html']);
    expect(emitted).toEqual([
      { type: 'asset', fileName: 'index.html', source: 'shell' },
      { type: 'asset', fileName: 'frame.html', source: 'frame' },
    ]);
  });

  it('rewrites relative urls for the two directories the documents moved up', () => {
    const source = '<link rel="stylesheet" href="../../assets/a.css"><script type="module" src="../../assets/a.js"></script>';
    const bundle = { 'node_modules/.forge/index.html': { type: 'asset', source } };
    const emitted: { source: unknown }[] = [];
    hoistPages(bundle, (file) => emitted.push(file));
    expect(emitted[0]?.source).toBe('<link rel="stylesheet" href="./assets/a.css"><script type="module" src="./assets/a.js"></script>');
  });
});
