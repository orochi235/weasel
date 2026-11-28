# audio: saturation

Repeated blind reviews of the area `audio` (47 files, 5219 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.74, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.74. `skulkr scour report audio` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.1 |
|   2 | claude |        3 |   3 |        6 |   6 |   0 |       13.5 |    7.5 |   100.0% | $2.39 |    $0.43 |     6.1 |
|   3 | claude |        4 |   2 |        8 |   6 |   2 |       14.0 |    6.0 |    45.0% | $3.02 |    $0.70 |     9.3 |
|   4 | claude |        6 |   3 |       11 |   8 |   1 |       35.0 |   24.0 |    46.2% | $2.01 |    $0.69 |     7.4 |
|   5 | claude |        6 |   5 |       16 |  13 |   1 |       83.6 |   67.6 |    54.4% | $2.02 |    $0.60 |     7.4 |
|   6 | claude |        4 |   2 |       18 |  14 |   2 |       58.8 |   40.8 |    49.0% | $2.05 |    $0.65 |     8.1 |
|   7 | claude |        4 |   1 |       19 |  15 |   1 |      115.4 |   96.4 |    47.3% | $1.28 |    $0.68 |     5.9 |
|   8 | claude |        2 |   0 |       19 |  14 |   2 |       61.9 |   42.9 |    40.8% | $1.79 |    $0.77 |     6.5 |
|   9 | claude |        5 |   3 |       22 |  16 |   3 |       59.9 |   37.9 |    40.2% | $2.22 |    $0.77 |     8.6 |
|  10 | claude |        4 |   1 |       23 |  16 |   4 |       51.8 |   28.8 |    36.1% | $1.97 |    $0.82 |     7.7 |
|  11 | claude |        3 |   0 |       23 |  14 |   6 |       37.8 |   14.8 |    28.7% | $2.23 |    $0.92 |     8.4 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |        10 |       21 |       31.8 |   10.8 |    25.7% |       – |
| all sources    | Chao2     |        11 |       23 |       37.8 |   14.8 |    28.7% |       – |
| codex × claude | Chapman   |         – |       23 |       43.0 |   20.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                            | where                                                                                                                        | first | codex | claude | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | An in-flight decode stores its buffer in the sound cache after the engine's dispose has cleared it, so a disposed engine can hold newly cached buffers                                            | packages/audio/src/soundCache.ts:62                                                                                          |     1 |     1 |      5 | medium   |
| D2  | A throwing late-event callback runs outside the try block, dropping the rest of the batch and skipping the rearm while the scheduler still counts as running, so start() cannot restore the timer | packages/audio/src/scheduler.ts:95                                                                                           |     1 |     1 |      0 | medium   |
| D3  | An engine created on an already suspended context starts with suspendedSince false, so the first resume never sets staleFloor and elapsed voices skip the backlog check                           | packages/audio/src/resumeWatch.ts:21                                                                                         |     1 |     1 |      0 | medium   |
| D4  | stop(), cancelKey() and stopAll() on a voice started inside the lookahead but not yet heard report onDone, where release() reports onDrop('stopped')                                              | packages/audio/src/voices.ts:173 (voiceHandle.stop)                                                                          |     2 |     0 |     10 | medium   |
| D5  | catchUp() on a voice being torn down can steal an unrelated sounding voice                                                                                                                        | packages/audio/src/voices.ts:174 (voiceHandle.stop)                                                                          |     2 |     0 |      3 | medium   |
| D6  | A freed sound's drop warns that the engine never loaded it                                                                                                                                        | packages/audio/src/createAudioEngine.ts:107 (bufferStarter.ready)                                                            |     2 |     0 |      1 | low      |
| D7  | A finite value past float32's range passes every audio param check, then throws from the AudioParam after writeParam has already canceled the ramp in flight                                      | packages/audio/src/param.ts:20 (writeParam / checkParam / checkGain / checkFinite / checkRate)                               |     3 |     0 |      1 | medium   |
| D8  | A voice pan past float32's range throws during launch and leaks a voice chain still wired to the bus                                                                                              | packages/audio/src/voiceChains.ts:46 (createChainPool.take), packages/audio/src/voices.ts:270 (launch)                       |     3 |     0 |      1 | low      |
| D9  | setTempo called outside a step moves the already-booked step's end, unlike the in-onStep path                                                                                                     | packages/audio/src/patternPlayer.ts:285 (createPatternPlayer → setTempo)                                                     |     4 |     0 |      1 | medium   |
| D10 | patternVoicePeaks leads each voice by lookahead only, but the slot is taken up to lookahead + tickInterval early, so the peak count is too low                                                    | packages/audio/src/patternLoad.ts:52 (patternVoicePeaks, lead)                                                               |     4 |     0 |      1 | low      |
| D11 | setEvents(events, length) called from beforeStep applies the new events to a step index computed with the old length                                                                              | packages/audio/src/patternPlayer.ts:220 (fire: step = count % length read before beforeStep)                                 |     4 |     0 |      2 | low      |
| D12 | An insert effect whose nodes cannot be wired makes add throw while leaving the slot in order, so every later chain edit throws again                                                              | packages/audio/src/inserts.ts:130 (chain.add), packages/audio/src/insertSlot.ts:27 (buildSlot)                               |     5 |     0 |      1 | low      |
| D13 | Partials whose gains sum past the double range normalize to 0, so a note with large gains is silent                                                                                               | packages/audio/src/synthVoice.ts:107 (resolvePartials)                                                                       |     5 |     0 |      2 | low      |
| D14 | resolveEnvelope passes NaN through despite promising every value in range                                                                                                                         | packages/audio/src/envelope.ts:24 (resolveEnvelope)                                                                          |     5 |     0 |      1 | low      |
| D15 | createNoiseKernel/renderNoise index past the table when random returns 1 or a negative, writing NaN                                                                                               | packages/audio/src/voiceKernel.ts:186 (createNoiseKernel)                                                                    |     5 |     0 |      1 | low      |
| D16 | load called after dispose still fetches and decodes                                                                                                                                               | packages/audio/src/soundCache.ts:52 (load), packages/audio/src/createAudioEngine.ts:316 (dispose)                            |     5 |     0 |      1 | low      |
| D17 | The 'quietest' steal policy never sees a fading or releasing voice's level fall, so it ranks voices by a stale gain                                                                               | packages/audio/src/voices.ts:184 (voiceHandle.setGain), packages/audio/src/voices.ts:173 (stop fade path)                    |     6 |     0 |      2 | low      |
| D18 | A worklet voice that ended before the scheduler reached it still takes a pool slot and can steal a live voice                                                                                     | packages/audio/src/voices.ts:128 (startVoice), packages/audio/src/worklet/workletVoices.ts:36 (workletSource onended setter) |     6 |     0 |      1 | low      |
| D19 | A fade short enough to finish synchronously makes the insert pump overwrite the cancel of the next crossfade                                                                                      | packages/audio/src/insertPump.ts:52 (pump)                                                                                   |     7 |     0 |      2 | low      |
| D20 | A voice whose start throws has already stolen a sounding voice                                                                                                                                    | packages/audio/src/voices.ts:133 (startVoice)                                                                                |     9 |     0 |      2 | low      |
| D21 | A stream rate that passes checkRate still makes the element's playbackRate setter throw a non-RangeError                                                                                          | packages/audio/src/streamStarter.ts:91 (createStreamStarters.starter / retune)                                               |     9 |     0 |      2 | low      |
| D22 | checkScoreMood lets a missing axis through, so every bar's notes throw                                                                                                                            | packages/audio/src/scoreMood.ts:59 (checkScoreMood)                                                                          |     9 |     0 |      1 | low      |
| D23 | patternVoicePeaks measures a fractional-step event's slot from the event's own time, but the slot is taken a lookahead before the event's step boundary, so it under-counts voices                | packages/audio/src/patternLoad.ts:62 (patternVoicePeaks, from: at - lead)                                                    |    10 |     0 |      1 | medium   |
