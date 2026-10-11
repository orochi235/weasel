import { isPlainObject, type SerializedHistory, type SerializedHistoryEntry, type SerializedOp } from '@weasel-js/core';
import type { DocumentCodec, DraftStorage, OpenedDocument } from './document';
import { dropDraft, openDraft, saveDraft, STEPS_KEPT } from './draft';
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
 * that stands at the baseline's root through all of them. `null` when an asset's steps are missing (`undefined`)
 * or do not line up with the rest.
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
      // An asset the draft does not hold, or holds nothing of that the source does not say now, is the baseline's.
      const opened = base.assets.map((asset) => {
        const entry = draft.assets[asset.id];
        return entry === undefined ? null : { draft: openDraft(asset.id, asset.root, shim(JSON.stringify(entry)), types) };
      });
      const at = workspaces(base);
      const value = at(base.assets.map((a, i) => opened[i]?.draft?.schema ?? a.root));
      if (value === base) {
        dropDraft(key, storage);
        return null;
      }
      // An entry that opens as nothing was carried there: `draft.ts` drops only a draft whose source moved.
      const met = opened.flatMap((o) => (o ? [o.draft?.met ?? 'carried'] : []));
      return {
        savedAt: draft.savedAt,
        value,
        stacks: zipStacks(opened.map((o) => (o?.draft ? o.draft.stacks ?? undefined : null)), base, at),
        met: met.includes('carried') ? 'carried' : met.includes('unknown') ? 'unknown' : 'same',
      };
    },
    saveDraft(key, value, base, stacks, savedAt, storage) {
      // A storage short of room is asked again for half the steps, down to the values alone; one that refuses keeps nothing.
      for (let keep = STEPS_KEPT; ; keep >>= 1) {
        const near = { ...stacks, undoStack: keep > 0 ? stacks.undoStack.slice(-keep) : [], redoStack: keep > 0 ? stacks.redoStack.slice(-keep) : [] };
        const stepped = new Set<Workspace>([value]);
        mapSwaps(near, (w: Workspace) => stepped.add(w));
        const assets: Record<string, unknown> = {};
        for (const asset of value.assets) {
          const source = assetOf(base, asset.id)?.root;
          const rootIn = (w: Workspace): SchemaRoot | undefined => assetOf(w, asset.id)?.root ?? source;
          // An asset the baseline's all the way through is left out, so a change to its source has nothing to carry.
          if (!source || [...stepped].every((w) => rootIn(w) === source)) continue;
          const kept = shim();
          saveDraft(asset.id, asset.root, source, mapSwaps(near, (w: Workspace) => rootIn(w)!), savedAt, kept, types);
          const { steps, ...rest } = JSON.parse(kept.text()!) as Record<string, unknown>;
          assets[asset.id] = keep > 0 ? { ...rest, steps } : rest;
        }
        try {
          (storage ?? localStorage).setItem(key, JSON.stringify({ savedAt, assets } satisfies StoredWorkspace));
          return;
        } catch {
          // Private windows and full quotas throw; the editor goes on with what was kept before.
          if (keep === 0) return;
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
