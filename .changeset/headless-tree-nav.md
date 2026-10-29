---
'@weasel-js/headless': patch
'@weasel-js/ui': patch
---

`@weasel-js/headless` has a tree's Right and Left as `treeKey(items, at, key, shape)`: Right opens a closed branch or steps to its first child, Left closes an open branch or steps to the parent. A `TreeShape` says which items are branches, which are open, which is whose child, and optionally which can't toggle. `rowKey(items, at, press, shape, searching)` is the rest of a list of rows' keys — Cmd/Ctrl+A, the arrows, Home and End with Shift to extend, the tree keys, Enter and Space, typeahead — returned as a `RowKeyAction` for the caller to carry out. This adds API.

ui's `useRowNavigation` now takes every key but the Alt+arrow nudge from `rowKey`. Its keys do what they did before.
