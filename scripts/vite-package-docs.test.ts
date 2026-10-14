import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { demosByPackage, packageDoc, packageInfos } from './vite-package-docs';

const ROOT = resolve(__dirname, '..');

describe('packageInfos, over the real workspace', () => {
  const infos = packageInfos(ROOT);
  const named = (name: string) => infos.find((info) => info.name === name)!;

  it('gives every published package an entry, sorted by name', () => {
    expect(infos.length).toBeGreaterThan(20);
    expect(infos.map((i) => i.name)).toEqual([...infos.map((i) => i.name)].sort((a, b) => a.localeCompare(b)));
    expect(infos.filter((i) => !i.specifier.endsWith(`/${i.name}`) || !i.version)).toEqual([]);
  });

  it('reads the entries a consumer imports from the exports map, the root first', () => {
    const { entries } = named('geom');
    expect(entries[0]).toBe('@weasel-js/geom');
    expect(entries).toContain('@weasel-js/geom/booleans');
  });

  it('names the weasel packages a package depends on', () => {
    expect(named('geom').uses).toEqual([]);
    expect(named('labkit').uses).toContain('core');
  });

  it('finds a guide by its file and titles it from its heading', () => {
    expect(named('geom').guides).toContainEqual({ slug: 'paths', title: 'Working with paths' });
    expect(named('quantity').guides).toEqual([]);
  });

  it('points every demo it lists at a file that exists', () => {
    const missing = infos.flatMap((i) => i.demos).filter((path) => !existsSync(resolve(ROOT, path)));
    expect(missing).toEqual([]);
  });
});

describe('demosByPackage and packageDoc, over a workspace made for the test', () => {
  const root = mkdtempSync(join(tmpdir(), 'package-docs-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const write = (path: string, text: string) => {
    mkdirSync(resolve(root, path, '..'), { recursive: true });
    writeFileSync(resolve(root, path), text);
  };
  write('apps/site/demos/BoxDemo.tsx', "import { box } from '@weasel-js/geom/booleans';\nimport { helper } from './boxHelper';\nimport type { Scene } from '@weasel-js/core';\n");
  write('apps/site/demos/boxHelper.ts', "import { undo } from '@weasel-js/history';\nexport const helper = undo;\n");
  write('apps/site/demos/PlainDemo.tsx', "import { useState } from 'react';\n");
  write('packages/geom/README.md', '# @weasel-js/geom\n\nA kernel.\n');
  write('packages/geom/docs/guides/2-curves.md', '# Curves\n\nBend.\n');
  write('packages/geom/docs/guides/1-paths.md', '# Paths\n\n```ts\nline();\n```\n');
  write('packages/geom/docs/notes.md', '# Not a guide\n');

  it('files a demo under each package it or a file beside it imports from, type-only imports included', () => {
    expect([...demosByPackage(root)]).toEqual([
      ['geom', ['apps/site/demos/BoxDemo.tsx']],
      ['core', ['apps/site/demos/BoxDemo.tsx']],
      ['history', ['apps/site/demos/BoxDemo.tsx']],
    ]);
  });

  it('renders the README and each guide without its title, a number prefix ordering but not naming it', () => {
    const doc = packageDoc(root, 'geom');
    expect(doc.readme).toEqual([{ kind: 'html', html: '<p>A kernel.</p>' }]);
    expect(Object.keys(doc.guides)).toEqual(['paths', 'curves']);
    expect(doc.guides.paths).toEqual([{ kind: 'code', code: 'line();', language: 'ts' }]);
  });
});
