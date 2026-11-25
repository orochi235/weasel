A+B nonzero fill whose outlines meet only at vertices or along a shared stretch skips crossing resolution (A; B's crossing-related findings are separate): fixed c2fcd2d5fd
nestRings box test runs before the tolerant on-outline check, so a ring on its container's edge stays top-level (A+B): fixed 5e2f350da6
A cut between two anchors, or between an anchor and a curve's first interior point, snaps to the nearer anchor's color in trim, dash, clip windows and fill crossings, with the rule copied in `anchorsAlong` (B): fixed 40a90e1412
Nonzero crossing resolution has no work cap, unlike even-odd (B): question (should it have one? The even-odd cap falls back to the parity stencil, and the renderer has no nonzero stencil, so a cap could only draw a wrong fill instead of a slow one; a real cap needs a nonzero stencil pass in the renderer. I left it uncapped and recorded the call in `docs/unruled.md`.)
resolveCrossings ignores an incomplete chain, so a nonzero fill loses a face (B): fixed f192eb03c6 + c2fcd2d5fd. A fuzz found this on ordinary integer polygons, not only after `weld`. Root cause: `boundaryPieces` judged each side of a piece by the winding at a point offset 1e-7 of the outline's size, and a hairline spike or a near-triple crossing is narrower than that, so the piece was misjudged. It now counts the winding on a ray from the piece's midpoint (f192eb03c6), and 100,000 fuzz trials under both rules all close. c2fcd2d5fd also makes the nonzero path fall back to the unresolved outline when a boundary still won't close, as even-odd falls back to the stencil; that call is recorded in `docs/unruled.md`.
flattenPolygon spreads a kept contour into `push`, which throws on a large one (B): fixed f878d85996

Extra, found while fixing:
- `tessellate` and `pinWarpMesh` each decided the nonzero contour path on their own. They now share `nonzeroContours`, and `anyCrossing` and `resolveCrossings`, left with no callers, are removed (c2fcd2d5fd, part of the A1 fix, not counted separately).
- A cut landing exactly on a vertex keeps that vertex's own anchor-exact parameters. Found through a windowPolylines test while fixing B1; it is part of 40a90e1412 and not counted separately.
- Measured locally, one machine, 15 runs each: resolving a 1,024-edge ring takes 3.7 ms median with the new winding count, against 6.3 ms before.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file, one at a time: anchorParams.test.ts pass (5), crossings.test.ts pass (1), nesting.test.ts pass (2), tessellate.test.ts pass (36)
- Wider run of every test file that reaches tessellate (geom, stroke, renderer, core, path-tools, text, font): pass, 185 files, 1925 tests
- `npm run checks:gate`: first run failed (`check:changesets`, three titles over 140 characters). After shortening them (folded into their fix commits): "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/geom`: fail, "Missing script: lint" (geom has no lint script). The root `npm run lint` inside the gate passed, and eslint on every changed file passed (exit 0).
- `npm run typecheck:packages -- geom`: pass ("1/1 geom ok")
- Tree clean, nothing in `.skulk/` touched

tally: 5 of 7 fixed, 0 extra fixed