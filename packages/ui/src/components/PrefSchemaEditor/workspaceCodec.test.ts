import { describe, expect, it } from 'vitest';
import { createHistory, type SerializedHistory } from '@weasel-js/core';
import type { PrefAlias, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { SWAP, swapOp, type DraftStorage } from './document';
import { saveDraft } from './draft';
import { nodeAt, setAttribute } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';
import { CODE, SETTINGS, WORKSPACE } from './workspace.fixtures';
import { workspaceCodec } from './workspaceCodec';
import { editAsset, NO_MOVES, renameInAsset } from './workspaceEdit';

const KEY = 'ws';
const codec = workspaceCodec([]);

function memory(): DraftStorage {
  const held = new Map<string, string>();
  return { getItem: (k) => held.get(k) ?? null, setItem: (k, v) => void held.set(k, v), removeItem: (k) => void held.delete(k) };
}

/** A workspace under a real history, as `useDocument` holds one. */
function editor(start: Workspace) {
  let value = start;
  const emit = (next: Workspace) => { value = next; };
  const history = createHistory(null, {
    rebuildOp: (name, args) => (name === SWAP ? swapOp((args as { before: Workspace }).before, (args as { after: Workspace }).after, emit) : null),
  });
  return {
    history,
    value: () => value,
    commit: (next: Workspace) => history.applyOps([swapOp(value, next, emit)], 'edit'),
  };
}

/** `base` edited through each of `edits` in turn, saved under {@link KEY}. */
function saved(base: Workspace, edits: ReadonlyArray<(ws: Workspace) => Workspace>, storage = memory()) {
  const doc = editor(base);
  for (const edit of edits) doc.commit(edit(doc.value()));
  codec.saveDraft(KEY, doc.value(), base, doc.history.serialize(), 5, storage);
  return { storage, value: doc.value() };
}

/** What `opened` holds, under a history its steps were restored to. */
function reopened(opened: { value: Workspace; stacks: SerializedHistory | null }) {
  const doc = editor(opened.value);
  doc.history.restore(opened.stacks!);
  return doc;
}

const rootOf = (ws: Workspace, id: string) => assetOf(ws, id)!.root;
const gridName = (ws: Workspace) => (nodeAt(rootOf(ws, 'settings'), 'view/grid') as PrefLeaf).name;
const nameGrid = (name: string) => (ws: Workspace) => editAsset(ws, 'settings', setAttribute(rootOf(ws, 'settings'), 'view/grid', 'name', name), NO_MOVES);
const nameCode = (name: string) => (ws: Workspace) => editAsset(ws, 'code', setAttribute(rootOf(ws, 'code'), null, 'name', name), NO_MOVES);

describe('workspaceCodec', () => {
  it('saves and reopens a workspace with an edit in each asset, value for value', () => {
    const { storage, value } = saved(WORKSPACE, [nameGrid('Grid'), nameCode('Editor')]);
    const opened = codec.openDraft(KEY, WORKSPACE, storage)!;
    expect(opened.value).toEqual(value);
    expect(opened.savedAt).toBe(5);
    expect(opened.met).toBe('same');
  });

  it('reopens the steps: one undo gives the workspace before the last edit, and every undo the baseline itself', () => {
    const { storage } = saved(WORKSPACE, [nameGrid('Grid'), nameCode('Editor')]);
    const doc = reopened(codec.openDraft(KEY, WORKSPACE, storage)!);
    doc.history.undo();
    expect(doc.value()).toEqual(nameGrid('Grid')(WORKSPACE));
    expect(rootOf(doc.value(), 'code')).toBe(CODE);
    doc.history.undo();
    expect(doc.value()).toBe(WORKSPACE);
    expect(doc.history.canUndo()).toBe(false);
    doc.history.redo();
    doc.history.redo();
    expect(rootOf(doc.value(), 'code').name).toBe('Editor');
  });

  it('keeps an edit to the dialog that a layout followed as one step: one undo restores both assets', () => {
    const { storage } = saved(WORKSPACE, [(ws) => renameInAsset(ws, 'settings', 'view/grid', 'lines')]);
    const opened = codec.openDraft(KEY, WORKSPACE, storage)!;
    expect(nodeAt(rootOf(opened.value, 'settings'), 'view/lines')).toBeDefined();
    expect((nodeAt(rootOf(opened.value, 'code'), 'grid') as PrefAlias).of).toBe('view.lines');
    const doc = reopened(opened);
    doc.history.undo();
    expect(doc.value()).toBe(WORKSPACE);
    expect(doc.history.canUndo()).toBe(false);
  });

  it('opens nothing when nothing is stored, and when what is stored is not a workspace draft', () => {
    const storage = memory();
    expect(codec.openDraft(KEY, WORKSPACE, storage)).toBeNull();
    storage.setItem(KEY, 'not json');
    expect(codec.openDraft(KEY, WORKSPACE, storage)).toBeNull();
    saveDraft(KEY, setAttribute(SETTINGS, 'view/grid', 'name', 'Grid'), SETTINGS, createHistory(null).serialize(), 5, storage);
    expect(codec.openDraft(KEY, WORKSPACE, storage)).toBeNull();
  });

  it('drops an asset the draft holds and the baseline does not', () => {
    const { storage } = saved(WORKSPACE, [nameGrid('Grid'), nameCode('Editor')]);
    const alone: Workspace = { assets: [WORKSPACE.assets[0]!] };
    const opened = codec.openDraft(KEY, alone, storage)!;
    expect(opened.value.assets.map((a) => a.id)).toEqual(['settings']);
    expect(gridName(opened.value)).toBe('Grid');
  });

  it('opens an asset the baseline holds and the draft does not as the baseline’s', () => {
    const { storage } = saved({ assets: [WORKSPACE.assets[0]!] }, [nameGrid('Grid')]);
    const opened = codec.openDraft(KEY, WORKSPACE, storage)!;
    expect(gridName(opened.value)).toBe('Grid');
    expect(rootOf(opened.value, 'code')).toBe(CODE);
    const doc = reopened(opened);
    doc.history.undo();
    expect(doc.value()).toBe(WORKSPACE);
  });

  it('carries a draft onto a dialog with one more setting, the reader’s edit kept', () => {
    const { storage } = saved(WORKSPACE, [nameGrid('Grid')]);
    const view = SETTINGS.children.view as PrefGroup;
    const zoom: PrefLeaf = { kind: 'number', name: 'Zoom', description: '', default: 1 };
    const wider: PrefGroup = { ...SETTINGS, children: { view: { ...view, children: { ...view.children, zoom } } } };
    const base: Workspace = { assets: [{ ...WORKSPACE.assets[0]!, root: wider }, WORKSPACE.assets[1]!] };
    const opened = codec.openDraft(KEY, base, storage)!;
    expect(opened.met).toBe('carried');
    expect(gridName(opened.value)).toBe('Grid');
    expect(nodeAt(rootOf(opened.value, 'settings'), 'view/zoom')).toEqual(zoom);
    expect(rootOf(opened.value, 'code')).toBe(CODE);
  });

  it('keeps the values without the steps in a storage that throws on the first write', () => {
    const inner = memory();
    let writes = 0;
    const storage: DraftStorage = { ...inner, setItem: (k, v) => { if (writes++ === 0) throw new Error('full'); inner.setItem(k, v); } };
    const { value } = saved(WORKSPACE, [nameGrid('Grid'), nameCode('Editor')], storage);
    const opened = codec.openDraft(KEY, WORKSPACE, storage)!;
    expect(opened.value).toEqual(value);
    expect(opened.stacks).toBeNull();
  });

  it('keeps nothing in a storage that throws on every write', () => {
    const inner = memory();
    const storage: DraftStorage = { ...inner, setItem: () => { throw new Error('full'); } };
    saved(WORKSPACE, [nameGrid('Grid')], storage);
    expect(codec.openDraft(KEY, WORKSPACE, storage)).toBeNull();
  });

  describe('once what was sent is taken', () => {
    const sentValue = nameGrid('Grid')(WORKSPACE);
    const sent = JSON.parse(JSON.stringify(codec.packSent(sentValue, WORKSPACE))) as unknown;
    // The host's source after the send: what was sent, as objects of its own.
    const base: Workspace = { assets: sentValue.assets.map((a) => ({ ...a, root: JSON.parse(JSON.stringify(a.root)) as PrefGroup })) };

    it('returns the baseline itself when nothing was edited since the send', () => {
      expect(codec.afterTaken(sentValue, sent, base)).toBe(base);
    });

    it('keeps an edit made since', () => {
      const next = codec.afterTaken(nameCode('Editor')(sentValue), sent, base);
      expect(rootOf(next, 'settings')).toBe(rootOf(base, 'settings'));
      expect(rootOf(next, 'code').name).toBe('Editor');
    });
  });
});
