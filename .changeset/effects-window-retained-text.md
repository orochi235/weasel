---
'@weasel-js/renderer': patch
---

Inside a group's effects buffer, a retained group's surface and the offscreen paint behind text filled with a registered paint kind now cover the buffer's whole window rather than stopping at the drawing buffer. Content of either lying just past the edge of the canvas now feeds a blur or shadow around it, as a direct draw already did.
