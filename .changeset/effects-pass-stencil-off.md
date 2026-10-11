---
'@weasel-js/core': patch
---

A group with `effects` whose last child was a group clipped by anything but an axis-aligned rect (an ellipse, a rounded rect, a rotated rect) drew nothing at all. The effect passes now turn the stencil test off themselves instead of inheriting it from that child.
