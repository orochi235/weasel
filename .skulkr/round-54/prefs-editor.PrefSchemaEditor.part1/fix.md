Catalog-only edits turned Submit on and then submitted nothing (A+B): fixed f4b4c7cfea. `PrefSchemaEditor`'s Changes tab and Submit now carry only the schema's changes. The fix adds an `AssetEditor` option, `sends(asset)`, with a minor changeset because that is new API.

Unit suffix `mm` can't be typed past an existing `m` (B): fixed ad307a00fb. A row whose name clashes with another's now shows the typed text and is marked invalid, and it is written once its name is unique.

The identity glyph is offset from the wrong edge in right-to-left layouts (A): fixed 7ea66299ba. In right-to-left layouts the inset is now measured from the left edges.

No extra defects found. A sweep for other physical-edge measurements in the area found none that needed changing.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `PrefSchemaEditor.catalog.test.tsx`: pass (5/5)
  - `PrefSchemaEditor.test.tsx`: pass (53/53)
  - `AssetEditor.changes.test.tsx`: pass (5/5)
  - `UnitAttr.test.tsx`: pass (10/10)
  - `IdentityForm.test.tsx`: pass (2/2)
- `PrefSchemaEditor.actions.test.tsx`: pass (11/11)
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `audit:jsdoc` because my new constant had landed between the component's JSDoc and its function; that fix is folded into f4b4c7cfea.
- `npm run check:changesets`: pass
- `npm run typecheck:packages -- prefs-editor`: pass
- `npm run lint -w @weasel-js/prefs-editor`: unrun, because the package has no `lint` script. `npx eslint` on every changed file: pass.
- The tree is clean apart from `.skulk/`.

tally: 3 of 4 fixed, 0 extra fixed