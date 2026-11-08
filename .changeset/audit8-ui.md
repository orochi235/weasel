---
"@weasel-js/ui": patch
---

A `ToolbarDock` reads its stored layout's docks and floating bars by own key, so a dock or bar
named like an `Object.prototype` member (`constructor`, `toString`) resolves instead of throwing.
A disabled action's reason is worded through one lookup everywhere it shows, read the same way.
`DataGrid` sorts `NaN` last with the nullish values, rather than scrambling the numbers around
it. A `useRovingTabIndex` container whose ref attaches after mount, as a `Toolbar` turned
`roving` does, now tracks focus and disabled items. `ActionSettingsPopover`,
`ActionSettingsDialog` and `useActionSettings` are exported from the package root as well.
