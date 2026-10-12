---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Adds API: a `hover` gesture, the pointer moving with no button pressed. `{ kind: 'hover', target?, mods?, phase? }` (`HoverSpec`) binds an immediate action that runs on every such move with `worldX` / `worldY`, `clientX` / `clientY`, `affordance`, `bodyTarget`, and `mods` in its params; `hover` is a route-grammar gesture name, and `HoverEvent` joins `InputEvent`. A coordinate readout, an eyedropper preview, or a ruler can follow the pointer through the dispatcher, with its modifiers, targets, modes, and views, where each used to attach its own `pointermove` listener.

A hover binding claims nothing, a rule chosen on an agent's judgment: every live `hover` binding that matches a move runs, the move is never canceled, and it still reaches the hover-cursor pump. An ongoing action bound to `hover` is refused with a console error, since there is no press for it to own. A held pointer's moves are its drag's and fire no hover. The gesture reports motion only; it does not say when the pointer leaves.

Adding a member to `GestureSpec`, `InputEvent`, and `GestureName` breaks a consumer's exhaustive `switch` or `Record` over any of them.
