---
'@weasel-js/animator': major
---

A timeline's `loop: n` runs n passes, as a clock's does, not n passes after the first.

`setLoop(n)` and `loop()` count passes the same way, the one under way included. A timeline that should play three times took `loop: 2` and takes `loop: 3` now.

```ts
// Before: three passes
animator.timeline({ tracks, loop: 2 });

// After: three passes
animator.timeline({ tracks, loop: 3 });
```

<!-- entry: breaking behavior -->
