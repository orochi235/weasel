---
'@weasel-js/ui': major
---

`ActionSettingsDialog` is gone; spread `useActionSettings(item)` into a `PrefsDialog` for an action's settings in a dialog.

`useActionSettings` returns `schema`, `values`, `mixed`, and `onChange` under the names `PrefsDialog` takes them, so nothing else changes for `CommandPalette`, which draws its settings this way.

```tsx
// before
<ActionSettingsDialog item={item} onClose={close} />
// after
const settings = useActionSettings(item ?? undefined);
{item && settings && (
  <PrefsDialog {...settings} isOpen onOpenChange={(open) => { if (!open) close(); }} layout="list" />
)}
```

<!-- entry: breaking api -->
