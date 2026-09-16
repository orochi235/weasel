---
'@weasel-js/forge': patch
---

A story frame now tells the workshop when its first render has committed, with a new
`rendered` message, and the workshop keeps a freshly loaded frame hidden until then — or
until the frame faults, so a fault still shows. A new or swapped trial no longer flashes
the frame's blank white document before the story appears; the story fades in instead.
