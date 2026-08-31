---
'@weasel-js/labkit': patch
---

Assemble a trial's chrome from what its instrument declares. A contribution is
data keyed to a region — `toolbar`, `palette`, `sidebar`, `viewport`, `status` —
and the regions render whatever the assembled list puts in them. Bundles
concatenate built-ins, then the instrument's, then the lab's, and a duplicate id
throws. A lab adds its own with `chrome` and drops a built-in with `suppress`.

An instrument declaring `tools` gets a palette region and its own tool slot; one
declaring none reads the lab's, which `<Lab tools>` fills. The resolved tool
reaches the instrument on `RenderContext.trial.activeToolId`.

Breaking: `detectCapabilities`, `CapabilityFlags`, `ToolbarSlot`, `SidebarSlot`,
`StatusBarSlot`, the matching `Trial*Context` types, `DefaultToolbar`,
`DefaultSidebar`, `DefaultStatusBar` and `TrialChrome`'s `sidebarExtras` are
removed. Zoom moves from the trial toolbar to the new viewport region.
