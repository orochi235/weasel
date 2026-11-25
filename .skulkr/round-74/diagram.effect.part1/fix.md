Live runner's apply-time errors erased by the next unrelated edit (A): fixed 3fcb8e2b26
`typeColors` gives every type `undefined` when the theme's `series` is empty (A): fixed 3add55e1d9
Two wires with the same ends map to one wire id in `editorScene` (B): fixed a563e8fd6a
Reverb `seconds` given as text passed through unparsed while levels are parsed (B): fixed 795ec6c0de

Extra:
Branch symbol (`bar`/`crossover`) given an empty `tints` list draws bands with no color, the same `x[i % 0]` mistake (sweep): fixed d75c5bafb0

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: `audio/liveRunner.test.ts` pass (20), `audio/nodes.test.ts` pass (10), `audio/plan.test.ts` pass (12), `draw.test.ts` pass (2), `symbols.test.ts` pass (15), `editorMapping.test.ts` pass (14); `audio/useLiveAudioRunner.test.tsx` pass (8)
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". The `check:proto-index` failure from the first run was fixed and folded into 3fcb8e2b26, and the rerun passed.
- `npm run check:changesets`: pass, "OK — 738 changeset(s)." Its first run flagged two changeset titles over 140 characters; both were shortened and folded into their commits before this result.
- `npm run lint -w @weasel-js/diagram`: fail, "Missing script: "lint"" (the package has no lint script). `npx eslint` on every changed file: pass (exit 0).

tally: 4 of 4 fixed, 1 extra fixed