`GLTextureCache.replaces` ignores the premultiply flag (A): fixed 1666bbccf9

Marker head cache key mixes up a bare key ending in `@` with `{ key }` of the same stem, and a key containing `|` can collide the same way (B): fixed efc1dd2e0d

Extra defects: none. I checked the other `join('|')` keys in this area, in `outlineStrokeMeshCache.ts` and `strokeMeshCache.ts`. They can't collide: only their first field is a free string, and every field after it is a fixed count that never contains `|`.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/GLTextureCache.test.ts`: pass, Tests 14 passed (14). The new test failed before the fix: 1 failed | 13 passed.
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/markerCommandCache.test.ts`: pass, Tests 10 passed (10). The new test failed before the fix: 1 failed | 9 passed.
- `npm run check:changesets`: pass, "[changesets] OK — 1435 changeset(s), 163 with warnings". The warnings are on other changesets.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/renderer`: not run, because `@weasel-js/renderer` has no `lint` script. `npx eslint` on the four files I touched returned no errors, and the gate's root `npm run lint` passed.

tally: 2 of 2 fixed, 0 extra fixed