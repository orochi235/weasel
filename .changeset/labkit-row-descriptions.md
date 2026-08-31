---
'@weasel-js/labkit': patch
---

Show a config leaf's description as a tooltip on its control row

A schema leaf could carry `describe('…')` text, but nothing in labkit rendered
it: `ControlPanel` read only the leaf's name, so the help a lab wrote never
reached the person using the lab. Every described leaf now gets an ⓘ beside its
label, and hovering or keyboard-focusing it shows the description in a tooltip.
Leaves with no description stay bare.

`PropertyRow` takes the same text directly as `description`, as do the typed
rows built on it (`SliderRow`, `NumberRow`, `CheckboxRow`, `TextRow`,
`SelectRow`, `ToggleRow`, `ColorRow`), so a hand-built panel gets the same
affordance without going through a schema.
