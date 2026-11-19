---
'@weasel-js/clock': patch
---

A clock back in `useClockLoop` from under a registration that shadowed its id no longer jumps by the time it spent shadowed.

Any clock the loop starts syncing counts no time from before it joined.

<!-- entry: fix -->
