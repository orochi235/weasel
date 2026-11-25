# Audit round 37 — audio.graph findings

## A def whose `start` throws leaves the graph playing with later sources never started, and `start()` cannot be retried
- where: packages/audio/src/graph/transport.ts:47 (start), packages/audio/src/graph/wrapper.ts:68 (startWrapper), packages/audio/src/graph/edits.ts:98 (add), packages/audio/src/graph/sources.ts:118 (createOscillatorNode)
- scenario: `createOscillatorNode(ctx, { frequency: NaN })` builds without complaint (unlike `createGainNode({ gain: NaN })` and `createPanNode`, which throw from `initParam` at construction), so the bad value surfaces only in `start`, where `initParam(ctx, osc.frequency, NaN)` throws. In `graph.start()`, `playing` is already `true` and the output fade-in has begun when `startWrapper` reaches that def; `startWrapper` has already set `w.running = true`, so the throw aborts the loop. Every wrapper after it in `deps.live()` stays silent, and a second `graph.start()` returns at `if (playing) return`. Added while playing, `edits.add` has already put the wrapper into `nodes` before `onAdd` throws, so `add` throws but the id is taken (a retry throws "already exists") and its `running` flag says it is playing when it never started. The same happens inside `apply`, after validation passed, so a list that "changes nothing on a structural error" is left half applied. Expected: the oscillator refuses a non-finite `frequency` when it is built, as the other factories do, and a throwing `start` leaves no wrapper marked running and does not stop the sources after it from starting.
- evidence: read
- severity: medium

## `settled()` resolves while a new connection is still fading in
- where: packages/audio/src/graph/edits.ts:95 (busy), packages/audio/src/graph/edits.ts:54 (wire)
- scenario: on a running context, call `graph.connect('osc', { output: true })` and then `await graph.settled()`. `wire` sets `e.state = 'open'` and starts a `fadeMs` ramp to 1, but `busy()` counts only edges whose state is not `'open'`, along with replace crossfades. The output gain's fade-in from `start()` is counted (`transport.busy()`; the test "settled waits for the output fade-in a start begins"), so the contract "Resolves once no fade is in flight" (types.ts:59) holds for one fade-in but not the other. A caller who measures a tap level after `settled()` reads a connection partway through opening. Expected: an edge's open ramp counts as in flight until it lands, as the output's does.
- evidence: read
- severity: low

## A non-looping file source stopped at a future `when` past its end comes back silent, not from the top
- where: packages/audio/src/graph/sources.ts:100 (createFileSourceNode stop), packages/audio/src/graph/sources.ts:39 (sourceShell.end), packages/audio/src/graph/playhead.ts:55 (stop)
- scenario: a 2 s buffer with `loop: false` is started at t=0, and `def.stop(5)` is called at t=1 (a scheduled stop, which `GraphNodeDef.stop(when)` and the playhead's `stop(when, now)` both support). `head.stop` sets `until = 5`, and `shell.end` replaces the node's `onended` with the ending handler, so when the buffer plays out at t=2 neither `head.rewind` nor `ended` runs. The next `start` takes `pos = at(5)`, which `wrap` clamps to `duration` = 2, and starts the node at offset 2: it plays nothing, ends at once, and only then rewinds. The same happens on the graph's own path when its stop (`ctx.currentTime`, after the output fade) lands after the buffer's end but before the main thread has dispatched `ended`. Expected: a non-looping source whose stop falls after its natural end restarts from 0, as one that ended on its own does.
- evidence: read
- severity: low

## `fadeMs` is never checked, so a non-finite value breaks every edit once the context runs
- where: packages/audio/src/graph/createAudioGraph.ts:30 (createAudioGraph)
- scenario: with `createAudioGraph(ctx, dest, { fadeMs: NaN })` (or `Infinity`), every edit works while the context is suspended, because `fade()` returns 0. Once the context is running, `connect` pushes the edge, sets it `'open'` and creates its fader before `fader.open(NaN)` throws from `writeParam`'s `checkParam`. That leaves a live edge that is wired but silent forever, and a repeat `connect` is a no-op because `findLive` finds it. `set` with no `rampMs`, `start` and `stop` throw too, `start` after it has already set `playing = true`. Expected: the option is refused with a `RangeError` at construction, matching the ruled rule that non-finite audio input throws (docs/unruled.md, "Non-finite input to audio").
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
