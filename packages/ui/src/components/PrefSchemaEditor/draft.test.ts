import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { packDraft, unpackDraft } from './draft';
import { moveNodes, nodeAt, renameKey, setAttribute } from './schemaEdit';

const enc = { read: () => true, write: (on: boolean) => on };
const SOURCE: PrefGroup = {
  name: 'Root',
  children: {
    view: { name: 'View', children: {
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false, encoding: enc },
      cut: { kind: 'number', name: 'Cut', description: '', default: 1, max: Infinity },
    } },
    other: { name: 'Other', children: {} },
  },
};

const round = (schema: PrefGroup) => unpackDraft(JSON.parse(JSON.stringify(packDraft(schema, SOURCE))), SOURCE);

describe('a schema draft', () => {
  it('comes back equal, with the code it held and the numbers JSON cannot write', () => {
    const back = round(setAttribute(SOURCE, 'view/snap', 'name', 'Snap to grid'));
    expect(nodeAt(back, 'view/snap')).toMatchObject({ name: 'Snap to grid', default: false });
    expect((nodeAt(back, 'view/snap') as { encoding: unknown }).encoding).toBe(enc);
    expect(nodeAt(back, 'view/cut')).toMatchObject({ max: Infinity });
  });

  it('keeps a node’s code when the node was moved and re-keyed', () => {
    const moved = moveNodes(SOURCE, ['view/snap'], { parentPath: 'other', index: 0 }).root;
    const back = round(renameKey(moved, 'other/snap', 'stick'));
    expect((nodeAt(back, 'other/stick') as { encoding: unknown }).encoding).toBe(enc);
    expect(nodeAt(back, 'view/snap')).toBeUndefined();
  });

  it('keeps the order of a group’s children', () => {
    const back = round(moveNodes(SOURCE, ['view/cut'], { parentPath: 'view', index: 0 }).root);
    expect(Object.keys((nodeAt(back, 'view') as PrefGroup).children)).toEqual(['cut', 'snap']);
  });

  it('drops an attribute whose code the source no longer holds', () => {
    const packed = JSON.parse(JSON.stringify(packDraft(SOURCE, SOURCE)));
    const bare: PrefGroup = { name: 'Root', children: { view: { name: 'View', children: {
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
    } } } };
    expect(nodeAt(unpackDraft(packed, bare), 'view/snap')).not.toHaveProperty('encoding');
  });
});
