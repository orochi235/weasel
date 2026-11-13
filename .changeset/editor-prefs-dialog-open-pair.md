---
'@weasel-js/editor': major
---

`EditorPrefsDialog` opens through `isOpen` and `onOpenChange`, like `PrefsDialog` and every other modal in the kit.

```tsx
// before
<EditorPrefsDialog store={store} open={open} onClose={() => setOpen(false)} />
// after
<EditorPrefsDialog store={store} isOpen={open} onOpenChange={setOpen} />
```

<!-- entry: breaking api -->
