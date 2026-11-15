---
'@weasel-js/ui': minor
---

`SwatchGrid` takes a list of ids as `value`, making every swatch a toggle pressed while its id is listed.

```tsx
<SwatchGrid options={colors} value={pinnedIds} onChange={(id) => togglePin(id)} />
```

A click still hands the swatch back, for the app to add or take out. A single id marks one swatch current as before.

<!-- entry: api new -->
