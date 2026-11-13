---
'@weasel-js/ui': major
---

`CommandPalette` is held open by `isOpen` and asks to close through `onOpenChange`, as `Dialog` and `PrefsDialog` are.

```tsx
// before
<CommandPalette open={open} onClose={() => setOpen(false)} />
// after
<CommandPalette isOpen={open} onOpenChange={setOpen} />
```

<!-- entry: breaking api -->
