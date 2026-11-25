Array or class instance spread into the object leaf instead of lifted through `fromScalar` (A): fixed f52c366922

Group or section that starts out empty is kept, while one its conditions empty is dropped (A): fixed fbec4b8689

`prefStatusAt` doesn't narrow an alias inside an object, union, list, or map leaf (B): fixed 727339cea7

`prefReader` reads a scoped leaf as its raw `PrefScope` or plain `default`, and an auto leaf as `default` (B): fixed 4271dfff76. A stored split value now resolves through its selectors, which the reader reads itself, picking one option, not a weighted blend. With nothing stored, a split leaf reads its `defaultScope`, and a leaf that starts auto reads its `auto.value`.

`prefDisplayBounds` rounds a stop past the shown `min`/`max` under `places` (B): fixed 0594a0dcb8

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: object.test.ts pass (11), status.sections.test.ts pass (5), status.alias.test.ts pass (11), status.test.ts pass (22), helpers.test.ts pass (29). Each new test also failed against the pre-fix source.
- `prefReader` callers, untouched files: groupConditions, prefs judge.over, aliasTargets, action.activeIf, store.auto, ui BarRootLayout.alias and params.kitSettings: all pass.
- `npm run checks:gate`: pass, all 33 passed. The first run failed typecheck, check:changesets and check:proto-index; those fixes are folded into the commits above.
- `npm run lint -w @weasel-js/prefs-schema`: the package has no lint script; `npx eslint packages/prefs-schema/src` pass.

tally: 5 of 5 fixed, 0 extra fixed