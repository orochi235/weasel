---
'@weasel-js/core': patch
---

Add a side-scroller demo that load-tests the animation timeline and the audio
engine. The player is an eleven-joint rig posed by cross-faded
`SampledTrack<Pose>` clips — the run cycle plays on a real `animator.timeline`
whose time scale tracks ground speed, while jump and fall are seeked by vertical
velocity rather than played. Footsteps fire from an `EventTrack` on that looping
timeline, which is the timeline-to-audio bridge under the heaviest load it will
see. Every sound is synthesized into an `AudioBuffer` at load, so the demo ships
no assets.

Its HUD is the point: frame time, active voice count, footstep timing spread and
a swarm control that pushes the voice pool past its limit, so the demo measures
the two arcs rather than merely exercising them.

Findings are recorded in `docs/TODO.md` under Animation. The load-bearing one:
`EventTrack` events are `{ t, fire: () => void }`, and `fire` receives no
arguments, so an audio handler cannot learn the playhead's crossing time and is
quantized to the animation frame instead of the audio clock.
