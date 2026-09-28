---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

New `DispatchRecord`: for one input, every binding that matched, what the claim and eligibility filters dropped, the ranked survivors with the step that placed each one below the last (`view`, `tier`, `specificity`, `context`, `order`), and what the walk did with each. `Dispatcher.explain` returns one without invoking anything. In dev builds the trace buffer on `window.__weaselDispatchLog__` now holds these records. They replace `DispatchLogEntry`, which is removed, so a reader of that buffer must move to the new shape. `handleInput`, `resolveAll` and `resolveOnly` now share one walk, so a prediction ranks candidates exactly as a dispatch does. `matchSortedWithBarred` reports the bindings an exclusive claim kept out. The types are also exported from `@weasel-js/core/routing`.

New `FallthroughDiagram` in `@weasel-js/ui` draws one record: the input, the matched set, one band per filter, and the ranked list with its walk, with the winner marked.
