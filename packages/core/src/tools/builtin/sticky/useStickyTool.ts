import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import { STICKY_DEFAULTS, type StickyStyle } from './stickyNode';

/** Options for `useStickyTool`: the look of the notes it makes, and the
 *  insert behaviors every drag-to-insert tool takes. Keep object options
 *  stable across renders: a new one rebuilds the tool. */
export interface UseStickyToolOptions extends InsertToolOptions, StickyStyle {}

/**
 * Sticky-note tool. A drag draws a note through `insertAction`, a click
 * places one of `size` through `placeAction`, and either drops into the new
 * note's caret. A click on a selected note edits it.
 *
 * The note is minted by the `insert` dep's `sticky` kind, as a text node with
 * a `background` (see `stickyData`); the look rides on the bindings' params
 * as that insert's extras. A consumer wanting its own node overrides the dep
 * (`insertNodeFactories.sticky`), not the tool.
 */
export function useStickyTool(options: UseStickyToolOptions = {}): Tool {
  const { behaviors, size = STICKY_DEFAULTS.size, background, fill, padding, style, verticalAlign } = options;
  return useMemo(() => {
    const look = {
      kind: 'sticky',
      ...(background !== undefined ? { background } : {}),
      ...(fill !== undefined ? { fill } : {}),
      ...(padding !== undefined ? { padding } : {}),
      ...(style !== undefined ? { style } : {}),
      ...(verticalAlign !== undefined ? { verticalAlign } : {}),
    };
    return defineTool({
      id: 'sticky',
      keybinding: { key: 'S' },
      capabilities: ['creates-text'],
      hookName: 'useStickyTool',
      cursor: cursorFor('crosshairRect', { fallback: 'crosshair' }),
      presentation: {
        label: 'Sticky note',
        icon: icon('sticky'),
        group: 'type',
      },
      bindings: [
        { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: look, ...insertBindingBehaviors(behaviors) } },
        { spec: { kind: 'click' }, actionId: 'place', opts: { params: { ...look, size } } },
        { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit' },
        INSERT_REPOSITION_BINDING,
      ],
    });
  }, [behaviors, size, background, fill, padding, style, verticalAlign]);
}
