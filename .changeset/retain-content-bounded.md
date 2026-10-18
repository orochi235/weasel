---
'@weasel-js/renderer': patch
---

A retained group's surface covers only the device pixels its children can
paint, clamped to the drawing buffer, and is composited as a quad over just
that rect; the multisampled buffer it is drawn in is as large as the largest
surface rather than the canvas. A layer's retained memory now follows its
content: a small layer on a large canvas holds a small texture. Text, custom
shaders and `effects` cannot be bounded yet, so a surface holding them still
covers the whole buffer unless a clip around them bounds it. Content wholly
off the buffer keeps no texture and composites nothing.
