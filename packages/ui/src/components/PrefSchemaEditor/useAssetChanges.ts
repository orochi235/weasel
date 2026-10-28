import { useEffect, useMemo, useState } from 'react';
import { useLatest } from '@weasel-js/core';
import { exportOf, type AssetExport } from './assetExport';
import { trackOrigins } from './nodeOrigins';
import { formatChanges, type SchemaChange } from './schemaExport';
import type { PrefTypes } from './types';
import { assetOf, shownAssets, type Asset, type Workspace } from './workspace';
import { workspaceChanges, type AssetChanges } from './workspaceChanges';

const NO_CHANGES: readonly SchemaChange[] = [];

/** One asset's part of a submission: its changes since the baseline, and what it exports: its root as a TypeScript
 *  literal, or a Bundles asset's `weasel-bundles/1` JSON. */
export interface SentAsset {
  id: string;
  kind: Asset['kind'];
  changes: readonly SchemaChange[];
  literal: string;
}

/** Where an asset editor's changes go when the reader submits them: every changed asset, in the workspace's order. A promise it returns says whether they arrived. */
export type SubmitAssets = (assets: readonly SentAsset[]) => void | Promise<void>;

/** What a workspace has changed from its baseline, as the editor's panes ask for it. */
export interface WorkspaceChanges {
  /** The ids of the changed assets. */
  ids: ReadonlySet<string>;
  /** The changes of the asset `id`; none for one that stands at its baseline. */
  of(id: string): readonly SchemaChange[];
  /** Every asset's changes as one list, which is empty when nothing changed and another list when anything does. */
  all: readonly SchemaChange[];
  /** The changes as text: one asset's alone as `formatChanges` writes them, and several each under its asset's label. */
  text: string;
  /** What a submission hands over. */
  sent(types?: PrefTypes): SentAsset[];
  /** What the asset `id` exports as it stands. */
  exported(id: string, types?: PrefTypes): AssetExport;
  /** Follow every node from `before` to what it became in `after`, an edit made in one step, so it stays paired with
   *  its baseline whatever the later steps make of its key and its name. */
  follow(before: Workspace, after: Workspace): void;
}

function changesText(workspace: Workspace, each: readonly AssetChanges[]): string {
  // A lone dialog's changes need no heading, though a catalog is kept beside it, until that changes too.
  const [lone, ...more] = shownAssets(workspace);
  if (more.length === 0 && each.every((c) => c.id === lone?.id)) return formatChanges(each[0]?.changes ?? NO_CHANGES);
  return each.map(({ id, changes }) => `${assetOf(workspace, id)!.label}\n${formatChanges(changes)}`).join('\n\n');
}

/**
 * The changes from `base` to `workspace`. A workspace `same` as the last one is not looked at again, so what the
 * panes are handed keeps its identity under a host that makes its workspace anew each time it draws. `report` is
 * called with the changed assets' ids on mount, and again whenever the set is another one.
 */
export function useAssetChanges(
  base: Workspace, workspace: Workspace, same: (a: Workspace, b: Workspace) => boolean, report?: (ids: ReadonlySet<string>) => void,
): WorkspaceChanges {
  const [held, setHeld] = useState(workspace);
  const current = held === workspace || same(held, workspace) ? held : workspace;
  if (current !== held) setHeld(current);
  const [tracked, setTracked] = useState(() => ({ base, origins: trackOrigins(base) }));
  const track = tracked.base === base ? tracked : { base, origins: trackOrigins(base) };
  if (track !== tracked) setTracked(track);
  const { origins } = track;
  const changes = useMemo<WorkspaceChanges>(() => {
    const each = workspaceChanges(base, current, origins);
    const by = new Map(each.map((c) => [c.id, c.changes]));
    return {
      ids: new Set(by.keys()),
      of: (id) => by.get(id) ?? NO_CHANGES,
      all: each.flatMap((c) => c.changes),
      text: changesText(current, each),
      sent: (types) => each.map(({ id, changes }) => {
        const asset = assetOf(current, id)!;
        return { id, kind: asset.kind, changes, literal: exportOf(asset, base, origins.of(id), types).text };
      }),
      exported: (id, types) => exportOf(assetOf(current, id)!, base, origins.of(id), types),
      follow: origins.follow,
    };
  }, [base, current, origins]);
  const reported = useLatest(report);
  const { ids } = changes;
  useEffect(() => reported.current?.(ids), [ids, reported]);
  return changes;
}
