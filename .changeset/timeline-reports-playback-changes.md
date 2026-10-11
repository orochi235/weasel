---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A timeline handle has `subscribePlayback(cb)`, notified on `pause`, `resume`, `seek`, `setTimeScale`, `setLoop`, a cancel, and the playhead reaching the end; `subscribe` still reports edits only. `AnimatedTimeline` listens to it, so a resume, pause, or seek made on the handle from the app's own controls moves its playhead and Play button. Anything implementing `TimelineHandle` by hand needs the new method.
