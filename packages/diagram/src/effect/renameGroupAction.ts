/** The double-click that opens a group's name field from its title grip, under a look that places stages itself. */
import { ActionDisabledReason, type Contribution, type Vec2 } from '@weasel-js/core';
import { ANYWHERE } from '../reorder';
import type { ReorderSource } from './editorReorder';
import { groupAt } from './groupOrder';
import type { ImmediateParams } from '@weasel-js/core';

/** The action that opens a group's name field. */
export const RENAME_GROUP_ACTION_ID = 'effect.renameGroup';

/** A double-click on a group's grip ({@link groupAt}), handing `rename` the innermost group there. */
export function renameGroupContribution(now: () => ReorderSource, rename: (group: string) => void): Contribution {
  const under = (at: Vec2) => {
    const { doc, boxOf } = now();
    return groupAt(doc, boxOf, at);
  };
  return {
    id: `weasel-diagram-effect:${RENAME_GROUP_ACTION_ID}`,
    eligibility: { always: true },
    actions: [{
      id: RENAME_GROUP_ACTION_ID,
      label: 'Rename group',
      group: 'diagram',
      enabled: (_, at) => (at === undefined || under(at) !== undefined ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'immediate',
        run(_, params) {
          const world = (params as ImmediateParams | undefined)?.world;
          const group = world ? under(world) : undefined;
          if (group !== undefined) rename(group);
        },
      },
    }],
    // Empty space included: an unlabeled group's grip is padding.
    bindings: [{
      spec: { kind: 'doubleClick', target: { kindOf: ANYWHERE } },
      actionId: RENAME_GROUP_ACTION_ID,
      opts: { id: `${RENAME_GROUP_ACTION_ID}.doubleClick` },
    }],
  };
}
