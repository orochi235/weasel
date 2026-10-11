---
'@weasel-js/core': patch
---

Timeline events at the edge of a seek or a paused start now follow one rule: an event the playhead is sitting on fires, and books, when playback next advances from there, and never while paused. A timeline created with `autoplay: false` no longer fires its `t = 0` event before it is resumed, and `seek(t)` no longer swallows the event at `t`, so `seek(0)` replays the opening event as a loop wrap does. This is a behavior change for a caller that seeks onto an event.
