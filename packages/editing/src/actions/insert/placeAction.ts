import { defineAction, type Action, type ModifierState } from '@weasel-js/routing';
import { SNAP_ROLES, snapMods } from '@weasel-js/core/engine';
import { inPlane, insertLayer, insertParent, minSizeOf } from '@weasel-js/core';
import { restoreSelection } from './commit';
import { insertKind } from './shape';
import { clearedSelection } from './session';
import { insertStyleOf } from './style';
import type {} from '@weasel-js/core';

/** What the dispatcher lays under an immediate action's params for a click. */
const CLICK_FIELDS = ['world', 'press', 'affordance', 'mods'] as const;

const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

/**
 * Click-to-insert: the companion to `insertAction` for a click, which draws
 * no box. It commits a node of `params.kind` at `params.size`, centered on the
 * click, snapped through a `point` session of the `snap` dep unless the
 * click held `snap.suspend` (Ctrl), and commits
 * through the same `insert` dep a drag commits through. The rest of the
 * binding's params are the insert's extras, as a drag's are.
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
  group: 'insert',
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
      const world = params?.world;
      if (!dep || !size || !world) return;
      const { x, y } = world;
      if (!(size.width > 0 && size.height > 0)) return;

      const prior = deps.operands ? [...deps.operands.get()] : [];
      deps.operands?.set([]);
      const parent = insertParent(deps.scene, deps.insertInto?.get(), deps.canDropInto, { x, y });
      const snap = deps.snap?.begin({ gesture: 'point', press: { x, y }, ...(parent === null ? {} : { parent }) });
      const mods = snapMods({ modifiers: params?.mods ?? NO_KEYS });
      const out = snap?.at({ x, y }, mods);
      const at = out ? out.point : { x, y };
      snap?.end();
      const extras: { kind: string; [extra: string]: unknown } = { ...params, kind: insertKind(params) };
      for (const k of [...CLICK_FIELDS, 'size']) delete extras[k];
      const style = insertStyleOf(params);
      if (style) extras['style'] = style;
      const bounds = { x: at.x - size.width / 2, y: at.y - size.height / 2, width: size.width, height: size.height };
      const ends = {
        start: at, end: { x: at.x + size.width / 2, y: at.y + size.height / 2 }, fromCenter: true,
        ...(out?.landing !== undefined ? { landings: { start: out.landing } } : {}),
      };
      const id = dep.commit(bounds, extras, ends, clearedSelection(prior));
      if (id === null) {
        restoreSelection({ priorSelection: prior, selection: deps.operands });
      }
    },
  },
  /** Like `insert`, needs no selection. */
  enabled: () => true as const,
}), insertLayer);
