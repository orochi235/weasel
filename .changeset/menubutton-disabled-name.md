---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`MenuButton` takes `disabled`, and its rows take `disabled` and `current`, as `Button` and `@weasel-js/menu`'s entries do.

```tsx
// before
<MenuButton label="Add" isDisabled items={[{ value: 'a', label: 'A', isDisabled: true, isCurrent: true }]} />
// after
<MenuButton label="Add" disabled items={[{ value: 'a', label: 'A', disabled: true, current: true }]} />
```

<!-- entry: breaking api -->
