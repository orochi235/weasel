import { useMemo } from 'react';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type Tool, type ToolOptions } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { SMUDGE_BRUSH_PARAMS } from './smudgeBrush';

/** The Smudge brush's size and strength: the `smudgeBrush` action's params, the same form its last-operation
 *  panel shows. */
export const SMUDGE_BRUSH_OPTIONS = {
  actionId: 'smudgeBrush',
  prefs: SMUDGE_BRUSH_PARAMS,
  size: { option: 'radiusPx', times: 1.25 },
  strength: { option: 'strength', plus: 0.1 },
} satisfies ToolOptions;

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
 * its options ({@link SMUDGE_BRUSH_OPTIONS}): `[` and `]` resize it, `Shift+[` and
 * `Shift+]` weaken and strengthen it, and a host keeps their values in the
 * `toolOptionValues` dep.
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
    options: SMUDGE_BRUSH_OPTIONS,
  }), [keybinding]);
}
