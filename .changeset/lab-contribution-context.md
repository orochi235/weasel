---
"@weasel-js/labkit": patch
---

**`LabContribution` takes its chrome context as a type parameter.** It defaults
to `LabChromeContext`, so a `<Lab>` call site reads exactly as it did; a
consumer mounting the regions under a bare `<LabShell>` now writes
`LabContribution<MyCtx>` instead of composing `ContributionBase` and
`ToolbarItem<MyCtx>` by hand or fabricating a lab context. `contributionsIn`
carries the same parameter.
