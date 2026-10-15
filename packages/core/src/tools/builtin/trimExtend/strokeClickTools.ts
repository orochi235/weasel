import { createElement, useMemo } from 'react';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type Tool } from '../../overlayBinding';
import { SliceIcon } from '../../../icons';

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

/** A tool whose one binding hands a click, and `radiusPx`, to `actionId`. */
function useStrokeClickTool(
  spec: { id: string; label: string; hookName: string; actionId: string; keybinding: ToolKeybinding },
  options: StrokeClickToolOptions,
): Tool {
  const { keybinding = spec.keybinding, radiusPx } = options;
  const { id, label, hookName, actionId } = spec;
  return useMemo(() => defineTool({
    id,
    ...(keybinding ? { keybinding } : {}),
    capabilities: ['creates-shapes'],
    hookName,
    cursor: 'crosshair',
    presentation: { label, group: 'path', icon: createElement(SliceIcon) },
    bindings: [{
      spec: { kind: 'click' },
      actionId,
      ...(radiusPx !== undefined
        ? { opts: { params: () => ({ radiusPx: typeof radiusPx === 'function' ? radiusPx() : radiusPx }) } }
        : {}),
    }],
  }), [id, label, hookName, actionId, keybinding, radiusPx]);
}

/**
 * Trim tool. A click on a stroke removes its piece between the crossings on
 * either side — a declarative shell over the `trimPath` action, which owns
 * the hit-test and the commit.
 */
export function useTrimTool(options: UseTrimToolOptions = {}): Tool {
  return useStrokeClickTool(
    { id: 'trim', label: 'Trim', hookName: 'useTrimTool', actionId: 'trimPath', keybinding: TRIM_KEY },
    options,
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
