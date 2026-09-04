---
'@weasel-js/labkit': patch
---

Give a trial's sidebar a draggable seam.

`.lk-trial__sidebar` was a stated 320px with nothing between it and the
instrument, so a lab whose sidebar needed to be wider had no way to say so at
runtime. The sidebar and the content well are now a two-pane `windease` strip:
the seam is `stripStrategy`'s own resize affordance, which arrives as a
`role="separator"` carrying the range it can reach, operable by pointer and by
arrows / Home / End, and clamped against the content pane's floor rather than
the sidebar's alone.

The width persists per trial (`TrialRecord.sidebarWidth`), so a dragged sidebar
survives a reload and a clone inherits it.

`<TrialBody>` is exported for a lab composing its own chrome; `minWidth`,
`maxWidth` and `contentMinWidth` are its props. Like `<Workspace>`, it measures
its own box and takes a `viewport` where nothing measures — jsdom, notably.

**`--lk-trial-sidebar-w` no longer does anything.** The width is a number the
trial holds, not a token the stylesheet reads; a lab that set the variable
should pass `width` to `<TrialBody>` or let the seam settle it.
