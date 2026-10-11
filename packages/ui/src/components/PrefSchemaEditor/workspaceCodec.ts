import { isPlainObject, type SerializedHistory, type SerializedHistoryEntry, type SerializedOp } from '@weasel-js/core';
import type { DocumentCodec, DraftStorage, OpenedDocument } from './document';
import { dropDraft, openDraft, saveDraft, type OpenedDraft } from './draft';
import type { SchemaRoot } from './schemaEdit';
import { afterTaken, dropSent, openSent, packSent, saveSent } from './sent';
import { mapSwaps } from './swaps';
import type { PrefTypes } from './types';
import { assetOf, type Workspace } from './workspace';

/** A workspace's draft in storage: each asset as `draft.ts` keeps a schema, by the asset's id. */
interface StoredWorkspace {
  savedAt: number;
  assets: Record<string, unknown>;
}

/** A place for `draft.ts` to keep one asset, read back as text. */
function shim(held?: string): DraftStorage & { text(): string | undefined } {
  let text = held;
  return { getItem: () => text ?? null, setItem: (_key, value) => { text = value; }, removeItem: () => { text = undefined; }, text: () => text };
}

/**
 * `base` with a root for each of its assets, in their order. One workspace per set of roots, `base` itself for its
 * own: steps that share a workspace then share the object, and a step back to the baseline lands on it.
 */
function workspaces(base: Workspace): (roots: readonly SchemaRoot[]) => Workspace {
  const made: Array<{ roots: readonly SchemaRoot[]; workspace: Workspace }> = [{ roots: base.assets.map((a) => a.root), workspace: base }];
  return (roots) => {
    const known = made.find((m) => m.roots.every((root, i) => root === roots[i]));
    if (known) return known.workspace;
    const workspace: Workspace = { assets: base.assets.map((a, i) => (a.root === roots[i] ? a : { ...a, root: roots[i]! })) };
    made.push({ roots, workspace });
    return workspace;
  };
}

/**
 * One history of workspaces from each asset's history of roots, which hold the same steps; `null` for an asset
 * that takes no part in them. `null` when an asset's steps are missing or do not line up with the rest.
 */
function zipStacks(each: ReadonlyArray<SerializedHistory | null | undefined>, base: Workspace, at: (roots: readonly SchemaRoot[]) => Workspace): SerializedHistory | null {
  const first = each.find((stacks) => stacks != null);
  if (!first || each.includes(undefined)) return null;
  type Side = 'before' | 'after';
  type Ops = 'forwardOps' | 'baseOps';
  type Stack = 'undoStack' | 'redoStack';
  const root = (stacks: SerializedHistory, stack: Stack, i: number, ops: Ops, j: number, side: Side): SchemaRoot => {
    const args = stacks[stack][i]?.[ops][j]?.args as Record<Side, SchemaRoot> | undefined;
    if (!args) throw new Error('steps do not line up');
    return args[side];
  };
  const zip = (stack: Stack): SerializedHistoryEntry[] => {
    if (each.some((stacks) => stacks && stacks[stack].length !== first[stack].length)) throw new Error('steps do not line up');
    return first[stack].map((entry, i) => {
      const ops = (which: Ops): SerializedOp[] => entry[which].map((op, j) => {
        const side = (s: Side) => at(base.assets.map((a, n) => (each[n] ? root(each[n], stack, i, which, j, s) : a.root)));
        return { ...op, args: { before: side('before'), after: side('after') } };
      });
      return { ...entry, forwardOps: ops('forwardOps'), baseOps: ops('baseOps') };
    });
  };
  try {
    return { ...first, undoStack: zip('undoStack'), redoStack: zip('redoStack') };
  } catch {
    return null;
  }
}

function readWorkspace(key: string, storage?: DraftStorage): StoredWorkspace | null {
  try {
    const raw = (storage ?? localStorage).getItem(key);
    const draft: unknown = raw === null ? null : JSON.parse(raw);
    return isPlainObject(draft) && typeof draft.savedAt === 'number' && isPlainObject(draft.assets) ? (draft as unknown as StoredWorkspace) : null;
  } catch {
    return null;
  }
}

/**
 * How a document keeps a workspace whose leaves may be of `types`: every asset as a schema draft of its own, all
 * under one key, and the one history of workspaces as each asset's history of its root.
 */
export function workspaceCodec(types: PrefTypes): DocumentCodec<Workspace> {
  return {
    openDraft(key, base, storage): OpenedDocument<Workspace> | null {
      const draft = readWorkspace(key, storage);
      if (!draft) return null;
      // `undefined` for an asset whose entry did not open; `null` for one the draft never held, which stays the baseline's.
      const opened: Array<OpenedDraft<SchemaRoot> | null | undefined> = base.assets.map((asset) => {
        const entry = draft.assets[asset.id];
        return entry === undefined ? null : openDraft(asset.id, asset.root, shim(JSON.stringify(entry)), types) ?? undefined;
      });
      const read = opened.filter((o) => o != null);
      if (read.length === 0) return null;
      const at = workspaces(base);
      return {
        savedAt: draft.savedAt,
        value: at(base.assets.map((a, i) => opened[i]?.schema ?? a.root)),
        stacks: zipStacks(opened.map((o) => (o ? o.stacks ?? undefined : o)), base, at),
        met: read.some((o) => o.met === 'carried') ? 'carried' : read.some((o) => o.met === 'unknown') ? 'unknown' : 'same',
      };
    },
    saveDraft(key, value, base, stacks, savedAt, storage) {
      const assets: Record<string, Record<string, unknown>> = {};
      for (const asset of value.assets) {
        const source = assetOf(base, asset.id)?.root;
        if (!source) continue;
        const kept = shim();
        saveDraft(asset.id, asset.root, source, mapSwaps(stacks, (w: Workspace) => assetOf(w, asset.id)?.root ?? source), savedAt, kept, types);
        const text = kept.text();
        if (text !== undefined) assets[asset.id] = JSON.parse(text) as Record<string, unknown>;
      }
      const bare = Object.fromEntries(Object.entries(assets).map(([id, { steps: _steps, ...rest }]) => [id, rest]));
      // A storage short of room is asked again for the values alone; one that refuses keeps nothing.
      for (const held of [assets, bare]) {
        try {
          (storage ?? localStorage).setItem(key, JSON.stringify({ savedAt, assets: held } satisfies StoredWorkspace));
          return;
        } catch {
          // Private windows and full quotas throw; the editor goes on with what was kept before.
        }
      }
    },
    dropDraft,
    packSent: (value, base) => Object.fromEntries(value.assets.flatMap((asset) => {
      const source = assetOf(base, asset.id)?.root;
      return source ? [[asset.id, packSent(asset.root, source, types)]] : [];
    })),
    afterTaken(value, sent, base) {
      const was = isPlainObject(sent) ? sent : {};
      return workspaces(base)(base.assets.map((asset) => {
        const root = assetOf(value, asset.id)?.root ?? asset.root;
        return asset.id in was ? afterTaken(root, was[asset.id], asset.root, types) : root;
      }));
    },
    saveSent,
    openSent,
    dropSent,
  };
}
