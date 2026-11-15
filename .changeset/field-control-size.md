---
'@weasel-js/ui': minor
---

Text, select and numeric fields take `size` and follow `ControlSizeScope`, so buttons and fields of one size stand at one height.

`Input`, `TextArea`, `Select`, `NumberField` and `UnitField` take `size="sm" | "md"`.

A field's height comes from its own `size`, else the nearest `ControlSizeScope` (which a container's `size` sets, as on `Bar`), else the height its container gives fields, else `control-h`. An unsized field outside every scope looks as before. A field inside a container given a `size` now takes that size: a select inside `<Bar size="md">` stands at the bar's buttons' height rather than at `control-h-sm`. A `TextArea` keeps its `rows` height and takes only the type size.

```tsx
<Bar label="Tools" size="sm">
  <Button>Apply</Button>
  <Select aria-label="Curve" options={curves} />
  <NumberField aria-label="Count" />
</Bar>
```

<!-- entry: new api behavior -->
