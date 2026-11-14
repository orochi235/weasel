import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { moveNodes, nodeAt, renameKey } from './schemaEdit';

const flag = (name: string, more: object = {}): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false, ...more });
const num = (name: string, more: object = {}): PrefLeaf => ({ kind: 'number', name, description: '', default: 0, ...more });

const ROOT: PrefGroup = {
  name: 'Root',
  enableIf: { path: 'a.on' },
  children: {
    a: { name: 'A', children: {
      on: flag('On'),
      size: num('Size', { showIf: { path: 'a.on', is: true } }),
      plain: num('Plain', { showIf: { path: 'b.count', above: 2 } }),
    } },
    b: {
      name: 'B',
      showIf: { all: [{ path: 'a.on' }, { not: { any: [{ path: 'a.size', atLeast: 3 }, { path: 'b.count', below: 1 }] } }] },
      children: {
        count: num('Count', { enableIf: { path: 'a.on', isNot: false } }),
        rows: { kind: 'list', name: 'Rows', description: '', default: [], item: num('Row', { showIf: { path: 'a.on' } }) } as PrefLeaf,
      },
    },
  },
};

describe('conditions follow the values they read', () => {
  it('carries a leaf\'s, a group\'s, and the root\'s conditions along with a renamed leaf', () => {
    const next = renameKey(ROOT, 'a/on', 'enabled');
    expect(nodeAt(next, 'a/size')).toMatchObject({ showIf: { path: 'a.enabled', is: true } });
    expect(nodeAt(next, 'b/count')).toMatchObject({ enableIf: { path: 'a.enabled', isNot: false } });
    expect(nodeAt(next, 'b')).toMatchObject({
      showIf: { all: [{ path: 'a.enabled' }, { not: { any: [{ path: 'a.size', atLeast: 3 }, { path: 'b.count', below: 1 }] } }] },
    });
    expect(next.enableIf).toEqual({ path: 'a.enabled' });
  });

  it('leaves a node whose conditions read nothing renamed as the object it was', () => {
    const next = renameKey(ROOT, 'a/on', 'enabled');
    expect(nodeAt(next, 'a/plain')).toBe(nodeAt(ROOT, 'a/plain'));
  });

  it('carries the condition of a list\'s entry', () => {
    const next = renameKey(ROOT, 'a/on', 'enabled');
    expect(nodeAt(next, 'b/rows')).toMatchObject({ item: { showIf: { path: 'a.enabled' } } });
  });

  it('carries them along with a leaf moved to another group', () => {
    const next = moveNodes(ROOT, ['a/on'], { parentPath: 'b', index: 0 }).root;
    expect(nodeAt(next, 'a/size')).toMatchObject({ showIf: { path: 'b.on', is: true } });
    expect(next.enableIf).toEqual({ path: 'b.on' });
  });

  it('carries them along with a renamed group, for every leaf under it', () => {
    const next = renameKey(ROOT, 'a', 'first');
    expect(nodeAt(next, 'first/size')).toMatchObject({ showIf: { path: 'first.on', is: true } });
    expect(nodeAt(next, 'b')).toMatchObject({
      showIf: { all: [{ path: 'first.on' }, { not: { any: [{ path: 'first.size', atLeast: 3 }, { path: 'b.count', below: 1 }] } }] },
    });
  });

  it('carries a section\'s and a member\'s under a section root, where a key is the whole path', () => {
    const node: PrefSection = {
      name: 'Properties',
      members: {
        'data.locked': flag('Locked'),
        pose: { name: 'Pose', enableIf: { not: { path: 'data.locked' } }, members: {
          'pose.x': num('X', { showIf: { path: 'data.locked', is: false } }),
        } },
      },
    };
    const next = renameKey(node, 'data.locked', 'data.pinned');
    expect(nodeAt(next, 'pose')).toMatchObject({ enableIf: { not: { path: 'data.pinned' } } });
    expect(nodeAt(next, 'pose/pose.x')).toMatchObject({ showIf: { path: 'data.pinned', is: false } });
  });

  it('carries a union variant\'s, and those of the fields inside it', () => {
    const fill = { kind: 'union', name: 'Fill', description: '', default: { type: 'flat' }, tag: 'type', variants: {
      flat: { kind: 'object', name: 'Flat', description: '', default: {}, children: {} },
      ramp: { kind: 'object', name: 'Ramp', description: '', default: {}, showIf: { path: 'a.on' }, children: {
        angle: num('Angle', { enableIf: { path: 'a.on', is: true } }),
        more: { name: 'More', showIf: { path: 'a.on' }, members: { stops: num('Stops') } },
      } },
    } } as unknown as PrefLeaf;
    const root: PrefGroup = { ...ROOT, children: { ...ROOT.children, fill } };
    const next = renameKey(root, 'a/on', 'enabled');
    expect(nodeAt(next, 'fill')).toMatchObject({ variants: { ramp: {
      showIf: { path: 'a.enabled' },
      children: { angle: { enableIf: { path: 'a.enabled', is: true } }, more: { showIf: { path: 'a.enabled' } } },
    } } });
    const flat = (node: unknown) => (node as { variants: { flat: unknown } }).variants.flat;
    expect(flat(nodeAt(next, 'fill'))).toBe(flat(fill));
    expect(nodeAt(renameKey(root, 'a/size', 'extent'), 'fill')).toBe(fill);
  });
});
