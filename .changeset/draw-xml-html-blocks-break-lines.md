---
'@weasel-js/diagram-formats': patch
---

Draw-style XML labels break lines at HTML table rows, lists, and other block elements, as a browser lays them out. A `<br>` with attributes breaks a line too.

<!-- entry: fix data -->
