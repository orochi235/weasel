---
'@weasel-js/routing': patch
---

End a drag whose deferred start throws.

- An ongoing action held back by `dragThresholdPx` whose `start` throws when the drag crosses the threshold now ends the drag: the error is logged once, nothing is left in flight, and no later move of that drag calls `start` again. Before, the error escaped into the pointer listener and every later move of the drag tried `start` again. The next press starts as usual.
