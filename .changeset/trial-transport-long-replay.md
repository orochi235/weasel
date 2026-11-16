---
'@weasel-js/labkit': patch
---

`TrialTransport` holds an ended run for the whole of a `replay` longer than 2³¹ − 1 ms, and an infinite one never replays, instead of replaying at once.

<!-- entry: fix -->
