---
'@weasel-js/routing': major
'@weasel-js/ui': major
'@weasel-js/core': major
---

A tool palette shows the key that activates each tool now: a key rebound through `bindingOverrides` shows rebound.

`ToolsApi.shortcuts` holds each tool's live keys, read from the `tool.activate` bindings in the canvas's actions scope, or with no scope the keys the tools declare. `ToolPalette` reads it; its `lookupShortcut` prop and `ToolPresentation.shortcut` are gone. A hand-built `ToolsApi` needs a `shortcuts` field, which `declaredToolShortcuts(registry)` makes, and `toolShortcutsOf(actions, ids)` reads the same keys from an action list.

```tsx
// before
<ToolPalette tools={tools} lookupShortcut={(id) => myLookup(id)} />
// after
<ToolPalette tools={tools} />
```

<!-- entry: rank=10 breaking api fix -->
