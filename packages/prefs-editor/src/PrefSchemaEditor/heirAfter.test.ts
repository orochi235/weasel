import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { heirAfter } from './heirAfter';

const leaf = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const ROOT: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: { grid: leaf('Grid'), snap: leaf('Snap'), hints: leaf('Hints') } },
    text: { name: 'Text', children: { sharp: leaf('Sharp') } },
  },
};
const OPEN = new Set(['view', 'text']);
const DEEP: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { name: 'Grid', children: { major: leaf('Major') } } } } },
};

describe('heirAfter: the row the selection passes to when rows are removed', () => {
  it('is the next sibling', () => {
    expect(heirAfter(ROOT, OPEN, ['view/snap'])).toBe('view/hints');
  });

  it('is the row above for the last child, and the parent for an only child', () => {
    expect(heirAfter(ROOT, OPEN, ['view/hints'])).toBe('view/snap');
    expect(heirAfter(ROOT, OPEN, ['text/sharp'])).toBe('text');
  });

  it('skips what goes with the removed rows, and passes over a folded branch to its own row', () => {
    expect(heirAfter(ROOT, OPEN, ['view/grid', 'view/snap'])).toBe('view/hints');
    expect(heirAfter(ROOT, new Set(['text']), ['text'])).toBe('view');
  });

  it('is the folded row holding what is removed, when the removed rows are not drawn', () => {
    expect(heirAfter(ROOT, new Set(['text']), ['view/snap'])).toBe('view');
    expect(heirAfter(ROOT, new Set(), ['view/grid', 'text/sharp'])).toBe('view');
    expect(heirAfter(DEEP, new Set(['view']), ['view/grid/major'])).toBe('view/grid');
  });

  it('is null when nothing is left', () => {
    expect(heirAfter(ROOT, OPEN, ['view', 'text'])).toBeNull();
  });
});
