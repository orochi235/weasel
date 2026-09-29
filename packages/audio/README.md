# @weasel-js/audio

Web Audio engine for 2D scenes. No weasel dependencies — positional audio takes
plain `{ x, y }`.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame: `AudioContext.currentTime` is driven by the audio
hardware, ticks independently of `requestAnimationFrame`, and cannot be paused
or time-scaled. Triggering a sound *on* a frame inherits frame jitter, which is
audible. A `play()` whose `when` is already inside the window does not wait for
the next pass: it is booked at the end of the task that called it.

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

## Notes and patterns

`playNote` plays a synthesized voice — an `OscillatorNode` under an ADSR
envelope — with no buffer at all. It is a voice like a buffer voice: the same
handle, bus pool, stealing and `cancelKey`. Pitch is hertz, a name (`'C#4'`) or
`{ midi: 61 }`. `wave` is a built-in shape or the amplitudes of harmonic
partials, built once into a `PeriodicWave` and reused. A note with a `duration`
releases on its own; one without holds until `release()`, which runs the
envelope's release from wherever it has got to.

```ts
const pluck = { wave: [1, 0.5, 0.33], envelope: { attack: 4, decay: 120, sustain: 0.3, release: 80 } };
engine.playNote({ ...pluck, pitch: 'E4', duration: 150, bus: 'music' });
engine.playNote({ pitch: 260, duration: 80, glide: { to: 660 } });
```

`createPatternPlayer` is a step sequencer on top. Events sit on steps — a note
with a `length` in steps, or a buffer `sound` — and each step is booked through
`engine.schedule` only when the lookahead window reaches it, so `setTempo` and
`setEvents` take effect from the next step. A step that fires more than a step
late skips ahead in phase instead of playing what it missed in a burst.

```ts
const player = createPatternPlayer(engine, {
  tempo: 120, // four steps a beat by default
  events: [
    { step: 0, pitch: 'C3', length: 8, wave: 'triangle' },
    { step: 4, sound: snare },
  ],
});
player.start();
player.setTempo(140);
```
