---
'@weasel-js/diagram': major
---

`DiagramView` takes its held pick as `selection` and reports changes through `onSelectionChange`, as other components do.

`selected` is renamed `selection` and `onSelect` is renamed `onSelectionChange`; their values and the callback's arguments are unchanged. `EffectChart` and `EffectEditor` keep their `selected` and `onSelect`.

```tsx
// before
<DiagramView specs={specs} selected={id} onSelect={setId} />
// after
<DiagramView specs={specs} selection={id} onSelectionChange={setId} />
```

<!-- entry: breaking api -->
