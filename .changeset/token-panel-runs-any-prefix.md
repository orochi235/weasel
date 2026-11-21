---
'@weasel-js/ui': patch
---

`TokenPanel` draws names without their `--`, so rows sharing a group name it once whether `namePrefix` is unset, `'wzl-'` or `'--wzl-'`.

<!-- entry: fix visual -->
