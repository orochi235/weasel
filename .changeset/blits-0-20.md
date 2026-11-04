---
'@weasel-js/core': patch
'@weasel-js/animator': patch
'@weasel-js/clock': patch
'@weasel-js/labkit': patch
---

Depends on `@msb235/blits` 0.20.0, up from 0.18.0. Neither release breaks anything the kit calls. Among their fixes: a seek back over children that a forward seek passed plays them in order again on the next frame, `inert` no longer reads true after a seek back while a staggered subject still has motion to come, so a frame loop sleeping on it wakes, and a child whose rate is written every frame keeps a bounded history instead of one entry per write.
