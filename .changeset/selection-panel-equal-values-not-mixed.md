---
'@weasel-js/ui': patch
---

`SelectionPanel` read two nodes holding equal paints, lists, or maps as Mixed whenever the values were separate objects, as they are after a load: a fill drew its mixed chip over two identical reds, and a list or map showed the word Mixed with no editor. Values are now compared by content, so equal ones read as one value and stay editable.
