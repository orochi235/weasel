/**
 * fast-check arbitraries shared by icons-plugin's property tests: modules assembled from import forms and
 * statements whose rewritten refs are known up front. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** The namespace a specifier's icons.gen declares: `@app/` ones resolve nowhere. */
export const namespaceOf = (spec: string): string | undefined =>
  spec.includes('@app/') ? undefined : spec.startsWith('../') ? 'other' : 'core';

/** A name as `icon()` takes it: plain, qualified, unicode, or holding what a quoted literal cannot carry bare. */
export const iconName: fc.Arbitrary<string> = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('undo', 'redo', '__proto__', 'constructor', 'é', '😀x', 'ui:close', 'a:b:c', 'x-y_z.0') },
  { weight: 3, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }) },
  { weight: 3, arbitrary: fc.constantFrom("a'b", 'a"b', 'a`b', 'a b', 'a\\b', 'a\nb', 'a\u2028b', '', '*/', '${x}', '\ud800') },
);

/** `s` as a single-quoted JS literal. */
export const quoted = (s: string): string =>
  `'${[...s].map((c) => {
    const code = c.codePointAt(0)!;
    if (c === "'" || c === '\\') return `\\${c}`;
    if (code < 0x20 || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff)) return `\\u${code.toString(16).padStart(4, '0')}`;
    return c;
  }).join('')}'`;

/** `s` as a template literal with no substitution. */
export const templated = (s: string): string =>
  `\`${[...s].map((c) => {
    const code = c.codePointAt(0)!;
    if (c === '`' || c === '\\' || c === '$') return `\\${c}`;
    if (code >= 0xd800 && code <= 0xdfff) return `\\u${code.toString(16)}`;
    return c;
  }).join('')}\``;

