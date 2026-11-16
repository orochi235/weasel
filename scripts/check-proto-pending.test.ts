import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { classify, inScope, sitesIn } from './check-proto-pending.mjs';

/** A program over one in-memory file, with the default library read from disk. */
function sitesOf(source: string) {
  const name = '/virtual/file.ts';
  const options = { strict: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts'], noEmit: true, types: [] };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.getSourceFile = (f, lang, ...rest) => (f === name ? ts.createSourceFile(f, source, lang) : getSourceFile(f, lang, ...rest));
  host.fileExists = (f) => f === name || fileExists(f);
  host.readFile = (f) => (f === name ? source : readFile(f));
  const program = ts.createProgram({ rootNames: [name], options, host });
  return sitesIn(program.getTypeChecker(), program.getSourceFile(name)!);
}

describe('sitesIn', () => {
  it('reports what the rule reports, with its line', () => {
    expect(sitesOf('declare const t: Record<string, number>;\ndeclare const k: string;\nt[k];\nt[k] = 1;\n')).toEqual([
      { line: 3, access: 'read', text: 't[k]' },
      { line: 4, access: 'write', text: 't[k]' },
    ]);
  });

  it('reports nothing for a guarded read or a closed key', () => {
    expect(sitesOf("declare const t: Record<string, number>; declare const k: string; declare const c: 'a';\n"
      + 'Object.hasOwn(t, k) ? t[k] : 0; t[c];\n')).toEqual([]);
  });
});

describe('classify', () => {
  const counts: Record<string, number> = { 'a.ts': 2, 'b.ts': 0 };
  const exists = (rel: string) => Object.hasOwn(counts, rel);
  const count = (rel: string) => counts[rel]!;

  it('keeps an entry whose file still holds a site', () => {
    expect(classify(['a.ts'], exists, count)).toEqual({ keep: ['a.ts'], clean: [], gone: [] });
  });

  it('names an entry whose file is now clean, and one whose file is gone', () => {
    expect(classify(['a.ts', 'b.ts', 'c.ts'], exists, count)).toEqual({ keep: ['a.ts'], clean: ['b.ts'], gone: ['c.ts'] });
  });
});

describe('inScope', () => {
  it('takes shipped source and leaves tests, benches, stories and fixtures', () => {
    expect(inScope('packages/geom/src/paths/pathFromD.ts')).toBe(true);
    expect(inScope('apps/draw/src/App.tsx')).toBe(true);
    for (const rel of ['packages/geom/src/a.test.ts', 'packages/geom/src/a.bench.ts', 'packages/ui/src/A.stories.tsx',
      'packages/core/src/testing/x.ts', 'apps/site/demos/a.ts', 'packages/geom/src/a.d.ts']) expect(inScope(rel)).toBe(false);
  });
});
