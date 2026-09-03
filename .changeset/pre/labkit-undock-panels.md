---
"@weasel-js/labkit": patch
---

A sidebar section can be torn out into the workspace, and put back.

Every `sidebar` contribution now carries a tear-out control. Undocking moves
the section out of its trial's sidebar and into the workspace as either a tile
— a peer of the trials in the same grid, resizable and reorderable like one —
or a floating panel above the grid. The section says which it wants with
`undockAs: 'tile' | 'floating'` (default `'tile'`), and a section that only
makes sense beside its trial opts out with `undockable: false`.

`Workspace` registers windease's `floatingStrategy` alongside `gridStrategy` to
carry the second target, and takes `panels: readonly PanelDescriptor[]`.

The panel's content is **portalled** out of the trial rather than re-rendered
beside it: the workspace owns the frame and the host element, the trial owns
what goes in it. So a torn-out section keeps its place in the trial's React
tree — its context, its subscriptions and its own component state all survive
an undock and a dock, and an instrument does not have to make its panels
free-standing to allow it.

`TrialChromeContext` gains `undockedPanels`, `undockPanel(sectionId, as?)` and
`dockPanel(sectionId)`, so a consumer can drive this from its own chrome
instead of the built-in control.

Which panels are out is persisted with the rest of the lab, so it survives a
reload. That moves the document to **version 3**; `migrateV2toV3` starts the
field empty and touches nothing else. Closing a trial docks everything it
owned.

`Workspace`'s node-id list is now kept in a ref keyed on the joined ids rather
than a `useMemo` over a stand-in key, which drops the two lint suppressions
that arrangement needed.
