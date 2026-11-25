A background wait loop hit its time limit and was stopped. It was only waiting on the first gate run, which had already finished, so nothing needs restarting. The final gate run passed all 33 checks.

Multi-row access drop (action variants, `actions` leaf), A+B: not a defect. It was a deliberate choice, pinned by the existing test "leaves the letter off every variant a parametric action makes": one letter picks one row, and a leaf drawn as several rows has no single row to pick. It wasn't written down anywhere, so I made the strict call and recorded it in `docs/unruled.md` in 30dcdcada9, with enum option rows included.

Enum readout row drops `access`, A+B: fixed 466db6cd2c. B's part about enum option rows is covered by the multi-row call above.

`usePublishSelection` keeps its token in the old provider when the provider changes, A: not a defect. The raw context isn't exported, and the provider's `publishSelection` comes from `useCallback([])`, so it never changes while the provider is mounted. A publisher only sees a different provider if the tree above it changes, and that remounts the publisher too.

`DepSchema` doc says one entry when there are eight, A: fixed 5b1ef7b34e.

`useContributions` has no server snapshot, so a server render throws, B: fixed 27393387be, with a follow-up typing fix to the test in 789df06c71. The same fix went into `useOpenKeymap` and `useInnermostKeymap`, which B mentioned.

Untyped dragged string read differently during the drag and on the drop, B: fixed 7dcd5b9555. The drag path now also checks for `kind === 'string'`, as the drop path already did.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `routing/src/contributions/useContributions.server.test.tsx`: pass (1)
  - `routing/src/contributions/useContributions.test.tsx`: pass (17)
  - `routing/src/keymaps/useOpenKeymap.test.tsx`: pass (1)
  - `routing/src/ingestion/ingestItems.test.ts`: pass (1)
  - `core/src/domains/ingestion/ingestItems.test.ts`: pass (12)
  - `core/src/domains/ingestion/contentHandlers.test.ts`: pass (17)
  - `core/src/domains/ingestion/useCanvasIngestion.test.tsx`: pass (13)
  - `routing/src/menus/resolveMenu.test.ts`: pass (44)
- `npm run checks:gate`: the first run failed 2 of 33 (routing's typecheck of the new server test). After the fix: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/routing`: routing has no `lint` script. Instead I ran `eslint` on every changed `.ts`/`.tsx` file: pass.
- Tree clean, apart from `.skulkr/`.

tally: 4 of 8 fixed, 0 extra fixed