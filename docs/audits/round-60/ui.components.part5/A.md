I couldn't write `.skulkr/out/findings.md` because permission was denied twice, so the full findings document is below.

# Round 60 findings: ui.components.part5

## ListEditor's Enter does not commit a typed entry once the list is at maxItems (or has no entry kinds)
- where: packages/ui/src/components/ListEditor/ListEditor.tsx:116 (ListEditor, onKeyDown)
- scenario: with `maxItems={3}` and three entries, the user retypes entry 2 and presses Enter. The Enter branch calls `preventDefault()` and then `insert(at + 1, …)`. That returns early because `list.length >= maxItems`, so `entries.write` never runs and the draft stays uncommitted. The else branch with `entries.keyDown` is skipped too. The same thing happens with `newEntry={[]}`, where `kinds[0]` is undefined. The props promise that a text entry "is written … on blur or Enter". Here Enter does nothing, and `onChange` waits for a blur or an idle rest. Enter should settle the draft (`entries.settle()`) when it cannot insert.
- evidence: read (useTextDraft's `keyDown` handles only Escape, so the commit on Enter comes only from `insert`'s `write`)
- severity: medium

## MeshHandles ignores Disabled and ReadOnly scopes: a held mesh's points still drag and arrow-step
- where: packages/ui/src/components/MeshEditor/MeshHandles.tsx:50 (MeshHandles)
- scenario: an app wraps a fill's panel and its on-canvas overlay in `<ReadOnly when>` or `<Disabled>`. `MeshEditor` holds every corner field and the space switch. `MeshHandles`, however, takes no `HoldProps`, never calls `useControlHold` or `useControlAccess`, and `DragPoint` reads no hold either. So dragging a corner, or pressing an arrow on a focused handle, still calls `onInput`/`onChange` and edits the paint. Kit controls that draw their own focus targets (slider thumbs, list rows, timeline keys) gate edits through `useControlHold`; this one answers the same question the other way.
- evidence: read
- severity: medium

## PageTabs draws its drop line on the wrong edge in a right-to-left strip
- where: packages/ui/src/components/PageTabs/PageTabs.module.css:45 (`.strip .dropBefore` / `.dropAfter`)
- scenario: in an RTL document the strip's flex row runs right to left. PageTabs sets no `dir`, and its arrows follow the computed direction per docs/unruled.md. `dropBefore` is `inset 2px 0` and `dropAfter` is `inset -2px 0`, which are the physical left and right edges. A drop "before" tab 2 therefore lights tab 2's left edge, which in RTL is the edge it shares with tab 3, so the line marks the opposite side from where the page lands. Bar (`Bar.module.css:344`) and ToolbarDock (`ToolbarDock.module.css:185`) flip their drop lines under `:dir(rtl)`, but PageTabs has no such rule.
- evidence: read
- severity: low

## OpacityRange's dead-track style misses a range disabled for a reason
- where: packages/ui/src/components/OpacityRange/OpacityRange.module.css:19 (`.range:disabled::…`)
- scenario: take `<OpacityRange disabled disabledReason="No fill">`, or the range inside `<Disabled reason>`. `useNativeHold` keeps the input focusable with `aria-disabled` and `data-disabled` rather than native `disabled`. So `:disabled` never matches, and the track keeps its full groove and thumb and looks live. InlineRange's own rule keys off `:where(:disabled, [data-disabled])` (InlineRange.module.css:80). These four rules key off `:disabled` only.
- evidence: read
- severity: low

## MeshHandles remounts, and permanently welds, a point dragged or stepped onto another of its kind
- where: packages/ui/src/components/MeshEditor/MeshHandles.tsx:57 (MeshHandles, `meshHandles(value)` keyed by `handle.id`)
- scenario: handles are rebuilt from the live draft every frame. `meshHandles` merges any two coincident points of one kind into one handle, which takes the first point's id. For example, arrow-step edge control `0:1` (at 1/3) right by 80px in the story's 240px frame:
  - It lands on control `0:2` (at 2/3), within the 1e-9 tolerance.
  - The `0:1` key disappears and the focused circle unmounts, so focus and any in-flight pointer drag are lost.
  - From then on both points are one handle with two refs and can never be dragged apart.

  The overlay should keep a handle's identity for the length of a gesture instead of re-deriving merges from the moving draft.
- evidence: read (merge rule in packages/renderer/src/meshPaint/handles.ts:61)
- severity: low

## Jog's Pause button is disabled while playing once count drops below 2
- where: packages/ui/src/components/Jog/Jog.tsx:107 (jogParts, `play`)
- scenario: a Jog is `playing` and its list shrinks to one step, or it mounts with `count={1} playing`. The button reads "Pause", but `disabled={held || count < 2}` disables it. The user cannot stop playback, and the consumer's `playing` stays true. The count guard should only refuse starting play (`!playing && count < 2`).
- evidence: read
- severity: low

## Jog drops a falsy but renderable caption such as `0`, which JogAlong would draw
- where: packages/ui/src/components/Jog/Jog.tsx:152 (jogParts, `caption`)
- scenario: `caption={0}` is a valid `ReactNode`, but `caption ? … : null` renders nothing. JogAlong tests `parts.caption != null` (JogAlong.tsx:34, :62). So the straight and curved layouts answer "is there a caption" differently, and the straight one loses a caption of 0.
- evidence: read
- severity: low

## LastOperationPanel calls `store.dismiss` unbound
- where: packages/ui/src/components/LastOperationPanel/LastOperationPanel.tsx:33 (LastOperationPanel)
- scenario: `LastOperationStore` is a public interface, and a caller may implement it as a class (`class MyStore { dismiss() { this.op = null; … } }`) and pass it as `store`. `onClick={source.dismiss}` calls the method with `this` undefined, so pressing Close throws instead of dismissing. `adjust` is called as a method on the next line, and `dismiss` should be too: `onClick={() => source.dismiss()}`.
- evidence: read
- severity: low

## A `current` MenuButton is not held by a ReadOnly scope, though it changes a held value
- where: packages/ui/src/components/MenuButton/MenuButton.tsx:109 (MenuButton, `ButtonTooltip` without `holdsValue`)
- scenario: `<ReadOnly when><MenuButton current label={instrument} onAction={setInstrument} items={…} /></ReadOnly>`. The doc says `current` makes the label "a value the caller holds and has set from the last row chosen". The trigger passes no `holdsValue`, though, so the read-only scope is ignored: the menu opens, and choosing a row changes the value. `Select`, the other control that shows a held value, is held read-only.
- evidence: read
- severity: low

## Legend's dot swatch is offset on the wrong side in right-to-left text
- where: packages/ui/src/components/Legend/Legend.module.css:38 (`.swatch[data-mark='dot']`)
- scenario: the dot's `margin: 0 var(--wzl-space-2) 0 5px` pads it to the 15px column the other marks take, but it uses physical sides. In an RTL legend the row's flex runs right to left. The 5px lead then lands between the dot and its label, and the 4px trail on the outer edge. The dots end up out of line with the line, dash and band swatches above and below them. `margin-inline` would keep the column in both directions.
- evidence: read
- severity: low

## KeymapHint story ignores its `label` control after the first render
- where: packages/ui/src/components/KeymapHint/KeymapHint.stories.tsx:25 (Open)
- scenario: the story exposes `args: { label }`, but the keymap is pushed once inside `useState`'s initializer. Editing `label` in forge's controls never changes the title the hint shows.
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

<!-- done: 11 findings, files read: 46 -->