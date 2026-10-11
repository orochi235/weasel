---
'@weasel-js/audio': patch
---

A voice played with `position` kept its full level through `handle.stop(fadeMs)` and then cut off with a click whenever `engine.setListener` or `handle.setPosition` ran during the fade, as it does every frame in a game that follows a camera. The fade now survives those calls, and so does a `handle.setGain(value, rampMs)` ramp, which carries on to the same end time at the new distance's level. `setGain` during a fade-out no longer cancels the fade either.
