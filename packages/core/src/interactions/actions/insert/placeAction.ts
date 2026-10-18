import type { Action, ActionDeps } from '@weasel-js/routing';
import type { InsertExtras } from '../depSchema';
import { inPlane, insertLayer } from '../planeInput';
import { enterInsertedText } from './commit';
import { insertKind } from './shape';

/** What the dispatcher lays under an immediate action's params for a click. */
const CLICK_FIELDS = ['worldX', 'worldY', 'pressX', 'pressY', 'affordance'] as const;

/**
 * Click-to-insert: the companion to `insertAction` for a click, which draws
 * no box. It commits a node of `params.kind` at `params.size`, centered on the
 * click, through the same `insert` dep a drag commits through. The rest of the
 * binding's params are the insert's extras, as a drag's are.
 *
 * A binding with no `size` places nothing: the kind's extent is the tool's to
 * name, and a click has none of its own.
 */
export const placeAction: Action & { requires: string[] } = inPlane({
  id: 'place',
  label: 'Place',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  requires: ['insert', 'selection', 'snap', 'textEdit'],
  invoker: {
    timing: 'immediate',
    run(deps: ActionDeps, params?: Record<string, unknown>): void {
      const dep = deps.insert;
      const size = params?.['size'] as { width: number; height: number } | undefined;
      const x = params?.['worldX'];
      const y = params?.['worldY'];
      if (!dep || !size || typeof x !== 'number' || typeof y !== 'number') return;
      if (!(size.width > 0 && size.height > 0)) return;

      deps.selection?.clear();
      const at = deps.snap ? deps.snap.point({ x, y }) : { x, y };
      deps.snap?.release?.();
      const extras: Record<string, unknown> = { ...params, kind: insertKind(params) };
      for (const k of [...CLICK_FIELDS, 'size']) delete extras[k];
      const bounds = { x: at.x - size.width / 2, y: at.y - size.height / 2, width: size.width, height: size.height };
      const id = dep.commit(bounds, extras as InsertExtras);
      enterInsertedText(deps.textEdit, id === null ? null : String(id), extras.kind as string);
    },
  },
  /** Like `insert`, needs no selection. */
  enabled: () => true as const,
}, insertLayer);
