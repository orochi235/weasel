# schema-lab

Two labkit instruments whose control panels are generated from schemas over
weasel types.

```bash
npm run dev:schema -w @weasel-js/labkit
```

## ShapeProperties

`defaultNodeProperties` (`@weasel-js/core`) is weasel's published property
schema for its own node kinds — the one `<SelectionPanel>` reads. Its leaves are
dotted node paths (`pose.x`, `data.fill`) carrying a `BuiltinPref` descriptor:
kind, label, bounds, and an optional display unit.

`f.prefs` (`@weasel-js/labkit`) takes that schema as the instrument's
`config`: each leaf sits at the node path its key names, and the panel draws it
as `PrefsForm` would, through `prefFieldProps`. `applyConfig` writes each
config value back at that path. No field is handled by name in either
direction, so the panel is whatever the schema says — including
`pose.rotation`, stored in radians and edited in degrees through the leaf's
`unit`, and a dash style stored as the lengths its `encoding` writes.

An `object` leaf — `data.stroke`, whose value is a whole `Stroke` — is one
value in the config and opens in a dialog. Its `paint` field has no labkit
control: the row says so rather than approximating a `Paint` union with a color
swatch, which would write a solid over a gradient.

## Stroke

A schema written by hand from core's `Stroke` (`core/paint-types.ts`), written
straight onto `data.stroke` — which is a whole `Stroke`, so the built-in
`kit:path` painter draws every field the panel edits.

`dash` is a `number[]`, which no control kind covers — the panel offers named
presets instead. With `square` caps the caps close the gaps and every preset
renders solid, which is the renderer being correct, not the control failing.
