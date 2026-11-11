---
"@weasel-js/core": patch
---

A resize dragged to a point that is no number, or to one that carries its box past the double range, no longer throws a `TypeError` from the snap session's side reading (`resizeSides`): a side with no corner on it is left out.
