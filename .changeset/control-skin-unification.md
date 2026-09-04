---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

One skin for the kit's sliders and fields.

`@weasel-js/ui` carried six slider treatments, three of which rendered the same
bare `<input type="range">` with independently hand-authored pseudo-element rules.
A new shared `range.module.css` is now the single source for that chrome, imported
by `InlineRange` and by the property rows; a bare range inside a labkit `.lk-root`
wears it too. New tokens carry the geometry: `--wzl-slider-track-h`,
`--wzl-slider-thumb-size`, `--wzl-slider-track-tint`, `--wzl-slider-thumb-tint`.

`Slider` — the multi-thumb canvas widget — keeps its own 24px chrome, since a
gradient track needs a grabbable thumb, but gains `density="slim"` which drives its
track and thumb from those tokens. `ZoomControl` uses it, so a lab's zoom no longer
looks like a different design system from the panel beside it.

`NumberField` gains `ghost`: transparent until focused, the readout treatment the
property rows already had. `hideSteppers` alone still painted the full sunken box,
which is why `ZoomControl`'s readout could not match a property row.

Boxed fields size from `var(--wzl-field-h, var(--wzl-control-h))` and pad from
`--wzl-field-pad-x`. Set `--wzl-field-h` on a container to change a whole panel's
density; `PropertyList` sets its own, so property rows keep their 20px. The
fallback form is deliberate — it resolves per element, so a toolbar's redeclared
`--wzl-control-h` still reaches its fields. `--wzl-prop-field-height` is retired;
nothing ever set it.

`NumberRow` gains a `unit` suffix, matching `SliderRow`, and right-aligns its value
so a column of numbers shares a decimal position. labkit's `ControlPanel` passes a
leaf's `unit` through to both rows when it is a string.

Behaviour changes worth knowing:

- `InlineRange`'s thumb is 8px and translucent rather than 12px and solid.
- Every boxed field focuses with the 1px ring the React Aria fields already used,
  replacing the property rows' bare outline; the colour chip gains a focus ring it
  never had, and the property-row select moves from `--wzl-accent` to
  `--wzl-focus-ring`.
- A `PropertyRow` rendered outside a `PropertyList` no longer picks up the dense
  20px — density belongs to the container now. Every panel composes the list, so
  this shows only in isolated stories.
- labkit's mark-title field renders with `Input` instead of a bare `<input>`, so it
  no longer shows user-agent chrome. Its `onChange` now receives the string value.

Removes `--wzl-track-bg`, `--wzl-track-border`, `--wzl-thumb-fill`,
`--wzl-thumb-border` and `--wzl-thumb-text`, which nothing read.

A note on `unit` in a config leaf: `ToolPrefNumber` already uses that key for a
conversion descriptor (`{ toDisplay, fromDisplay, suffix }`). `ControlPanel` honours
a `unit` only when it is a string and ignores the descriptor, rather than printing
its `suffix` beside an unconverted value. No builder method sets a string unit yet,
so the key is reachable only from a hand-written leaf.
