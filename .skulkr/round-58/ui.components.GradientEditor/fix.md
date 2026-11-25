canceled drag sends onInput a value rebuilt from the handle's pixels, not the value it began from (A+B): fixed fe841fdc57
radius floor is 1 gradient unit whatever the units (A): fixed 63d81fb662
commit-only GradientEditor doesn't draw a stop drag or color pick while it runs (A): fixed db5cef5b45
pointer removal (right-click or drag off the track) leaves focus on a different stop than the selection (A+B): fixed 1857ac775f
focus request the consumer never satisfies stays armed and steals focus later (A): fixed 64933acb11
out-of-range selection never written back, so it comes back when the list grows (A): fixed b8cce52467
Up and Down on the radius handle both grow the radius (A): fixed 9d7e22fd1e
removal focus mismatch (B): duplicate of A's pointer-removal finding, 1857ac775f
declined track-click add leaves the selection and a pending focus on a stop that doesn't exist (B): fixed 64933acb11; the selection half also needed b8cce52467
canceled handle drag rebuilt through toLocal(toScreen(...)) (B): duplicate of A's canceled-drag finding, fe841fdc57
conic angle arm is a fixed 50 gradient units, so it collapses onto the center or leaves the screen with zoom (B): fixed ac895544a5
radial guide is a screen circle, not the painted ellipse, under an anisotropic transform (B): fixed 6d81856e34
arrow keys on the radius or angle handle call onChange when nothing changed (B): fixed 1e3e591a66

extra (sweep): MeshHandles had the same cancel replay and the same unchanged-value commits, because they share the overlay code. Fixed in fe841fdc57 and 1e3e591a66; it isn't counted as a separate defect.

checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/GradientEditor/GradientHandles.test.tsx`: pass (24)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/GradientEditor/GradientStops.test.tsx`: pass (26)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/GradientEditor/GradientEditor.test.tsx`: pass (17)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MeshEditor/MeshHandles.test.tsx`: pass (6)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MeshEditor/MeshEditor.test.tsx`: pass (6)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run check:changesets`: pass, "OK — 3031 changeset(s)"
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script. eslint on `packages/ui/src/components/GradientEditor` and `packages/ui/src/components/MeshEditor`: pass

tally: 11 of 13 fixed, 0 extra fixed