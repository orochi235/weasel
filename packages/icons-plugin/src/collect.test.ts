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

  it('reads a module that does not parse as the parsed path would', () => {
    const literals = 'a(/* @icon */ `core:tick`); b(/* @icon */ \'core:\\ud800\'); c(/* @icon */ "core:caf\\xe9");';
    const parsed = collectIconRefs(literals);
    expect(parsed.sort()).toEqual(['core:caf\u00e9', 'core:tick', 'core:\ud800'].sort());
    expect(collectIconRefs(`${literals} const = ;`).sort()).toEqual(parsed.sort());
  });
});
