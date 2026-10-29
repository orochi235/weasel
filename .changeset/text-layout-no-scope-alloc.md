---
'@weasel-js/text': patch
---

Laying out and painting text allocates less each call. The text caches empty the lists they refill with `pop` rather than `length = 0`, which made V8 reallocate each list on its next push, and `layoutRuns`, `orderLine`, `paintRunsInto` and the line-break scan no longer build closures over their locals, which allocated a scope on every call whether or not the closure ran. A wrap reuses one array of break opportunities from call to call. Layouts and paintings are unchanged.
