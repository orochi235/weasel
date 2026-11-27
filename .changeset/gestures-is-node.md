---
'@weasel-js/gestures': minor
---

`isElement` and `isNode` recognize an event target from any window's document, such as a same-origin iframe's.

There `instanceof Element` is false.

<!-- entry: api -->
