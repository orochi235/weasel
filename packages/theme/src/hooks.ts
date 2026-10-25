/**
 * Consumer override hooks: custom properties kit CSS reads with a fallback and
 * **the built-in theme does not declare**. Setting one on any container
 * restyles the components below it; leaving it unset takes the fallback. A
 * theme built with `defineTheme` may pin one, and a container below it still
 * overrides the pin.
 *
 * They stay out of `tokens.css` on purpose: a `:root` declaration would win
 * over the in-CSS fallback, so the two would have to agree forever. Adding a
 * hook means adding it here; `scripts/check-token-reads.ts` reads this list.
 */

/** One override hook, as the manifest describes it. */
export interface TokenHook {
  /** Without the `--wzl-` prefix, matching a token's name in a definition. */
  readonly name: string;
  /** DTCG type. */
  readonly type: string;
  /** The fallback every read of it carries — the value in force when nothing
   *  sets it. */
  readonly value: string;
  readonly description: string;
}

export const TOKEN_HOOKS: readonly TokenHook[] = [
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
    name: 'field-border',
    type: 'border',
    value: '1px solid var(--wzl-border)',
    description: 'Border of a field’s frame. A theme whose --wzl-bevel-sunken draws the edge sets it to a border of no width.',
  },
  {
    name: 'field-focus-shadow',
    type: 'shadow',
    value: '0 0 0 1px var(--wzl-focus-ring)',
    description: 'Box shadow of a field’s frame while it holds focus. It replaces --wzl-bevel-sunken there, so a beveled theme restates the bevel in it.',
  },
  {
    name: 'button-icon-size',
    type: 'dimension',
    value: '14px',
    description: 'The glyph in a Button. Unset, 12px in a small one and 14px otherwise.',
  },
  {
    name: 'button-radius',
    type: 'dimension',
    value: 'calc(var(--btn-height) * 0.1)',
    description: 'Corner radius of a Button. Unset, a tenth of its height.',
  },
  {
    name: 'button-surface',
    type: 'color',
    value: 'var(--btn-glass)',
    description: 'Background of a solid Button. Unset, neutral glass mixed from the surfaces.',
  },
  {
    name: 'button-pressed-surface',
    type: 'color',
    value: 'var(--btn-glass-pressed)',
    description: 'Background of a solid Button while it is held down.',
  },
  {
    name: 'button-confirm-surface',
    type: 'color',
    value: 'var(--btn-glass)',
    description: 'Background of a confirm Button. Unset, glass tinted with --wzl-accent.',
  },
  {
    name: 'button-confirm-pressed-surface',
    type: 'color',
    value: 'var(--btn-glass-pressed)',
    description: 'Background of a confirm Button while it is held down.',
  },
  {
    name: 'button-confirm-fg',
    type: 'color',
    value: 'var(--wzl-fg-on-accent)',
    description: 'Text color of a confirm Button, for a theme whose --wzl-button-confirm-surface is not an accent fill.',
  },
  {
    name: 'button-confirm-bevel',
    type: 'shadow',
    value: 'var(--wzl-bevel-raised)',
    description: 'Box shadow of a confirm Button, where it differs from --wzl-bevel-raised: the heavier frame of a default button.',
  },
  {
    name: 'button-gloss',
    type: 'number',
    value: '1',
    description: 'Opacity of the specular sheen over a Button’s upper half. 0 for a flat face.',
  },
  {
    name: 'button-text-shadow',
    type: 'shadow',
    value: 'var(--btn-engraving)',
    description: 'Text shadow of a Button’s label. Unset, an engraving stamp under the glyphs in dark mode.',
  },
  {
    name: 'detail-figure-min-width',
    type: 'dimension',
    value: '8ch',
    description: 'Least width of a value cell in a `values="figures"` DetailList.',
  },
  {
    name: 'disclosure-gap',
    type: 'dimension',
    value: '4px',
    description: 'Gap between a Disclosure’s twisty and its label.',
  },
  {
    name: 'disclosure-fill',
    type: 'color',
    value: 'var(--wzl-accent-fg)',
    description: 'Fill of a Disclosure’s fold mark.',
  },
  {
    name: 'disclosure-target',
    type: 'dimension',
    value: '20px',
    description: 'Hit-target square of a Disclosure twisty, and the twisty column of a LayerList row.',
  },
  {
    name: 'input-surface',
    type: 'color',
    value: 'var(--wzl-surface-sunken)',
    description:
      'Surface a field’s frame sits on — Input, NumberField, ComboBox, Select, MenuButton, ListEditor and the property rows. Set it on any container whose own background is the default — a sunken rail or panel — where an unset field is the same color as what is behind it.',
  },
  {
    name: 'number-field-width',
    type: 'dimension',
    value: '9ch',
    description: 'Width of a NumberField’s input.',
  },
  {
    name: 'field-font-size',
    type: 'dimension',
    value: 'var(--wzl-font-size)',
    description:
      'Font size of the text in a field, a select, a radio, a segmented bar or a button. Unset, each takes its own size; a params row sets it to --wzl-params-text-size.',
  },
  {
    name: 'params-label-align',
    type: 'string',
    value: 'start',
    description: 'Text alignment of row labels in PropertyPanel, Prefs and labkit’s ControlPanel.',
  },
  {
    name: 'params-label-case',
    type: 'string',
    value: 'uppercase',
    description: 'text-transform of every label and title in PropertyPanel, Prefs and labkit’s ControlPanel.',
  },
  {
    name: 'params-label-tracking',
    type: 'dimension',
    value: 'var(--wzl-tracking-wide)',
    description:
      'Letter spacing of every label and title in PropertyPanel, Prefs and labkit’s ControlPanel. Unset, rows take --wzl-tracking-wide and titles --wzl-tracking-wider.',
  },
  {
    name: 'params-label-width',
    type: 'dimension',
    value: 'auto',
    description: 'Inline size of row labels in PropertyPanel, Prefs and labkit’s ControlPanel.',
  },
  {
    name: 'params-text-size',
    type: 'dimension',
    value: 'var(--wzl-font-size-sm)',
    description:
      'Font size of a row’s label and of its value, one size for both, in PropertyPanel, Prefs, SelectionPanel and labkit’s ControlPanel.',
  },
  {
    name: 'prefs-rail-width',
    type: 'dimension',
    value: '216px',
    description: 'Width of the Prefs navigation rail.',
  },
  {
    name: 'prefs-column-width',
    type: 'dimension',
    value: '300px',
    description: 'Width of the Prefs category column.',
  },
  {
    name: 'prop-columns',
    type: 'string',
    value: '1fr 1fr',
    description:
      'Column tracks of a Properties list, group body, and subpanel. A container too narrow for two columns sets `minmax(0, 1fr)` to stack every row.',
  },
  {
    name: 'prop-number-width',
    type: 'dimension',
    value: '9ch',
    description: 'Width of a numeric field in the Properties panel.',
  },
  {
    name: 'prop-row-h',
    type: 'dimension',
    value: '20px',
    description:
      'Floor under every Properties row, whatever control it holds. Unset, it is the panel’s own field height, so it follows density — 20px at the default one.',
  },
  {
    name: 'prop-text-width',
    type: 'dimension',
    value: '16ch',
    description: 'Width of a text field in the Properties panel.',
  },
  {
    name: 'property-readout-w',
    type: 'dimension',
    value: 'calc(4.5ch + 2px)',
    description: 'Width of a Properties row’s value readout — four digits, so the controls beside a column of readouts end on one line. A range whose widest value needs more widens its own readout.',
  },
  {
    name: 'select-border',
    type: 'border',
    value: '1px solid var(--wzl-border)',
    description:
      'Border of a Select’s trigger. Unset, a boxed trigger draws --wzl-border and a bare one a transparent border of the same width.',
  },
  {
    name: 'select-fg',
    type: 'color',
    value: 'var(--wzl-fg)',
    description: 'Text color of a Select’s trigger.',
  },
  {
    name: 'swatch-size',
    type: 'dimension',
    value: '28px',
    description: 'Minimum cell of a swatch grid — PatternPicker, and any panel laying swatches out the same way.',
  },
  {
    name: 'timeline-label-w',
    type: 'dimension',
    value: '120px',
    description: 'Width of the Timeline’s track-label gutter.',
  },
  {
    name: 'timeline-value-axis-w',
    type: 'dimension',
    value: '32px',
    description: 'Width reserved for the Timeline’s value axis.',
  },
  {
    name: 'tree-indent',
    type: 'dimension',
    value: 'calc(var(--wzl-control-h-xs) + var(--wzl-space-2))',
    description: 'Indent of each Tree level. Unset, it is one twisty and one gap, so a child’s twisty sits under its parent’s label.',
  },
  {
    name: 'tree-font-size',
    type: 'dimension',
    value: 'var(--wzl-font-size-sm)',
    description: 'Size of a Tree row’s text.',
  },
  {
    name: 'tree-fold-size',
    type: 'dimension',
    value: '16px',
    description: 'Size of the leading glyph a Tree folds a branch by, where its branches fold by their glyphs.',
  },
  {
    name: 'tree-guide',
    type: 'color',
    value: 'var(--wzl-fg-subtle)',
    description: 'Color of the bracket a Tree draws down a branch.',
  },
  {
    name: 'tree-selected',
    type: 'color',
    value: 'var(--wzl-border)',
    description: 'Background of a selected Tree row.',
  },
  {
    name: 'tree-leaf-indent',
    type: 'dimension',
    value: '0',
    description: 'How far in from its branches\' glyphs a Tree with guides sets a row that folds nothing.',
  },
  {
    name: 'dialog-max-width',
    type: 'dimension',
    value: '900px',
    description: 'Widest a Dialog grows, modal or inline, before its contents wrap or scroll.',
  },
  {
    name: 'prefs-across-gap',
    type: 'dimension',
    value: '28px',
    description: 'Gap between the two columns of rows a PrefsForm pane sets side by side.',
  },
  {
    name: 'prefs-control-min',
    type: 'dimension',
    value: '80px',
    description: 'Narrowest a PrefsForm row’s control gets in a two-across pane before the row wraps it under its label.',
  },
  {
    name: 'prop-panel-actions-basis',
    type: 'dimension',
    value: 'auto',
    description: 'Width a PropertyPanel’s title row gives its actions. Set, it holds that width whatever the actions are.',
  },
  {
    name: 'prop-panel-actions-align',
    type: 'string',
    value: 'center',
    description: 'How a PropertyPanel’s title row lines its actions up with the title: center, or baseline for actions that are text.',
  },
  {
    name: 'entered-group',
    type: 'color',
    value: '#a48bd4',
    description: 'Color of the dashed frame a canvas draws around the group it is working inside. Read off the canvas element, so it can be set on it or anything above it.',
  },  {
    name: 'tree-row-h',
    type: 'dimension',
    value: 'var(--wzl-control-h)',
    description: 'Height of every row in a Tree below the container that sets it, and of its drag ghost. Unset, the control height.',
  },
  {
    name: 'tree-current',
    type: 'color',
    value: 'var(--wzl-accent-fg)',
    description: 'Text color of the Tree row marked `current`, the page or item being shown.',
  },
];
