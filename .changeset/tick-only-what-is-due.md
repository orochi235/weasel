---
'@weasel-js/animator': patch
---

A frame no longer calls every animation. A tween on a target with no `onTick` has nothing to do until it ends, and a hold has nothing to do at all, so neither is ticked on a frame: the first is woken when its own clock reaches its duration, pauses and time scales counted. A frame also calls only the moving targets that have a `show`. With 10,000 tweens running on targets nothing reads, a frame took 1.25 ms and takes 0.28; with 10,000 target table rows each under a hold of plain values, 0.85 ms and now 0.30 (both trees' animators run in one process in alternating blocks of frames, fastest block of each, on a machine busy with other work; `node tests/perf/target-reads/run.mjs table 10000 idle` and `... held` time the same frames alone).

Each animation's clock is now read off the animator's own, not summed frame by frame, which changes one thing a caller can see. Animations started while the animator is idle used to be charged the wait for the first frame each from its own start; they are now all charged from the first one's start, as their values already were. Two tweens of one duration started a few milliseconds apart before any frame therefore end on the same frame.
