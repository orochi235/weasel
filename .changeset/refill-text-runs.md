---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

A runs array can now be refilled in place. `clearRuns(runs)` in `@weasel-js/text` forgets what the layout and
paint caches hold for it while leaving it filed, `resolveRunsInto(out, runs, style)` resolves into an array the
caller owns, rewriting each run object whose optional fields match, and `textCommandFromRunsInto(cmd, …)` in
`@weasel-js/renderer` refills a text command and its runs. Core re-exports all three.

A HUD text widget now keeps one command and one runs array for its life and refills them when its text, color
or family changes, so a readout rewritten every frame no longer allocates a command, its runs, or a cache
entry per label. What its `draw` returned shows the widget's current text rather than a snapshot of the
text it had then.
