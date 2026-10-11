---
'@weasel-js/forge': patch
---

A component's index page says which release the component first shipped in and when its source file was created and last changed. All three are read from git: the dates are the file's first and latest commits, followed back through renames, and the release is the nearest tag after the first. A file in no tagged release yet reads `Unreleased`, and one git has never committed shows nothing. A custom index page gets the part as `History` on its `IndexContext`, and the component graph carries the same facts as `history` on each entry.
