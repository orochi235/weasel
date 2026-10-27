---
'@weasel-js/headless': patch
'@weasel-js/ui': patch
---

`rovingKey` takes `orientation: 'both'`, answering to all four arrows, and a `dir` that swaps Left and Right for a right-to-left layout (adds API). ui's `useRowNavigation` and `rovingTarget` now step through `rovingKey`; their behavior is unchanged.
