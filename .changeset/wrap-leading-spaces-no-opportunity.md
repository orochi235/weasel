---
"@weasel-js/text": patch
---

A paragraph opening with spaces no longer wraps after them before a character no line may start with, such as `!` or `。`, per UAX #14.

`layoutRuns`, `measureText` and `layoutMarkdown` all change together.

<!-- entry: fix -->
