- Edits throw on a sequence with a locked part (A+B): fixed 5f34e14bac. This needed a behavior call, which I made and recorded in `docs/unruled.md`: such a sequence takes no edit, its regions are dropped, and `commitSequence` leaves it as it stands, the same rule `redrawSequences` already followed.
- Dragging or adding a participant breaks box membership (A, plus sweep): fixed 72a36983d8. The sweep found that `addParticipant` had the same flaw as `moveParticipant`, so both now go through `settleBoxMembership`.
- The Participant click on empty canvas lays out in the default 12px font, not the theme's (A+B): fixed a1e4ded536.
- The drag preview leaves behind the number digit, the fragment type label and the fragment's own steps (A+B): fixed 0e582ac2ff.
- An activation open at a destroy runs past the cross to the diagram's foot (A+B): fixed 9651c85c51.
- `SEQ_ARROWS` lookups go through the prototype chain, and `setMessageArrow('foo')` throws a TypeError (A+B): fixed 9d4a7559c1. This also needed a behavior call, recorded in `docs/unruled.md`: `insertMessage` and `setMessageArrow` now throw on an unknown arrow name and say which name, and the Message tool's param falls back to a call.
- `setMessageArrow` reads `both: false` or `async: false` as a change (A): fixed 14d1d2087c.

No other defects turned up. One extra commit, 8e842a83bd, shortens the six changeset titles to under 140 characters, because `check:changesets` rejected them.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `sequence/locked.test.ts` (new): pass (1)
  - `edit.test.ts`: pass (10)
  - `author.test.ts`: pass (9)
  - `authorActions.test.ts`: pass (16)
  - `actions.test.ts`: pass (6)
  - `layout.test.ts`: pass (10)
  - `authorSteps.test.ts`: pass (17)
  - `specs.scene.test.ts` and `selected.test.ts`: pass (10, 5)
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run had 2 of 32 failing on a TS18048 in `actions.test.ts`; I folded the fix into 0e582ac2ff and reran.
- `npm run check:changesets`: "OK — 2033 changeset(s)"
- `npm run lint -w @weasel-js/diagram`: the package has no `lint` script (npm error). `npx eslint packages/diagram/src/sequence`: pass.
- The working tree is clean, and `.skulk/` is untouched.