/**
 * `buildClassifyTarget` reports both halves of a body hit: how it relates to
 * the selection (`bodyTarget`) and what it actually is (`bodyKind`). The second half is
 * what makes the `kind:<k>` / `kind:<k>:selected` TargetSpec forms resolvable.
 */

import { describe, it, expect } from 'vitest';
import { buildClassifyTarget } from './affordanceAt';

// One node at world (0,0,50,50), selected; a second at (60,0,50,50), not.
const SELECTION = ['text-1'];
const pickBest = ({ x: wx, y: wy }: { x: number; y: number }): string | null => {
  if (wy < 0 || wy > 50) return null;
  if (wx >= 0 && wx <= 50) return 'text-1';
  if (wx >= 60 && wx <= 110) return 'rect-1';
  return null;
};
const KINDS: Record<string, string> = { 'text-1': 'text', 'rect-1': 'rect' };

describe('buildClassifyTarget — body classification', () => {
  const classify = buildClassifyTarget(() => SELECTION, pickBest, (id) => KINDS[id]);

  it('reports the selection relationship on `bodyTarget`', () => {
    expect(classify({ x: 25, y: 25 }).bodyTarget).toBe('selected-body');
    expect(classify({ x: 85, y: 25 }).bodyTarget).toBe('unselected-body');
    expect(classify({ x: 200, y: 25 }).bodyTarget).toBe('empty');
  });

  it('reports the node kind on `bodyKind`', () => {
    expect(classify({ x: 25, y: 25 }).bodyKind).toBe('text');
    expect(classify({ x: 85, y: 25 }).bodyKind).toBe('rect');
  });

  it('leaves `bodyKind` undefined on empty canvas', () => {
    expect(classify({ x: 200, y: 25 }).bodyKind).toBeUndefined();
  });
});

describe('buildClassifyTarget — absent kind resolver', () => {
  const classify = buildClassifyTarget(() => SELECTION, pickBest);

  it('still classifies the body', () => {
    expect(classify({ x: 25, y: 25 }).bodyTarget).toBe('selected-body');
  });

  it('leaves `bodyKind` undefined rather than inventing one', () => {
    expect(classify({ x: 25, y: 25 }).bodyKind).toBeUndefined();
  });
});

describe('buildClassifyTarget — resolver returns nothing for a hit node', () => {
  const classify = buildClassifyTarget(() => SELECTION, pickBest, () => undefined);

  it('reports the body without a kind', () => {
    const c = classify({ x: 25, y: 25 });
    expect(c.bodyTarget).toBe('selected-body');
    expect(c.bodyKind).toBeUndefined();
  });
});
