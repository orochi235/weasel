Collapsed nested timeline's bar drawn at the parent's start, not the track's `at` (A+B): fixed 3af5ee4cfd
Read-only graph lane's arrow key moving the selection and focus to another key (A): fixed 406c695b35
Rows four or more deep losing their label indent (A+B): fixed 55cd03ffc5
Canceled dope-sheet drag reordering keys that share a time (A+B): fixed e347401d9a
Key drag placing the key through the press-time window (A): fixed 1d8a6ff098
Ruler scrub seeking through the press-time window (A): fixed bc06ca3d2f
Uncontrolled zoomed window not re-clamped when `duration` shrinks (A+B): fixed 1b686d4871
Segment selection surviving a key selected through a controlled `selection`, and surviving edits that renumber its track's keys (A, plus B's graph-mode and external-edit case): fixed 8aa6e47123
Nested timeline with no `duration` drawing a zero-width bar, and a negative one a negative width (B): fixed 08b07eb073. A nested timeline with an infinite `duration` now runs its bar to the window's end.
Releasing a key drag commits against the press-time tracks, undoing an edit made mid-drag (B): fixed 0f30deb1da. This was a behavior call, recorded in `docs/unruled.md`: while a press on the lanes is held, Delete, Backspace and arrow-key edits on a key or the root are refused, and Escape still cancels. Edits that come from the inspector or the consumer during a drag are still not guarded.

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: Lane.test.tsx 56 passed; Timeline.test.tsx 42 passed; TimeRuler.test.tsx 19 passed; timelineState.test.ts (new) 1 passed; Timeline.hold.test.tsx 9 passed; AnimatedTimeline.test.tsx 18 passed; lanes.test.ts 15 passed.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` because three titles were over 140 characters; I shortened them and folded the fixes into their own commits.
- `npm run lint -w @weasel-js/ui`: did not run, because the package has no `lint` script (npm reports the script as missing). In its place, `npx eslint packages/ui/src/components/Timeline` exited 0.
- Tree is clean apart from the untracked `.skulkr/`.

tally: 15 of 15 fixed, 0 extra fixed