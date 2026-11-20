---
"@weasel-js/gestures": minor
---

`foldKeyRoute(parsed)` reads a parsed route's arg and modifiers the way `describeRoute` does.

The `*` wildcard reads as `undefined`, and a key gesture's arg as the key alone, its optional modifiers folded into the route's own.

<!-- entry: api -->
