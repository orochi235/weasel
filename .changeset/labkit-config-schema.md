---
'@weasel-js/labkit': patch
---

Declare an instrument's config once, with `f.schema`

An instrument used to declare its config twice: `defaultConfig(): TC` for the
values and their types, and `configSchema(): ConfigField[]` repeating every key
as a control with a label, bounds and a second default. Nothing held the two to
one answer, and `validateConfigSchema` could not catch the drift because it only
ever saw the schema.

`f.schema` replaces both. It infers `TC`, supplies the defaults, and says how
each value is edited:

```ts
const config = f.schema({
  showGrid: f.boolean(true),
  cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
})

defineInstrument({ config, ... })   // defaultConfig is synthesized
type Config = ConfigOf<typeof config>
```

This is additive. An instrument written with `defaultConfig` + `configSchema`
keeps working, and both paths now resolve to one renderer.

**Built on weasel-ui's `PrefLeaf`, not on `ConfigField`.** That vocabulary — the
one `PrefsForm` renders, and the one core's structurally-identical `ToolPrefLeaf`
feeds `SelectionPanel` — already carried kinds, bounds, options, labels, groups
and an open leaf kind. `ConfigField` was a third dialect of it, so it is now
adapted into `PrefLeaf` rather than extended.

Four ways in, for a lab that needs something the built-in controls do not give:

- `ControlPanel` takes `renderers`, keyed by config path (checked first) or leaf
  kind, matching `PrefsForm.renderers` and `SelectionPanel.renderers`. A path key
  overrides one field; a kind key supplies a control labkit does not ship.
- `.render()` on a builder node is the colocated form of the same thing.
- `<Lab configRules>` runs rules over every leaf before labkit's own inference,
  so a lab states a convention once instead of annotating each field. labkit's
  own inference ships as rules in that same vocabulary.
- `.showIf()` hides a row while the value stays in config, and `.section()`
  groups rows under a heading.

`validateConfigSchema` no longer rejects an unrecognized field type: a lab
supplies controls for its own kinds through `renderers`, which validation cannot
see. Key, label and per-kind constraint checks are unchanged. Relatedly,
`ControlPanel` now renders a labeled placeholder for a kind with no control
instead of dropping the row silently.
