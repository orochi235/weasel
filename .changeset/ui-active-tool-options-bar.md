---
'@weasel-js/ui': minor
---

`<ActiveToolOptionsBar tools={tools} values={values} />` draws the active tool's options, writing each edit back to the canvas's store.

`tool` names one tool instead of following `tools.active`. A shared option moves for every tool sharing it, and a change made elsewhere, such as a key stepping a size, redraws the bar.

<!-- entry: api -->
