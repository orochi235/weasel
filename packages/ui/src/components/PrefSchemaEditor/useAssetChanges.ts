import { useMemo, useState } from 'react';
import type { SchemaChange } from './schemaExport';
import type { Workspace } from './workspace';
import { workspaceChanges, type AssetChanges } from './workspaceChanges';

const NO_CHANGES: readonly SchemaChange[] = [];

/** What a workspace has changed from its baseline, as the editor's panes ask for it. */
export interface WorkspaceChanges {
  /** Each changed asset's changes, in the workspace's order. */
  each: readonly AssetChanges[];
  /** The ids of the changed assets. */
  ids: ReadonlySet<string>;
  /** The changes of the asset `id`; none for one that stands at its baseline. */
  of(id: string): readonly SchemaChange[];
}

/**
 * The changes from `base` to `workspace`. A workspace `same` as the last one is not looked at again, so what the
 * panes are handed keeps its identity under a host that makes its workspace anew each time it draws.
 */
export function useAssetChanges(base: Workspace, workspace: Workspace, same: (a: Workspace, b: Workspace) => boolean): WorkspaceChanges {
  const [held, setHeld] = useState(workspace);
  const current = held === workspace || same(held, workspace) ? held : workspace;
  if (current !== held) setHeld(current);
  return useMemo(() => {
    const each = workspaceChanges(base, current);
    const by = new Map(each.map((c) => [c.id, c.changes]));
    return { each, ids: new Set(by.keys()), of: (id) => by.get(id) ?? NO_CHANGES };
  }, [base, current]);
}
