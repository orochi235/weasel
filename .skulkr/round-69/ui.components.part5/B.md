## ListEditor drops focus to the body when an add in a `renderEntry` list reaches `maxItems`
- where: packages/ui/src/components/ListEditor/ListEditor.tsx:103 (insert), with packages/ui/src/components/ListEditor/listEntries.ts:16 (useListFocus effect)
- scenario: a `renderEntry` list (non-string entries, for example the EntryKinds story) with `maxItems={3}` holding 2 entries. Clicking Add (or choosing a kind from the add menu) calls `insert`, which requests focus `{ at, to: 'input' }`. A `renderEntry` list registers no `inputs`, and the effect only falls back when `to === 'removed'`, so nothing gets focus. The add control then re-renders with `disabled={value.length >= maxItems}` and no `disabledReason` (`access.reason` is undefined while enabled), so it becomes natively disabled and the focused trigger loses focus to `document.body`. Keyboard users lose their place. The text-entry path focuses the new input, so only `renderEntry` lists hit this. Focus should land on the new entry (its handle or its remove button) or on some other control that can still take focus.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ItemList/index.ts
packages/ui/src/components/ItemList/useRowInput.ts
packages/ui/src/components/Jog/Jog.module.css
packages/ui/src/components/Jog/Jog.stories.module.css
packages/ui/src/components/Jog/Jog.stories.tsx
packages/ui/src/components/Jog/Jog.tsx
packages/ui/src/components/Jog/JogAlong.module.css
packages/ui/src/components/Jog/JogAlong.tsx
packages/ui/src/components/KeymapHint/KeymapHint.module.css
packages/ui/src/components/KeymapHint/KeymapHint.stories.tsx
packages/ui/src/components/KeymapHint/KeymapHint.tsx
packages/ui/src/components/LastOperationPanel/LastOperationPanel.module.css
packages/ui/src/components/LastOperationPanel/LastOperationPanel.stories.tsx
packages/ui/src/components/LastOperationPanel/LastOperationPanel.tsx
packages/ui/src/components/Legend/Legend.module.css
packages/ui/src/components/Legend/Legend.stories.tsx
packages/ui/src/components/Legend/Legend.tsx
packages/ui/src/components/ListEditor/AddEntry.tsx
packages/ui/src/components/ListEditor/ListEditor.module.css
packages/ui/src/components/ListEditor/ListEditor.stories.tsx
packages/ui/src/components/ListEditor/ListEditor.tsx
packages/ui/src/components/ListEditor/entryDraft.ts
packages/ui/src/components/ListEditor/listEntries.ts
packages/ui/src/components/MenuButton/MenuButton.module.css
packages/ui/src/components/MenuButton/MenuButton.stories.module.css
packages/ui/src/components/MenuButton/MenuButton.stories.tsx
packages/ui/src/components/MenuButton/MenuButton.tsx
packages/ui/src/components/MeshEditor/MeshEditor.module.css
packages/ui/src/components/MeshEditor/MeshEditor.stories.tsx
packages/ui/src/components/MeshEditor/MeshEditor.tsx
packages/ui/src/components/MeshEditor/MeshHandles.stories.module.css
packages/ui/src/components/MeshEditor/MeshHandles.stories.tsx
packages/ui/src/components/MeshEditor/MeshHandles.tsx
packages/ui/src/components/OpacityRange/OpacityRange.module.css
packages/ui/src/components/OpacityRange/OpacityRange.stories.tsx
packages/ui/src/components/OpacityRange/OpacityRange.tsx
packages/ui/src/components/PageTabs/PageTabs.module.css
packages/ui/src/components/PageTabs/PageTabs.stories.module.css

<!-- done: 1 findings, files read: 38 -->
