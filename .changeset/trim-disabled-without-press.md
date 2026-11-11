---
"@weasel-js/path-tools": patch
---

Menus and the command palette no longer offer a Trim segment that would cut nothing.

It is disabled with `NotApplicable` when it has no click and its press reaches nothing it could cut.

A click still enables it, and the run decides from the click's point, as Extend to next path does.

<!-- entry: fix -->
