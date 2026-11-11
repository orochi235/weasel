---
"@weasel-js/plot": patch
---

A quadrant chart finds a point's class among its own `classes` only. `setQuadrantPointClass` and the point table's class column took `constructor`, `toString`, or `__proto__` as a class the chart held, because every object inherits them, and gave the point a class that does not exist.
