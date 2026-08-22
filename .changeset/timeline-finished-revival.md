---
'@weasel-js/core': patch
---

A finished timeline can be scrubbed back instead of going inert

A non-looping timeline that reached `duration` returned `finished` from its
tick and left the animator's table, but its handle kept answering `time()` and
`duration()` as though it were live. `seek()` moved a playhead nothing ticked —
no error, no state change. The only recovery was to build a new timeline.

`seek`, and an `edit` that extends the duration past the playhead, now
re-register the timeline and it plays on. It still finishes: an entry that
never retires would hold a slot, and the frame loop, open for every timeline
ever created.

- `onDone` fires once per arrival at the end, and again for a replay. A handler
  that seeks back from inside `onDone` keeps the entry live rather than
  stranding the replay it just started.
- Reviving re-registers under the same `cancelKey` without cancelling whoever
  claimed that key meanwhile, and the revived timeline is still cancellable by
  it.
- `cancel()` is final, including on a timeline that had already finished. No
  seek or edit revives a cancelled one.
- A `pause()` or `setTimeScale()` taken while the timeline was off the table
  applies when it comes back, so scrubbing a paused transport does not silently
  start playback.
