---
'@weasel-js/ui': patch
---

Fixes: removing the `Tree` row that holds focus, or folding its branch away from under it, dropped focus to the page, and the next arrow key went nowhere. Focus now moves to a row: the removed row's next sibling, else the row above it, which for an only child is its parent. Which row was decided on an agent's judgment. Focus that something else took in the same render stays where it was put.