/** What `rewriteIconCalls` reads a call's argument as, mirrored: the names it rewrites. */
export const REWRITABLE = /^[^'"`\s\\]+$/;

/** One import line, and the local names it binds to a followed `icon` with their namespace. */
export interface ImportForm {
  code: string;
  locals: [string, string][];
}

export const importForm: fc.Arbitrary<ImportForm> = fc.constantFrom<ImportForm>(
  { code: `import { icon } from './icons.gen';`, locals: [['icon', 'core']] },
  { code: `import { icon as glyph } from './icons.gen.ts';`, locals: [['glyph', 'core']] },
  { code: `import { other, icon as i } from '../pkg/src/icons.gen.js';`, locals: [['i', 'other']] },
  { code: `import { "icon" as quotedIcon } from './icons.gen';`, locals: [['quotedIcon', 'core']] },
  { code: `import { icon as lost } from '@app/icons.gen';`, locals: [] },
  { code: `import type { icon as typed } from './icons.gen';`, locals: [] },
  { code: `import * as gen from './icons.gen';`, locals: [] },
  { code: `import def from './icons.gen';`, locals: [] },
  { code: `import { ICON_GROUPS } from './icons.gen';`, locals: [] },
);

/** A statement, and the refs a rewrite of it then collects: every live call to `local`, qualified. */
export interface Piece {
  code: string;
  refs: string[];
  dynamic: number;
}

const call = (local: string, arg: string) => `${local}(${arg})`;

/** A statement around one call of `local` (or a name like it), with what the rewrite should make of it. */
export function piece(local: string, ns: string | undefined): fc.Arbitrary<Piece> {
  const live = (name: string, arg: string, wrap: (c: string) => string): Piece => {
    if (ns === undefined) return { code: wrap(call(local, arg)), refs: [], dynamic: 0 };
    if (!REWRITABLE.test(name)) return { code: wrap(call(local, arg)), refs: [], dynamic: 1 };
    return { code: wrap(call(local, arg)), refs: [name.includes(':') ? name : `${ns}:${name}`], dynamic: 0 };
  };
  const dead = (code: string): Piece => ({ code, refs: [], dynamic: 0 });
  return fc.oneof(
    iconName.map((n) => live(n, quoted(n), (c) => `const a = ${c};`)),
    iconName.map((n) => live(n, templated(n), (c) => `f(${c}, 1);`)),
    iconName.map((n) => live(n, quoted(n), (c) => `const t = \`pre \${ ${c} } post\`;`)),
    iconName.map((n) => live(n, quoted(n), (c) => `const o = { k: [${c}] }, p = () => ${c.replace(/^/, '')};`)).map((p) => ({
      ...p, refs: [...p.refs, ...p.refs], dynamic: p.dynamic * 2,
    })),
    iconName.map((n) => live(n, quoted(n), (c) => `if (x) { let y = 1; g(${c}); } else { h(); }`)),
    iconName.map((n) => live(n, quoted(n), (c) => `class K { m() { return ${c}; } static s = 1; }`)),
    fc.constant<Piece>(ns === undefined ? dead(`${local}(name);`) : { code: `${local}(name);`, refs: [], dynamic: 1 }),
    fc.constant<Piece>(ns === undefined ? dead(`${local}('a', 'b');`) : { code: `${local}('a', 'b');`, refs: [], dynamic: 1 }),
    iconName.map((n) => dead(`function f(${local}) { return ${call(local, quoted(n))}; }`)),
    iconName.map((n) => dead(`const g = ({ k: ${local} }) => ${call(local, quoted(n))};`)),
    iconName.map((n) => dead(`{ const ${local} = id; ${call(local, quoted(n))}; }`)),
    iconName.map((n) => dead(`try { } catch (${local}) { ${call(local, quoted(n))}; }`)),
    iconName.map((n) => dead(`for (const ${local} of list) ${call(local, quoted(n))};`)),
    iconName.map((n) => dead(`x.${local}(${quoted(n)}); my${local}(${quoted(n)});`)),
    iconName.map((n) => dead(`const s = ${JSON.stringify(call(local, quoted(n)))};`)),
    iconName.map((n) => dead(`// ${call(local, quoted(n)).replace(/[\n\r\u2028\u2029]/g, ' ')}\nconst q = 1;`)),
    iconName.map((n) => dead(`/* ${call(local, quoted(n)).replaceAll('*/', '* /')} */ const r = /'/;`)),
    fc.constantFrom('const u = "é — ✓ 😀";', 'let i = 0; const h = i++ / 2;', ';', 'const z = `a${1}b`;'),
  ).map((p) => (typeof p === 'string' ? dead(p) : p));
}

/** A ref already annotated in the source: collected as written, through any rewrite. */
export const annotated: fc.Arbitrary<Piece> = fc.tuple(
  fc.constantFrom('core', 'lib', 'ui'),
  iconName.filter((n) => /^[^'"\s\\:]+$/.test(n)),
  fc.boolean(),
).map(([ns, n, dq]) => ({ code: `use(/* @icon */ ${dq ? JSON.stringify(`${ns}:${n}`) : quoted(`${ns}:${n}`)});`, refs: [`${ns}:${n}`], dynamic: 0 }));

/** A whole module: imports, then statements calling each local they bound, in any order, each in a block of its own. */
export const module: fc.Arbitrary<{ code: string; refs: string[]; dynamic: number; followed: boolean }> = fc
  .uniqueArray(importForm, { minLength: 1, maxLength: 3, selector: (f) => f.code })
  .chain((imports) => {
    const locals = new Map(imports.flatMap((f) => f.locals));
    const names = [...new Set([...locals.keys(), 'icon', 'glyph', 'lost', 'typed'])];
    const statement = fc.oneof(
      fc.constantFrom(...names).chain((l) => piece(l, locals.get(l))),
      annotated,
    );
    return fc.array(statement, { minLength: 1, maxLength: 8 }).map((body) => ({
      code: [...imports.map((f) => f.code), ...body.map((p) => `{\n${p.code}\n}`)].join('\n'),
      refs: body.flatMap((p) => p.refs).sort(),
      dynamic: body.reduce((n, p) => n + p.dynamic, 0),
      followed: locals.size > 0,
    }));
  });
