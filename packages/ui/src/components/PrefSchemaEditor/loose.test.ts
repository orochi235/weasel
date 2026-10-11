import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { looseKeys, looseTarget, placedOnly, schemaTarget, topLevelAllows } from './loose';

const leaf = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
// Root order: a page, a leaf, a page, a leaf, a tab. The tree shows canvas and tools; the rest are loose.
const ROOT: PrefGroup = {
  name: '',
  children: {
    canvas: { name: 'Canvas', children: { grid: leaf('Grid') } },
    author: leaf('Author'),
    tools: { name: 'Tools', children: {} },
    zoom: leaf('Zoom'),
    extra: { name: 'Extra', as: 'tab', children: {} },
  },
};
const SECTION: PrefSection = { name: 'Node', members: { 'pose.x': leaf('X') } };

describe('what a root holds outside any page', () => {
  it('is a group root\'s own leaves and its groups that are not pages, and nothing of a section root', () => {
    expect(looseKeys(ROOT)).toEqual(['author', 'zoom', 'extra']);
    expect(looseKeys(SECTION)).toEqual([]);
  });

  it('is left out of the root the preview draws', () => {
    expect(Object.keys(placedOnly(ROOT).children)).toEqual(['canvas', 'tools']);
    const pages: PrefGroup = { name: '', children: { canvas: ROOT.children.canvas! } };
    expect(placedOnly(pages)).toBe(pages);
  });

  it('keeps all but pages off the tree\'s top level, and decides nothing below it', () => {
    expect(topLevelAllows(ROOT, ['tools'], null)).toBe(true);
    expect(topLevelAllows(ROOT, ['canvas/grid'], null)).toBe(false);
    expect(topLevelAllows(ROOT, ['extra'], null)).toBe(false);
    expect(topLevelAllows(ROOT, ['author'], 'canvas')).toBeUndefined();
    expect(topLevelAllows(SECTION, ['pose.x'], null)).toBeUndefined();
  });

  it('lands a drop at the tree\'s top level among the pages, and a node taken off its page at the root\'s end', () => {
    // Top level reads canvas, tools: index 0 is before canvas, 1 before tools, 2 the end.
    expect(schemaTarget(ROOT, null, 0)).toEqual({ parentPath: null, index: 0 });
    expect(schemaTarget(ROOT, null, 1)).toEqual({ parentPath: null, index: 2 });
    expect(schemaTarget(ROOT, null, 2)).toEqual({ parentPath: null, index: 5 });
    expect(schemaTarget(ROOT, 'canvas', 1)).toEqual({ parentPath: 'canvas', index: 1 });
    expect(looseTarget(ROOT)).toEqual({ parentPath: null, index: 5 });
  });
});
