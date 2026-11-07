---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

An arrow key pressed mid-drag no longer nudges what the drag is moving. The nudge and anchor-nudge keys now wait until no gesture is in flight, as Delete does. And a binding gated to no gesture in flight (`phase: [{ channel: '*', phase: 'initial' }]`, as on Delete and Escape) now sees a drag no entry owns, such as `move`'s own default binding, which it used to miss.
