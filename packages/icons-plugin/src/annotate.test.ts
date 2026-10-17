import { describe, expect, it } from 'vitest';
import { libraryAnnotations } from './annotate';

describe('libraryAnnotations', () => {
  it('annotates a ref inlined into a chunk that does not hold the module naming it', () => {
    const library = libraryAnnotations();
    library.record('a.ts', ['lib:star']);
    const out = library.renderChunk(`const s = 'lib:star';\n`, { fileName: 'b.js', moduleIds: ['b.ts'] });
    expect(out?.code).toContain(`/* @icon */ 'lib:star'`);
  });

  it('reports a literal that lost its annotation while another kept one', () => {
    const library = libraryAnnotations();
    library.record('a.ts', ['lib:star', 'lib:moon']);
    const code = `const s = /* @icon */ 'lib:star';\nconst m = 'lib:moon';\n`;
    expect(library.stripped({ 'a.js': { type: 'chunk', code } })).toMatch(/lib:moon/);
  });

  it('reads a minifier-made template literal as a literal', () => {
    const library = libraryAnnotations();
    library.record('a.ts', ['lib:star']);
    expect(library.stripped({ 'a.js': { type: 'chunk', code: 'var e=`lib:star`;' } })).toMatch(/lib:star/);
  });

  it('passes a ref whose literal the bundle dropped altogether', () => {
    const library = libraryAnnotations();
    library.record('a.ts', ['lib:star', 'lib:moon']);
    expect(library.stripped({ 'a.js': { type: 'chunk', code: `const s = /* @icon */ 'lib:star';\n` } })).toBeUndefined();
  });

  it('forgets a module that no longer names a ref', () => {
    const library = libraryAnnotations();
    library.record('a.ts', ['lib:star']);
    library.record('a.ts', []);
    expect(library.stripped({ 'a.js': { type: 'chunk', code: `const s = 'lib:star';\n` } })).toBeUndefined();
  });
});
