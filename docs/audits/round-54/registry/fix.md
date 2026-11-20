- identityKeyOf gives two distinct symbols one key (A+B): fixed 0cf2863467. The commit also regenerates audio's worklet bundle, which inlines this code.
- Reflectable.set drops the live registrant's rank, so a later push goes over a higher-ranked one (A+B): fixed 5d5370687b
- ExtensionRegistry.subscribe's unsubscribe also removes the same listener's own subscription to the parent or to `own` (B): fixed fb0cc62793
- The clash warning says the newer registrant is live when a higher-ranked one sits above it (B): fixed 5eea377ecc
- KeyedEmitter.clear during an emit still calls the cleared listeners (B): fixed 3210a64ab3. The commit adds a listener-sets allowlist entry for the unsubscribes that `clear` runs.
- ExtensionRegistry.entries lists inherited ids before its own, not in first-registration order (B): fixed 846a00bf9d. The commit adds a part-caches allowlist entry for the registry's order reader.
- hostile fixture's mutate throws when duplicating a field that holds undefined (B): fixed 00eb15e316 (test-only, no changeset)
- prototypePolluted misses an overwritten or symbol-keyed Object.prototype member (B): fixed 792a20d9c8 (test-only, no changeset)

No extra defects found.

Checks:
- Every test file in `packages/registry/src` and `src/testing`, plus the three consumers of the hostile fixture (core's `sceneDocument.pbt`, diagram-formats' `number.long.pbt`, and diagram's `themeFile.hostile.pbt`), each run alone with `--maxWorkers=1`: pass
- `npm run checks:gate`: first run "3 of 32 failed" (check:listener-sets, check:audio-worklet, check:part-caches). After the fixes folded into the commits above: "checks:gate: all 32 passed"
- `npm run check:changesets`: "OK — 2595 changeset(s)."
- `npm run lint -w packages/registry`: the package has no lint script, so `npx eslint packages/registry/src` was run instead: pass, no output
- No browser tests were touched. The tree is clean.

tally: 8 of 8 fixed, 0 extra fixed