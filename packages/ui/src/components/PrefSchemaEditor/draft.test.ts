import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import type { SerializedHistory } from '@weasel-js/core';
import { packDraft, packSteps, SWAP, unpackDraft, unpackSteps } from './draft';
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

  describe('with its steps', () => {
    const a = setAttribute(SOURCE, 'view/snap', 'name', 'One');
    const b = setAttribute(a, 'view/snap', 'name', 'Two');
    const c = setAttribute(b, 'view/snap', 'name', 'Three');
    const swap = (before: PrefGroup, after: PrefGroup) => ({ name: SWAP, args: { before, after } });
    const entry = (id: number, before: PrefGroup, after: PrefGroup) => ({ id, label: 'edit schema', forwardOps: [swap(before, after)], baseOps: [swap(before, after)] });
    const stacks: SerializedHistory = {
      version: 1, nextEntryId: 4, droppedEntries: 0,
      undoStack: [entry(1, SOURCE, a), entry(2, a, b)],
      redoStack: [entry(3, b, c)],
    };
    const through = (keep?: number) => unpackSteps(JSON.parse(JSON.stringify(packSteps(stacks, b, SOURCE, keep))), SOURCE)!;

    it('writes each schema once, and the source not at all', () => {
      const stored = packSteps(stacks, b, SOURCE);
      expect(stored.schemas).toHaveLength(4);
      expect(stored.schemas.filter((x) => x === null)).toHaveLength(1);
    });

    it('comes back with every step sharing its neighbours’ schemas, the first leaving the source itself', () => {
      const { current, stacks: back } = through();
      const args = (e: { forwardOps: { args: unknown }[] }) => e.forwardOps[0]!.args as { before: PrefGroup; after: PrefGroup };
      const [first, second] = back.undoStack.map(args);
      expect(first!.before).toBe(SOURCE);
      expect(second!.before).toBe(first!.after);
      expect(current).toBe(second!.after);
      expect(args(back.redoStack[0]!).before).toBe(current);
      expect(nodeAt(args(back.redoStack[0]!).after, 'view/snap')).toMatchObject({ name: 'Three', encoding: enc });
    });

    it('keeps only the steps nearest where the editor stands', () => {
      const { stacks: back } = through(1);
      expect(back.undoStack.map((e) => e.id)).toEqual([2]);
      expect(back.redoStack.map((e) => e.id)).toEqual([3]);
    });

    it('reads as nothing when a step names a schema that is not there', () => {
      const stored = packSteps(stacks, b, SOURCE);
      expect(unpackSteps({ ...stored, schemas: stored.schemas.slice(0, 2) }, SOURCE)).toBeNull();
    });
  });
});
