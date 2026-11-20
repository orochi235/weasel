Moving a section between `object` leaves left conditions, aliases and layout pointers on old value paths (A): fixed 86131a5ae3
Converting a leaf with its own options to `enum` dropped its default (A): fixed e6d24cf843
Two bundles whose ids differ only in punctuation collapsed into one group (A): fixed 6f05dbf7e1
Draft packing did not escape `$from`/`$num`/`$stub`/`$type`/`$unset` keys in plain data (A): fixed cf9d457a72
A dotted leaf key could name a path inside another leaf's value (A): fixed d2bbe70516 (strict call recorded in `docs/unruled.md`)
A bundle link moved between bundles exported like a package move, and `touched` missed packages (A+B): fixed 50d044800e (new `repackage` op, breaking changeset, recorded in `docs/unruled.md`)
An asset-set draft reopened at its baseline threw away its redo steps (A): fixed ee47ed629e
`attributeSchema` threw for a group `as` naming an `Object.prototype` member (A): fixed 2e16ada92e
Bundle link move as a package move (B): duplicate of A's bundle link finding, fixed 50d044800e
`convertLeaf` kept or dropped `access`, `readout` and `auto` by a different list than `sharedAttrs` (B): fixed fbecb7fee2
`conditionLeaves` never resolved a test read from its group (`from: 'group'`) (B): fixed fc7d123e10
Clearing a field of an object attribute left `{}` behind (B): fixed b86682f492
Draft marker keys not escaped (B): duplicate of A's draft finding, fixed cf9d457a72

Extra: none counted. Two small things went in alongside these fixes:
- **Moved leaves:** a move that would put one leaf's value inside another's now numbers the leaf's key instead (`grid2.size`), in d2bbe70516.
- **Doc comment:** `mapNodes` had two stacked doc comments; I merged them into one in 86131a5ae3.

Checks:
- Each touched test file run alone with `--maxWorkers=1`:
  - `PrefConditionEditor.test.tsx` pass (33)
  - `bundleExport.test.ts` pass (7)
  - `bundleTree.test.ts` pass (7)
  - `assetSetCodec.test.ts` pass (16)
  - `attrAggregate.test.ts` pass (7)
  - `conditionFlow.test.ts` pass (9)
  - `conditionLeaves.test.ts` pass (5)
  - `draft.test.ts` pass (9)
  - `kindSchemas.test.ts` pass (32)
  - `schemaKeys.test.ts` pass (16)
  - `valuePaths.test.ts` pass (5)
- Every new test failed against the frozen source before its fix.
- Related files I didn't edit also pass: `schemaEdit`, `schemaEdit.pbt`, `schemaEdit.conditions`, `schemaCopy`, `assetSetEdit`, `assetSetEdit.layout`, `valuePaths.group`, `valuePaths.entry`, `settingAliases`, `PrefConditionEditor.over`.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run check:changesets`: "OK — 2600 changeset(s)".
- `npm run lint -w @weasel-js/prefs` and `npm run lint -w @weasel-js/prefs-editor`: neither package has a lint script ("Missing script: lint"). eslint on every changed file passed, and the root `lint` passed inside the gate.
- Not run here: browser tests. I edited none, but `PrefConditionEditor.browser.test.tsx` covers a component I changed.
- The tree is clean, with 12 commits on top of the frozen commit.

tally: 13 of 13 fixed, 0 extra fixed