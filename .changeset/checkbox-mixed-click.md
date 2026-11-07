---
'@weasel-js/ui': patch
---

A mixed `Checkbox`, and a mixed boolean `PropertyField` drawn as a checkbox, keep their mixed mark through a click their owner does not answer — a read-only box, or a controlled one whose owner leaves it mixed. The browser cleared `indeterminate` on the click, and nothing put it back until the next render.
