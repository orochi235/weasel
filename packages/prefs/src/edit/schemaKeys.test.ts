import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { addNode, copyNodes, moveNodes, nodeAt, renameKey } from './schemaEdit';
import { keyClashes, keyProblem, keysTakenAt, uniqueKey } from './schemaKeys';

const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 });

const NODE: PrefSection = {
  name: 'Rect',
  members: {
    layout: { name: 'Layout', members: { 'pose.x': num('X'), inner: { name: 'Inner', members: { 'pose.y': num('Y') } } } },
    look: { name: 'Look', members: { opacity: num('Opacity') } },
    'data.text': num('Text'),
  },
};

const PREFS: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: { zoom: num('Zoom') } },
    panels: { name: 'Panels', children: {
      stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: {
        width: num('Width'),
        ends: { name: 'Ends', members: { cap: num('Cap') } },
        joins: { name: 'Joins', members: {} },
      } } as PrefLeaf,
    } },
  },
};

describe('the keys a new node may not take', () => {
  it('are, for a leaf under a section root, every leaf\'s under the root', () => {
    const taken = keysTakenAt(NODE, 'look', true);
    expect(Object.keys(taken)).toEqual(expect.arrayContaining(['data.text', 'opacity', 'pose.x', 'pose.y']));
    expect(keyProblem(taken, 'pose.x', true)).toMatch(/"pose\.x" is taken here/);
    expect(keyProblem(taken, 'pose.y', true)).toMatch(/taken here/);
    expect(keyProblem(taken, 'pose.z', true)).toBeNull();
    expect(uniqueKey(taken, 'opacity')).toBe('opacity2');
  });

  it('are, for a leaf under a section root, every section\'s under the root too: a panel names both in one list', () => {
    expect(Object.keys(keysTakenAt(NODE, 'look', true)).sort()).toEqual(['data.text', 'inner', 'layout', 'look', 'opacity', 'pose.x', 'pose.y']);
    expect(Object.keys(keysTakenAt(NODE, null, true)).sort()).toEqual(['data.text', 'inner', 'layout', 'look', 'opacity', 'pose.x', 'pose.y']);
    expect(keyProblem(keysTakenAt(NODE, 'look', true), 'inner', true)).toMatch(/"inner" is taken here/);
  });

  it('are, for a section under a section root, its siblings\' and every leaf\'s under the root', () => {
    expect(Object.keys(keysTakenAt(NODE, 'look', false)).sort()).toEqual(['data.text', 'opacity', 'pose.x', 'pose.y']);
    expect(Object.keys(keysTakenAt(NODE, null, false)).sort()).toEqual(['data.text', 'layout', 'look', 'opacity', 'pose.x', 'pose.y']);
    expect(keyProblem(keysTakenAt(NODE, 'layout', false), 'opacity')).toMatch(/"opacity" is taken here/);
    // Two sections apart may share a key: neither is a value path, and only a top-level one is ever named.
    expect(keyProblem(keysTakenAt(NODE, 'look', false), 'inner')).toBeNull();
  });

  it('are its siblings\' for a section inside an object leaf, which no panel names', () => {
    expect(Object.keys(keysTakenAt(PREFS, 'panels/stroke', false)).sort()).toEqual(['ends', 'joins', 'width']);
    expect(Object.keys(keysTakenAt(PREFS, 'panels/stroke/joins', false))).toEqual([]);
  });

  it('are its siblings\' under a group, where keys nest', () => {
    expect(Object.keys(keysTakenAt(PREFS, 'panels', true))).toEqual(['stroke']);
    expect(keyProblem(keysTakenAt(PREFS, 'panels', true), 'zoom')).toBeNull();
  });

  it('are, for a field of an object leaf, every field\'s in whichever of its sections', () => {
    expect(Object.keys(keysTakenAt(PREFS, 'panels/stroke/joins', true)).sort()).toEqual(['cap', 'width']);
  });
});

