# Findings: ui.components.part5 (round 60)

## ListEditor: Enter in a text entry neither adds nor commits the draft when the list is full or has no kind to add
- where: packages/ui/src/components/ListEditor/ListEditor.tsx:116 (ListEditor onKeyDown → insert)
- scenario: `maxItems={3}` and three entries (or `newEntry={[]}`); the user types into entry 2 and presses Enter. The Enter branch always `preventDefault()`s and calls `insert`, which returns early on `list.length >= maxItems` (and is skipped when `kinds[0]` is missing), so nothing is written: `entries.keyDown` is not reached and `entries.settle` is never called. The typed text stays an uncommitted draft until blur, while the props doc (and `useTextDraft`'s contract) says a text entry is written "on blur or Enter". Should settle the draft (`entries.settle()`) when no entry is inserted.
- evidence: read
- severity: medium

## MenuButton: a `bare` trigger disabled for a reason is drawn enabled, with hover accent and a pointer cursor
- where: packages/ui/src/components/MenuButton/MenuButton.module.css:38,47 (`.bare:hover:not(:disabled)`, `.bare:disabled`)
- scenario: `<MenuButton bare label="Dashboard" disabled disabledReason="No pages yet" items={…} />` (or a `<Disabled reason=…>` scope around it). `ButtonTooltip`'s `stillReachable` renders the button with `disabled={false}`, `aria-disabled` and `data-disabled` so its tooltip stays reachable. The bare styles key only on `:disabled`, so the trigger keeps full opacity, gets the `--wzl-accent-fg` hover color and the default cursor, and reads as live while refusing presses. The framed variant is dimmed because `Field.module.css:105` matches `.frame[data-disabled]`; the bare one should match `[data-disabled]` too.
- evidence: read
- severity: low

## OpacityRange: a range disabled for a reason keeps its thumb and live track; the "dead alpha" rules key only on `:disabled`
- where: packages/ui/src/components/OpacityRange/OpacityRange.module.css:19-33 (`.range:disabled::…`)
- scenario: `<OpacityRange disabled disabledReason="Locked layer" … />`, or a `ColorField` held for a reason, which passes the reason down. `InlineRange` → `useNativeHold` renders a reason-held control reachable: `aria-disabled` + `data-disabled`, never native `disabled` (`Disabled/nativeHold.ts:38`). The four rules that drop the thumb and flatten the track match `:disabled` only, so the alpha track still draws its thumb and groove as live. A reason-less disabled one loses its thumb, so the same state draws two ways depending on whether a reason was given. `InlineRange.module.css:80` already uses `:where(:disabled, [data-disabled])`. The comment there ("which a color field already sets on the input") is wrong for the reason case.
- evidence: read
- severity: low

## Jog: while playing, the Pause button is disabled once `count` drops below 2, so playback can't be stopped from the Jog
- where: packages/ui/src/components/Jog/Jog.tsx:107 (jogParts, `play`)
- scenario: `playing={true}` over a list of steps that shrinks to one (snapshots deleted, a filter narrows the beats). The play button now reads "Pause" (`aria-label={playing ? 'Pause' : 'Play'}`) but `disabled={held || count < 2}` disables it, so the user can't send `onPlayingChange(false)` and the caller's loop keeps `playing` true. The `count < 2` guard should apply only to starting playback (`!playing && count < 2`), the way `Transport`'s play button never disables Pause for a short duration (`Transport.tsx:135-138`).
- evidence: read
- severity: low

## Files read
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
packages/ui/src/components/PageTabs/PageTabs.stories.tsx

<!-- done: 4 findings, files read: 46 -->
