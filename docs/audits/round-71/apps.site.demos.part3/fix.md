MenuDemo menu never dismisses on outside press, blur or resize, and its opener stays disabled; focus is not handed back on close (A+B): fixed 8fc6f228a1

MenuDemo "Show grid" entry built from a snapshot of `grid` (A): not a defect (the row has no `keepOpen`, so the menu closes on the toggle and the next open rebuilds the entries from current state; nothing else changes `grid` while the menu is open)

LayoutDemo's added tile is posed below G, not at its bottom-right corner (A+B): fixed 793fd741df

Lines3dDemo and LabLoupeDemo's ForeignGl frame loops spin forever without a WebGL context (A): fixed 2b2dba44bc

LabLoupeDemo `compile` never checks compile or link status, and a null `createProgram` goes unchecked (A): fixed 5db121e867 (now throws with the driver's log and deletes the program)

LevelOfDetailDemo hint says "Scroll to zoom out" but a plain wheel pans (B): fixed 0f46ecfb1b (the canvas now zooms on a plain wheel, the same `viewport` setting StrokeTrimLabDemo uses)

ParallaxDemo zoom control scales about the world origin and sinks the ground off the stage (B): fixed e06cfb238d (it now zooms through `zoomAt` about the stage's bottom center)

No extra defects found. No changesets were written, because `apps/site` is not a published package.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, on ParallaxDemo.test.tsx, LevelOfDetailDemo.test.tsx, LayoutDemo.test.tsx (new), MenuDemo.test.tsx, Lines3dDemo.test.tsx (new) and LabLoupeDemo.test.tsx: pass. Each new test was seen failing before its fix.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w <pkg>`: not run. `apps/site` has no package.json, so no workspace lint applies; the root `npm run lint` passed inside the gate.

tally: 6 of 7 fixed, 0 extra fixed