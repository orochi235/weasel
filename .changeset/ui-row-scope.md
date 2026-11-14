---
'@weasel-js/ui': major
---

A settings row's auto, changed, reset, and error state is set by a `<RowScope>` around it, not by props on the row.

The row is `PropertyRow`, `PropertyField`, or `DialogRow`. `auto`, `onAutoChange`, `autoValue`, `onReset`, `changed`, and `error` are gone from all three. `<RowScope>` takes them and the row inside it draws them; a scope inside another overrides only the fields it names, and a row nested in another's control starts with none. `usePropertyRow()` is exported, and returns the row a control sits in, its label and that state, or `null`. `mixed` stays a prop, and a row's `disabled` still goes through the `<Disabled>` scope.

```tsx
// before
<PropertyField kind="number" label="Gap" value={gap} onChange={setGap} auto={auto} onAutoChange={setAuto} error={err} />
// after
<RowScope auto={auto} onAutoChange={setAuto} error={err}>
  <PropertyField kind="number" label="Gap" value={gap} onChange={setGap} />
</RowScope>
```

<!-- entry: rank=5 breaking api -->
