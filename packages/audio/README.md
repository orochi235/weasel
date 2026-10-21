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

The worker times the pass, but the pass itself runs on the main thread, so a
stall there longer than the lookahead starts whatever came due late. The
`onLate(lateMs, when)` option reports each one; if it fires, raise `lookahead`.
Or pass `synthVoices: 'worklet'`: `playNote` and `playNoise` voices are then
rendered in an `AudioWorkletProcessor` from events posted when they are played,
so one played ahead of a stall starts on time. The processor loads from a
`blob:` URL (CSP: `script-src blob:`); until it has, and where it cannot,
synth voices play on nodes.

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

`onDone` is called when a voice's source ends: it played out, or was stopped,
faded or stolen. A voice that never played calls `onDrop(reason)` instead, with
`'locked'`, `'disposed'`, `'stopped'`, `'unready'`, `'failed'` or `'stale'`, so
code chaining one sound after another hears about both.

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

A `wave` of `{ partials }` sums sine oscillators at any ratios of the pitch,
each with its own level and an optional exponential `decay` (a time constant in
ms) — the partials of a bell, a bar or struck metal, which sit off the harmonic
series where a `PeriodicWave` cannot reach. Levels are scaled to sum to 1.
`partialPresets` holds a `bell`, `marimba` and `metal` to start from.

`playNoise` is the same kind of voice with white, pink or brown noise as its
source, looped from a buffer made once per color per context. Either voice takes
a `filter`: a biquad ahead of the envelope, whose cutoff can follow an envelope
of its own, at `frequency + amount × level`.

```ts
engine.playNote({ pitch: 'C5', wave: partialPresets.bell, duration: 1500, envelope: { release: 800 } });
engine.playNote({ pitch: 310, wave: { partials: [{ ratio: 1, decay: 110 }, { ratio: 1.71, gain: 0.5, decay: 80 }] } });
// A thump: lowpassed noise whose cutoff falls from 4 kHz to 80 Hz.
engine.playNoise({
  noise: 'white', duration: 20, envelope: { release: 120 },
  filter: { frequency: 80, amount: 4000, envelope: { attack: 0, decay: 60, sustain: 0 } },
});
```

`renderNote` and `renderNoise` compute the same voices as samples, with no
`AudioContext`: a `Float32Array` of the whole note through its release, to put
in an `AudioBuffer` and `register`. `createNoteKernel` and `createNoiseKernel`
are the block-at-a-time form, with `release()` and `retune()`, for rendering
inside an `AudioWorkletProcessor`. A square or a sawtooth is band-limited and a
harmonic past Nyquist is left out, so they do not alias; pan, position, and
routing are not a kernel's.

```ts
const samples = renderNote({ pitch: 'C5', wave: partialPresets.bell, duration: 1500 }, ctx.sampleRate);
const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
buffer.getChannelData(0).set(samples);
const bell = engine.register(buffer);
```

`createPatternPlayer` is a step sequencer on top. Events sit on steps — a note
or a noise with a `length` in steps, or a buffer `sound` — and each step is
booked through `engine.schedule` only when the lookahead window reaches it, so `setTempo` and
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

A `step` can be fractional: `{ step: 2.25 }` sounds a quarter of a step after
step 2, which is how a pattern swings or a hit drags. The player's `detune` is
cents added to every event, as a number or a function of the event's step, for
a loop that drifts in pitch. `patternVoicePeaks(events, opts)` returns the most
voices the pattern holds at once on each bus, to check against `voiceLimit`
before it plays.

## Generative scoring

`createScore` writes music from a mood instead of choosing a clip. A mood is
three numbers — `valence` (-1 dark to 1 bright), `tension` and `urgency` (0 to
1) — and each one moves its own musical parameters: valence picks the mode, the
register and how open the chords are; tension picks the harmony and how many
layers build up; urgency picks the tempo, the pulse, the articulation and how
often the chord changes.

```ts
const score = createScore(engine, {
  mood: { valence: -1, tension: 1, urgency: 0 },
  bus: 'music',
  onBar: (state) => {
    label.textContent = `${state.cue.name}: ${state.params.mode}, ${state.params.tempo} bpm`;
  },
});
score.start();
score.setMood({ valence: 0, tension: 0.7, urgency: 1 }); // from the next bar line
```

