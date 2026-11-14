---
'@weasel-js/ui': major
---

`Bar` is now a strip of children, and the bar drawn from a schema is `PrefsBar`, from `@weasel-js/ui/components/PrefsBar`.

`PrefsBar` takes every prop the schema `Bar` did, plus children drawn after the schema's cells. `Bar` takes any controls as children, with `Bar.Group`, `Bar.Spacer`, `Bar.Divider`, `Bar.Item`, `Bar.Readout`, and `Bar.Button`, and adds `roving`, `wrap`, `fit`, `divided`, and the `framed` values `'band'` and `'status'`.

```tsx
// before
<Bar schema={TEXT} values={values} onChange={onChange} />
// after
<PrefsBar schema={TEXT} values={values} onChange={onChange} />
```

<!-- entry: rank=5 breaking api new -->
