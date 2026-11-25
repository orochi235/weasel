- Booking with an infinite duration booked every event at clock time NaN and never retimed (A+B): fixed 4ef2b0d72d
- A track or nested timeline used in two places was booked at only one of them (A+B): fixed 5cb6509a4b
- A cancel from an event handler during the wrap's tail flush reopened target holds (A): fixed b6a1cd14b0
- A cancel from a sampled track's `onTick` reopened later tracks' holds and fired one more event (A): fixed b6a1cd14b0. This is the same root cause as the line above, so one fix covers both: the sampler stops at a cancel, and the tick returns once canceled.
- A nested timeline's negative duration counted as 0 for firing but stayed negative for sampling and booking (A+B): fixed ac0cb2db04. All three now read it through a new `length.ts` `nestedLength`.
- `toClip` wrote a non-finite duration, `at`, `t`, weight or bezier point, which `bindClip` then refused (A+B): fixed 8d171969c2. I made the strict call (an infinite `duration` throws, naming where) and recorded it in `docs/unruled.md`.
- `rearm` knew only the forward end, so a timeline finished forward could not be revived to play backward, and one finished backward was revived at 0 and called `onDone` again (A): fixed ff66483cef
- A reversed loop that landed exactly on 0 with laps behind it ended, instead of playing on into the lap before (B): fixed 0c5e118615
- `bindClip` accepted a key with no value, which then threw only when first sampled (B): fixed bae1188041

Extra commits:
- 80199b390d: brings `booking.ts` and `createTimeline.ts` back within their `check:size` allowances. They had grown by 5–6 lines; this moves code into module-level helpers (`placesOf`, `pullBack`, `atEnd`) and drops a cancel check made redundant by the sampler's.
- 161e23cf48: shortens four changeset titles to fit the 140-character limit.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/animator/src/timeline/booking.test.ts`: pass (30)
- `npx vitest run --maxWorkers=1 packages/animator/src/timeline/holds.test.ts` (new): pass (3)
- `npx vitest run --maxWorkers=1 packages/animator/src/timeline/clip.test.ts`: pass (24)
- `npx vitest run --maxWorkers=1 packages/animator/src/timeline/clipShape.test.ts` (new): pass (2)
- `npx vitest run --maxWorkers=1 packages/animator/src/timeline/revival.test.ts`: pass (27)
- `npx vitest run --maxWorkers=1 packages/animator` (whole package): pass (944 tests, 106 files)
- `npm run typecheck:packages -- animator`: pass ("1/1 animator ok")
- eslint on the 12 changed files: pass (exit 0)
- `npm run check:size`: pass (exit 0)
- `npm run check:changesets`: pass ("OK — 1339 changeset(s).")
- No browser test files touched. The tree is clean apart from `.skulk/`.