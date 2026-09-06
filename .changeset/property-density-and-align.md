---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Property panels take `density` and `align`, and `layout` reaches every row kind.

Three things a consumer could not do from outside `Properties.module.css`.

**Spacing was four hard-coded numbers** — the list's row gap, the group's
padding, the group title's margin, the panel's padding — none of which read a
custom property. Every metric in the family now does: `--wzl-prop-row-gap`,
`--wzl-prop-column-gap`, `--wzl-prop-panel-pad`, `--wzl-prop-panel-title-gap`,
`--wzl-prop-group-pad`, `--wzl-prop-group-title-gap`,
`--wzl-prop-subpanel-row-gap`, `--wzl-prop-field-h`, `--wzl-prop-field-pad-x`.
A `density` of `'tight' | 'normal' | 'roomy'` on `PropertyPanel`,
`PropertyList`, `PropertyGroup`, `Subpanel` or `PropertyRow` sets them as a
bundle. Both props inherit, so the nearest container that states one wins and an
inner group can differ from the panel around it.

**A color row centered its label and swatch and could not be told otherwise**,
so a palette panel — a column of swatches read as a group — had no way to line
them up. `align` takes `'start' | 'center' | 'end' | 'baseline'`; `baseline`
sits each swatch on its label's first-line baseline, which holds when labels
wrap to different heights. Left unset, a color row keeps sinking its content to
the row's bottom edge, so an alpha track stays level with the taller row beside
it.

**`ColorRow` and `CheckboxRow` took no `layout`.** `PropertyRow` gated the
inline class on the default variant, so a panel asking for one orientation got
another for two row kinds out of six. `layout` is now unset by default and each
variant supplies its own — `block` for the default variant, `inline` for color
and checkbox — so passing it through a whole panel is safe, and `block` on a
color or checkbox row stacks it. `ControlPanel` forwards `layout` to those two
rows, and takes `density` and `align` of its own.

`PropertyList` and `PropertyGroup` also take `pack="one-up"`, which gives every
row the full width, color rows included. `'auto-color'` pairs them two per row
and there was no way to opt out — which is the packing a palette needs.

Nothing changes for a consumer that passes none of these.
