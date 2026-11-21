- Scene tab recursed forever after a node was moved under one of its own former children (A): fixed 5cb7fc5e35
- Trace records over the serializer's 100-item cap crashed the Dispatch tab when expanded (A): fixed 757fc1461f
- Frame tab threw on a canvas with more than 100 render layers (A): fixed a3b7809c1c
- History tab's Age column stopped counting between history notices (A): fixed 04be8c9751
- Coord table's Scale column dropped `scaleY` and the view's offset (A+B): fixed 77ed79a741
- One trace detail spelled the same key three different ways (A): fixed 5b08149b10
- Frame tab showed the last frame again after the fps overlay was turned off and back on (B): fixed 7cc9ffd989
- Frame tab showed the "fps overlay is off" note in place of a get-state error (B): fixed 0aed0425d6
- Dispatch tab's Clear left the coord rows, and was disabled when only coord rows existed (B): fixed fff45d26ee
- Dispatch diagram showed a blank Route cell for a binding with no route form (B): fixed 261c5b4e40
- Each trace notice queued one more serial read behind a slow transport, in the Dispatch and History tabs (B): fixed 9bfaafe43f

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, run one file at a time:
  - `views/SceneView.test.tsx`: pass
  - `views/HistoryView.test.tsx`: pass
  - `views/CoordTable.test.tsx`: pass
  - `views/keyName.test.tsx`: pass
  - `views/GestureRoute.test.tsx`: pass
  - `views/FallthroughDiagram.test.tsx`: pass
  - `views/FrameView.test.tsx`: pass
  - `views/DispatchView.test.tsx`: pass
  - `page/handlers.test.ts`: pass
  - `page/session.test.ts`: pass
  - `DevtoolsPanel.test.tsx`: pass
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass, after shortening five titles that were over 140 characters
- `npm run lint -w @weasel-js/devtools`: not run, because the package has no `lint` script. `npx eslint packages/devtools/src` stood in for it: pass, no output
- Browser test files: none touched

tally: 11 of 11 fixed, 0 extra fixed