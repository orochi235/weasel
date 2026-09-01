---
'@weasel-js/labkit': patch
---

`PaletteRegion` and `ViewportRegion` claimed `role="toolbar"` without the
keyboard contract that role promises — no roving tabindex, every button in the
tab order. Both now use `useRovingTabIndex`, which takes an orientation: the
vertical palette walks ArrowUp/ArrowDown and leaves the cross-axis arrows to the
page, per APG.
