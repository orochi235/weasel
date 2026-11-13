---
'@weasel-js/labkit': major
---

labkit's chrome takes a shortcut as keys and writes it for the platform, so the snapshot button reads `⌘S` on a Mac rather than `Mod+S`.

`shortcut` on a toolbar, rail, viewport or title bar item and on a `TrialTool` is a `MenuShortcut`, not a string. `undoShortcuts()` is replaced by `UNDO_SHORTCUT` and `REDO_SHORTCUT`.

```ts
// before
{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }
// after
{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: { key: 'V' } }
```

<!-- entry: breaking api fix -->
