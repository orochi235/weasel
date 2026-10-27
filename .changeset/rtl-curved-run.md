---
'@weasel-js/geom': patch
'@weasel-js/ui': patch
---

`trackRun` takes a `direction: 'ltr' | 'rtl'` option and reports it on the run. Under `'rtl'` the run starts at its right end on the side it stands on, `tangent` points the way it reads, and each item is still tipped upright as left-to-right reading would tip it. A curved `Bar`, segmented row, `RadioGroup`, `TabList` and `PageTabs` read their root's computed `direction`, so in a right-to-left locale item 1 sits at the right end as it does laid out straight, and the chevron past a scrolled run's end points out of the end it is at.
