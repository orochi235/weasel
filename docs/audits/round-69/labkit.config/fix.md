isRowVisible/isRowEnabled walk an `over` alias target through the panel's own function maps (A): fixed 2a27eb9fcc

isConfigNodeShown ignores `over`, unlike isRowVisible (A+B): fixed 974086e7cb. `isConfigNodeShown` takes an optional `over`, and both forge callers now pass the resolved schema's `over`.

configFromPrefs drops leaves when a dotted key and a group or leaf at its prefix both appear (A+B): fixed 5f8a71a09b. A group now merges with the dotted keys under it in either order. Where a plain leaf and a branch, or two leaves, claim one path, it throws. That throw is a strict call, recorded in `docs/unruled.md`.

configFromPrefs' defaults() hands out each leaf's own default object (A): fixed 53f77fbfc1

`.auto()` with no resolver keeps an earlier resolver (B): fixed 4dc81da36b

Writing `AUTO` at a group path pins the auto leaves under it and records the group path (B): fixed 5d9aa3b893. A bare `AUTO` over a group that has auto leaves now leaves the auto set unchanged. `applyConfigWrite` has no schema, so it cannot tell which of the group's leaves may be auto. This is a strict call, recorded in `docs/unruled.md`.

useOverAccess outside a lab drops writes (B): fixed 5b343b5cf6. Outside a lab it now keeps the values itself through `useKeptOver`.

fieldSweep sweeps an enum's disabled options (B): fixed 6dc6269a82

fieldSweep labels ignore `.display` and print float noise (B): fixed 03b6d06153. The `.display` part was real: `2000000` where the control reads `2.00M`. The float noise was not: I ran it, and a unit-scaled degree sweep already labels `0°`, `45°`, `90°`, `135°`, `180°`.

Checks:
- vitest, one file at a time, `--maxWorkers=1`: pass
  - labkit config: `fieldSweep.test.ts`, `builder.test.ts`, `fromPrefs.test.ts`, `visible.over.test.ts`, `autoConfig.test.ts`, `autoConfig.pbt.test.ts`, `over.test.tsx`, `conditions.test.ts`, `sectionTree.over.test.ts`, `resolve.test.ts`
  - labkit controls and trial: `ControlPanel.over.test.tsx`, `ControlPanel.alias.test.tsx`, `ControlMatrix.over.test.tsx`, `Trial.over.test.tsx`
  - forge: `variants.test.ts`, `schema.test.ts`
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run check:changesets`: "[changesets] OK — 237 changeset(s)."
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- `@weasel-js/forge`: no lint script, so nothing to run
- No browser test files were touched.

tally: 9 of 9 fixed, 0 extra fixed