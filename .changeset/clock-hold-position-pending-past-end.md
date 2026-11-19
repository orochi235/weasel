---
'@weasel-js/clock': patch
---

`holdPosition`'s `pending()` reports a position past its pass's end as still waiting, as `holdAt`'s does.

It reads null once the span grows to reach the position; one before the pass's start waits the same way.

<!-- entry: fix -->
