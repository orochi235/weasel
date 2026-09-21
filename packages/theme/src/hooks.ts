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
    name: 'disclosure-gap',
    type: 'dimension',
    value: '4px',
    description: 'Gap between a Disclosure’s twisty and its label.',
  },
  {
    name: 'disclosure-target',
    type: 'dimension',
    value: '20px',
    description: 'Hit-target square of a Disclosure twisty, and of a labkit LayerList row’s.',
  },
  {
    name: 'number-field-width',
    type: 'dimension',
    value: '9ch',
    description: 'Width of a NumberField’s input.',
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
    value: '2.8em',
    description: 'Minimum width of a Properties row’s value readout.',
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
];
