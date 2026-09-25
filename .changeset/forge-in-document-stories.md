---
'@weasel-js/forge': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/theme': patch
---

Stories render in the workshop page instead of in an iframe each.

A story is now a labkit instrument directly: its schema is the trial's, its
render runs in the page inside a host that applies the globals to itself,
portals weasel overlays into itself and contains fixed-position descendants.
A story that needs its own document sets `isolate: '<why>'` (CSF:
`parameters.forge.isolate`) and keeps the frame path unchanged;
`check:forge-isolate` lists those and refuses an increase. A `viewport` story
renders as a fixed-size box the trial pans and zooms, so `vw`, `vh` and media
queries inside it read the page.

`applyGlobals` in the frame config now receives a target, `{ root, scope,
style }`, instead of a bare root: `style(css)` writes a rule that reaches that
story alone. Editing a story file reloads it in place, with each trial's
config and state kept. `runStory` renders through the same host, with no
message channel.

`@weasel-js/ui`'s Toast story is the one isolated story: React Aria's toast
region portals to `document.body` with no container option.

`@weasel-js/labkit` gains `LabBoundary`, which renders its children as though
no lab, trial or theme were above them, and `@weasel-js/theme/react` exports
`ThemeContext` so such a boundary can hide an outer theme. A story host in the
workshop, which is itself a lab, wraps every story in one.

A story reached by its URL, typed, linked or pasted, now shows in the focused
trial the way a click in the tree does, instead of opening another trial
beside it. Only a lab with no trial gets a new one; Shift-click is what opens
another.
