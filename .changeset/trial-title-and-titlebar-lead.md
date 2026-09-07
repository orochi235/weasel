---
'@weasel-js/labkit': patch
---

A trial can be retitled, its title bar has a leading end, and a chrome item's
`onActivate` is handed the trial's context.

`TrialChromeContext` gains `title` and `setTitle`. A trial's bar reads its
instrument's name until something calls `setTitle`, so a lab running one
instrument over many subjects can say which subject a trial holds instead of
repeating the instrument's name down the column; `setTitle(null)` puts the name
back.

The title bar now honors `end` the way the toolbar does. A `titlebar`
contribution that sets `end` joins the actions cluster — clone, reset, snapshot,
close — and one that leaves it unset leads the bar, ahead of the title.
`TitleBarRegion` takes a `placement` of `'lead'` or `'actions'` and renders the
contributions belonging to that end. All four built-ins set `end`, so nothing
moves.

`ToolbarItem.onActivate` and `ViewportControl.onActivate` receive the trial's
`TrialChromeContext`. A contribution declared through `Lab.chrome` can now call
`ctx.saveSnapshot()` directly, so re-declaring a suppressed built-in in another
group no longer means dropping to `render` and hand-rolling a button outside the
chrome's layout. A zero-argument handler keeps working untouched.
