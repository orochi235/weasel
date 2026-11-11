---
"@weasel-js/plot": patch
---

A git graph's commit given no id takes the first `#n` from its place that no commit holds. It used to take `#` and its place even where an earlier commit had been given that id, and the replay stopped there with `a commit "#2" already exists`, an error about a name the command never wrote.
