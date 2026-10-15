import { createElement, useMemo } from 'react';
import type { Action, GestureBinding, ToolKeybinding } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import type { RenderLayer } from 'core/layers/render';
import type { Scene } from 'core/scene/types';
import { planTrim } from 'interactions/actions/pathCommands/trimExtend';
import { defineTool, type Tool } from '../../overlayBinding';
import { SliceIcon } from '../../../icons';
import { createPiecePreview } from './piecePreview';

/** Options for `useTrimTool` and `useExtendTool`. */
export interface StrokeClickToolOptions {
  /** Override the default keybinding. Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** How far from a stroke a click may land and still reach it, in screen
   *  pixels. Read on every click. Default 6. */
  radiusPx?: number | (() => number);
}

/** Options for `useTrimTool`; the default keybinding is `{ key: 'Y' }`. */
export type UseTrimToolOptions = StrokeClickToolOptions;
/** Options for `useExtendTool`; the default keybinding is `{ key: 'U' }`. */
export type UseExtendToolOptions = StrokeClickToolOptions;

const TRIM_KEY: ToolKeybinding = { key: 'Y' };
const EXTEND_KEY: ToolKeybinding = { key: 'U' };

/** The tool's own extras: actions it registers, bindings beside its click,
 *  an overlay, and what to drop when it is put down. */
interface StrokeClickExtras {
  actions?: Action[];
  bindings?: GestureBinding[];
  overlay?: RenderLayer<unknown>;
  onDeactivate?: () => void;
}

/** A tool whose click binding hands the press, and `radiusPx`, to `actionId`. */
function useStrokeClickTool(
  spec: { id: string; label: string; hookName: string; actionId: string; keybinding: ToolKeybinding },
  options: StrokeClickToolOptions,
  extras: StrokeClickExtras = {},
): Tool {
  const { keybinding = spec.keybinding, radiusPx } = options;
  const { id, label, hookName, actionId } = spec;
  return useMemo(() => {
    const opts = radiusPx !== undefined
      ? { opts: { params: () => ({ radiusPx: typeof radiusPx === 'function' ? radiusPx() : radiusPx }) } }
      : {};
    return defineTool({
      id,
      ...(keybinding ? { keybinding } : {}),
      capabilities: ['creates-shapes'],
      hookName,
      cursor: 'crosshair',
      presentation: { label, group: 'path', icon: createElement(SliceIcon) },
      ...(extras.actions ? { actions: extras.actions } : {}),
      ...(extras.overlay ? { overlay: extras.overlay } : {}),
      ...(extras.onDeactivate ? { onDeactivate: extras.onDeactivate } : {}),
      bindings: [
        { spec: { kind: 'click' }, actionId, ...opts },
        ...(extras.bindings ?? []).map((b) => ({ ...b, ...opts })),
      ],
    });
  }, [id, label, hookName, actionId, keybinding, radiusPx, extras.actions, extras.bindings, extras.overlay, extras.onDeactivate]);
}

const TRIM_PREVIEW_ID = 'trim.preview';

/**
 * Trim tool. A click on a stroke removes its piece between the crossings on
 * either side — a declarative shell over the `trimPath` action, which owns
 * the hit-test and the commit. While it is up, the piece under the pointer is
 * drawn highlighted, through the same `planTrim` the click commits.
 */
export function useTrimTool(options: UseTrimToolOptions = {}): Tool {
  const extras = useMemo<StrokeClickExtras>(() => {
    const preview = createPiecePreview();
    const action: Action = {
      id: TRIM_PREVIEW_ID,
      label: 'Trim — show the piece under the pointer',
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
    { id: 'trim', label: 'Trim', hookName: 'useTrimTool', actionId: 'trimPath', keybinding: TRIM_KEY },
    options,
    extras,
  );
}

/**
 * Extend tool. A click near an open end of a stroke carries that end along
 * its tangent to the next stroke it meets — a declarative shell over the
 * `extendToMeet` action.
 */
export function useExtendTool(options: UseExtendToolOptions = {}): Tool {
  return useStrokeClickTool(
    { id: 'extend', label: 'Extend', hookName: 'useExtendTool', actionId: 'extendToMeet', keybinding: EXTEND_KEY },
    options,
  );
}
