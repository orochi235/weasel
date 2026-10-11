---
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

forge reads a `showIf` written as data where it read only the function form. A control or a group hidden at the defaults by a condition gets no row of variants on a story's index page, and `answerSchema` lists it among the hidden paths. The condition itself still crosses to the workshop in the node's annotations, where the controls panel evaluates it.

Adds API: `isEntryShown(entry, config)` in `@weasel-js/labkit`, which answers a node of a schema that has not been resolved by its own `showIf`, as a condition or a function.
