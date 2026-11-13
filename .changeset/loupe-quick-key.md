---
'@weasel-js/labkit': minor
---

F2 opens a magnifying lens at the pointer in any lab with `labLoupe`. Tapped, the lens sits where it opened and drags by its body; held, it follows the pointer and stays where the key is let go. A tap on the open lens closes it.

It is the `loupe.quick` action, a held-key binding outside the Loupe keymap, so it takes no Alt+L first; its binding id is `loupe.quick` for rebinding, `QUICK_KEY` names the default, and `QUICK_TAP_MS` is how short a press counts as a tap.

A Glass lens no longer draws or picks its source patch, which lies under its own body. `LensActionApi.follow` takes an optional lens id, and moves a Glass lens by its body.

<!-- entry: new api -->
