---
'@weasel-js/editor': minor
---

`<EditorShell>` opens a keyboard shortcut sheet on Shift+/, listing the tools a workspace publishes with `useEditorTools(tools, toolSets)`.

`shortcuts` sets how its `shortcuts.show` command registers, as `preferences` does for Preferences, and `shortcuts={null}` registers none. `<EditorTools>` publishes from a host that holds its tools above the shell.

<!-- entry: rank=5 api new -->
