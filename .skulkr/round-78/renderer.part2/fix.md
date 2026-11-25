A text layer's cached box went stale when one of its texts was refilled in place (A): fixed 40f7c46f89
A text run's stroke with a paint that can't resolve was kept with no paint (A): fixed 4ffcec76bc
`paintToBoundsUnits` converted a paint already in `'bounds'` units a second time (A): fixed ad3e34b9ff
Dots wider than half the tile were cut off at its edges (A): fixed 7be159232f
`createTilePattern` with a fractional size drew at a different period than its canvas held (A): fixed ac50540812
A tile spec that failed to rasterize was cached as null for good and took LRU slots (A): fixed 760a623eb1
A movable retained surface drawn straight through on a fractional pan was never marked adrift (A): fixed c3dbc0bc32
`warmPrograms` leaked its WebGL context when setup threw (A+B): fixed 7a73dbdcf1
`uninstallFakeOffscreenCanvas` deleted the global instead of restoring it (A): fixed e7d7279b5e
`warmPrograms` leaked its context when `buildProgram` threw (B): duplicate of A's `warmPrograms` finding, fixed 7a73dbdcf1
A `'bounds'` paint of a lazily loaded kind stayed unconverted while it loaded (B): not a defect (core's painters subscribe to `paintDrawKindRegistry` and bump their memo when a kind lands, `core/src/canvas/nodeShapes/nodePaint.ts:14`, so the command is built again; the inverse path needs a kind already loaded to have drawn handles at all)
Pose-less text kept a `'bounds'` tile, image or gradient paint in `'bounds'` units (B): fixed 691b2ff41f (fixer's call on which box to use, recorded in `docs/unruled.md`)
`warnOnce` keys grew without bound, in production too (B): fixed b9e336c223 (it now goes through registry's `createWarnOnce`, which takes a new optional `key`, a `minor` changeset for `@weasel-js/registry`)
The `TileTextures` pool was capped per size but not across sizes (B): fixed 7e941da8e3
`BakedTiles.begin` leaked its scratch buffer if the opening clear threw (B): fixed e0de89f1a0
Unregistering a pattern texture through the public API left its bitmap unclosed (B): fixed 2ac11a32da

Extra defects:
`chunks` tiles wider than the tile were copied only one period over, so they were cut at the seams (sweep): fixed 7be159232f. That commit also covers dots: the shared `wraps` helper now copies across every period it reaches, and a dot or chunk big enough to cover the tile becomes a single rect.

Other commits: 581d6307ee shortens three changeset titles that `check:changesets` warned on. 2c782db17e adds the textBounds refill stamps to `check-part-caches.allow.mjs`, because the map is overwritten on each refill and read without being made.

Checks:
- Each touched test file alone with `--maxWorkers=1`: pass, all 13 files (registry `warnOnce`, `paintToLocalUnits`, `patterns`, `resolveSpec`, `fakeOffscreenCanvas`, `tileGeometry`, `RetainedSurfaces.pan`, `TileTextures`, `bakeTile`, `textBounds`, `textCommand`, `warmPrograms`, renderer `warnOnce`).
- `npm run checks:gate`: the first run failed (`check:part-caches`, textBounds.ts:61). After the allowlist entry: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/renderer` and `-w @weasel-js/registry`: fail with "missing script". Neither package defines a `lint` script, so I ran eslint on every changed `.ts` file instead: pass, exit 0. Root `npm run lint` passed inside the gate.
- `npm run check:size`: pass. `npm run check:changesets`: OK, with no warnings on the new changesets.
- No browser tests touched. Tree clean apart from `.skulkr/`.

tally: 15 of 16 fixed, 1 extra fixed