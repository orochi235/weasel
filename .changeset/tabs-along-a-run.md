---
"@weasel-js/ui": patch
---

`Tabs` and `PageTabs` follow an `Along` arc, as `Bar` does. Inside an `Along` with a curved shape, a `TabList`'s tabs lie along the shape in reading order, each tipped to its spot and kept upright, and the line under them is drawn along the inside of the bend half a tab off the run, with the selected tab's marker bent along it under that tab. The arrow keys still move through the tabs in reading order, and a row too long for its arc scrolls along it with the wheel, a drag or focus. `Tabs` can sit inside the `Along`, or the `Along` can wrap only the `TabList`. Tabs on an arc need an `id`.

`PageTabs` inside such an `Along` puts its + button last on the run. A drag measures the tabs and the pointer along the run, through a scaled or rotated ancestor, and marks where the tab would land with a line across the run; renaming and Alt+arrow work as before.

`useReorderDragList` takes `line`, which measures rows and the pointer along a line of the caller's own instead of a screen axis.
