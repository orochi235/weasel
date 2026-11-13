---
'@weasel-js/editor': major
---

`usePages`, `usePageSettle` and `usePageFit` take `padding` (and `usePageSettle` its `paging`) in a trailing options bag instead of as positional arguments.

```ts
// before
usePages(scene, view, dims, setView, 32, { paging: 'single' });
usePageSettle(pages, view, dims, setView, 'single', 32);
usePageFit(dims, fitKey, page, setView, 32);
// after
usePages(scene, view, dims, setView, { paging: 'single', padding: 32 });
usePageSettle(pages, view, dims, setView, { paging: 'single', padding: 32 });
usePageFit(dims, fitKey, page, setView, { padding: 32 });
```

`PageSettleOptions` and `PageFitOptions` are exported beside `UsePagesOptions`.

<!-- entry: breaking api -->
