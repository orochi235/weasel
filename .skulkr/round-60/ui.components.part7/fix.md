ResizeHandle commits a release size `onInput` never got (A+B): fixed 678be4b09c

Muted or plain stacked QuantityText reads its value twice (A+B): fixed 5fc00b3320

Another tab's `localStorage.clear()` (null `key`) never reaches recent colors (A+B): fixed 3b40f03057

Radio overwrites a consumer's `aria-describedby` when it has a note (A): fixed c310222750

RecentColorsProvider provides `null` once `store` is removed after mount (A+B): fixed 3957086b97

ReorderHandle's refocus flag outlives the move and steals focus later (A+B): fixed 4968b4cd87. The handle now also gets focus back when a memoized row moves without re-rendering it.

RadioArc lab keeps a pick the radios no longer offer (B): fixed b22749adad. This is a story lab, so it has no changeset.

No extra defects. The sweep for null-key storage handlers found that `packages/storage/src/webStorage.ts` already handles a null key.

Notes:
- The existing ResizeHandle test "reads a move with no button held as the release that never arrived" asserted that `onInput` was *not* called, which is the bug itself. It now expects `onInput(300)`.
- Canceling a drag before any move now commits the raw `value`, not the snapped one, since that is where the pane sits.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. ResizeHandle.test.tsx 24/24, QuantityText.test.tsx 12/12, recentColors.test.ts 16/16, recording.test.tsx 8/8, RadioGroup.test.tsx 9/9, ReorderHandle.test.tsx (new) 3/3, RadioArcView.test.tsx (new) 1/1. Every new test failed before its fix.
- No browser test files touched, so none unrun.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` on three titles over 140 characters; I fixed those into their own commits and reran.
- `npm run lint -w @weasel-js/ui`: fail, "Missing script: "lint"". The package has no lint script, so I ran `npx eslint` on every changed file instead: pass, exit 0.
- Tree clean; `.skulkr/` untouched.

tally: 12 of 12 fixed, 0 extra fixed