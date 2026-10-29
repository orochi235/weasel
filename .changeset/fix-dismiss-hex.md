---
'@weasel-js/menu': patch
'@weasel-js/paint': patch
'@weasel-js/hud': patch
'@weasel-js/ui': patch
---

Add `attachMenuDismiss` to `@weasel-js/menu`: it closes a menu on a press or wheel outside it, on the window losing focus, and on a resize, attaching to any `Window`-like target and returning a detach. `press: false` leaves out the press listener, and `keepOnBlur` keeps the menu open through a blur. ui's `ContextMenuHost` and hud's `attachMenuHost` both dismiss through it.

`normalizeHex` takes an optional form: `'rgb'` drops alpha, `'rgba'` always writes it (`ff` when none was named). `tryNormalizeHex` is the same, returning undefined where `normalizeHex` throws. hud's color row and ui's `ColorField` and `TokenPanel` read hex through them. hud's hex row now accepts `#rgba` shorthand, and `ColorField` shows a malformed `#` value as black rather than passing it to the color input.
