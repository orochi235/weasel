import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { inScope, sitesIn, verdict, type Site } from './check-proto-index.mjs';

/** The sites in one in-memory file, from a program with the ES2022 library. */
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

/** Keys and records the rule has to tell apart, and accesses it has to see past: none is a site. */
const CLEAN = [
  "declare const t: Record<string, number>; t['x'];",
  "declare const t: Record<string, number>; declare const k: 'a' | 'b'; t[k];",
  'declare const t: Record<string, number>; declare const k: `data-${number}`; t[k];',
  'declare const xs: number[]; declare const i: number; xs[i];',
  'declare const t: { [i: number]: string }; declare const k: string; t[k as unknown as number];',
  'declare const m: Map<string, number>; declare const k: string; m.get(k);',
  "declare const t: { a: 1; b: 2 }; declare const k: 'a'; t[k];",
  'declare const t: Record<string, number>; declare const k: string; delete t[k];',
  'declare const t: Record<string, number>; declare const k: string; Object.hasOwn(t, k) ? t[k] : 0;',
  'declare const t: Record<string, number>; declare const k: string; if (Object.hasOwn(t, k) && t[k] > 0) {}',
  'declare const t: Record<string, number>; declare const k: string; if (!Object.hasOwn(t, k)) throw 0; t[k];',
  'declare const t: Record<string, number>; declare function hasOwnKey(o: object, k: string): boolean; declare const k: string; if (hasOwnKey(t, k)) t[k];',
  'declare const t: Record<string, number>; for (const k in t) t[k];',
  'declare const t: Record<string, number>; for (const k of Object.keys(t)) t[k] = 1;',
  'declare const t: Record<string, number>; for (const [k] of Object.entries(t)) t[k];',
  'declare const t: Record<string, number>; Object.keys(t).sort().forEach((k) => t[k]);',
  'declare const t: Record<string, number>; const ks = Object.keys(t); ks.every((k) => t[k]);',
  'declare const v: object; for (const k of Object.keys(v)) (v as Record<string, unknown>)[k];',
  'declare const v: object; declare const k: string; function f() { if (k === "" || !Object.hasOwn(v, k)) return; (v as Record<string, unknown>)[k]; }',
  'declare const t: Record<string, number>; declare const k: string; if (k === "__proto__") {} else t[k] = 1;',
  'declare const t: Record<string, number>; declare const k: string; if (k !== "__proto__") t[k] = 1;',
];

/** One site each, and what it does. */
const FLAGGED: [string, Site['access']][] = [
  ['declare const t: Record<string, number>; declare const k: string; t[k];', 'read'],
  ['declare const t: { [k: string]: number }; declare const k: string; t[k];', 'read'],
  ['declare const t: Record<string, number> | undefined; declare const k: string; t?.[k];', 'read'],
  ['declare const t: Record<string, number>; declare const k: string | undefined; t[k!];', 'read'],
  ['declare const t: Record<string, number>; function f<K extends string>(k: K) { return t[k]; }', 'read'],
  ['declare const t: Record<string, number>; declare const k: string; t[k] = 1;', 'write'],
  ['declare const t: Record<string, number>; declare const k: string; t[k] += 1;', 'read'],
  ['declare const t: Record<string, number>; declare const k: string; if (Object.hasOwn(t, k)) {} t[k];', 'read'],
  ['declare const t: Record<string, number>; declare const u: Record<string, number>; for (const k in u) t[k];', 'read'],
  ['declare const t: Record<string, number>; declare const k: string; if (Object.hasOwn(t, "x")) t[k];', 'read'],
  ['declare const t: Record<string, number>; declare const k: string; if (k !== "__proto__") t[k];', 'read'],
];

describe('protoIndexAccess', () => {
  it.each(CLEAN)('finds no site in %s', (code) => {
    expect(sitesOf(code)).toEqual([]);
  });

  it.each(FLAGGED)('finds one site in %s', (code, access) => {
    expect(sitesOf(code).map((s) => s.access)).toEqual([access]);
  });
});

describe('sitesIn', () => {
  it('reports each site with its line and text', () => {
    expect(sitesOf('declare const t: Record<string, number>;\ndeclare const k: string;\nt[k];\nt[k] = 1;\n')).toEqual([
      { line: 3, access: 'read', text: 't[k]' },
      { line: 4, access: 'write', text: 't[k]' },
    ]);
  });
});

describe('verdict', () => {
  const site: Site = { line: 1, access: 'read', text: 't[k]' };
  const sites = new Map<string, Site[]>([['a.ts', [site, site]], ['b.ts', []], ['new.ts', [site]]]);
  const exists = (rel: string) => sites.has(rel);

  it('fails a site in a file the pending list does not name', () => {
    expect(verdict(['a.ts'], exists, sites).unlisted).toEqual([['new.ts', [site]]]);
  });

  it('keeps an entry whose file still holds a site', () => {
    expect(verdict(['a.ts', 'new.ts'], exists, sites)).toEqual({ unlisted: [], keep: ['a.ts', 'new.ts'], clean: [], gone: [] });
  });

  it('names an entry whose file is now clean, and one whose file is gone', () => {
    const { keep, clean, gone } = verdict(['a.ts', 'b.ts', 'c.ts', 'new.ts'], exists, sites);
    expect({ keep, clean, gone }).toEqual({ keep: ['a.ts', 'new.ts'], clean: ['b.ts'], gone: ['c.ts'] });
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
