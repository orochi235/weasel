---
'@weasel-js/core': patch
---

Poll which keys are down. `useKeyState()` (or `createKeyState()` plus
`attach(target)` outside React) tracks physical keys by `KeyboardEvent.code`,
independently of which bindings claim them: `isDown(code)`, `isKeyDown(key)`,
`codes()`, `modifiers()`, and `take(code)`, which hands out each fresh press
once — autorepeat is not a press. Everything is released when the keyups can no
longer arrive: the window blurs, the document hides, focus leaves an element
target, or Meta is released (macOS sends no keyup for a key let go while Cmd is
held). Modifier keys are reconciled against the flags every key event carries,
so a modifier released in another window does not stick. `preventDefault`
names the codes whose browser default is blocked, so a game's Space and arrows
stop scrolling the page.

This adds API and changes nothing existing.
