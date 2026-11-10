---
"@weasel-js/text": patch
---

A paragraph opening with spaces no longer wraps after them before a character no line may start with, such as `!`, `)` or `。`: the spaces and what follows stay on one line, as UAX #14 requires. Wrapped text in `layoutRuns`, `measureText` and `layoutMarkdown` all changes together.
