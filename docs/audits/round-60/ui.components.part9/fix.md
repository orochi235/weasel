Backspace at the start of typed text leaves TokenField text alone (B): fixed 460c0d7fed (changeset title shortened in 82bc045775)

Focus drops to the page when typing fills TokenField to `maxItems` (A): fixed 5c30d11cc9

Focus drops to the page when typing fills TokenField to `maxItems` (B): duplicate of A's finding, fixed 5c30d11cc9

Pasted text with commas becomes one token (A): fixed 7c8bad2f44. Each comma in pasted or composed text now ends a token. Text past `maxItems`, or text that `create` refuses, stays in the field. TokenField's main function then ran past 140 lines, over `check:size`'s 120-line cap, so 1a6aa15325 moves the draft handling into `useTokenDraft` in `tokenDraft.ts`.

A Tab's function `style` is dropped along a run (A): fixed 81b1b259a7, with a type correction in 96f63bde6f

A Tab's function `style` is dropped along a run (B): duplicate of A's finding, fixed 81b1b259a7

ToggleChips blocks touch scrolling without `sweep` (A): fixed 03347d57e3. Only a set with `sweep` gets `touch-action: none`, through a `.sweep` class.

The arc lab's controlled `selectedKey` names a tab that no longer exists (A): fixed e865ef40dc. When the tab count drops the chosen tab, the lab chooses the last tab left. It is lab code, so no changeset.

The arc lab's controlled `selectedKey` names a tab that no longer exists (B): duplicate of A's finding, fixed e865ef40dc

Extra:
- `Radio` along a run dropped a function `style` the same way Tab did (sweep): fixed 81b1b259a7. Tab and Radio now share one helper, `slotStyle` in `Along/runSlots.ts`.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - `TokenField/TokenField.test.tsx`: pass (21)
  - `Tabs/Tabs.along.test.tsx`: pass (7)
  - `RadioGroup/RadioGroup.along.test.tsx`: pass (5)
  - `ToggleChips/ToggleChips.test.tsx`: pass (14)
  - `Tabs/lab/TabsArcView.test.tsx` (new): pass (1)
- Each new test failed before its fix. For the Tab and Radio style tests I checked this by putting the old source back temporarily.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed on typecheck, `check:changesets` and `check:size`; all three were fixed in the last three commits.
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (its only scripts are `build` and `test`). I ran eslint on the changed directories instead: pass.
- `npm run check:changesets`: pass.
- Unrun: no browser tests were touched.
- The tree is clean.

tally: 9 of 9 fixed, 1 extra fixed