// Counterexamples the property tests in rewrite.pbt.test.ts shrank to.
import { describe, expect, it } from 'vitest';
import { libraryAnnotations } from './annotate';
import { collectIconRefs } from './collect';
import { rewriteIconCalls } from './rewrite';

describe('shrunk counterexamples', () => {
  it('writes a lone surrogate in a name escaped, so the ref reads back as itself', () => {
    const src = `import { icon } from './icons.gen';\nicon('\\ud800');\n`;
    const out = rewriteIconCalls(src, 'm.ts', () => 'core')!;
    expect(out.code).toContain(`/* @icon */ 'core:\\ud800'`);
    expect(collectIconRefs(out.code, 'm.ts')).toEqual(['core:\ud800']);
  });

  it('annotates and checks a ref a chunk spells with escapes', () => {
    const library = libraryAnnotations();
    library.record('a.ts', ['core:é']);
    const code = `const s = "core:\\u00e9";\n`;
    expect(library.stripped({ 'a.js': { type: 'chunk', code } })).toMatch(/core:é/);
    const out = library.renderChunk(code, { fileName: 'a.js' });
    expect(out?.code).toContain(`/* @icon */ "core:\\u00e9"`);
    expect(library.stripped({ 'a.js': { type: 'chunk', code: out!.code } })).toBeUndefined();
  });
});
