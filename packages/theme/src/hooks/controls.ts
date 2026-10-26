import type { TokenHook } from '../hooks.ts';

/** Override hooks for buttons, fields, selects, swatches, disclosures, and trees. */
export const CONTROL_HOOKS: readonly TokenHook[] = [
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
    name: 'button-pad-x',
    type: 'dimension',
    value: 'var(--wzl-space-6)',
    description: 'Inline padding of a text Button below the container that sets it, at every size. Unset, `--wzl-space-4` at sm and `--wzl-space-6` at md. Icon-only buttons stay square.',
  },
  {
    name: 'button-font-weight',
    type: 'fontWeight',
    value: 'var(--wzl-font-weight-medium)',
    description: 'Font weight of a Button’s label below the container that sets it.',
  },
];
