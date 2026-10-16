import { useMemo } from 'react';
import type { Action, ToolKeybinding } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import type { Scene } from 'core/scene/types';
import { planTrim } from 'interactions/actions/pathCommands/trimSegment';
import type { Tool } from '../../overlayBinding';
import { SliceIcon } from '../../../icons';
import { useStrokeClickTool, type StrokeClickExtras, type StrokeClickToolOptions } from '../shared/strokeClickTool';
import { createPiecePreview } from './piecePreview';

/** Options for `useTrimTool`; the default keybinding is `{ key: 'Y' }`. */
export type UseTrimToolOptions = StrokeClickToolOptions;

const TRIM_KEY: ToolKeybinding = { key: 'Y' };
const TRIM_PREVIEW_ID = 'trim.preview';

/**
 * Trim segment tool. A click on a stroke removes its piece between the
 * crossings on either side — a declarative shell over the `trimPath` action,
 * which owns the hit-test and the commit. While it is up, the piece under the
 * pointer is drawn dashed, through the same `planTrim` the click commits.
 */
export function useTrimTool(options: UseTrimToolOptions = {}): Tool {
  const extras = useMemo<StrokeClickExtras>(() => {
    const preview = createPiecePreview();
    const action: Action = {
      id: TRIM_PREVIEW_ID,
      label: 'Trim segment: show the piece under the pointer',
      eligible: { capability: 'creates-shapes' },
      requires: ['scene', 'view'],
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const plan = deps.scene ? planTrim(deps, params) : null;
          const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
          preview.show(plan && scene ? { path: plan.result.removed as PolygonPath, scene } : null);
        },
      },
    };
    return {
      actions: [action],
      bindings: [{ spec: { kind: 'hover' }, actionId: TRIM_PREVIEW_ID }],
      overlay: preview.layer,
      onDeactivate: () => preview.show(null),
    };
  }, []);
  return useStrokeClickTool(
    { id: 'trim', label: 'Trim segment', icon: SliceIcon, hookName: 'useTrimTool', actionId: 'trimPath', keybinding: TRIM_KEY },
    options,
    extras,
  );
}
