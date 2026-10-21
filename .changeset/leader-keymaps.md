---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
"@weasel-js/menu": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

Keymaps behind a leader key. `keymapContribution` builds a keymap, whose bindings are live only while
it is open, and the leader that opens it: tap the leader for one input, or hold it to keep the keymap
open. Escape always closes it; a key it does not bind is ignored, or passed on under the new
`gestures.keymapUnbound` kit setting. `<KeymapHint>` lists an open keymap's keys, and `formatShortcut`
draws a key inside one as `Loupe ▸ 2`.

Bindings can now be rebound or removed by id, on actions and contributions alike:
`ActionsRegistry.overrideBindings` and `<SceneCanvas bindingOverrides>`, written as route strings or
with the new `key()`, `held()` and `unbound()` helpers. `captureKey` reads the next keystroke for a
binding editor.

`modeShortcutSpec` now reads through `key()`, so a mode shortcut written `'Space'` or `'Esc'` names
the key it says; before, either matched nothing.

Additive: `ActionsRegistry` gains `overrideBindings` and `bindingOverrides`, so a hand-written
registry must implement them.
