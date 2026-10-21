---
"@weasel-js/forge": patch
"@weasel-js/labkit": patch
---

A story taller than its trial makes forge's scroller a tab stop, a region named for the trial, so a
keyboard can scroll it and the Accessibility panel no longer reports `scrollable-region-focusable`
against the workshop. A story that fits leaves the scroller out of the tab order. labkit now exports
`useTrialTitle` and `TrialTitleContext`, the enclosing trial's title as its title bar shows it.
