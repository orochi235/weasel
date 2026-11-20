---
'@weasel-js/devtools': minor
---

Two devtools panels sharing a channel to a page no longer read each other's answers; the earlier one says the later replaced it.

A `yo` and a `bye` may carry a `session`, which `createDevtoolsClient` sets fresh on each open, and the page tags every message it sends that connection with it. A `bye` naming another session closes nothing. The client ignores messages tagged for another session, and goes to `error`, rejecting its pending requests, on hearing another session's `sup`. Messages without a `session` work as before.

<!-- entry: fix api -->
