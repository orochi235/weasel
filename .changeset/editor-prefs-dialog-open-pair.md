---
'@weasel-js/editor': major
---

`EditorPrefsDialog` asks to close through `onOpenChange`, like `PrefsDialog` and every other modal in the kit; `onClose` is gone.

```tsx
// before
<EditorPrefsDialog store={store} open={open} onClose={() => setOpen(false)} />
// after
<EditorPrefsDialog store={store} open={open} onOpenChange={setOpen} />
```

<!-- entry: breaking api -->
