---
'@weasel-js/labkit': patch
---

A presented lab whose trial has a clock no longer posts a `labkit:state` saying `clock: false` before that clock is in, and no longer drops a host's command in that gap. Its first state is now the clock's, and it listens from the moment it posts it.
