import { type ActionsRegistry, useActionsRegistry } from '@weasel-js/core';
import { useCallback } from 'react';
import type { DrawScene } from './drawDocument';
import type { ActivePaint } from './newShapePaint';

/** A fill, a stroke, or both, for the selection to take. */
export type SelectionPaints = { fill?: ActivePaint; stroke?: ActivePaint };

/** Paints the selection with whichever of a fill and a stroke `next` names, as one undo entry named `label`. */
export type PaintSelection = (next: SelectionPaints, label: string) => void;

/** Paints the selection with each paint `next` names, through `setFill` and `setStroke`. */
export function paintSelectionThrough(actions: ActionsRegistry | null, next: SelectionPaints): void {
  if ('fill' in next) actions?.begin('setFill', { paint: next.fill ?? null })?.end('commit');
  if ('stroke' in next) actions?.begin('setStroke', { paint: next.stroke ?? null })?.end('commit');
}

/**
 * What a change to the active paints does to the selection, from a swatch button or a color key: each paint it
 * names goes through `setFill` or `setStroke`, together in one undo entry.
 */
export function usePaintSelection(scene: Pick<DrawScene, 'batch'>): PaintSelection {
  const actions = useActionsRegistry();
  return useCallback((next, label) => {
    scene.batch(label, () => paintSelectionThrough(actions, next));
  }, [actions, scene]);
}
