import type { TokenHook } from '../hooks.ts';

/** Override hooks for the surfaces a frame, a bevel, and the canvas draw around their content. */
export const FRAME_HOOKS: readonly TokenHook[] = [
  {
    name: 'titlebar-surface',
    type: 'color',
    value: 'var(--_edge)',
    description:
      'Background of the strip a `titlebar` frame carries its title in: a color, a gradient, or stripes. Unset, the frame’s edge color. A frame that names a tint paints the tint instead.',
  },
  {
    name: 'titlebar-fg',
    type: 'color',
    value: 'var(--_edge-ink)',
    description: 'Text color on a `titlebar` frame’s strip. Unset, black or white, whichever reads on the edge color.',
  },
  {
    name: 'titlebar-align',
    type: 'string',
    value: 'start',
    description: 'Text alignment of a `titlebar` frame’s title along its strip.',
  },
  {
    name: 'titlebar-weight',
    type: 'fontWeight',
    value: 'var(--wzl-font-weight-bold)',
    description: 'Font weight of a `titlebar` frame’s title.',
  },
  {
    name: 'titlebar-label-surface',
    type: 'color',
    value: 'transparent',
    description: 'Background behind a `titlebar` frame’s title alone, for a strip drawn in stripes that must not run through the letters.',
  },
  {
    name: 'titlebar-label-pad',
    type: 'dimension',
    value: '0',
    description: 'Inline padding of the patch --wzl-titlebar-label-surface paints behind a `titlebar` frame’s title.',
  },
  {
    name: 'titlebar-border',
    type: 'border',
    value: '1px solid var(--_edge)',
    description: 'Border of a `titlebar` frame. A theme whose --wzl-bevel-raised draws the edge sets it to a border of no width.',
  },
  {
    name: 'titlebar-inset',
    type: 'dimension',
    value: '0',
    description: 'Padding between a `titlebar` frame’s edge and its strip and body: the width of the bevel a theme draws there.',
  },
  {
    name: 'bevel-raised',
    type: 'shadow',
    value: 'none',
    description:
      'Box shadow of a raised face: a Button, a PropertyPanel, a menu, popover, tooltip, or Dialog, a thumb, the chosen segment of a segmented control, a toolbar’s strip, and every edge of a tab but the one its panel is on. A theme that draws its edges in relief declares it; unset, each keeps the shadow it draws for itself, which for most is none.',
  },
  {
    name: 'bevel-pressed',
    type: 'shadow',
    value: 'none',
    description: 'Box shadow of a Button held down, or of a Button or a toolbar’s button that stays down. Unset, a Button draws its own inset (--btn-relief-pressed) and a toolbar’s button none.',
  },
  {
    name: 'bevel-sunken',
    type: 'shadow',
    value: 'none',
    description: 'Box shadow of a well: the frame a field draws its value in, a checkbox, a radio, the track of a switch, a slider, or a segmented control, and a cell of a flat one.',
  },
  {
    name: 'entered-group',
    type: 'color',
    value: '#a48bd4',
    description: 'Color of the dashed frame a canvas draws around the group it is working inside. Read off the canvas element, so it can be set on it or anything above it.',
  },
];
