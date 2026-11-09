---
'@weasel-js/gestures': patch
---

Fixes to how key bindings match, and to what the route grammar accepts, writes and describes.

- A key spec requiring `mod` beside the other platform key now matches that chord: `{ mod, meta }` is Ctrl+Win off Apple platforms, and `{ mod, ctrl }` is Cmd+Ctrl on them. Before, the other key stayed forbidden, so the chord `captureKey` recorded for Ctrl+Win never fired.
- A Latin letter or digit in a chord matches when the keyboard types something else on that key: Ctrl+я on a Russian layout is Ctrl+Z, and Option+Z (Ω) or Option+E (a dead key) on a Mac is Alt+Z or Alt+E. A key pressed with no Ctrl, Alt or Cmd is still read as what it typed.
- A route's `Space` and `Esc` read as the keys a `KeyboardEvent` names, as `key()` and `held()` already read them, so `[initial] keyHeld(Space)` fires on the space bar. `keySpecRoute` writes the space bar as `Space`, and `describeRoute` names it.
- The route grammar spells the `?` and `)` keys (`keyDown(?) +shift`, `keyDown()) +shift`), so `keySpecRoute` writes a route for them.
- `describeRoute` reads a key route's optional modifiers (`keyDown(z?shift)`) as optional, rather than printing them as part of the key.
- `parseRoute` rejects an empty phase atom (`[initial,]`), an empty arg (`keyDown()`), and a target starting with a reserved sigil (`=> *x`), and `routeToSpec` rejects an empty glob in a MIME list (`drop(image/*|)`) and a key route that names a modifier the mod slot names too (`keyDown(z?shift) +shift`). Each used to be accepted silently.
