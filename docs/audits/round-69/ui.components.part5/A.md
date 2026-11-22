# Audit round 69 — ui.components.part5

## LastOperationPanel hands PrefsForm a flat by-path record where PrefsForm reads a nested tree, so any leaf under a subgroup shows its default rather than the value the command ran with
- where: packages/ui/src/components/LastOperationPanel/LastOperationPanel.tsx:35 (LastOperationPanel)
- scenario: An action whose `params` schema nests a group, e.g. `pref.group('Offset', { outline: pref.group('Outline', { width: pref.number('Width', 1) }) })`, runs with `outline.width = 4`. `LastOperation.values` is "one value per leaf of `schema`, by the leaf's path" (`packages/routing/src/interactions/actions/lastOperation.ts:22`): `formValues` builds it with `getOwn(params, path)` / `setOwn(out, path, …)` (lines 127–134), both flat own-key helpers (`packages/registry/src/getOwn.ts`, `setOwn.ts`), so the record is `{ 'outline.width': 4 }`. The panel passes that straight to `<PrefsForm values={op.values}>`, whose `values` is a "Nested value tree (shape mirrors the schema)" (`PrefsForm.tsx:38`) read by `prefReader` → `prefValueAt`, which walks `path.split('.')` segment by segment (`packages/prefs-schema/src/helpers.ts:126`). `prefValueAt({ 'outline.width': 4 }, 'outline.width')` finds no `outline` key and returns undefined, so the field falls back to the schema default 1. The panel then shows Width 1 for a run made at 4, and nudging any other field reruns with the flat 4 while the visible control still says 1. Only flat schemas (the story's) display correctly. Expected: the panel converts the by-path record to the tree PrefsForm reads (or the store keeps values nested), so each control shows the value used.
- evidence: read
- severity: medium

## Files read
packages/ui/src/components/ItemList/index.ts
packages/ui/src/components/ItemList/useRowInput.ts
packages/ui/src/components/Jog/Jog.module.css
packages/ui/src/components/Jog/Jog.stories.module.css
packages/ui/src/components/Jog/Jog.stories.tsx
packages/ui/src/components/Jog/Jog.tsx
packages/ui/src/components/Jog/JogAlong.module.css
packages/ui/src/components/Jog/JogAlong.tsx
packages/ui/src/components/Jog/index.ts
packages/ui/src/components/KeymapHint/KeymapHint.module.css
packages/ui/src/components/KeymapHint/KeymapHint.stories.tsx
packages/ui/src/components/KeymapHint/KeymapHint.tsx
packages/ui/src/components/KeymapHint/index.ts
packages/ui/src/components/LastOperationPanel/LastOperationPanel.module.css
packages/ui/src/components/LastOperationPanel/LastOperationPanel.stories.tsx
packages/ui/src/components/LastOperationPanel/LastOperationPanel.tsx
packages/ui/src/components/LastOperationPanel/index.ts
packages/ui/src/components/Legend/Legend.module.css
packages/ui/src/components/Legend/Legend.stories.tsx
packages/ui/src/components/Legend/Legend.tsx
packages/ui/src/components/Legend/index.ts
packages/ui/src/components/ListEditor/AddEntry.tsx
packages/ui/src/components/ListEditor/ListEditor.module.css
packages/ui/src/components/ListEditor/ListEditor.stories.tsx
packages/ui/src/components/ListEditor/ListEditor.tsx
packages/ui/src/components/ListEditor/entryDraft.ts
packages/ui/src/components/ListEditor/index.ts
packages/ui/src/components/ListEditor/listEntries.ts
packages/ui/src/components/MenuButton/MenuButton.module.css
packages/ui/src/components/MenuButton/MenuButton.stories.module.css
packages/ui/src/components/MenuButton/MenuButton.stories.tsx
packages/ui/src/components/MenuButton/MenuButton.tsx
packages/ui/src/components/MenuButton/index.ts
packages/ui/src/components/MeshEditor/MeshEditor.module.css
packages/ui/src/components/MeshEditor/MeshEditor.stories.tsx
packages/ui/src/components/MeshEditor/MeshEditor.tsx
packages/ui/src/components/MeshEditor/MeshHandles.stories.module.css
packages/ui/src/components/MeshEditor/MeshHandles.stories.tsx
packages/ui/src/components/MeshEditor/MeshHandles.tsx
packages/ui/src/components/MeshEditor/index.ts
packages/ui/src/components/OpacityRange/OpacityRange.module.css
packages/ui/src/components/OpacityRange/OpacityRange.stories.tsx
packages/ui/src/components/OpacityRange/OpacityRange.tsx
packages/ui/src/components/OpacityRange/index.ts
packages/ui/src/components/PageTabs/PageTabs.module.css
packages/ui/src/components/PageTabs/PageTabs.stories.module.css

<!-- done: 1 findings, files read: 46 -->
