import { describe, expect, it } from 'vitest';
import { RULES } from './categories.mjs';
import { categoryOf } from './categoryOf.mjs';

const abs = (rel) => `/Users/x/weasel/${rel}`;

describe('categoryOf', () => {
  it('maps a path to its category', () => {
    expect(categoryOf(abs('packages/core/src/core/viewport/useViewTween.ts'), 'useViewTween')).toBe(
      'Viewport',
    );
  });

  it('takes the first matching rule, so a specific path beats a general one', () => {
    // createHistory lives under core/ops/, which the Scene rule would swallow.
    expect(categoryOf(abs('packages/core/src/core/ops/createHistory.ts'), 'createHistory')).toBe(
      'History',
    );
    expect(categoryOf(abs('packages/core/src/core/ops/insert.ts'), 'createInsertOp')).toBe('Scene');
  });

  it('categorizes symbols the barrel re-exports from sibling packages', () => {
    expect(categoryOf(abs('packages/history/src/history.ts'), 'HistoryEntry')).toBe('History');
    expect(categoryOf(abs('packages/font/src/outline/OutlineFace.ts'), 'OutlineFontStyle')).toBe(
      'Text',
    );
    expect(categoryOf(abs('packages/gestures/src/ui/spec.ts'), 'GestureSpec')).toBe(
      'Tools & gestures',
    );
  });

  it('lets a name override beat every path rule', () => {
    expect(categoryOf(abs('packages/core/src/core/viewport/anything.ts'), 'VERSION')).toBe(
      'Extension points',
    );
  });

  it('returns null when no rule matches', () => {
    expect(categoryOf(abs('packages/nowhere/src/atAll.ts'), 'mystery')).toBeNull();
  });

  it('handles a path that is already relative', () => {
    expect(categoryOf('packages/core/src/renderer/WeaselRenderer.ts', 'WeaselRenderer')).toBe(
      'Rendering',
    );
  });
});

describe('the rule table', () => {
  it('has no rule shadowed by an earlier, more general one', () => {
    const shadowed = [];
    for (let i = 0; i < RULES.length; i++) {
      for (let j = 0; j < i; j++) {
        const [earlier, earlierCategory] = RULES[j];
        const [later, category] = RULES[i];
        if (later.startsWith(`${earlier}/`) && earlierCategory !== category) {
          shadowed.push(`${later} is unreachable behind ${earlier}`);
        }
      }
    }
    expect(shadowed).toEqual([]);
  });
});
