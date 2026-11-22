- `__proto__` printed bare in schema export (A+B): fixed abb1827f99
- withRoots ignores `presets`/`nodeKind` when deciding the host said nothing (A+B): fixed 0e2a2f4c9b
- copyNodes/aliasNodes pick a leaf key with uniqueKey, not uniqueLeafKey (A+B): fixed e4271cb588
- aliasesTo keys a layout alias with a dialog's dotted key (A+B): fixed cf6b97f52d
- bundleProblems marks "named twice" in a bundle never loaded with the other namer (A): fixed d23ec2229c
- Copying or moving a section re-keys only the section, so its leaves can share value paths in the target scope (A): fixed 43451af87f
- Draft stores a list's or map's entry fields as a `$from` pointer when one holds code, so field edits are lost on reopen (B): fixed 8d0c1a7576
- Action row dropped silently when selected prefs' definitions differ (unregistered keys) (B): fixed 547a90a871 (attributes that every node has but defines differently now go in `apart`)

No extra defects. Each fix has its own changeset.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: pass. The files are schemaExport, assetSet, schemaCopy, settingAliases, attrAggregate, draft, and prefs-editor's bundleChecks.
- The neighboring prefs edit tests also pass: schemaEdit, schemaEdit.pbt, schemaKeys, compoundNodes, schemaEdit.conditions, valuePaths.entry, valuePaths.group, assetSetEdit, assetSetEdit.layout, kindSchemas, and actionCatalog.
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed on typecheck and check:proto-index; those fixes are folded into their commits.
- `npm run lint -w @weasel-js/prefs` and `-w @weasel-js/prefs-editor`: fail, because neither package has a `lint` script (scripts are `build`, `test`). eslint on the changed files passes.

tally: 12 of 12 fixed, 0 extra fixed