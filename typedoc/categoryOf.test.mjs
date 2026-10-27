import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES } from './categories.mjs';
import { categoryOf } from './categoryOf.mjs';

const abs = (rel) => `/Users/x/weasel/${rel}`;

const holdsAFile = (dir) =>
  readdirSync(dir, { withFileTypes: true }).some((e) => e.isFile() || (e.isDirectory() && holdsAFile(join(dir, e.name))));

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

  it('categorizes the routing package by where each part lived in core', () => {
    expect(categoryOf(abs('packages/routing/src/interactions/actions/action.ts'), 'Action')).toBe(
      'Selection & actions',
    );
    expect(
      categoryOf(abs('packages/routing/src/interactions/dispatcher/dispatcher.ts'), 'createDispatcher'),
    ).toBe('Tools & gestures');
    expect(categoryOf(abs('packages/routing/src/viewport/clientToCanvas.ts'), 'clientToCanvas')).toBe(
      'Viewport',
    );
    expect(categoryOf(abs('packages/routing/src/eligibility/rule.ts'), 'evaluate')).toBe(
      'Extension points',
    );
    expect(categoryOf(abs('packages/routing/src/index.ts'), 'DepSchema')).toBe('Selection & actions');
  });

  it("files routing's ambient contexts where core's domain directories had them", () => {
    expect(categoryOf(abs('packages/routing/src/ambient/PointerContext.tsx'), 'usePointerPosition')).toBe(
      'Extension points',
    );
    expect(
      categoryOf(abs('packages/routing/src/ambient/SelectionContext.tsx'), 'useSelectionContext'),
    ).toBe('Selection & actions');
  });

  it("files routing's shared vocabulary by each type's subject", () => {
    const vocabulary = abs('packages/routing/src/vocabulary.ts');
    expect(categoryOf(vocabulary, 'ModifierState')).toBe('Tools & gestures');
    expect(categoryOf(vocabulary, 'View')).toBe('Viewport');
    expect(categoryOf(vocabulary, 'SelectionMode')).toBe('Selection & actions');
    expect(categoryOf(vocabulary, 'NodeId')).toBe('Scene');
    expect(categoryOf(vocabulary, 'DebugSink')).toBe('Extension points');
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
    expect(categoryOf('packages/renderer/src/WeaselRenderer.ts', 'WeaselRenderer')).toBe(
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

  // These hold tests, test helpers, re-export lists, and module shims, never a declaration the reference documents.
  const noDeclarations = new Set(['__tests__', 'barrel', 'import-shims', 'test-hook', 'testing']);
  const uncoveredIn = (pkg) =>
    readdirSync(join(import.meta.dirname, `../${pkg}`), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !noDeclarations.has(e.name))
      .map((e) => `${pkg}/${e.name}`)
      // A fleet node's synced tree keeps a renamed directory's empty shell.
      .filter((dir) => holdsAFile(join(import.meta.dirname, `../${dir}`)))
      .filter((dir) => categoryOf(`${dir}/any.ts`, 'any') === null);

  it.each(['packages/core/src', 'packages/routing/src'])(
    'covers every directory of %s that declares exports',
    (pkg) => {
      expect(uncoveredIn(pkg)).toEqual([]);
    },
  );
});