The corners of that space are the stock devices of documentary and news
scoring, listed in `scoreCues` with a sentence each on what they do: `dread`,
`investigation`, `wonder` and `urgency`. They work on a listener without asking
them, so the score says what it is doing: `state()` and `onBar` give the cue in
force, each cue's share of the mood (`cue.weights`), and every parameter the bar
was written from. Show it.

The layers underneath are usable on their own: `scoreParams(mood)` resolves a
mood, `scoreChord` and `scoreBar` write a chord and a bar of pattern events
from the parameters, and `readScoreCue(mood)` names the cue.

## Insert effects

Each bus has an ordered insert chain, `engine.bus(name).inserts`, between where
its voices connect and its fader, so mute, solo and the bus gain act on the
processed signal. An effect is anything with an `input` and an `output` node.
The built-ins are `createFilterEffect` (a biquad), `createReverbEffect`
(convolution from an impulse buffer, with a wet/dry mix), `createDelayEffect`
(a feedback delay with a mix) and `createCompressorEffect` (with a makeup gain).
Your own nodes go in the same way: `{ input: shaper, output: shaper }`.

```ts
const music = engine.bus('music').inserts;
const lowpass = music.add(createFilterEffect(engine.context, { frequency: 800 }));
const room = music.add(createReverbEffect(engine.context, { impulse, mix: 0.3 }), { bypassed: true });
room.bypass(false);
room.moveTo(0);
lowpass.remove();
```

Edits never click. `bypass` crossfades the slot's wet and dry routes. `add`,
`remove` and `moveTo` build the new route beside the old one and crossfade
between them, one splice at a time, so `slots()` shows an edit at once while the
audio follows over a few fades; `settled()` resolves when it has caught up. The
fade is `insertFadeMs`, default 15. A move is a splice out and a splice back in,
so the moved effect drops out for one fade. A removed effect's `dispose` runs
once it has left the graph.

## Patchable graph

`engine.graph(bus)` returns a graph of nodes feeding that bus's input (the
first bus by default), which can be edited while it plays. Every structural
edit crossfades — `add`, `remove`, `replace`, `connect`, `disconnect` — and
`set` ramps a param. Sources are `createFileSourceNode` (a looping buffer),
`createOscillatorNode` and `createNoiseNode`; `createGainNode`,
`createPanNode`, `createMixNode`, `filterNode`, `delayNode`, `reverbNode` and
`compressorNode` process, and `insertNode` wraps any insert effect. `tap(id)`
puts an analyser on a node. The graph is disposed with the engine.

```ts
const g = engine.graph('music');
g.add('osc', createOscillatorNode(engine.context, { frequency: 220 }));
g.add('echo', delayNode(engine.context, { time: 300, feedback: 0.4 }));
g.connect('osc', { node: 'echo', port: 'in' });
g.connect('echo', { output: true });
g.start();
g.replace('osc', createOscillatorNode(engine.context, { wave: 'square', frequency: 220 }));
```

## Streaming

`load` and `decode` hold a whole sound in memory, which is wrong for a long
music track. `engine.stream` plays one from an `HTMLMediaElement`, or a URL it
makes one for, through a `MediaElementAudioSourceNode`:

```ts
const bed = engine.stream('/music/theme.ogg', { bus: 'music', loop: true, gain: 0.6 });
bed.stop(800);
```

It is a voice like the others: a `VoiceHandle`, the bus's inserts and voice
pool, `cancelKey`, `onDone`, `onDrop`, position and pan. What does not carry over:

- **No `when`.** The element starts once it has buffered enough; the start is
  not sample-accurate and cannot be booked ahead on the audio clock.
- **No `detune`.** `rate` is the element's `playbackRate`, which keeps pitch
  unless you set the element's `preservesPitch` to false.
- **One stream per element.** An element can be routed into a graph once, and
  has one playhead, so streaming an element that is already playing stops the
  earlier voice.
- **Cross-origin media needs CORS.** Pass `crossOrigin: 'anonymous'` for a URL
  on another origin, or the graph receives silence.

A stream counts toward its bus's voice limit and can be stolen, so give music a
bus of its own.
