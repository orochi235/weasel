---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `Select` set directly in a property row shows its value at the row label's size (`--wzl-font-size-sm`) instead of the body size, and sits on the label's baseline. `Select` takes a new `--wzl-select-font-size` hook for this. Before, a theme whose small size differed from its body size drew the value larger than the label and set it off the label's line. labkit's `ControlPanel` no longer centers its dropdown rows. The centering existed to cancel the step that the larger value caused against neighboring slider and checkbox rows.
