---
"@weasel-js/forge": patch
---

An issue report fences the story id and branch it names past any backticks they hold, so a branch such as `` fix/`x` `` reads back whole in the issue instead of breaking its code span.
