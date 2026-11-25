- bounds can cross: `prefBoundedNumber` gives `min` above `max`, and the clamp returns a value below `min` (A): fixed ba00ecf271. A bound read by `minAt` or `maxAt` is now held inside the declared `min` and `max`, and a `maxAt` below the `min` gives way to it. I recorded this behavior call in `docs/unruled.md`.
- an object leaf with `fromScalar` lets any non-object through repair unchecked (A): fixed 8846878cb0. The scalar is lifted and its fields repaired. When it cannot be lifted (`fromScalar` throws or returns no object), it reads as the default. The same mistake in `prefObjectBase` is fixed in the same commit.
- a group's own `from: 'group'` test reads its parent group, so a mounted group cannot be switched by its own leaf (B): fixed f8e94972cf. A group's own tests now read from the group itself. I recorded this call in `docs/unruled.md`. Four places had to agree, so they all changed: the resolver, plus `packages/prefs`' `conditionProblems`, `conditionGroupAt` and `rebaseValuePaths`. `conditionGroupAt(root, null)` now returns `''`. Its changeset is `major` with a before/after snippet, because a schema whose group-level test meant a leaf beside the group now reads a different leaf.
- `applyPrefConditions` docs promise the schema itself back when it holds a group test (B): fixed e04ee6db3c. This is a docs fix. Handing back the original nodes would give `applyPrefEntryConditions` unresolved tests to read, so the docs now say `shown` is the schema `resolvePrefGroupConditions` gives. A test pins `shown === resolvePrefGroupConditions(schema)`.

Checks:
- `npx vitest run --maxWorkers=1` on prefs-schema's `bounds`, `repair` and `groupConditions` tests, and prefs' `valuePaths.group` test: pass (55 tests).
- Wider run: all of `packages/prefs-schema`, plus prefs' `valuePaths`, `conditionMarks` and `conditionCheck` tests: pass (28 files, 273 tests).
- Also run: prefs' `conditionLeaves` and `conditionFlow` tests, prefs-editor's `PrefConditionEditor` test, and prefs-schema's `status` test: pass (75 tests).
- `npm run checks:gate`: pass (exit 0).
- `npm run check:changesets`: pass, after shortening four titles that ran over 140 characters.
- `npm run lint -w @weasel-js/prefs-schema` and `npm run lint -w @weasel-js/prefs`: fail, because neither package has a `lint` script ("Missing script: lint"). Instead, `npx eslint` on every changed `.ts` file: pass.
- Tree: clean.

tally: 4 of 4 fixed, 0 extra fixed