---
'@weasel-js/ui': major
---

`CommandPalette` asks to close through `onOpenChange`, as `Dialog` and `PrefsDialog` do; `onClose` is gone.

```tsx
// before
<CommandPalette open={open} onClose={() => setOpen(false)} />
// after
<CommandPalette open={open} onOpenChange={setOpen} />
```

<!-- entry: breaking api -->
