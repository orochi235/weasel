import { describe, expect, it } from 'vitest';
import { collectIconRefs } from './collect';
import { rewriteIconCalls } from './rewrite';

const ns = (spec: string) => (spec.endsWith('icons.gen') ? 'core' : undefined);

describe('rewriteIconCalls', () => {
  it('qualifies and annotates a bare name imported from icons.gen', () => {
    const src = `import { icon } from '../icons.gen';\nexport const a = { icon: icon('undo') };\n`;
    expect(rewriteIconCalls(src, 'a.ts', ns)!.code).toContain(`icon: /* @icon */ 'core:undo'`);
  });

  it('keeps a qualified name as written', () => {
    const src = `import { icon } from './icons.gen';\nconst b = icon("ui:close");\n`;
    expect(rewriteIconCalls(src, 'b.ts', ns)!.code).toContain(`/* @icon */ 'ui:close'`);
  });

  it('follows an alias of the import', () => {
    const src = `import { icon as glyph } from './icons.gen';\nconst c = glyph('redo');\n`;
    expect(rewriteIconCalls(src, 'c.ts', ns)!.code).toContain(`/* @icon */ 'core:redo'`);
  });

  it('leaves a module that imports no icons.gen alone', () => {
    expect(rewriteIconCalls(`const icon = (s) => s; icon('x');`, 'd.ts', ns)).toBeNull();
  });

  it('leaves a dynamic call as a call, and counts it', () => {
    const src = `import { icon } from './icons.gen';\nconst e = icon(name);\n`;
    const out = rewriteIconCalls(src, 'e.ts', ns)!;
    expect(out.code).toContain('icon(name)');
    expect(out.dynamic).toBe(1);
  });

  it('does not touch a method or a longer name that ends in the local', () => {
    const src = `import { icon } from './icons.gen';\nx.icon('a'); myicon('b'); icon('c');\n`;
    const code = rewriteIconCalls(src, 'f.ts', ns)!.code;
    expect(code).toContain(`x.icon('a')`);
    expect(code).toContain(`myicon('b')`);
    expect(code).toContain(`/* @icon */ 'core:c'`);
  });

  it('maps the rewritten call back to its source line', () => {
    const src = `import { icon } from './icons.gen';\nconst g = icon('undo');\n`;
    const { map } = rewriteIconCalls(src, 'g.ts', ns)!;
    expect(map.sources).toEqual(['g.ts']);
    expect(map.mappings).not.toBe('');
  });
});

describe('rewriteIconCalls on imports it cannot follow', () => {
  const warned = (src: string) => {
    const warnings: string[] = [];
    rewriteIconCalls(src, 'w.ts', ns, (m) => warnings.push(m));
    return warnings.join('\n');
  };

  it('warns on a namespace import', () => {
    expect(warned(`import * as g from './icons.gen';\ng.icon('x');\n`)).toMatch(/w\.ts.*namespace import/);
  });

  it('warns on a default import', () => {
    expect(warned(`import g from './icons.gen';\ng('x');\n`)).toMatch(/w\.ts.*default import/);
  });

  it('warns on a re-export of icon, from the module or through a local', () => {
    expect(warned(`export { icon } from './icons.gen';\n`)).toMatch(/w\.ts.*re-export/);
    expect(warned(`export * from './icons.gen';\n`)).toMatch(/w\.ts.*re-export/);
    expect(warned(`import { icon } from './icons.gen';\nexport { icon as glyph };\n`)).toMatch(/w\.ts.*re-export/);
  });

  it('warns on an icon imported from an icons.gen it cannot find', () => {
    const lost = (spec: string) => (spec.endsWith('icons.gen') ? undefined : 'core');
    const warnings: string[] = [];
    const out = rewriteIconCalls(`import { icon } from '@app/icons.gen';\nicon('x');\n`, 'w.ts', lost, (m) => warnings.push(m));
    expect(out).toBeNull();
    expect(warnings.join('\n')).toMatch(/w\.ts.*@app\/icons\.gen/);
  });

  it('says nothing about a type-only re-export', () => {
    expect(warned(`export type { CoreIconName } from './icons.gen';\n`)).toBe('');
  });
});

describe('rewriteIconCalls in comments and strings', () => {
  const src = [
    `import { icon } from './icons.gen';`,
    `/** @example icon('inBlock') */`,
    `// icon('inLine')`,
    `const a = "icon('inDouble')";`,
    `const b = 'icon("inSingle")';`,
    'const c = `icon(\'inTemplate\') ${icon(\'inExpr\')} ${ { k: icon(\'inBraces\') }.k }`;',
    `const r = /'/;`,
    `const d = icon('real');`,
  ].join('\n');

  it('rewrites only real calls, including those in a template expression', () => {
    const code = rewriteIconCalls(src, 'h.ts', ns)!.code;
    for (const kept of [`/** @example icon('inBlock') */`, `// icon('inLine')`, `"icon('inDouble')"`, `'icon("inSingle")'`, "`icon('inTemplate') "]) {
      expect(code).toContain(kept);
    }
    expect(collectIconRefs(code, 'h.ts').sort()).toEqual(['core:inBraces', 'core:inExpr', 'core:real']);
  });
});

