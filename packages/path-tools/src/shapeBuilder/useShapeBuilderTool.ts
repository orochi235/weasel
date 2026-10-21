import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { ToolKeybinding } from '@weasel-js/routing';
import { createPathOverlay, defineTool, PATHFINDER_STROKES, type BooleanStrokes, type Tool } from '@weasel-js/core';
import { icon } from '../icons.gen';
import type { ShapeBuilderMode } from './shapeBuilder';
import { createShapeBuilderActions } from './shapeBuilderActions';

/** Options for `useShapeBuilderTool`. */
export interface UseShapeBuilderToolOptions {
  /** Override the default keybinding (`{ key: 'M', shift: true }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** What a stroked path gives the faces. Default `'unfilled'`, as the
   *  Pathfinder actions: an unfilled stroke counts as the region it covers. */
  strokes?: BooleanStrokes;
  /** What a drag or a click does without Alt: unite the faces (`'merge'`, the
   *  default) or delete them. With Alt it does the other. Read on every gesture. */
  mode?: ShapeBuilderMode;
}

/**
 * Shape builder. With two or more paths selected, the faces their outlines cut
 * each other into are what the tool works on: the face under the pointer is
 * shown, a drag unites every face it passes through into one path wearing the
 * paint of the first, and an Alt-drag deletes them (the other way round under
 * `mode: 'delete'`). A click takes the one face. Every face not taken becomes a path of its own, and each gesture is
 * one undo step. With fewer than two selected, a drag marquee-selects.
 *
 * It reads the `booleansAdapter` dep the Pathfinder actions do.
 */
export function useShapeBuilderTool(options: UseShapeBuilderToolOptions = {}): Tool {
  const settingsRef = useLatest({ op: { strokes: options.strokes ?? PATHFINDER_STROKES }, mode: options.mode ?? 'merge' });
  const overlay = useMemo(() => createPathOverlay({ id: 'shape-builder-faces', label: 'Shape Builder — faces' }), []);
  const built = useMemo(
    () => createShapeBuilderActions(overlay, () => settingsRef.current),
    [overlay, settingsRef],
  );

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'shapeBuilder',
    capabilities: ['edits-page'],
    hookName: 'useShapeBuilderTool',
    cursor: 'crosshair',
    presentation: { label: 'Shape Builder', icon: icon('core:union'), group: 'shape' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'M', shift: true } }),
    actions: built.actions,
    overlay: overlay.layer,
    onDeactivate: built.reset,
    bindings: [
      { spec: { kind: 'hover', mods: { alt: 'optional' } }, actionId: 'shapeBuilder.hover', opts: { id: 'shapeBuilder.hover' } },
      { spec: { kind: 'hover', motion: 'leave', mods: { alt: 'optional' } }, actionId: 'shapeBuilder.leave', opts: { id: 'shapeBuilder.leave' } },
      { spec: { kind: 'click', mods: { alt: 'optional' } }, actionId: 'shapeBuilder.click', opts: { id: 'shapeBuilder.click' } },
      // Alt is read live, so it can be pressed or let go mid-drag.
      { spec: { kind: 'drag', mods: { alt: 'optional' } }, actionId: 'shapeBuilder', opts: { id: 'shapeBuilder.drag', yields: true } },
      { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: 'areaSelect', opts: { id: 'shapeBuilder.marquee' } },
    ],
  }), [built, overlay, keybinding]);
}
