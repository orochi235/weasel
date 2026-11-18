---
'@weasel-js/ui-canvas': major
---

`CharacterOptions` takes the styling it shows as `value` and reports each edit through `onChange`, where they were `style` and `onPatch`.

```tsx
// before
<CharacterOptions style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />
// after
<CharacterOptions value={edit.effectiveStyle} onChange={edit.applyStyleToSelection} />
```

<!-- entry: breaking api -->
