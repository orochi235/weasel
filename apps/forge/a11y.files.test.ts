import { describe, expect, it } from 'vitest';
import { STORY_MODULES, storyKey, unresolvedKeys } from './a11y.files';
import { JUDGED, KNOWN, UNSWEPT } from './a11y.known';

describe('a11y sweep tables', () => {
  it('names a story file that is gone', () => {
    const files = ['../../packages/ui/src/A.stories.tsx'];
    expect(unresolvedKeys({ KNOWN: { 'ui/src/A.stories.tsx': {}, 'ui/src/B.stories.tsx': {} } }, files)).toEqual([
      'KNOWN: ui/src/B.stories.tsx',
    ]);
  });

  it('keys every entry by a story file the sweep renders', () => {
    expect(Object.keys(STORY_MODULES).length).toBeGreaterThan(0);
    expect(unresolvedKeys({ KNOWN, JUDGED, UNSWEPT }, Object.keys(STORY_MODULES))).toEqual([]);
  });

  it('keys a file by its path under packages/', () => {
    expect(storyKey('../../packages/labkit/src/x/X.stories.tsx')).toBe('labkit/src/x/X.stories.tsx');
  });
});
