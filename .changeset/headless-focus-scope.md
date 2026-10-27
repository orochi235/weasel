---
'@weasel-js/headless': patch
'@weasel-js/hud': patch
'@weasel-js/ui': patch
---

Keyboard focus is one contract across the DOM and the HUD. `@weasel-js/headless` adds `FocusScope<T>` (the focused target, whether its ring shows, `focus`, `moveFocus`, `tabOrder`, `subscribeFocus`) and the `tabSort` and `tabStep` rules behind it. `Hud` now extends `FocusScope<Widget>`, and `HudFocusOptions` is an alias of `FocusScopeOptions`; its behavior is unchanged, and `@weasel-js/hud` now depends on `@weasel-js/headless`. `@weasel-js/ui` adds `domFocusScope(root)`, the same contract over the elements under `root`, with the browser's Tab order.
