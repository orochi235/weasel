---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Say in labkit's declarative chrome and builder what its components already draw

- Chrome commands, rail tools, viewport controls and a lab's `tools` take `disabledReason`, which every region reads in the item's tooltip while it stays focusable. The close button reads "Close trial", with "It is the last trial" as its reason, where its label used to carry the reason.
- A viewport control takes `shortcut`, `pressed` and `danger`.
- The title bar honors an item's `pressed` and `showLabel`, as the toolbar does. The expand toggle keeps one icon and label and reads as held down while the trial is expanded.
- A rail command reads as current while it is `pressed`.
- A toolbar or lab header item can be `{ kind: 'menu', label, icon?, entries }`, whose `entries` are `@weasel-js/menu` entries, or a function of the chrome context called each time the menu opens. The "Load snapshot" button is one, where it used the `render` escape. A header menu registers no lab command.
- An instrument's `TrialTool` takes `disabled` and `disabledReason`.
- A builder leaf takes `.icon()` and `.short()`, a group `.icon()` and `.lead()`, and a `.labels()` option `short` and `disabled`, all carried onto the prefs they resolve to, so `f.boolean()` can draw a glyph in a bar and a bar can lead with its group's icon. `prefsFromConfig` and `f.prefs` keep a group's icon and lead.
- ui's `Toolbar.Button` takes `disabledReason`, and `MenuButton` takes `entries` in place of `items`.