describe('an edit that would give two leaves one value path', () => {
  it('is refused by addNode and renameKey', () => {
    expect(() => addNode(NODE, 'look', 'pose.x', num('Again'))).toThrow(/"pose\.x" is taken here/);
    expect(() => renameKey(NODE, 'look/opacity', 'pose.y')).toThrow(/"pose\.y" is taken here/);
    expect(() => addNode(PREFS, 'panels/stroke/joins', 'cap', num('Again'))).toThrow(/"cap" is taken here/);
    expect(nodeAt(addNode(NODE, 'look', 'pose', { name: 'Pose', members: {} }), 'look/pose')).toBeDefined();
  });

  it('is refused where it would give a section and a leaf one name under a section root', () => {
    expect(() => addNode(NODE, null, 'opacity', { name: 'Opacity', members: {} })).toThrow(/"opacity" is taken here/);
    expect(() => renameKey(NODE, 'layout', 'opacity')).toThrow(/"opacity" is taken here/);
    expect(() => addNode(NODE, 'look', 'inner', num('Inner'))).toThrow(/"inner" is taken here/);
    expect(() => renameKey(NODE, 'look/opacity', 'layout')).toThrow(/"layout" is taken here/);
    expect(nodeAt(addNode(PREFS, 'panels/stroke/joins', 'ends', num('Ends')), 'panels/stroke/joins/ends')).toBeDefined();
  });

  it('numbers a moved or copied node that would take the name of a leaf or a section where it lands', () => {
    const root: PrefSection = { name: 'Rect', members: {
      a: { name: 'A', members: { opacity: { name: 'Opacity', members: {} }, b: num('B') } },
      opacity: num('Opacity'),
      b: { name: 'B', members: {} },
    } };
    expect(moveNodes(root, ['a/opacity'], { parentPath: null, index: 0 }).paths).toEqual(['opacity2']);
    expect(moveNodes(root, ['a/b'], { parentPath: 'b', index: 0 }).paths).toEqual(['b/b2']);
    expect(copyNodes(root, ['b'], { parentPath: 'a', index: 0 }).paths).toEqual(['a/b2']);
  });

  it('numbers a field moved out of an object leaf into a scope that holds its key', () => {
    const root: PrefSection = { name: 'Rect', members: {
      a: { name: 'A', members: { x: num('X') } },
      b: { name: 'B', members: { box: { kind: 'object', name: 'Box', description: '', default: {}, children: { x: num('Box x') } } as PrefLeaf } },
    } };
    expect(moveNodes(root, ['b/box/x'], { parentPath: 'b', index: 0 }).paths).toEqual(['b/x2']);
    expect(moveNodes(root, ['a/x'], { parentPath: 'b', index: 0 }).paths).toEqual(['b/x']);
  });
});

describe('keyClashes', () => {
  it('names a section and a leaf that share a name under a section root, in a schema made elsewhere', () => {
    const shared: PrefSection = { name: 'Rect', members: {
      opacity: { name: 'Opacity', members: { 'pose.x': num('X') } },
      look: { name: 'Look', members: { opacity: num('Opacity'), inner: { name: 'Inner', members: {} } } },
      other: { name: 'Other', members: { inner: { name: 'Inner again', members: {} } } },
    } };
    expect([...keyClashes(shared)].sort()).toEqual([
      ['look/opacity', '"opacity" is taken here.'],
      ['opacity', '"opacity" is taken here.'],
    ]);
  });

  it('finds none in a schema whose leaves each have a value path of their own', () => {
    expect(keyClashes(NODE).size).toBe(0);
    expect(keyClashes(PREFS).size).toBe(0);
  });

  it('names every leaf that shares its value path with another, in a schema made elsewhere', () => {
    const twice: PrefSection = { name: 'Rect', members: {
      layout: { name: 'Layout', members: { 'pose.x': num('X') } },
      look: { name: 'Look', members: { 'pose.x': num('X again'), opacity: num('Opacity') } },
    } };
    expect([...keyClashes(twice)]).toEqual([
      ['layout/pose.x', '"pose.x" is taken here.'],
      ['look/pose.x', '"pose.x" is taken here.'],
    ]);
  });
});
