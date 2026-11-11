---
"@weasel-js/diagram": patch
---

`labelSpotAt` reads a label two stretches of its route are nearest alike on the stretch that stands it where it is, so a label dropped back where it stood no longer jumps to the other. A label at a vertex beside a stretch too short to see reads a route fraction inside 0 to 1, where it could read just below 0.
