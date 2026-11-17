---
'@weasel-js/ui': major
---

`Disclosure` takes native `<button>` attributes, so `controls` is gone in favor of `aria-controls`; it also forwards its `ref`.

An `onClick` runs before `onOpenChange`, and one that calls `preventDefault()` skips it. `tabIndex`, `disabled`, and `className` are the native attributes they were.

```tsx
// before
<Disclosure open={open} onToggle={toggle} label="Shapes" controls="shapes-panel" />
// after
<Disclosure open={open} onOpenChange={setOpen} label="Shapes" aria-controls="shapes-panel" />
```

<!-- entry: breaking api -->
