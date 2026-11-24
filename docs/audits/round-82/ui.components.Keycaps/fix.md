- `--key-diagram-unit` moves the spacing between keys but not the keys themselves (A): fixed c27cae1b18
- `--key-diagram-unit` changes the spacing and captions but not the keys (B): duplicate of A's unit finding above, fixed by c27cae1b18
- `keyLegendsFromChord` draws the same modifier twice for `Mod+Ctrl` / `Mod+Meta` (A): fixed 4083dec091
- An empty chord gives one blank key (A): fixed 2189f074f2
- The icon legend's size multiple is defined in two places, the CSS and a TS constant (A): fixed a4048f207d (both now read `--key-legend-icon-scale`; no changeset, since nothing changes for a consumer)
- On macOS, a key stays lit if Command's key-down was missed (B): fixed 9094c77886
- A key with no layout box (`display: none`) pulls its whole `KeyBank` down to `minScale` (B): fixed 010ffe4ce6

Checks:
- `npm run checks:gate`: pass (all 33 passed)
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script. The gate's root `npm run lint` passed.
- `npm run check:changesets`: pass, with no warnings on the new changesets
- `keyLegendsFromChord.test.ts`: pass (7)
- `useHeldKeys.test.tsx`: pass (4)
- `legendMeasure.test.ts`: pass (3)
- `KeyDiagram.test.tsx`: pass (13)
- `Keycaps.test.tsx`: pass (39)
- `KeyDiagram.browser.test.tsx` (new): unrun, because it is a browser test

tally: 7 of 7 fixed, 0 extra fixed