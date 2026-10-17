import { describe, expect, it } from 'vitest';
import { collectIconRefs } from './collect';

describe('collectIconRefs', () => {
  it('finds annotated literals in either quote style, and nothing else', () => {
    const code = `a(/* @icon */ 'core:undo'); b(/* @icon */"ui:close"); c('core:redo');`;
    expect(collectIconRefs(code).sort()).toEqual(['core:undo', 'ui:close']);
  });
});
