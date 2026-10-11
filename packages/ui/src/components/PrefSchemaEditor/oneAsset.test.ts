import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { swapOp, type DocumentCodec, type DraftStorage } from './document';
import { asWorkspace, ONE, oneAssetCodec, sameSchema, schemaOf } from './oneAsset';
import { schemaCodec } from './schemaCodec';
import { setAttribute } from './schemaEdit';
import type { PrefTypes } from './types';
import { editAsset, NO_MOVES } from './workspaceEdit';

const BASE: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      zoom: { kind: 'number', name: 'Zoom', description: '', default: 1, max: Infinity, unit: { toDisplay: (stored) => stored, fromDisplay: (display) => display } },
    } },
  },
};
const TYPES: PrefTypes = [];
const EDITS: ReadonlyArray<(schema: PrefGroup) => PrefGroup> = [
  (schema) => setAttribute(schema, 'view/grid', 'name', 'Grid'),
  (schema) => setAttribute(schema, 'view/zoom', 'default', 2),
  (schema) => setAttribute(schema, null, 'name', 'Settings'),
  (schema) => setAttribute(schema, 'view/zoom', 'name', 'Scale'),
];

function memory(): DraftStorage & { held: Map<string, string> } {
  const held = new Map<string, string>();
  return { held, getItem: (k) => held.get(k) ?? null, setItem: (k, v) => void held.set(k, v), removeItem: (k) => void held.delete(k) };
}

/** {@link EDITS} made and the last undone, under a real history, then saved and sent through `codec`. */
function driven<V>(codec: DocumentCodec<V>, base: V, edit: (value: V, to: (schema: PrefGroup) => PrefGroup) => V) {
  const storage = memory();
  let value = base;
  const emit = (next: V) => { value = next; };
  const history = createHistory(null, { selection: { get: () => ['view/grid'], set: () => {} } });
  for (const to of EDITS) history.applyOps([swapOp(value, edit(value, to), emit, 'attr')], 'edit schema');
  history.undo();
  codec.saveDraft('k', value, base, history.serialize(), 5, storage);
  codec.saveSent('k', codec.packSent(value, base), storage);
  return storage;
}

describe('a schema as a workspace of one', () => {
  beforeEach(() => { vi.useFakeTimers({ now: 1_000 }); });
  afterEach(() => { vi.useRealTimers(); });

  it('holds the schema it was made of', () => {
    expect(schemaOf(asWorkspace(BASE))).toBe(BASE);
    expect(sameSchema(asWorkspace(BASE), asWorkspace(BASE))).toBe(true);
    expect(sameSchema(asWorkspace(BASE), asWorkspace({ ...BASE }))).toBe(false);
  });

  it('stores the draft and what was sent byte for byte as the schema’s own codec does', () => {
    const alone = driven(schemaCodec<PrefGroup>(TYPES), BASE, (schema, to) => to(schema));
    const asOne = driven(oneAssetCodec<PrefGroup>(TYPES), asWorkspace(BASE), (ws, to) => editAsset(ws, ONE, to(schemaOf(ws)), NO_MOVES));
    expect([...asOne.held.keys()]).toEqual(['k', 'k:sent']);
    expect(asOne.held.get('k')).toBe(alone.held.get('k'));
    expect(asOne.held.get('k:sent')).toBe(alone.held.get('k:sent'));
    expect(JSON.parse(alone.held.get('k')!).steps.stacks.undoStack).toHaveLength(EDITS.length - 1);
  });

  it('opens a draft the schema’s own codec stored, a step back to the baseline landing on its schema', () => {
    const alone = driven(schemaCodec<PrefGroup>(TYPES), BASE, (schema, to) => to(schema));
    const base = asWorkspace(BASE);
    const opened = oneAssetCodec<PrefGroup>(TYPES).openDraft('k', base, alone)!;
    expect(schemaOf<PrefGroup>(opened.value).name).toBe('Settings');
    const first = opened.stacks!.undoStack[0]!.forwardOps[0]!.args as { before: typeof base };
    expect(sameSchema(first.before, base)).toBe(true);
  });
});
