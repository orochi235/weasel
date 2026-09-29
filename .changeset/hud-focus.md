---
'@weasel-js/hud': patch
---

HUD widgets take keyboard focus. Additive: a `Hud` now holds one focused
widget (`focused`, `focus()`, `moveFocus()`, `tabOrder()`, `subscribeFocus()`),
and a widget opts in with `focusable`, orders itself with `tabOrder`, names
itself with `accessibleName`, and receives keys through `onKey`, returning
whether it handled each one. A press on a focusable widget focuses it, a press
anywhere else blurs, and Tab / Shift+Tab walk the focusable widgets while the
canvas holds DOM focus. A key the focused widget handles never reaches the
canvas's key bindings; one it declines falls through to them. Keyboard focus
paints a ring in `--wzl-focus-ring`, and a polite live region announces the
focused widget's name. Buttons are focusable by default and press on Enter or
Space; pass `focusable: false` to opt one out.
