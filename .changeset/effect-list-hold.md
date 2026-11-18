---
'@weasel-js/ui': minor
---

`EffectList` takes `disabled` and `readOnly`, with their reasons, and holds its cards and the open card's settings with them.

A held list takes no move, switch, rename, duplicate or removal, and the controls in the open card's body are held
the same way, as inside a `Disabled` or `ReadOnly` scope. A read-only list still opens and closes its cards.

```tsx
<EffectList items={items} kinds={kinds} onChange={setItems} readOnly readOnlyReason="Shared preset" />
```

<!-- entry: api -->
