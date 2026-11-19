I couldn't write `.skulk/out/findings.md` because the write wasn't approved, so the whole findings document is below. I also couldn't run `git show`, so I couldn't check last week's diffs closely. One more thing: this checkout's HEAD is `7095f874ee`, not the commit the brief names (`aac71b54…`).

## A non-finite `fadeMs` is accepted at construction and throws from the middle of later edits, leaving the graph half-changed
- where: packages/audio/src/graph/createAudioGraph.ts:30 (createAudioGraph); fallout in packages/audio/src/graph/edits.ts:54-57 (wire), packages/audio/src/graph/transport.ts:28-32,47-58 (fadeOutput/start/stop)
- scenario: `createAudioGraph(ctx, dest, { fadeMs: NaN })` (or `Infinity`) on a running context. Construction succeeds because nothing checks the value. What breaks afterwards:
  - `connect` sets the edge to `open` and builds its fader, then `fader.open(NaN)` throws `RangeError`. The edge stays open at gain 0, and because later `connect`s of the same pair are no-ops, the connection can never be heard.
  - `start()` sets `playing = true`, then throws before any source starts. `isPlaying()` reports true and nothing sounds.
  - `stop()` sets `playing = false`, then throws before the fade is scheduled. The sources never stop, and a second `stop()` does nothing.
  - A `set` with no `rampMs` passes `checkParam`, then throws inside the param.

  It should throw `RangeError` from `createAudioGraph` itself, as the ruling on non-finite audio input requires. `inserts.ts:86` has the same hole.
- evidence: read
- severity: medium

## `replace(id, def)` with the def already in place, or one def added under two ids, disposes a def that is still live, and the later cut throws
- where: packages/audio/src/graph/replace.ts:28-59 (replaceDef) → packages/audio/src/graph/wrapper.ts:89-95 (releaseOutgoing); packages/audio/src/graph/fader.ts:38 (cut)
- scenario: a caller passes the def already in place: `graph.replace('osc', sameDef)`. The outgoing def is now also `w.def`. When the old faders close, `releaseOutgoing` stops and disposes that def, and `shell.dispose` calls `output.disconnect()`, which cuts the new out fader too. The node goes silent while the graph still lists it. A later `remove('osc')` calls `outFader.cut()`, whose `from.disconnect(gain)` targets a connection that is already gone. That throws `InvalidAccessError` inside a timer callback. `add('b', defOfA)` fails the same way. Nothing rejects reusing a def.
- evidence: read
- severity: low

## `settled()` resolves while a connect's or a replace's fade-in is still ramping
- where: packages/audio/src/graph/edits.ts:95-97 (busy), packages/audio/src/graph/edits.ts:54-57 (wire); doc at packages/audio/src/graph/types.ts:59
- scenario: `graph.connect('a', { output: true }); await graph.settled()` on a running context resolves at once. `busy()` counts only:
  - deferred and closing edges,
  - defs a `replace` is fading out,
  - the output fade.

  The new edge's 0→1 ramp, the incoming def's faders after a `replace`, and edges that `sweep` wires are not counted. The doc promises "Resolves once no fade is in flight", so a caller who then reads a tap sees a level partway up the ramp.
- evidence: read
- severity: low

## A non-looping file stopped between its natural end and its `onended` never rewinds, so the next start plays nothing
- where: packages/audio/src/graph/sources.ts:100-104 (createFileSourceNode stop), packages/audio/src/graph/sources.ts:39-48 (sourceShell.end)
- scenario: a file source with `loop: false` reaches the end of its buffer, and the graph stops it before `ended` is dispatched. `shell.live()` is still the node, so `head.stop` and `shell.end` run. `end` replaces `onended` with a handler that skips `onEnd`, so `head.rewind` never runs and the playhead stays clamped at `duration`. The next `graph.start()` starts the node at offset `duration`. It ends at once, silent, and only rewinds then. The user presses Play once and hears nothing.
- evidence: read
- severity: low

## Files read
packages/audio/src/graph/createAudioGraph.ts
packages/audio/src/graph/edges.ts
packages/audio/src/graph/edits.ts
packages/audio/src/graph/errors.ts
packages/audio/src/graph/fader.ts
packages/audio/src/graph/playhead.ts
packages/audio/src/graph/processors.ts
packages/audio/src/graph/replace.ts
packages/audio/src/graph/sources.ts
packages/audio/src/graph/transport.ts
packages/audio/src/graph/types.ts
packages/audio/src/graph/validate.ts
packages/audio/src/graph/wrapper.ts

<!-- done: 4 findings, files read: 13 -->