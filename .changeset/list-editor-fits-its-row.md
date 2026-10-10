---
'@weasel-js/ui': patch
---

`ListEditor` no longer holds a 28rem minimum width. It asks for 28rem and gives way to a
narrower container, so in a form row it stays inside its control cell rather than running
out past the label.
