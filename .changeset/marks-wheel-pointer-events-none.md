---
'@weasel-js/labkit': patch
---

A wheel over a mark target's input box now finds the scroller under the pointer even when the target is out of hit
testing with `pointer-events: none`, as a forge story is until its first paint. It used to find nothing there, and
the wheel did nothing.
