Graph drag released at start: missing close-out, stale `previewed` (A) — fixed 4967b8fb2e
Lane tracks narrow by the scrollbar width, so keys drift off the ruler (A) — fixed 00949d79bf (its browser test is unrun here)
Dope drag dims and highlights the wrong key under echoed previews (A) — fixed 81db0cb135
Flat graph lane draws its keys near the bottom (A) — fixed 33a1017d10
insertKey makes the first half of an eased stretch linear (B) — fixed ab21a1e6f8 (the new key takes the next key's easing, as the doc said; the open `docs/unruled.md` question about splitting the easing stays open)
Dragged keys never snap to event times (B) — fixed 341011783c
Graph-mode Delete leaves focus on the wrong key (B) — fixed 65ac4caa40
Selection on a folded nested row stays editable while Delete refuses it (B) — fixed 96e86f447a (my call: folding drops the selection, and a selection given on a row not drawn opens no inspector; recorded in `docs/unruled.md`)
ZOOM_STEP described as one notch's factor (B) — fixed b759f033d4
[r59-8] A controlled `selection` leaves a selected segment selected beside it (carried) — not a defect (no longer applies: 28f3eda9fc made a key selection arriving through `selection` drop the segment, and the "closes when a consumer holding the selection selects a key" test covers it)

Extra: a graph drag that changed only the selection committed its unchanged keys instead of putting its preview back — fixed in 4967b8fb2e, along with the first finding. The fix in `CurveEditor/useLayerGesture.ts` covers every curve layer: a gesture that sent a preview and ends unchanged now ends with `onCancel`.

Checks:
- `npx vitest run --maxWorkers=1` per file: Lane.test.tsx 60 passed; Timeline.test.tsx 51 passed; Timeline.hold.test.tsx 10 passed; AnimatedTimeline.test.tsx 18 passed; TimeRuler.test.tsx 19 passed; TimeRuler.entry.test.ts 1 passed; keys.test.ts 26 passed; keys.pbt.test.ts 4 passed; lanes.test.ts 16 passed; timelineState.test.ts 1 passed; CurveEditor/ (all files) 222 passed.
- Unrun: Timeline.browser.test.tsx.
- `npm run checks:gate`: the first run failed check:size (Timeline.tsx's longest function was 123 lines). After the split, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: fail, "Missing script: lint" (the package has no lint script). Instead, eslint on every changed file passes after one fix (renamed `refocus` to `refocusRef`), and the gate's root `npm run lint` passed.
- `npm run check:changesets`: pass, "OK — 865 changeset(s)". None of the warnings are from these changesets.
- The tree is clean except `.skulkr/`.

tally: 9 of 10 fixed, 1 extra fixed