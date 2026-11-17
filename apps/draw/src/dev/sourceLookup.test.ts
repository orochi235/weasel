import { describe, expect, it } from 'vitest';
import { findSourceMatch } from './sourceLookup';

describe('findSourceMatch', () => {
  it('finds a kit symbol in its package, by a repo-relative path', () => {
    const match = findSourceMatch('useRectTool');
    expect(match?.path).toBe('/packages/editing/src/tools/rect/useRectTool.ts');
    expect(match?.line).toBeGreaterThan(0);
  });

  it('returns null for a name nothing exports, an inherited key included', () => {
    expect(findSourceMatch('noSuchExportAnywhere')).toBeNull();
    expect(findSourceMatch('constructor')).toBeNull();
  });
});
