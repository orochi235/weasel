import type { Action, ActionDeps, ModifierState } from '@weasel-js/routing';
import { SNAP_ROLES, snapMods } from 'domains/snap/roles';
import type { InsertExtras } from '../depSchema';
import { inPlane, insertLayer } from '../planeInput';
import { enterInsertedText } from './commit';
import { insertParent } from './parent';
import { insertKind } from './shape';
import { minSizeOf } from 'core/scene/minSize';

/** What the dispatcher lays under an immediate action's params for a click. */
const CLICK_FIELDS = ['worldX', 'worldY', 'pressX', 'pressY', 'affordance', 'mods'] as const;

const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

/**
 * Click-to-insert: the companion to `insertAction` for a click, which draws
 * no box. It commits a node of `params.kind` at `params.size`, centered on the
 * click, snapped through a `point` session of the `snap` dep unless the
 * click held `snap.suspend` (Ctrl), and commits
 * through the same `insert` dep a drag commits through. The rest of the
 * binding's params are the insert's extras, as a drag's are.
 *
 * A `minSize` in the params floors the size, and goes on to the node.
 *
 * A binding with no `size` places nothing: the kind's extent is the tool's to
 * name, and a click has none of its own.
 */
export const placeAction: Action & { requires: string[] } = inPlane({
  id: 'place',
  label: 'Place',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  modifierRoles: SNAP_ROLES,
  requires: ['insert', 'insertInto', 'canDropInto', 'selection', 'snap', 'textEdit', 'scene'],
  invoker: {
    timing: 'immediate',
    run(deps: ActionDeps, params?: Record<string, unknown>): void {
      const dep = deps.insert;
      const asked = params?.['size'] as { width: number; height: number } | undefined;
      const min = minSizeOf(params);
      const size = asked && min
        ? { width: Math.max(asked.width, min.width), height: Math.max(asked.height, min.height) }
        : asked;
      const x = params?.['worldX'];
      const y = params?.['worldY'];
      if (!dep || !size || typeof x !== 'number' || typeof y !== 'number') return;
      if (!(size.width > 0 && size.height > 0)) return;

      deps.selection?.clear();
      const parent = insertParent(deps.scene, deps.insertInto?.get(), deps.canDropInto);
      const snap = deps.snap?.begin({ gesture: 'point', press: { x, y }, ...(parent === null ? {} : { parent }) });
      const mods = snapMods({ modifiers: (params?.['mods'] as ModifierState | undefined) ?? NO_KEYS });
      const at = snap ? snap.at({ x, y }, mods).point : { x, y };
      snap?.end();
      const extras: Record<string, unknown> = { ...params, kind: insertKind(params) };
      for (const k of [...CLICK_FIELDS, 'size']) delete extras[k];
      const bounds = { x: at.x - size.width / 2, y: at.y - size.height / 2, width: size.width, height: size.height };
      const ends = { start: at, end: { x: at.x + size.width / 2, y: at.y + size.height / 2 }, fromCenter: true };
      const id = dep.commit(bounds, extras as InsertExtras, ends);
      enterInsertedText(deps.textEdit, id === null ? null : String(id), extras.kind as string);
    },
  },
  /** Like `insert`, needs no selection. */
  enabled: () => true as const,
}, insertLayer);
