---
'@weasel-js/routing': minor
---

`subscribeRefusals` hears a keystroke that reached a command only to have its `enabled` refuse it, with the action and its reason.

It is heard a task after the keystroke, and not at all for an autorepeat or for a keystroke something on the page took with `preventDefault` in the meantime. A dispatcher reports one through the new `DispatcherContext.refused`.

<!-- entry: rank=5 new api -->
