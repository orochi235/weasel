import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { addNode, moveNodes, nodeAt, renameKey } from './schemaEdit';
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
    expect(Object.keys(taken).sort()).toEqual(['data.text', 'opacity', 'pose.x', 'pose.y']);
    expect(keyProblem(taken, 'pose.x', true)).toMatch(/"pose\.x" is taken here/);
    expect(keyProblem(taken, 'pose.y', true)).toMatch(/taken here/);
    expect(keyProblem(taken, 'pose.z', true)).toBeNull();
    expect(uniqueKey(taken, 'opacity')).toBe('opacity2');
    expect(Object.keys(keysTakenAt(NODE, null, true)).sort()).toEqual(['data.text', 'layout', 'look', 'opacity', 'pose.x', 'pose.y']);
  });

  it('are its siblings\' for a section, whose key is no part of a value path', () => {
    expect(Object.keys(keysTakenAt(NODE, 'look', false))).toEqual(['opacity']);
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
