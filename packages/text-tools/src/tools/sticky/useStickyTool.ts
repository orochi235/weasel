import { useMemo } from 'react';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../icons.gen';
import { STICKY_DEFAULTS, type StickyStyle } from './stickyNode';
import { shareToolOptions, withToolOptionDefault, type ToolOptions } from '@weasel-js/routing';
import type { Paint } from '@weasel-js/paint';
import { defineTool, INSERT_DRAG_MODS, INSERT_REPOSITION_BINDING, insertBindingBehaviors, styleOptionLeaves, toolOptionPaint, type InsertToolOptions, type Tool } from '@weasel-js/core';

/** Options for `useStickyTool`: the look of the notes it makes, and the
 *  insert behaviors every drag-to-insert tool takes. Keep object options
 *  stable across renders: a new one rebuilds the tool. */
export interface UseStickyToolOptions extends InsertToolOptions, StickyStyle {}

/** The sticky tool's options: the note's paper and its ink, its own rather than shared with the shape tools.
 *  Both inserts read them, the drag's and the click's. */
export const STICKY_TOOL_OPTIONS: ToolOptions = {
  actionId: ['insert', 'place'],
  prefs: {
    name: 'Sticky note',
    as: 'bar',
    children: {
      paper: { ...styleOptionLeaves({ fill: STICKY_DEFAULTS.background.paint }, ['fill']).fill!, name: 'Paper', description: 'What a new note is painted on.' },
      ink: { ...styleOptionLeaves({ fill: STICKY_DEFAULTS.fill.paint }, ['fill']).fill!, name: 'Ink', description: 'What a new note’s text is set in.' },
    },
  },
};

/**
 * Sticky-note tool. A drag draws a note through `insertAction`, a click
 * places one of `size` through `placeAction`, and either drops into the new
 * note's caret. Neither makes a note smaller than `minSize`, and the note
 * keeps it as the floor a resize stops at. A click on a selected note edits it.
 *
 * The note is minted by the `insert` dep's `sticky` kind (`textPreset`'s
 * `stickyNodeFactory`), as a text node with a `background` (see `stickyData`); the look rides on the bindings' params
 * as that insert's extras, and its paper and ink are the tool's options
 * (`background` and `fill` set their defaults). A consumer wanting its own node overrides the dep
 * (`insertNodeFactories.sticky`), not the tool.
 */
export function createStickyTool(options: UseStickyToolOptions = {}): Tool {
  const {
    behaviors, size = STICKY_DEFAULTS.size, minSize = STICKY_DEFAULTS.minSize,
    background, fill, padding, style, verticalAlign, overflow, edge, shadow, share,
  } = options;
  {
    const color = (paint: Paint | null | undefined) => (paint === undefined ? undefined : toolOptionPaint(paint));
    const toolOptions = withToolOptionDefault(
      withToolOptionDefault(shareToolOptions(STICKY_TOOL_OPTIONS, share), 'paper', color(background?.paint)),
      'ink', color(fill?.paint),
    );
    // `minSize` rides on both inserts: the drag grows to it, and the note
    // keeps it as its own minimum.
    const look = {
      kind: 'sticky',
      minSize,
      ...(padding !== undefined ? { padding } : {}),
      ...(style !== undefined ? { style } : {}),
      ...(verticalAlign !== undefined ? { verticalAlign } : {}),
      ...(overflow !== undefined ? { overflow } : {}),
      ...(edge !== undefined ? { edge } : {}),
      ...(shadow !== undefined ? { shadow } : {}),
    };
    return defineTool({
      id: 'sticky',
      keybinding: { key: 'S' },
      capabilities: ['creates-text'],
      hookName: 'useStickyTool',
      options: toolOptions,
      cursor: cursorFor('crosshair', { mark: 'rect', fallback: 'crosshair' }),
      presentation: {
        label: 'Sticky note',
        icon: icon('core:sticky'),
        group: 'type',
      },
      bindings: [
        { spec: { kind: 'drag', mods: INSERT_DRAG_MODS }, actionId: 'insert', opts: { id: 'sticky.drag', params: look, ...insertBindingBehaviors(behaviors) } },
        { spec: { kind: 'click' }, actionId: 'place', opts: { id: 'sticky.click', params: { ...look, size } } },
        { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit', opts: { id: 'sticky.editText' } },
        INSERT_REPOSITION_BINDING,
      ],
    });
  }
}

/** {@link createStickyTool}, rebuilt only when an option changes. */
export function useStickyTool(options: UseStickyToolOptions = {}): Tool {
  const {
    behaviors, size, minSize, background, fill, padding, style, verticalAlign, overflow, edge, shadow, share,
  } = options;
  return useMemo(
    () => createStickyTool({ behaviors, size, minSize, background, fill, padding, style, verticalAlign, overflow, edge, shadow, share }),
    [behaviors, size, minSize, background, fill, padding, style, verticalAlign, overflow, edge, shadow, share],
  );
}
