# animator.timeline: saturation

Repeated blind reviews of the area `animator.timeline` (17 files, 1806 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.98, or 40 occasions have run.
Stopped: ready to fix: 8.3 known defects per thousand lines, at least 5. The next defect should cost about $0.55. `skulkr scour report animator.timeline` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.2 |
|   2 | claude |        6 |   5 |        7 |   6 |   1 |       16.0 |    9.0 |    56.3% | $1.41 |    $0.23 |     4.3 |
|   3 | claude |        5 |   3 |       10 |   8 |   1 |       31.3 |   21.3 |    54.7% | $1.05 |    $0.26 |     4.2 |
|   4 | claude |        5 |   1 |       11 |   7 |   2 |       20.2 |    9.2 |    32.7% | $0.92 |    $0.32 |     3.9 |
|   5 | claude |        7 |   4 |       15 |  10 |   2 |       35.0 |   20.0 |    36.4% | $1.08 |    $0.31 |     4.4 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |       14 |       29.2 |   15.2 |    34.1% |       – |
| all sources    | Chao2     |         5 |       15 |       35.0 |   20.0 |    36.4% |       – |
| codex × claude | Chapman   |         – |       15 |       21.5 |    6.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                     | where                                                                                      | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A fractional or NaN loop count is accepted unvalidated and corrupts playhead lap accounting (half laps, lap ID 0.5, NaN lap count)                         | packages/animator/src/timeline/playhead.ts:8                                               |     1 |     1 |      4 | medium   |
| D2  | A huge finite time advance on an endless timeline overflows the lap quotient to Infinity, and Infinity - Infinity leaves the loop budget NaN permanently   | packages/animator/src/timeline/playhead.ts:83                                              |     1 |     1 |      0 | low      |
| D3  | A seek forgets standing bookings, so an event already booked without a handle is booked a second time for the same crossing                                | packages/animator/src/timeline/booking.ts:195 (createBooker → seek)                        |     2 |     0 |      1 | medium   |
| D4  | edit, and a seek that does not revive, on a finished timeline skip the resample that the edit and seek contracts promise                                   | packages/animator/src/timeline/createTimeline.ts:126 (sampleNow)                           |     2 |     0 |      3 | medium   |
| D5  | A nested timeline's events fire with lateBy measured against the nested end instead of the frame                                                           | packages/animator/src/timeline/fireEvents.ts:81 (createEventFirer, nested branch)          |     2 |     0 |      3 | low      |
| D6  | An EventTrack placed twice at the same root offset fires twice, but its second placement is booked once or not at all                                      | packages/animator/src/timeline/booking.ts:124 (scanTrack) and :139 (dedup)                 |     2 |     0 |      1 | low      |
| D7  | With laps left, a seek to the seam of a finished timeline does not revive it, though a live timeline plays on from the same spot                           | packages/animator/src/timeline/createTimeline.ts:115 (rearm)                               |     2 |     0 |      1 | low      |
| D8  | The booker keeps the tracks array captured at creation, while firing, sampling and duration reread opts.tracks, so the two disagree once the tracks change | packages/animator/src/timeline/crossings.ts:33 (createCrossings)                           |     3 |     0 |      1 | low      |
| D9  | Handlers on the outgoing lap's tail run before the frame is sampled                                                                                        | packages/animator/src/timeline/createTimeline.ts:66 (tick)                                 |     3 |     0 |      2 | low      |
| D10 | Editing a track's last key leaves the target showing the old value while onTick gets the new one                                                           | packages/animator/src/timeline/trackHolds.ts:113 (place)                                   |     3 |     0 |      2 | medium   |
| D11 | A paused timeline seeked to its end, or created paused with duration 0, finishes while paused and the event at the end never fires                         | packages/animator/src/timeline/createTimeline.ts:69 (tick)                                 |     4 |     0 |      1 | medium   |
| D12 | Events the playhead played back over (non-positive scale) are never booked when forward playback resumes                                                   | packages/animator/src/timeline/booking.ts:170 (createBooker → tick, `!(scale > 0)` branch) |     5 |     0 |      1 | medium   |
| D13 | bindClip accepts unsorted keys and events, which breaks sampling, holds and event search                                                                   | packages/animator/src/timeline/clipShape.ts:44 (sampled / events)                          |     5 |     0 |      1 | low      |
| D14 | toClip on a cyclic key value or event data overflows the stack instead of naming the offending track                                                       | packages/animator/src/timeline/clip.ts:168 (isClipValue)                                   |     5 |     0 |      1 | low      |
| D15 | targetStops writes the angle unwrap into the key's own value when a target's axes.to returns its input object                                              | packages/animator/src/timeline/targetStops.ts:24 (targetStops)                             |     5 |     0 |      1 | low      |
