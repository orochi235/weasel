import { useMemo, createElement } from 'react';
import { defineTool } from '../../routing';
import type { Tool } from '../../types';
import type { InsertAdapter } from 'core/adapters/types';
import type { UseInsertOptions } from 'interactions/actions/insert/options';
import { type InsertOverlayStyle } from '../marquee';
import { RectIcon } from '../../../icons';

export type { InsertOverlayStyle };

export interface UseInsertToolOptions<TPose, TNode extends { id: string } = { id: string }>
  extends UseInsertOptions<TPose, TNode> {
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

const PRESENTATION = {
  label: 'Rectangle',
  icon: createElement(RectIcon),
  group: 'shape',
};

/** Drag-to-insert Tool. Phase 14e Task 3.5: the legacy `useInsert` hook is
 *  no longer consumed here — the gesture is owned end-to-end by the
 *  dispatcher's `insertAction` (see `src/interactions/actions/defaults/insert.ts`),
 *  which requires the `insert` dep. `SceneCanvas` registers that dep via
 *  `useInsertDepSource`; consumers using bare `<Canvas>` must wire it themselves.
 *
 *  Note: this tool is now a thin declarative wrapper — no local route-table
 *  drag handler, no local insert overlay layer, no click-to-insert path.
 *  Live-preview marquee and click-to-insert are dispatcher-side features
 *  deferred to a later phase (see insertAction's "What this does NOT wire"
 *  comment). The `overlayStyle` / `hitExisting` / `pointInsert` options
 *  remain on the option surface for forward-compat but are currently
 *  ignored. */
export function useInsertTool<TNode extends { id: string }, TPose>(
  _adapter: InsertAdapter<TNode>,
  _options: UseInsertToolOptions<TPose, TNode> = {},
): Tool<undefined> {
  return useMemo<Tool<undefined>>(
    () =>
      defineTool<undefined>({
        id: 'insert',
        cursor: 'crosshair',
        presentation: PRESENTATION,
        bindings: [
          { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: 'rect' } } },
        ],
        bindingsOverrideDrag: true,
        initial: {},
      }),
    [],
  );
}
