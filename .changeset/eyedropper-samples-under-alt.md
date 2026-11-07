---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A tool held on a modifier hotkey refused its own gestures, because that modifier is down through every one of them and a binding that leaves a modifier out forbids it. The eyedropper, held on Alt by default, never sampled. While a tool holds the hotkey slot on Alt, Shift, Ctrl, or Meta, its bindings that do not name that modifier now take it held; a binding that names it, `false` included, keeps what it says.
