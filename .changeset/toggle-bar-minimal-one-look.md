---
'@weasel-js/ui': patch
---

`ToggleBar`'s `minimal` variant draws what `ButtonBar`'s and `OptionsBar`'s draw: bare rounded segments with a gap between them. It used to add a bordered box with square corners and a rule between neighbors, which no other bar had. Breaking for anything that relied on that box; a bar that should read as one outlined group is the `flat` variant.
