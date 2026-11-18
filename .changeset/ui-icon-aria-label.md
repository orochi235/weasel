---
'@weasel-js/ui': major
---

`<Icon>` takes its accessible name as `aria-label`, as the kit's other components do; the prop was `label`.

```tsx
// before
<Icon name={icon('close')} label="Close" />
// after
<Icon name={icon('close')} aria-label="Close" />
```

<!-- entry: breaking api -->
