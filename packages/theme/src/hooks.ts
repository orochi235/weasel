/**
 * Consumer override hooks: custom properties kit CSS reads with a fallback and
 * **no theme declares**. Setting one on any container resizes the components
 * below it; leaving it unset takes the fallback.
 *
 * They stay out of `tokens.css` on purpose. A `:root` declaration would win
 * over the in-CSS fallback, so the two would have to agree forever, and
 * `scripts/check-token-reads.ts` would stop enforcing that every read carries
 * one. This file is their declaration instead: `emitManifest` writes each as a
 * `TOKEN_MANIFEST` row with `hook: true`, which is what makes them findable
 * without reading kit stylesheets.
 *
 * Adding a hook means adding it here, and the checker reads this list.
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
];
