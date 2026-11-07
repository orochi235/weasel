---
'@weasel-js/diagram-formats': patch
---

Reading draw-style XML whose cells name each other as parents in a circle, or a cell naming itself, no longer hangs or overflows the stack: such cells are read as sitting on the page.
