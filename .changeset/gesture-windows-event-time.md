---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
---

A double click, and a multitouch tap, are now timed by when their inputs happened rather than when
each was handled, so a long task between a user's two clicks no longer drops the double click.
`PointerSample` takes an optional `timeStamp` on the recognizer clock's timeline; the dispatcher
passes each pointer event's own `timeStamp`. A sample without one, or with 0, or with one ahead of
the clock (jsdom stamps events with `Date.now()`), is timed when it is handled, as before.
