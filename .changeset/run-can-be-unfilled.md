---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

A run can carry no fill: `StyledRun.fill` accepts `null`, which `resolveRuns` keeps as unfilled where it used to read it as "inherit the node's". The range algebra reads and writes it (`styleAtRange` reports `null`, a `{ fill: null }` patch unfills the range, `undefined` still clears back to inheriting), the edit overlay carries it through an edit, and `@weasel-js/svg` writes it as `<tspan fill="none">` and reads that back.
