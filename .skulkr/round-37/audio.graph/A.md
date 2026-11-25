## A non-finite `fadeMs` is accepted, then every edit on a running context throws partway and leaves stuck state
- where: packages/audio/src/graph/createAudioGraph.ts:30 (createAudioGraph; `fade` at :35), used by edits.ts:54-58 (wire), edits.ts:72-83 (close), fader.ts:47-55 (close), transport.ts:47-51 (start)
- scenario: `createAudioGraph(ctx, dest, { fadeMs: NaN })` (e.g. `parseFloat('')` from a settings field), or `fadeMs: Infinity`, on a running context. `connect('a', { output: true })` pushes the edge, `wire` sets it `'open'` and connects its fader, then `fader.open(NaN)` → `writeParam` → `checkParam` throws. The edge stays in `edges` as open at gain 0, so every later `connect` of the same pair is an idempotent no-op and the connection is silent for good. `disconnect` then calls `fader.close(NaN)`, which sets `closing = true` before `writeParam` throws, so no timer is armed: the edge sits in `'closing'` forever, `edits.busy()` stays true, and `settled()` never resolves. `start()` sets `playing = true` before `fadeOutput` throws, so no source starts while `isPlaying()` reports true and a retry of `start()` is a no-op. The option should be checked when the graph is built (finite, ≥ 0), as `set` checks its own `rampMs`.
- evidence: read
- severity: medium

## `replace(id, def)` with the def already live (or an A→B→A swap while A is still fading out) disposes the live def
- where: packages/audio/src/graph/replace.ts:28-59 (replaceDef), wrapper.ts:89-95 (releaseOutgoing)
- scenario: `graph.replace('osc', sameDef)` while playing, e.g. to re-trigger the crossfade, or `replace('n', A); replace('n', B); replace('n', A)` within `fadeMs`. The outgoing entry's `def` is the same object as `w.def`. `startWrapper` finds the source's shell still live, so `start` does nothing. When the old faders close, `releaseOutgoing` calls `o.def.stop()` (since `o.running` was true) and then `o.def.dispose()` on the def that is still the node's live one. A source shell's `dispose` disconnects its `output`, so the node goes silent for good while `has(id)` stays true and later `set` calls write to dead nodes. Later, `remove`/`dispose` call `def.dispose` a second time, against the "called once" contract in types.ts:15. The code should either reject a def that is already live or outgoing, or not stop and dispose a def that is still `w.def`.
- evidence: read
- severity: low

## A non-looping file stopped after it played out, but before its `ended` event arrived, comes back silent on the next start
- where: packages/audio/src/graph/sources.ts:100-104 (createFileSourceNode stop), sources.ts:39-49 (sourceShell.end), playhead.ts:48-57
- scenario: `createFileSourceNode(ctx, { buffer, loop: false })` reaches the end of its buffer. The `ended` event is queued to the main thread, and `graph.stop()`'s timer runs `stopWrapper` first (the source's end and the stop-fade landing fall in the same few ms). `shell.live()` is still the node, so `head.stop` records `until = now` and `shell.end` replaces `onended` with the "ending" handler. The `onEnd` that would `head.rewind` never runs. The playhead's position at `until` clamps to `duration`, so the next `graph.start()` starts the buffer at offset `duration`. It plays nothing and ends at once, and only that second end rewinds. One `start()` produces silence where it should replay from the top.
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

<!-- done: 3 findings, files read: 13 -->
