---
"@weasel-js/path-tools": patch
---

The Smudge brush now pushes every path under it while nothing is selected, skipping locked and hidden ones; with a
selection it still pushes only the selected paths. It used to do nothing without a selection.
