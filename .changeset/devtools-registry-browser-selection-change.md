---
'@weasel-js/devtools': major
---

`<RegistryBrowser>` reports a new pick through `onSelectionChange`, as the kit's other components holding a selection do; the prop was `onSelect`.

```tsx
// before
<RegistryBrowser categories={categories} selected={pick} onSelect={setPick} detail={detail} />
// after
<RegistryBrowser categories={categories} selected={pick} onSelectionChange={setPick} detail={detail} />
```

<!-- entry: breaking api -->
