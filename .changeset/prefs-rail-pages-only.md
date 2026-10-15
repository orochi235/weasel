---
'@weasel-js/ui': patch
---

A `PrefsForm` rail lists pages only. A section is drawn on its page under its heading and no longer has a rail entry that scrolls the page to it, so the rail drops the mark for the section in view and the lighter weight it set section entries in. A page nested inside a section nests under the nearest page above it.

Breaking: `PrefRailItem` has no `page`, since every entry opens its own page, and `prefRailItems` returns no section entries. `PrefsRail` takes neither `current` nor `onScrollTo`, marks only the open page (`aria-current="page"`, `data-rail-mark="current"`), and no longer sets `data-rail-mark="open"` or `aria-current="location"`. A pane's sections no longer carry `data-spy-section`.

The rail and the pane keep 16px clear on their right, so a scrollbar laid over either one no longer covers the edges of the fields.
