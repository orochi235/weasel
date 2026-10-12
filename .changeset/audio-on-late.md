---
'@weasel-js/audio': patch
---

Adds API, on an agent's judgment: `onLate(lateMs, when)` on `createAudioEngine` and `createScheduler`. It is called for each voice or scheduled callback that came due after its time because the main thread stalled for longer than the lookahead, with how late it was, in ms on the audio clock. An event booked inside the lookahead, or for a time already past, is not reported: no pass was meant to catch it.
