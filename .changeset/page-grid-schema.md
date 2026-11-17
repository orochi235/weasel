---
'@weasel-js/editor': minor
---

`pageGridSchema` is a page grid's settings as a prefs group, and `usePageGrid` takes its values.

Mount it in an app's schema and spread the group's values in beside the page and its fill:

```tsx
const [grid] = usePrefGroup(store, 'view.grid');
const { layer, source } = usePageGrid({ ...grid, page, background });
```

`PageGridOptions` now extends `PageGridSettings`, the group's values.

<!-- entry: rank=5 new api -->
