---
'@weasel-js/ui': major
---

`ShortcutSheet` groups tools by the `toolSets` it is given, and with none lists every tool under "Other tools".

This is breaking: the default was editing's `KIT_TOOL_GROUPS`, which `@weasel-js/ui` no longer depends on. Pass it to keep the kit's groups: `<ShortcutSheet toolSets={KIT_TOOL_GROUPS} … />`. `EditorShell`'s sheet still groups by it when `useEditorTools` names no sets.

<!-- entry: breaking behavior -->
