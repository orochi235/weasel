---
'@weasel-js/labkit': patch
---

labkit's own `StatusBar` is gone; `@weasel-js/labkit` and `@weasel-js/labkit/primitives` now re-export `@weasel-js/ui`'s `StatusBar`, `StatusBarItem` and `StatusBarSpacer`. A bar written with `StatusBar.Section` needs `StatusBarItem` instead, a `StatusBarSpacer` before a section that was marked `end`, and `divided` on the bar to keep the hairlines between readouts. `StatusBarSectionProps` is gone with it.
