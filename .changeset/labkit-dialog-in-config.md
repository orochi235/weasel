---
'@weasel-js/labkit': patch
---

`@weasel-js/labkit/config` no longer loads `@weasel-js/ui` at runtime, so a forge frame importing it stops pulling in ui's whole barrel. `.dialog()` now records a `DialogSpec` on the node (`NodeOptions.dialog`) rather than building the `DialogRow` renderer itself, and `ControlPanel` draws it. `ResolvedConfig` gains a `dialogs` map beside `renderers`, which code that builds a `ResolvedConfig` by hand now has to supply. `.dialog()` and `.render()` still replace each other, whichever is called last winning.
