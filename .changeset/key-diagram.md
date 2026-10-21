---
"@weasel-js/ui": patch
"@weasel-js/gestures": patch
---

Add `KeyDiagram`, which draws a keyboard from a layout and groups its keys into `KeyBank`s the way
the keyboard does — function row, main block, navigation cluster, arrows. Given `keys`, it draws only
those, in their places, and shrinks to fit them; without a layout it draws them in a row, ungrouped.
Keys in `held` light up, `marks` print what a key does under it and tint it, and `linger` hides the
diagram until a key is held and for that many seconds after. `useHeldKeys` reads `held` off the
keyboard.

Layouts name keys by `KeyboardEvent.code`. `ansiLayout(platform)` and `KEYBOARD_LAYOUTS` give each
platform's ANSI tenkeyless board, and `placeKeys` works out where a layout's keys sit. Gestures gains
`keySpecFromCode`, the platform's legend for a physical key: `MetaLeft` is `⌘` on macOS and `⊞` on
Windows.
