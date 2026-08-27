# schema-lab

Two labkit instruments whose control panels are generated from schemas over
weasel types, rather than from hand-written `ConfigField[]`.

```bash
npm run dev:schema -w @weasel-js/labkit
```

## ShapeProperties

`defaultNodeProperties` (`@weasel-js/core`) is weasel's published property
schema for its own node kinds — the one `<SelectionPanel>` reads. Its leaves are
dotted node paths (`pose.x`, `data.fill`) carrying a `ToolPref` descriptor:
kind, label, bounds, and an optional display unit.

`prefsToFields.ts` translates that into labkit's `ConfigField[]`
(number/slider/checkbox/select/text/color), and `applyConfig` writes each config
value back at the path its leaf names. No field is handled by name in either
direction, so the panel is whatever the schema says — including `pose.rotation`,
stored in radians and edited in degrees through the leaf's `unit`.

Some kinds have no labkit control to map onto. `paint` is a tagged `FillStyle`
union — a color swatch would write a solid over a gradient — so it is dropped
rather than approximated. `stroke` is `string | Stroke`, and the swatch here
edits only the string form; flattening the object form is exactly what
weasel-ui's own `stroke` control exists to avoid.

## Stroke

A schema written by hand from core's `Stroke` (`core/paint-types.ts`), written
straight onto `data.stroke` — which is `NodeStroke = string | Stroke`, so the
built-in `kit:path` painter draws every field the panel edits.

`dash` is a `number[]`, which no control kind covers — the panel offers named
presets instead. With `square` caps the caps close the gaps and every preset
renders solid, which is the renderer being correct, not the control failing.
