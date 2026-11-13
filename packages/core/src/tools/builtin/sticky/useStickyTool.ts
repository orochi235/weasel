import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import { STICKY_DEFAULTS, type StickyStyle } from './stickyNode';
import { styleOptionLeaves, toolOptionPaint } from '../shared/styleOptions';
import { shareToolOptions, withToolOptionDefault, type ToolOptions } from '@weasel-js/routing';
import { INSERT_DRAG_MODS } from 'interactions/actions/insert/action';

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
 * The note is minted by the `insert` dep's `sticky` kind, as a text node with
 * a `background` (see `stickyData`); the look rides on the bindings' params
 * as that insert's extras, and its paper and ink are the tool's options
 * (`background` and `fill` set their defaults). A consumer wanting its own node overrides the dep
 * (`insertNodeFactories.sticky`), not the tool.
 */
export function useStickyTool(options: UseStickyToolOptions = {}): Tool {
  const {
    behaviors, size = STICKY_DEFAULTS.size, minSize = STICKY_DEFAULTS.minSize,
    background, fill, padding, style, verticalAlign, overflow, edge, shadow, share,
  } = options;
  return useMemo(() => {
    const toolOptions = withToolOptionDefault(
      withToolOptionDefault(shareToolOptions(STICKY_TOOL_OPTIONS, share), 'paper', background && toolOptionPaint(background.paint)),
      'ink', fill && toolOptionPaint(fill.paint),
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
        icon: icon('sticky'),
        group: 'type',
      },
      bindings: [
        { spec: { kind: 'drag', mods: INSERT_DRAG_MODS }, actionId: 'insert', opts: { id: 'sticky.drag', params: look, ...insertBindingBehaviors(behaviors) } },
        { spec: { kind: 'click' }, actionId: 'place', opts: { id: 'sticky.click', params: { ...look, size } } },
        { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit', opts: { id: 'sticky.editText' } },
        INSERT_REPOSITION_BINDING,
      ],
    });
  }, [behaviors, size, minSize, background, fill, padding, style, verticalAlign, overflow, edge, shadow, share]);
}
