---
'@weasel-js/ui': minor
---

`useScrollSpy` marks the last section shown once its container is scrolled to the end, even one too short to reach the top.

So a click on that section's rail item keeps it marked after the scroll settles. `pickActiveSection` takes the container's height at its end as an optional third argument for this.

<!-- entry: fix api -->
