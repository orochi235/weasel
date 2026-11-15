---
'@weasel-js/ui': major
---

`MenuButton` takes `ref` for its trigger `<button>`; `buttonRef` is gone.

```tsx
// before
<MenuButton buttonRef={addRef} label="Add" … />
// after
<MenuButton ref={addRef} label="Add" … />
```

<!-- entry: breaking api -->
