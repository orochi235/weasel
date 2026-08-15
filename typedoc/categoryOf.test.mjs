import { describe, expect, it } from 'vitest';
import { categoryOf } from './categoryOf.mjs';

const abs = (rel) => `/Users/x/weasel/packages/core/src/${rel}`;

describe('categoryOf', () => {
  it('maps a path to its category', () => {
    expect(categoryOf(abs('core/viewport/useViewTween.ts'), 'useViewTween')).toBe('Viewport');
  });

  it('takes the first matching rule, so a specific path beats a general one', () => {
    // createHistory lives under core/ops/, which the Scene rule would swallow.
    expect(categoryOf(abs('core/ops/createHistory.ts'), 'createHistory')).toBe('History');
    expect(categoryOf(abs('core/ops/insert.ts'), 'createInsertOp')).toBe('Scene');
  });

  it('lets a name override beat every path rule', () => {
    expect(categoryOf(abs('core/viewport/anything.ts'), 'VERSION')).toBe('Extension points');
  });

  it('returns null when no rule matches', () => {
    expect(categoryOf(abs('nowhere/atAll.ts'), 'mystery')).toBeNull();
  });

  it('handles a path that is already relative', () => {
    expect(categoryOf('packages/core/src/renderer/WeaselRenderer.ts', 'WeaselRenderer')).toBe(
      'Rendering',
    );
  });
});
