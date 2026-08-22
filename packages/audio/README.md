# @weasel-js/audio

Web Audio engine for 2D scenes. No weasel dependencies — positional audio takes
plain `{ x, y }`.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame: `AudioContext.currentTime` is driven by the audio
hardware, ticks independently of `requestAnimationFrame`, and cannot be paused
or time-scaled. Triggering a sound *on* a frame inherits frame jitter, which is
audible.

The public surface is still landing: the barrel currently exports a package-name
marker and nothing else. Usage lands with it.
