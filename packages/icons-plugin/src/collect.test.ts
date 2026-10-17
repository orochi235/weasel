import { describe, expect, it } from 'vitest';
import { collectIconRefs } from './collect';

describe('collectIconRefs', () => {
  it('finds annotated literals in either quote style, and nothing else', () => {
    const code = `a(/* @icon */ 'core:undo'); b(/* @icon */"ui:close"); c('core:redo');`;
    expect(collectIconRefs(code).sort()).toEqual(['core:undo', 'ui:close']);
  });

  it('skips an annotation inside a line comment or a string', () => {
    const code = `// /* @icon */ 'gone:x'\nconst s = "/* @icon */ 'gone:y'";\nf(/* @icon */ 'core:undo');`;
    expect(collectIconRefs(code)).toEqual(['core:undo']);
  });
});
