import { useMemo } from 'react';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type Tool } from '@weasel-js/core';
import { icon } from '../icons.gen';

/** Options for `useSmudgeBrushTool`. */
export interface UseSmudgeBrushToolOptions {
  /** Override the default keybinding (`{ key: 'S' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
}

const SMUDGE_KEY: ToolKeybinding = { key: 'S' };

/**
 * Smudge brush tool. A round brush that pushes the outline of the selected
 * paths, or of every path while none is selected, along with the pointer — a declarative shell whose one binding routes a
 * drag to the `smudgeBrush` action, which owns the stroke, its preview, its ring
 * cursor, and its one undo entry. The brush's radius (screen px) and strength are
 * that action's params: `tune={{ smudgeBrush: { params: () => ({ radiusPx, strength }) } }}`.
 */
export function useSmudgeBrushTool(options: UseSmudgeBrushToolOptions = {}): Tool {
  const { keybinding = SMUDGE_KEY } = options;
  return useMemo(() => defineTool({
    id: 'smudgeBrush',
    ...(keybinding ? { keybinding } : {}),
    capabilities: ['creates-shapes'],
    hookName: 'useSmudgeBrushTool',
    cursor: 'crosshair',
    presentation: { label: 'Smudge brush', group: 'path', icon: icon('smudgeBrush') },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'smudgeBrush', opts: { id: 'smudgeBrush.drag' } }],
  }), [keybinding]);
}
