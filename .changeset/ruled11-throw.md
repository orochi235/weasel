---
'@weasel-js/routing': patch
---

Fixes to how an ongoing action's handle is started and ended.

- An ongoing action held back by `dragThresholdPx` whose `start` throws when the drag crosses the threshold now ends the drag: the error is logged once, nothing is left in flight, and no later move of that drag calls `start` again. Before, the error escaped into the pointer listener and every later move of the drag tried `start` again. The next press starts as usual.
- An ongoing action bound to an input that nothing later continues (a key, a click, a wheel, a Safari pinch) is still started on each firing, and the handle a second firing replaces is now ended with `'commit'`. Before, two presses of its key ran `start` twice and only the second handle's `onEnd` ever ran. The latest handle stays in flight until the next firing or a cancel-all, as before; bind such an action to `key-held` or a drag to give it an end of its own.
- A handle whose `start` tore the dispatcher down synchronously (a `flushSync` that unmounts the canvas, say) is ended with `'cancel'` as soon as `start` returns, rather than left in flight after the teardown.
