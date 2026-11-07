---
'@weasel-js/diagram': patch
---

The `avoid` router found no route, and the connector fell back to `orthogonal`, whenever the target port faced away from the source with no obstacle corner beyond it: bottom to bottom with the target below, east to west with the target to the west, or a self-loop from one side to the next. The search graph had no line crossing the one the route must arrive along. It now casts one just behind each target.
