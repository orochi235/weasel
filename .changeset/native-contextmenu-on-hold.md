---
'@weasel-js/routing': patch
---

Fixes: a browser that sends its own `contextmenu` on a touch hold could run a `contextMenu` binding twice, once from the native event and once from the long-press `useGestureDispatcher` synthesizes. A `contextmenu` that arrives while a touch or pen hold is in progress now stands for that hold's long-press: it fires the pending long-press at once, `longPress` bindings first and the `contextMenu` fallback after, and is dropped when the long-press has already fired. The press is spent either way, so its release does not also click.

Behavior change, made on an agent's judgment and tested only against a hand-sent event in jsdom: a right-click from a mouse while a finger or pen is resting on the same canvas no longer opens the menu.
