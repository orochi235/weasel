---
'@weasel-js/ui': patch
---

`Badge` gains a `success` tone, painted from `--wzl-success`, and an `xs` size for counts and markers inside a dense row. `xs` sets its type on the `--wzl-font-size-2xs` step with tighter padding, so a small badge no longer needs a hand-set font size and a `transform: scale()` on top of `sm`.
