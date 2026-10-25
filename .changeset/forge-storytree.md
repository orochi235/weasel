---
'@weasel-js/ui': patch
'@weasel-js/forge': patch
---

`TreeNode` takes an `href`, which draws the row as a link: a plain or Shift click activates it as before, while a Cmd, Ctrl, Alt or middle click is left to the browser, so a row can open in a new tab. It also takes `current`, which sets `aria-current` and colors the row with `--wzl-tree-current`. A link row shows the pointer cursor, and `--wzl-tree-row-h` sets every row's height, falling back to `--wzl-control-h` as before.

forge's story sidebar is now built on `Tree`, so it gains the tree's type-ahead and row styling. Its rows keep their links, Shift-click still opens another trial, and the fold marks and the Lab and package badges stay where they were. A component's row is now a link to its index page too.
