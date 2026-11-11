---
'@weasel-js/diagram-formats': patch
---

A Mermaid gantt reads back as it was written, as a timeline does: a `#` is written as `#35;` and the reader reads numbered references, so text holding `#58;` keeps it, and a task named `title …`, `section …`, or `%%…` no longer reads as that statement or a comment.

A journey step named `%%…`, `title …`, `section …`, or nothing is written on a line that reads as a step: a leading `%%` dropped, a step named for a statement dropped, and a step with no name written as `(untitled)`, each with a warning.
