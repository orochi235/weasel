- `SceneMembershipError` thrown by scene calls but exported from no entry (B): fixed 18497b23f7. It is now exported from `core/scene/index.ts` and the scene barrel, and sets its `name`. A new test in `index.barrel.test.ts` checks that every error class core declares is on the main entry. Before the fix it failed naming only this class. Changeset `scene-membership-error-export.md`.
- Ingestion comment calls `getContentHandlers` "deliberately not exported" (A+B): fixed 378ae80b14. A was wrong that the function doesn't exist: it does, in `domains/ingestion/contentHandlers.ts:160`, and it just isn't on the entry. Still, the comment was wrong. `contentHandlerRegistry` lists the same handlers, and `editingSeams` puts `runIngest`, `handlersFor` and `couldClaim` on the same entry, because `@weasel-js/editing` imports them. I kept those exports and rewrote the comment to say what the entry exposes. No test or changeset, since it's a comment only.
- GestureSource comment sends readers to a bare `<Canvas>` that isn't exported (A): fixed 374139e870. The comment now says the types are public because `CanvasProps.gestureSource` names them. Comment only.
- WeaselProvider heading says "five" contexts; it mounts seven (A): fixed 3fba2bc256. The heading no longer gives a count. Comment only.
- Viewport barrel lists `<MinimapCanvas>` as exported here (A+B): fixed ca08eb3c25. Both comments now name `@weasel-js/minimap` as its home. Comment only.
- "Drag-action hooks" heading over a block that has none of them (A): fixed d00bc1a37b. The block is retitled as transform options and geometry, with the actions in `@weasel-js/editing`. Comment only.

No extra defects found while fixing. I made no `docs/unruled.md` entries.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/index.barrel.test.ts`: pass (12/12)
- Other files I ran because they hit the error's messages:
  - `scene.staleReplay.test.ts`: pass (10)
  - `scene.nodes.test.ts`: pass (28)
  - `scene.derived.test.ts`: pass (45)
  - `packages/diagram/src/fromData.pbt.test.ts`: pass (2)
  - `packages/editing/src/actions/delete/delete.test.ts`: pass (38)
- `npm run typecheck:packages -- core`: pass ("1/1 core ok")
- eslint on the 7 changed files: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass (the first draft failed on a 156-character title; I shortened it and amended the commit)
- Working tree clean.