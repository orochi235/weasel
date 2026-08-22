# @weasel-js/audio

Web Audio engine for 2D scenes. No weasel dependencies — positional audio takes
plain `{ x, y }`.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame: `AudioContext.currentTime` is driven by the audio
hardware, ticks independently of `requestAnimationFrame`, and cannot be paused
or time-scaled. Triggering a sound *on* a frame inherits frame jitter, which is
audible.

A hidden tab is the limit of that. Browsers clamp `setTimeout` to at least a
second there, so the pass runs far too late for a 100 ms lookahead and anything
booked while the tab is away arrives late. The clock keeps running, so ordering
survives; on return the engine drops what came due meanwhile rather than firing
it all at once. Moving the tick to a Worker would fix it and is not built.

```ts
const engine = createAudioEngine();
const jump = await engine.load('/sfx/jump.wav');
engine.play(jump, { bus: 'sfx', position: { x: 40, y: 0 } });
```

Browsers start an `AudioContext` suspended until a user gesture. The engine
resumes on the first gesture automatically; `play()` before that drops the voice
with a dev warning rather than queueing it.