describe('rewriteIconCalls on syntax a hand lexer misreads', () => {
  const refs = (src: string, id: string) => collectIconRefs(rewriteIconCalls(src, id, ns)!.code, id).sort();
  const head = `import { icon } from './icons.gen';\n`;

  it('rewrites calls on either side of a JSX closing tag', () => {
    const src = `${head}export const L = () => <ul><li>{icon('a')}</li><li>{icon('b')}</li></ul>;\n`;
    expect(refs(src, 'l.tsx')).toEqual(['core:a', 'core:b']);
  });

  it('rewrites a call after an apostrophe in JSX text', () => {
    const src = `${head}export const P = () => <p>Don't {icon('x')}</p>;\n`;
    expect(refs(src, 'p.tsx')).toEqual(['core:x']);
  });

  it('rewrites a call after a division that follows an increment', () => {
    const src = `${head}let i = 0;\nconst h = i++ / 2, k = icon('afterDivide'), z = h / 3;\n`;
    expect(refs(src, 'q.ts')).toEqual(['core:afterDivide']);
  });

  it('rewrites a call passed to a function with a type argument', () => {
    const src = `${head}declare function f<T>(x: unknown): void;\ntype T = 1;\nf<T>(icon('generic'));\n`;
    expect(refs(src, 'r.ts')).toEqual(['core:generic']);
  });

  it('places the rewrite correctly after non-ASCII text', () => {
    const src = `${head}const s = 'é — ✓';\nconst u = icon('u');\n`;
    expect(rewriteIconCalls(src, 's.ts', ns)!.code).toContain(`const u = /* @icon */ 'core:u';`);
  });

  it('leaves a module that does not parse alone, and says so', () => {
    const warnings: string[] = [];
    expect(rewriteIconCalls(`${head}const = icon('x');\n`, 'bad.ts', ns, (m) => warnings.push(m))).toBeNull();
    expect(warnings.join()).toMatch(/bad\.ts/);
  });
});

describe('rewriteIconCalls on a local that shadows the import', () => {
  const refs = (src: string, id = 'sh.ts') => collectIconRefs(rewriteIconCalls(src, id, ns)!.code, id).sort();
  const head = `import { icon } from './icons.gen';\n`;
  const kept = (src: string, call: string) => expect(rewriteIconCalls(src, 'sh.ts', ns)!.code).toContain(call);

  it('leaves a call through a parameter, and rewrites the import outside it', () => {
    const src = `${head}function f(icon) { return icon('param'); }\nconst g = (icon) => icon('arrow');\nicon('outside');\n`;
    expect(refs(src)).toEqual(['core:outside']);
    kept(src, `icon('param')`);
    kept(src, `icon('arrow')`);
  });

  it('leaves a call through a local const or function, hoisted or not', () => {
    const src = [
      head,
      `function f() { const icon = (s) => s; return icon('const'); }`,
      `function g() { return icon('hoisted'); function icon(s) { return s; } }`,
      `function h() { if (x) { var icon = id; } return icon('var'); }`,
      `icon('outside');`,
    ].join('\n');
    expect(refs(src)).toEqual(['core:outside']);
  });

  it('leaves a call in a nested function that closes over the shadowing name', () => {
    const src = `${head}function f(icon) { return () => function () { return icon('nested'); }; }\nicon('outside');\n`;
    expect(refs(src)).toEqual(['core:outside']);
  });

  it('leaves a call only inside the block that shadows the name', () => {
    const src = [
      head,
      `{ const icon = id; icon('block'); }`,
      `if (x) { let icon = id; icon('if'); } else { icon('else'); }`,
      `for (const icon of list) icon('forOf');`,
      `try { } catch (icon) { icon('catch'); }`,
      `switch (x) { case 1: let icon = id; icon('case'); }`,
      `icon('outside');`,
    ].join('\n');
    expect(refs(src)).toEqual(['core:else', 'core:outside']);
  });

  it('leaves a call through a destructured binding', () => {
    const src = [
      head,
      `const a = ({ icon }) => icon('object');`,
      `const b = ([icon]) => icon('array');`,
      `const c = ({ k: [, { icon = id }] }) => icon('deep');`,
      `const d = (...icon) => icon('rest');`,
      `function e() { const { k: icon } = o; return icon('renamed'); }`,
      `icon('outside');`,
    ].join('\n');
    expect(refs(src)).toEqual(['core:outside']);
  });

  it('rewrites a default parameter, which the body cannot shadow', () => {
    const src = `${head}function f(a = icon('default')) { var icon; return a; }\n`;
    expect(refs(src)).toEqual(['core:default']);
  });

  it('tracks an aliased import by its local name', () => {
    const src = [
      `import { icon as i } from './icons.gen';`,
      `const f = (i) => i('shadowed');`,
      `const g = (icon) => i('other');`,
      `i('outside');`,
    ].join('\n');
    expect(refs(src)).toEqual(['core:other', 'core:outside']);
  });
});
