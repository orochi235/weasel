/** The double-click that opens a cluster's name field from its title grip, under a look that places stages itself. */
import { ActionDisabledReason, defineAction, type Contribution, type Vec2 } from '@weasel-js/core';
import { ANYWHERE } from '../reorder';
import type { ReorderSource } from './editorReorder';
import { clusterAt } from './clusterOrder';
import type {} from '../actionParamSchema';

/** The action that opens a cluster's name field. */
export const RENAME_CLUSTER_ACTION_ID = 'diagram.renameCluster';

/** A double-click on a cluster's grip ({@link clusterAt}), handing `rename` the innermost cluster there. */
export function createRenameClusterContribution(now: () => ReorderSource, rename: (cluster: string) => void): Contribution {
  /** The cluster a double-click at `at` renames; none without a point, as from a palette. */
  const under = (at: Vec2 | undefined) => {
    if (at === undefined) return undefined;
    const { doc, boxOf } = now();
    return clusterAt(doc, boxOf, at);
  };
  return {
    id: `weasel-diagram-effect:${RENAME_CLUSTER_ACTION_ID}`,
    eligibility: { always: true },
    actions: [defineAction({
      id: RENAME_CLUSTER_ACTION_ID,
      label: 'Rename group',
      group: 'diagram',
      enabled: (_, at, _carried, params) => (under(at ?? params?.world) !== undefined ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'immediate',
        run(_, params) {
          const cluster = under(params?.world);
          if (cluster !== undefined) rename(cluster);
        },
      },
    })],
    // Empty space included: an unlabeled cluster's grip is padding.
    bindings: [{
      spec: { kind: 'doubleClick', target: { kindOf: ANYWHERE } },
      actionId: RENAME_CLUSTER_ACTION_ID,
      opts: { id: `${RENAME_CLUSTER_ACTION_ID}.doubleClick` },
    }],
  };
}
