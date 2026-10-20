---
"@weasel-js/diagram": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

Off-page reference markers. On a scene with pages, a connector whose two shapes sit on different
pages no longer draws across the gap: each end draws a short stub out of its shape, ending at a tag
that reads the other page's name and a reference letter, such as "Page 2 · A".
`useOffPageMarkers` (or `installOffPageMarkers` without React) splits and joins connectors as edits
move their ends or change the pages, in that edit's own undo entry, and writes
`DiagramEdge.offPage`. The tags are text nodes with a background (`offPageTagSpec`, registry key
`diagram:offPageTag`), colored by the theme. `diagramOffPage()` binds a double-click on a tag to
selecting the shape at the far end and fitting the view to its page. `offPageSplits` is the split
rule as arithmetic, and `offPageOps` runs the pass over named connectors.

A split connector's `ResolvedRoute` carries its two `stubs`, it shows no route handles, and the
`avoid` router leaves it out until it joins again. An edge label on a path with several subpaths
sits on the first (`subpathOf`).

`pageName` (core) is the name a page shows, its own or "Page" and its place, and `PageTabs` uses it.
