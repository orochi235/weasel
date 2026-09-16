---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

A lab now tracks a focused trial: `focusedTrialId` on the lab context names the
trial last pointed at or focused, counting focus that moved into a frame inside
it, and a trial that `addTrial` or `cloneTrial` opens takes it. `focusTrial`
sets it. With more than one trial open, the focused one draws its border in the
accent color. `swapTrial(id, instrumentName, options)` puts a fresh trial of
another instrument in a trial's place, keeping its tile size and sidebar width.

forge's story tree uses both: clicking a story runs it in the focused trial, and
Shift-click or Shift+Enter opens another trial. Cmd- and Ctrl-click are left to
the browser. The tree's text is a step larger.
