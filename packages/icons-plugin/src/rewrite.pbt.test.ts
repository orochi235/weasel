/**
 * Property tests of the plugin's source passes on generated modules: aliased, quoted, namespace, default,
 * type-only, and unresolvable imports of `icon`, calls live, shadowed, dynamic, in strings, comments, and
 * template expressions. A rewrite parses, collects exactly the refs its live calls name plus those already
 * annotated, counts its dynamic calls, and is a fixed point; a library chunk stripped of its annotations gets
 * every one back. Any text at all goes through every pass without a crash.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { annotateRefs, libraryAnnotations } from './annotate';
import { collectIconRefs } from './collect';
import { parseModule } from './parse';
import { rewriteIconCalls } from './rewrite';
import { module, namespaceOf, runs, timeoutFor } from './pbt.fixture';

describe('rewriteIconCalls on generated modules', () => {
  it('collects every live call qualified, and the annotated refs, from a rewrite that parses', () => {
    let followed = 0;
    let refs = 0;
    let dynamic = 0;
    fc.assert(fc.property(module, (m) => {
      expect('error' in parseModule(m.code, 'm.ts'), m.code).toBe(false);
      const warnings: string[] = [];
      const out = rewriteIconCalls(m.code, 'm.ts', namespaceOf, (w) => warnings.push(w));
      if (!m.followed) {
        expect(out).toBeNull();
        expect(collectIconRefs(m.code, 'm.ts').sort()).toEqual(m.refs);
        return;
      }
      followed++;
      refs += m.refs.length;
      dynamic += m.dynamic;
      expect(out).not.toBeNull();
      expect('error' in parseModule(out!.code, 'm.ts')).toBe(false);
      expect(collectIconRefs(out!.code, 'm.ts').sort()).toEqual(m.refs);
      expect(out!.dynamic).toBe(m.dynamic);
      const again = rewriteIconCalls(out!.code, 'm.ts', namespaceOf);
      expect(again?.code).toBe(out!.code);
      expect(again?.dynamic).toBe(m.dynamic);
    }), runs(300));
    expect(followed).toBeGreaterThan(60);
    expect(refs).toBeGreaterThan(150);
    expect(dynamic).toBeGreaterThan(10);
  }, timeoutFor(300, 20));

  it('gives a library chunk stripped of its annotations every one back, once', () => {
    let restored = 0;
    fc.assert(fc.property(module, (m) => {
      const out = rewriteIconCalls(m.code, 'm.ts', namespaceOf);
      const code = out?.code ?? m.code;
      const named = collectIconRefs(code, 'm.ts');
      if (named.length === 0) return;
      restored++;
      const library = libraryAnnotations();
      library.record('m.ts', named);
      const bare = code.replaceAll('/* @icon */ ', '');
      expect(library.stripped({ 'm.ts': { type: 'chunk', code: bare } })).toMatch(/stripped the @icon annotation/);
      const chunk = library.renderChunk(bare, { fileName: 'm.ts' });
      expect(chunk).not.toBeNull();
      expect(library.stripped({ 'm.ts': { type: 'chunk', code: chunk!.code } })).toBeUndefined();
      expect(annotateRefs(chunk!.code, 'm.ts', new Set(named))).toBeNull();
      const got = collectIconRefs(chunk!.code, 'm.ts');
      for (const ref of new Set(named)) expect(got.filter((r) => r === ref).length).toBeGreaterThanOrEqual(named.filter((r) => r === ref).length);
      expect(got.every((r) => named.includes(r))).toBe(true);
    }), runs(200));
    expect(restored).toBeGreaterThan(80);
  }, timeoutFor(200, 20));
});

describe('the passes on any text', () => {
  const token = fc.oneof(
    fc.string({ maxLength: 6 }),
    fc.constantFrom(
      `icon('x');`, `i(\`y\`);`, `icon(n);`, '/* @icon */', `'core:undo';`, '"ui:close";', '`', '${', '}', '(', ')', '{', '/*', '*/', '//',
      '\n', '<p>', '</p>', '\ud800', 'function f(icon) {', 'const icon = 1;',
    ),
  );
  const soup = fc.tuple(
    fc.constantFrom(`import { icon } from './icons.gen';`, `import { icon as i } from './icons.gen';`, ''),
    fc.array(fc.oneof({ weight: 1, arbitrary: token }, { weight: 2, arbitrary: fc.constantFrom(`icon('x');`, `i('y');`, ';') }), { maxLength: 10 }),
  ).map(([head, parts]) => [head, ...parts].join('\n'));

  it('never throws but to say a chunk does not parse, and a fallback scan finds every annotated ref', () => {
    let parsed = 0;
    fc.assert(fc.property(soup, fc.constantFrom('m.ts', 'm.tsx', 'm.js', 'm.mjs'), (code, id) => {
      const out = rewriteIconCalls(code, id, namespaceOf, () => {});
      const refs = collectIconRefs(code, id);
      for (const r of refs) expect(typeof r).toBe('string');
      if (out) {
        parsed++;
        expect('error' in parseModule(out.code, id)).toBe(false);
      }
      try {
        annotateRefs(code, id, new Set(['core:undo', 'ui:close', 'core:x']));
      } catch (e) {
        expect(e).not.toBeInstanceOf(TypeError);
        expect(String(e)).toMatch(/did not parse/);
      }
    }), runs(500));
    expect(parsed).toBeGreaterThan(20);
  }, timeoutFor(500, 5));
});
