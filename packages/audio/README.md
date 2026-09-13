# @weasel-js/audio

Web Audio engine for 2D scenes. No weasel dependencies — positional audio takes
plain `{ x, y }`.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame: `AudioContext.currentTime` is driven by the audio
hardware, ticks independently of `requestAnimationFrame`, and cannot be paused
or time-scaled. Triggering a sound *on* a frame inherits frame jitter, which is
audible.

A hidden tab clamps main-thread `setTimeout` to at least a second, far too late
for a 100 ms lookahead, so the engine wakes each pass from a timer inside a
dedicated Worker instead (`createTickTimer`). The worker is built from an inline
`blob:` URL, so no bundler setup is needed. Where none can be made — no `Worker`
global, or a Content-Security-Policy without `worker-src blob:` — it falls back
to `setTimeout`, and a hidden tab books late again.

A suspended `AudioContext` is a separate matter: its clock stops, and on resume
the engine drops what came due meanwhile rather than firing it all at once.

```ts
const engine = createAudioEngine();
const jump = await engine.load('/sfx/jump.wav');
engine.play(jump, { bus: 'sfx', position: { x: 40, y: 0 } });
```

Browsers start an `AudioContext` suspended until a user gesture. The engine
resumes on the first gesture automatically; `play()` before that drops the voice
with a dev warning rather than queueing it.
