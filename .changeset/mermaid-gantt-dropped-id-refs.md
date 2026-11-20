---
'@weasel-js/diagram-formats': patch
---

The Mermaid gantt writer no longer writes `after` or an end naming a task id it had to drop.

Such a task follows the task before it, or lasts a day, with a warning.

<!-- entry: fix data -->
