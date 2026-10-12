---
'@weasel-js/audio': patch
---

Adds API: generative scoring from a mood, designed on an agent's judgment and checked only against a fake audio context. Nobody has listened to it yet.

- `createScore(engine, { mood, tonic?, bus?, gain?, seed?, onBar? })` plays music written a bar at a time from a `ScoreMood`: `valence` (-1 to 1), `tension` and `urgency` (0 to 1). `setMood` lands on the next bar line, tempo included. `state()` and `onBar` report the cue in force, each cue's share of the mood, and every parameter the bar was written from, so a consumer can show what is being applied.
- `scoreParams(mood)` resolves a mood to `ScoreParams`. Each parameter follows one axis: valence sets the mode, register and spread; tension the harmony and layer count; urgency the tempo, pulse density, articulation, harmonic rhythm and attack.
- `scoreCues` lists the four named devices (`dread`, `investigation`, `wonder`, `urgency`) with the mood that produces each and a sentence on what it does; `readScoreCue(mood)` names the nearest and weighs the rest.
- `scoreChord` and `scoreBar` write a chord as MIDI notes and a bar as pattern events, for a `createPatternPlayer` of `SCORE_BAR_STEPS` steps. `scoreModes` holds the scales.
