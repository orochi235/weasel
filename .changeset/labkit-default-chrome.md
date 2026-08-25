---
'@weasel-js/labkit': patch
---

Rebuild what a lab gets by default.

`ControlPanel` is built on the property rows instead of hand-rolled native
inputs, so an instrument's config panel is themed and aligned rather than
showing OS-blue checkboxes against the parchment theme. Same props, same
schema.

`<Lab>` renders a header: add a trial, and choose the color mode. Both drove
`LabContext` with no UI at all, so every consumer rebuilt them.

`JobProgress` replaces the ad-hoc job markup in the trial chrome — a real
progress element that stays indeterminate until the job reports a total,
with failures and errors distinguished.

A trial paints a raised surface, so it reads as a panel against the workspace
instead of being separated from it by a hairline.

**`@weasel-js/core` and `@weasel-js/ui` are now declared dependencies.** Both
were re-exported from published subpaths (`/weasel-canvas`, `/weasel-ui`)
while sitting in `devDependencies`, so a clean install could not resolve
them. The consumer smoke test grew a manifest audit that catches this class of
break for every package, and labkit is now packed and imported by it.
