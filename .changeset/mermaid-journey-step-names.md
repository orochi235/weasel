---
'@weasel-js/diagram-formats': patch
---

A Mermaid journey step named `%%…`, `title …`, `section …` or nothing is written as a readable step, with a warning.

A leading `%%` is dropped, a step named for a statement is dropped, and a step with no name is written as `(untitled)`.

<!-- entry: fix -->
