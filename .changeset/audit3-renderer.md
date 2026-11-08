---
"@weasel-js/renderer": patch
"@weasel-js/core": patch
---

Renderer fixes from an audit:

- A tensor mesh patch's four interior points are read in PDF's order (p11 p12 p22 p21), so the second sits beside corner 1 and the fourth beside corner 3; the two were swapped, which twisted any tensor patch whose interior was not symmetric, and `meshHandles` dragged the wrong interior point with corners 1 and 3. A sixteen-point patch authored against the old reading draws differently: swap its points 13 and 15 to keep its shape.
- Cached marker heads are placed again when a stroke's `vertexWidths` change how finely its curve is flattened; a head on a curve could keep the position and angle of the previous widths.
- After a WebGL context restore, a custom program that fails to compile again is dropped rather than drawn with the lost context's program, and a program whose compile failed while the context was being lost is compiled again.
