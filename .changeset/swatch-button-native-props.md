---
'@weasel-js/ui': major
---

`SwatchButton` takes native `<button>` attributes, so its `data` and `held` props are gone: pass data attributes and a hold's attributes directly.

A caller's `onClick` or `onContextMenu` runs before the swatch applies, and one that calls `preventDefault()` applies nothing.

```tsx
// before
<SwatchButton option={o} tabStop current={false} apply={apply} held={hold.focus} data={{ 'data-slot': '2' }} />
// after
<SwatchButton option={o} tabStop current={false} apply={apply} {...hold.focus} data-slot="2" />
```

<!-- entry: breaking api -->
