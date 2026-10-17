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
    expect(collectIconRefs(code).sort()).toEqual(['core:inBraces', 'core:inExpr', 'core:real']);
  });
});
