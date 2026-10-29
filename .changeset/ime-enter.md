---
'@weasel-js/headless': patch
'@weasel-js/hud': patch
'@weasel-js/text-dom': patch
'@weasel-js/ui': patch
---

`@weasel-js/headless` adds `imeKey(e)`, whether a keydown belongs to an input method mid-composition: `isComposing`, or `keyCode` 229, which Safari sends for the Enter that ends a composition, or a `Process` or `Dead` key. This adds API. The hud's hidden text input, text-dom's `useTextEdit` and ui's `ComboBox` now use it in place of their own checks; `ComboBox` no longer commits typed text on Safari's composition-ending Enter, and `useTextEdit` also leaves `Process` and `Dead` keys alone.

A context menu's text row and `PageTabs`' rename field leave Enter and Escape to an input method. Before, confirming a Japanese or Chinese candidate with Enter committed the half-typed text.
