---
'@weasel-js/ui': major
---

`ZoomControl` takes `onZoomInput` for live zoom and `onZoomChange` for the committed one; `onZoomCommit` is gone.

```tsx
// before
<ZoomControl zoom={zoom} onZoomChange={preview} onZoomCommit={commit} />
// after
<ZoomControl zoom={zoom} onZoomInput={preview} onZoomChange={commit} />
```

<!-- entry: breaking api -->
