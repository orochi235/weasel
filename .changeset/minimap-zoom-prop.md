---
'@weasel-js/minimap': major
---

`<MinimapCanvas wheelZoom>` and `createMinimapContribution({ wheelZoom })` are renamed `zoom`, which now covers the touch pinch too.

`zoom` takes the same values: `true` (the default), the main view's `{ min, max }`, or `false` to bind no wheel, trackpad pinch or touch pinch.

```tsx
// Before
<MinimapCanvas wheelZoom={{ min: 0.05, max: 16 }} … />
createMinimapContribution({ rect, wheelZoom: false });

// After
<MinimapCanvas zoom={{ min: 0.05, max: 16 }} … />
createMinimapContribution({ rect, zoom: false });
```

<!-- entry: breaking api -->
