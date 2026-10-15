import { createElement, useMemo } from 'react';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type Tool } from '../../overlayBinding';
import { SliceIcon } from '../../../icons';

/** Options for `useTrimTool`. */
export interface UseTrimToolOptions {
  /** Override the default keybinding (`{ key: 'Y' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** How far from a stroke a click may land and still trim it, in screen
   *  pixels. Read on every click. Default 6. */
  radiusPx?: number | (() => number);
}

/**
 * Trim tool. A click on a stroke removes its piece between the crossings on
 * either side, through `trimPathAt` — the declarative shell over
 * `trimPathAction`, which owns the hit-test and the commit.
 */
export function useTrimTool(options: UseTrimToolOptions = {}): Tool {
  const { keybinding = { key: 'Y' }, radiusPx } = options;
  return useMemo(() => defineTool({
    id: 'trim',
    ...(keybinding ? { keybinding } : {}),
    capabilities: ['creates-shapes'],
    hookName: 'useTrimTool',
    cursor: 'crosshair',
    presentation: { label: 'Trim', group: 'path', icon: createElement(SliceIcon) },
    bindings: [{
      spec: { kind: 'click' },
      actionId: 'trimPath',
      ...(radiusPx !== undefined
        ? { opts: { params: () => ({ radiusPx: typeof radiusPx === 'function' ? radiusPx() : radiusPx }) } }
        : {}),
    }],
  }), [keybinding, radiusPx]);
}
