---
"@weasel-js/ui": minor
---

Add `StatusBar` (with `StatusBarItem` / `StatusBarSpacer`) and `ResizeHandle`
— the two pieces of editor shell that every app was otherwise rebuilding.
`ResizeHandle` is the window-splitter pattern: pointer drag or arrow keys,
`role="separator"` with a live value range, snapping to a `step` grid so
fractional pointer coordinates don't leak into persisted layouts. Both are
layout-agnostic; the consumer still owns the shell.
