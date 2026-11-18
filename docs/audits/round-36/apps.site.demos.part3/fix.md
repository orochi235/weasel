Parallax intro undoes a per-plane-zoom toggle made while it plays (A+B): fixed 565731d0b0. The same closure also jumped the planes' anchor to 0 when the box was toggled mid-intro. Both the intro frame and the toggle now read the last written state, and each changes only its own half.

PTouchLabelDemo's Download swallows a failure that Print reports (A): fixed 2fcdfdfaac. Both buttons now put their result or error on the status line through one shared helper.

PathMotionDemo keeps the last ride's tilt after "turn with the path" is unticked (A): fixed 85e4ccb31a. Each ride now starts from rotation 0.

PlotKindsDemo keys the chart by kind but not its data panel (B): fixed 86b141207e. The panel now takes `key={kind}`. The leak only happens when you go back to a kind that has already loaded. On a first visit the panel unmounts while that kind loads, so the test goes gantt → pie → gantt.

Extra defects found while fixing: none beyond the anchor jump noted under the Parallax finding. `MermaidKindsDemo` and `PlotKindsDemo` also call `void Promise…then` with no catch, but those calls only parse sample files bundled with the site, so I left them alone.

No changesets: every change is in the private `apps/site` app, and earlier demo fixes in `git log` carry none. Nothing went into `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/PathMotionDemo.test.tsx` — pass (new; failed before the fix)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/PTouchLabelDemo.test.tsx` — pass (2 tests; the new one failed before the fix)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/PlotKindsDemo.test.tsx` — pass (new; failed before the fix)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/ParallaxDemo.test.tsx` — pass (new; failed before the fix)
- `npm run typecheck:packages` — not run: no package changed. I ran `npm run typecheck` instead, which covers `apps/site` — pass (exit 0)
- eslint on all 8 changed files — pass
- `npm run check:size` — pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets` — pass ("[changesets] OK — 1699 changeset(s).")
- Tree clean apart from `.skulk/`.