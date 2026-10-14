import { createElement, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type Tool } from '../../overlayBinding';
import { createPathOverlay } from 'canvas/pathOverlay';
import { UnionIcon } from 'interactions/actions/defaults/icons/booleanIcons';
import { PATHFINDER_STROKES } from 'interactions/actions/booleans/action';
import type { BooleanStrokes } from 'interactions/actions/booleans/operands';
import { createShapeBuilderActions } from './shapeBuilderActions';

/** Options for `useShapeBuilderTool`. */
export interface UseShapeBuilderToolOptions {
  /** Override the default keybinding (`{ key: 'M', shift: true }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** What a stroked path gives the faces. Default `'unfilled'`, as the
   *  Pathfinder actions: an unfilled stroke counts as the region it covers. */
  strokes?: BooleanStrokes;
}

/**
 * Shape builder. With two or more paths selected, the faces their outlines cut
 * each other into are what the tool works on: the face under the pointer is
 * shown, a drag unites every face it passes through into one path wearing the
 * paint of the first, and an Alt-drag deletes them. A click takes the one
 * face. Every face not taken becomes a path of its own, and each gesture is
 * one undo step. With fewer than two selected, a drag marquee-selects.
 *
 * It reads the `booleansAdapter` dep the Pathfinder actions do.
 */
export function useShapeBuilderTool(options: UseShapeBuilderToolOptions = {}): Tool {
  const strokesRef = useLatest(options.strokes ?? PATHFINDER_STROKES);
  const overlay = useMemo(() => createPathOverlay({ id: 'shape-builder-faces', label: 'Shape Builder — faces' }), []);
  const built = useMemo(
    () => createShapeBuilderActions(overlay, () => ({ strokes: strokesRef.current })),
    [overlay, strokesRef],
  );

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'shapeBuilder',
    capabilities: ['edits-page'],
    hookName: 'useShapeBuilderTool',
    cursor: 'crosshair',
    presentation: { label: 'Shape Builder', icon: createElement(UnionIcon), group: 'shape' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'M', shift: true } }),
    actions: built.actions,
    overlay: overlay.layer,
    onDeactivate: built.reset,
    bindings: [
      { spec: { kind: 'hover', mods: { alt: 'optional' } }, actionId: 'shapeBuilder.hover' },
      { spec: { kind: 'hover', motion: 'leave', mods: { alt: 'optional' } }, actionId: 'shapeBuilder.leave' },
      { spec: { kind: 'click', mods: { alt: 'optional' } }, actionId: 'shapeBuilder.click' },
      // Alt is read live, so it can be pressed or let go mid-drag.
      { spec: { kind: 'drag', mods: { alt: 'optional' } }, actionId: 'shapeBuilder', opts: { yields: true } },
      { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: 'areaSelect' },
    ],
  }), [built, overlay, keybinding]);
}
