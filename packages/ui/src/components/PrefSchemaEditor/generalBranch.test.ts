import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { GENERAL, generalAllows, generalKeys, schemaTarget } from './generalBranch';

const leaf = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
// Root order: a group, a leaf, a group, a leaf. The tree shows General [author, zoom], then canvas, tools.
const ROOT: PrefGroup = {
  name: '',
  children: {
    canvas: { name: 'Canvas', children: { grid: leaf('Grid') } },
    author: leaf('Author'),
    tools: { name: 'Tools', children: {} },
    zoom: leaf('Zoom'),
  },
};
const SECTION: PrefSection = { name: 'Node', members: { 'pose.x': leaf('X') } };

describe('the General branch', () => {
  it('holds a group root\'s own leaves, and a section root has none', () => {
    expect(generalKeys(ROOT)).toEqual(['author', 'zoom']);
    expect(generalKeys(SECTION)).toEqual([]);
  });

  it('takes leaves only, keeps root leaves out of the root\'s own level, and never moves itself', () => {
    expect(generalAllows(ROOT, ['canvas/grid'], GENERAL)).toBe(true);
    expect(generalAllows(ROOT, ['canvas'], GENERAL)).toBe(false);
    expect(generalAllows(ROOT, ['author'], null)).toBe(false);
    expect(generalAllows(ROOT, ['tools'], null)).toBe(true);
    expect(generalAllows(ROOT, [GENERAL], 'canvas')).toBe(false);
    expect(generalAllows(ROOT, ['author'], 'canvas')).toBeUndefined();
  });

  it('lands a drop in General among the root\'s leaves, and one at the tree\'s top level among its groups', () => {
    expect(schemaTarget(ROOT, GENERAL, 0)).toEqual({ parentPath: null, index: 1 });
    expect(schemaTarget(ROOT, GENERAL, 1)).toEqual({ parentPath: null, index: 3 });
    expect(schemaTarget(ROOT, GENERAL, 2)).toEqual({ parentPath: null, index: 4 });
    // Top level reads General, canvas, tools: index 1 is before canvas, 2 before tools, 3 the end.
    expect(schemaTarget(ROOT, null, 1)).toEqual({ parentPath: null, index: 0 });
    expect(schemaTarget(ROOT, null, 2)).toEqual({ parentPath: null, index: 2 });
    expect(schemaTarget(ROOT, null, 3)).toEqual({ parentPath: null, index: 4 });
    expect(schemaTarget(ROOT, 'canvas', 1)).toEqual({ parentPath: 'canvas', index: 1 });
  });
});
