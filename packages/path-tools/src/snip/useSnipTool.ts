import { useMemo } from 'react';
import type { Action, ToolKeybinding } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import { type Tool, type AnyScene } from '@weasel-js/core';
import { planSnip } from './snip';
import { useStrokeClickTool, type StrokeClickExtras, type StrokeClickToolOptions } from '../shared/strokeClickTool';
import { createPiecePreview } from './piecePreview';
import { icon } from '../icons.gen';

/** Options for `useSnipTool`; the default keybinding is `{ key: 'Y' }`. */
export type UseSnipToolOptions = StrokeClickToolOptions;

const SNIP_KEY: ToolKeybinding = { key: 'Y' };
const SNIP_PREVIEW_ID = 'snip.preview';
const SNIP_UNPREVIEW_ID = 'snip.unpreview';

/**
 * Snip tool. A click on a stroke removes its piece between the
 * crossings on either side — a declarative shell over the `snipPath` action,
 * which owns the hit-test and the commit. While it is up, the piece under the
 * pointer is drawn dashed, through the same `planSnip` the click commits.
 */
export function useSnipTool(options: UseSnipToolOptions = {}): Tool {
  const extras = useMemo<StrokeClickExtras>(() => {
    const preview = createPiecePreview();
    const action: Action = {
      id: SNIP_PREVIEW_ID,
      label: 'Snip: show the piece under the pointer',
      eligible: { capability: 'creates-shapes' },
      requires: ['scene', 'view'],
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const plan = deps.scene ? planSnip(deps, params) : null;
          const scene = deps.scene as AnyScene | undefined;
          preview.show(plan && scene ? { path: plan.result.removed as PolygonPath, scene } : null);
        },
      },
    };
    const clear: Action = {
      id: SNIP_UNPREVIEW_ID,
      label: 'Snip: stop showing the piece',
      eligible: { capability: 'creates-shapes' },
      invoker: { timing: 'immediate', run: () => preview.show(null) },
    };
    return {
      actions: [action, clear],
      bindings: [
        { spec: { kind: 'hover' }, actionId: SNIP_PREVIEW_ID, opts: { id: 'snip.hover' } },
        { spec: { kind: 'hover', motion: 'leave' }, actionId: SNIP_UNPREVIEW_ID, opts: { id: 'snip.leave' } },
      ],
      overlay: preview.layer,
      onDeactivate: () => preview.show(null),
    };
  }, []);
  return useStrokeClickTool(
    { id: 'snip', label: 'Snip', icon: icon('snip'), hookName: 'useSnipTool', actionId: 'snipPath', keybinding: SNIP_KEY },
    options,
    extras,
  );
}
