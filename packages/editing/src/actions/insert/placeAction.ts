import { defineAction, type Action, type ImmediateParams, type ModifierState } from '@weasel-js/routing';
import { SNAP_ROLES, snapMods } from '@weasel-js/core/engine';
import { inPlane, insertLayer, insertParent, minSizeOf } from '@weasel-js/core';
import { restoreSelection } from './commit';
import { insertShape } from './shape';
import { clearedSelection } from './session';
import type {} from '@weasel-js/core';
import { INSERT_GROUP } from '../../actionGroups';

/** What the dispatcher lays under an immediate action's params for a click. */
const CLICK_FIELDS = ['world', 'press', 'affordance', 'mods', 'roles'] as const;

const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

/** The keys a click held, and the roles the dispatcher resolved them to (`ImmediateParams`). */
function clickRoles(params: Readonly<Record<string, unknown>> | undefined) {
  const p = params as ImmediateParams | undefined;
  return { modifiers: p?.mods ?? NO_KEYS, ...(p?.roles ? { roles: p.roles } : {}) };
}

/**
 * Click-to-insert: the companion to `insertAction` for a click, which draws
 * no box. It commits a node of `params.kind` at `params.size`, centered on the
 * click's press, snapped through a `point` session of the `snap` dep unless the
 * click held `snap.suspend` (Ctrl), and commits
 * through the same `insert` dep a drag commits through. Its extras are the
 * ones a drag out from the click's center to the size's corner makes
 * (`insertShape`), built from the rest of the binding's params.
 *
 * A `minSize` in the params floors the size, and goes on to the node. Style
 * params (a shape tool's fill, stroke, …) reach the dep as `extras.style`.
 *
 * A binding with no `size` places nothing: the kind's extent is the tool's to
 * name, and a click has none of its own.
 */
export const placeAction: Action = inPlane(defineAction({
  id: 'place',
  label: 'Place',
  group: INSERT_GROUP,
  eligible: { capability: 'creates-shapes' },
  modifierRoles: SNAP_ROLES,
  requires: ['insert', 'insertInto', 'canDropInto', 'operands', 'snap', 'scene'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const dep = deps.insert;
      const asked = params?.size;
      const min = minSizeOf(params);
      const size = asked && min
        ? { width: Math.max(asked.width, min.width), height: Math.max(asked.height, min.height) }
        : asked;
      const click = params as ImmediateParams | undefined;
      const pressed = click?.press ?? click?.world;
      if (!dep || !size || !pressed) return;
      const { x, y } = pressed;
      if (!(size.width > 0 && size.height > 0)) return;

      const prior = deps.operands ? [...deps.operands.get()] : [];
      deps.operands?.set([]);
      let committed = false;
      try {
        const parent = insertParent(deps.scene, deps.insertInto?.get(), deps.canDropInto, { x, y });
        const snap = deps.snap?.begin({ gesture: 'point', press: { x, y }, ...(parent === null ? {} : { parent }) });
        let out;
        try {
          out = snap?.at({ x, y }, snapMods(clickRoles(params)));
        } finally {
          snap?.end();
        }
        const at = out ? out.point : { x, y };
        const binding: Record<string, unknown> = { ...params, originMode: 'center' };
        for (const k of [...CLICK_FIELDS, 'size']) delete binding[k];
        const landing = out?.landing;
        const { bounds, extras, ends } = insertShape(
          binding,
          { shaped: { start: at, current: { x: at.x + size.width / 2, y: at.y + size.height / 2 } }, altHeld: false },
          null, 0,
          (p) => (p === at ? landing : undefined),
          { x, y },
        );
        committed = dep.commit(bounds, extras, ends, clearedSelection(prior)) !== null;
      } finally {
        if (!committed) restoreSelection({ priorSelection: prior, selection: deps.operands });
      }
    },
  },
  /** Like `insert`, needs no selection. */
  enabled: () => true as const,
}), insertLayer);
