/** The double-click that opens a group's name field from its title grip, under a look that places stages itself. */
import { ActionDisabledReason, defineAction, type Contribution, type Vec2 } from '@weasel-js/core';
import { ANYWHERE } from '../reorder';
import type { ReorderSource } from './editorReorder';
import { groupAt } from './groupOrder';
import type {} from '../actionParamSchema';

/** The action that opens a group's name field. */
export const RENAME_GROUP_ACTION_ID = 'diagram.renameGroup';

/** A double-click on a group's grip ({@link groupAt}), handing `rename` the innermost group there. */
export function createRenameGroupContribution(now: () => ReorderSource, rename: (group: string) => void): Contribution {
  /** The group a double-click at `at` renames; none without a point, as from a palette. */
  const under = (at: Vec2 | undefined) => {
    if (at === undefined) return undefined;
    const { doc, boxOf } = now();
    return groupAt(doc, boxOf, at);
  };
  return {
    id: `weasel-diagram-effect:${RENAME_GROUP_ACTION_ID}`,
    eligibility: { always: true },
    actions: [defineAction({
      id: RENAME_GROUP_ACTION_ID,
      label: 'Rename group',
      group: 'diagram',
      enabled: (_, at, _carried, params) => (under(at ?? params?.world) !== undefined ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'immediate',
        run(_, params) {
          const group = under(params?.world);
          if (group !== undefined) rename(group);
        },
      },
    })],
    // Empty space included: an unlabeled group's grip is padding.
    bindings: [{
      spec: { kind: 'doubleClick', target: { kindOf: ANYWHERE } },
      actionId: RENAME_GROUP_ACTION_ID,
      opts: { id: `${RENAME_GROUP_ACTION_ID}.doubleClick` },
    }],
  };
}
