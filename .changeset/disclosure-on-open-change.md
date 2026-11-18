---
'@weasel-js/ui': major
---

`Disclosure` and `DisclosureRow` report a press through `onOpenChange(next)` in place of `onToggle()`, and leave the native `onToggle` to the button.

```tsx
// before
<Disclosure open={open} onToggle={() => setOpen((o) => !o)} label="Shapes" />
// after
<Disclosure open={open} onOpenChange={setOpen} label="Shapes" />
```

<!-- entry: breaking api -->
