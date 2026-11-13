---
'@weasel-js/ui': minor
---

`<ShortcutSheet>` lists every key bound around it: tool keys by tool set, command keys by action group, and held keys.

It reads the live bindings, so a key rebound or unbound through `bindingOverrides` shows that way, and a search finds a row by its name or by a key (`⇧⌘Z` or `Cmd+Shift+Z`). `useShortcutSheetCommand(open)` registers `shortcuts.show` on Shift+/ (`SHORTCUT_SHEET_KEY`) to open it.

```tsx
const [open, setOpen] = useState(false);
useShortcutSheetCommand(() => setOpen(true));
<ShortcutSheet isOpen={open} onOpenChange={setOpen} tools={tools} toolSets={[SELECT_TOOLS, SHAPE_TOOLS]} />
```

<!-- entry: rank=10 api new -->
