Dragging one step rewrote every untouched step holding more than four decimals, and on a factors scale it lost the dragged factor (A+B): fixed 1d579cf532

Switching a scale with base 0 to factors flattened every step to the base (A): fixed 5b4c2a5c03

A dragged factors step whose factor rounds to zero did nothing, though round 59 ruled it is overridden (A): fixed c384f03df7

A shadow whose color nests a function, such as `color-mix(… rgb(…) …)`, was typed `string` (A): fixed a72aee3341

`dvw`/`svw`/`lvw`/`vi`/`vb`/`cqi`/`cqb`/`cqmin`/`cqmax` were not dimensions (A): fixed 6f44fee1c5. The fix also covers `cap`, `ic`, and the `r`-prefixed root forms.

Escape on a scale drag left the step overridden at its old value, or refit its factor (B): fixed 0440be8cc7

A pick on a transparent color wrote alpha 0, so it stayed invisible (B): fixed 1b8d4b65a5

A scale of whole numbers could only be dragged or stepped in whole units (B): fixed b6fb437622. This needed a behavior call, so I made it and recorded it in `docs/unruled.md` under "Audit round sixty-five". The slider now rounds finely enough to move the smallest step by a third of itself, so `1rem 2rem 4rem` steps by 0.1rem and `3px 5px 14px` still by 1px.

A long scale name ran under its reset button (B): fixed cd63056dcf

A token overridden to an empty value showed the unset gray instead of the overridden accent (B): fixed 9ca26d8812

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: TokenPanel.test.tsx 30 passed; tokenTypes.test.ts 7 passed; color.test.ts 4 passed. Untouched files in the same folder: tokenTypes.pbt.test.ts 6 passed; tokenTypes.long.pbt.test.ts 4 passed; TokenPanel.hold.test.tsx 5 passed.
- TokenPanel.browser.test.tsx: unrun (browser). It carries the new tests for cd63056dcf and 9ca26d8812.
- `npm run check:changesets`: pass ("OK — 3599 changeset(s)").
- `npm run checks:gate`: pass ("all 32 passed"), after fixing a `check:spacing` failure in cd63056dcf.
- `npm run lint -w @weasel-js/ui`: there is no such script ("Missing script: \"lint\""). The root `npm run lint` passed inside the gate.

tally: 10 of 10 fixed, 0 extra fixed