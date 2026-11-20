## An accepted unit suffix can't be typed if any other row already holds one of its prefixes, or if any row holds its first letter
- where: packages/prefs-editor/src/PrefSchemaEditor/UnitAttr.tsx:44 (UnitEditor, rename)
- scenario: a number's unit accepts `m`. The reader clicks "Add accepted suffix" and types `mm` into the new row. The first keystroke gives `m`, which `rename` rejects as another row's name before `setAccepted` runs. The input is controlled (`value={name}`), so it stays empty, and the second `m` is rejected the same way. `mm` can only be entered by pasting it whole. The same happens to `in` → `inch` and `k` → `km`. The duplicate check runs on every keystroke against a name the reader hasn't finished typing. It should refuse only the name that gets written (for example by leaving the duplicate row out of `named(...)` the way an unnamed row is), not block the text being typed.
- evidence: read
- severity: medium

## PrefSchemaEditor enables Submit and lists changes for a catalog-only edit, then submits an empty change list
- where: packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.tsx:105 (submit), with AssetEditor.tsx:213 (ExportPanel changes={changedAssets.all})
- scenario: a `PrefSchemaEditor` with `actions` and `onSubmit` is given. The reader only sorts or groups the Actions list. `assetSetChanges` diffs every asset, the `actions` catalog included, so `changedAssets.all` is non-empty. The Changes tab lists the catalog's changes (useAssetChanges.ts `changesText` titles each asset once the catalog changes), and `Submit` is enabled because `changes.length > 0`. Pressing it calls the host's `onSubmit([], literal)`: `submit` keeps only the `LONE_SCHEMA_ID` asset, which has no changes, and the button shows "Sent". The props doc says Submit hands over "the changes since `original`", and the comment says the catalog belongs to `onActionCatalogChange`. So the two paths disagree on whether catalog edits are submittable changes. The panel offers a submission that carries nothing and shows changes that are never sent.
- evidence: read (assetSetChanges.ts:13 includes every asset, the actions catalog among them)
- severity: medium

## Files read
packages/prefs-editor/src/PrefSchemaEditor/ActionList.tsx
packages/prefs-editor/src/PrefSchemaEditor/AddNodeDialog.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.demo.ts
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.fixture.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.stories.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetList.tsx
packages/prefs-editor/src/PrefSchemaEditor/AttributesPane.tsx
packages/prefs-editor/src/PrefSchemaEditor/BundlePreview.tsx
packages/prefs-editor/src/PrefSchemaEditor/EditorBar.tsx
packages/prefs-editor/src/PrefSchemaEditor/EditorNotice.tsx
packages/prefs-editor/src/PrefSchemaEditor/ExportPanel.tsx
packages/prefs-editor/src/PrefSchemaEditor/IconAttrField.tsx
packages/prefs-editor/src/PrefSchemaEditor/IconPicker.tsx
packages/prefs-editor/src/PrefSchemaEditor/IdentityForm.tsx
packages/prefs-editor/src/PrefSchemaEditor/NodeGhost.tsx
packages/prefs-editor/src/PrefSchemaEditor/NumberText.tsx
packages/prefs-editor/src/PrefSchemaEditor/Palette.tsx
packages/prefs-editor/src/PrefSchemaEditor/PaneHeader.tsx
packages/prefs-editor/src/PrefSchemaEditor/PartsList.tsx
packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.tsx
packages/prefs-editor/src/PrefSchemaEditor/PreviewPane.tsx
packages/prefs-editor/src/PrefSchemaEditor/SettingsTree.tsx
packages/prefs-editor/src/PrefSchemaEditor/Shelf.tsx
packages/prefs-editor/src/PrefSchemaEditor/StoredArea.tsx
packages/prefs-editor/src/PrefSchemaEditor/StructurePane.tsx
packages/prefs-editor/src/PrefSchemaEditor/StructureTools.tsx
packages/prefs-editor/src/PrefSchemaEditor/UnitAttr.tsx

<!-- done: 2 findings, files read: 28 -->
