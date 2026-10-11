---
'@weasel-js/history': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/forge': patch
---

history: `swapOp` builds an op that swaps one whole value for another and carries both as `args`, so a serialized history can rebuild the step. `@weasel-js/core` re-exports it with `SwapArgs` and `SwapOpOptions`. `PrefSchemaEditor`'s own swap is now a call to it.

forge: the CSS Vars panel keeps an undo history of a trial's edits. Undo and Redo sit beside the filter, and Mod+Z / Shift+Mod+Z step from anywhere in the panel except the filter's text. Typing a value is one step, and so is a scale edit with every token it regenerates. The steps are kept with the trial, so they outlive a reload, held to the last 100. Saving scales into the theme forgets them. A trial's scale edits are kept with the trial now (`fg-css-vars-scales` was lab-wide), so a scale edited in one trial no longer shows in another.
