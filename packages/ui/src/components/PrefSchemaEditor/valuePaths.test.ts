import { describe, expect, it } from 'vitest';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { nodeAt, renameKey } from './schemaEdit';
import { valuePathOf, valuePathsAt } from './valuePaths';

const num = (name: string, more: object = {}): PrefLeaf => ({ kind: 'number', name, description: '', default: 0, ...more });

const NODE: PrefSection = {
  name: 'Rect',
  members: {
    layout: { name: 'Layout', members: {
      'pose.x': num('X'),
      stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: {
        width: num('Width'),
        ends: { name: 'Ends', members: { cap: num('Cap') } },
      } } as PrefLeaf,
    } },
    width: num('Width', { showIf: { path: 'stroke.width', above: 0 }, enableIf: { path: 'pose.x', above: 0 } }),
  },
};

describe('value paths under a section root', () => {
  it('are a leaf\'s own key, and for a field of an object leaf, the leaf\'s key then the field\'s', () => {
    expect(valuePathOf(NODE, 'layout/pose.x')).toBe('pose.x');
    expect(valuePathOf(NODE, 'layout/stroke/width')).toBe('stroke.width');
    expect(valuePathOf(NODE, 'layout/stroke/ends/cap')).toBe('stroke.cap');
  });

  it('follow a renamed field of an object leaf, and leave a leaf keyed like the field alone', () => {
    const next = renameKey(NODE, 'layout/stroke/width', 'weight');
    expect(nodeAt(next, 'width')).toMatchObject({ showIf: { path: 'stroke.weight', above: 0 }, enableIf: { path: 'pose.x', above: 0 } });
  });
});

describe('valuePathsAt', () => {
  it('gives a leaf\'s path, each member\'s for a section, and each child\'s for the root', () => {
    expect(valuePathsAt(NODE, 'layout/stroke', nodeAt(NODE, 'layout/stroke')!)).toEqual(['stroke']);
    expect(valuePathsAt(NODE, 'layout', nodeAt(NODE, 'layout')!)).toEqual(['pose.x', 'stroke']);
    expect(valuePathsAt(NODE, null, NODE)).toEqual(['pose.x', 'stroke', 'width']);
  });
});
