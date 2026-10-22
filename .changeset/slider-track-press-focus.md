---
"@weasel-js/ui": patch
---

A press on a `Slider`'s track or curved band focuses the thumb it moves again, so the arrow keys carry on from there.
The thumb was looked up by its CSS-module class, which composes a second class, so the selector named two classes
and matched nothing: no thumb took focus, straight or curved. The same lookup let a press on a thumb fall through to
the track's handler. Thumbs are now found by their `slider` role.
