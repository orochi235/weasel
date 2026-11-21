# Audit round 60 — ui.components.part9 (blind reviewer)

Note: the brief names frozen commit deaf03bd8ed407174fa289a1262d2699ffbe97db, but this tree has no such object
(`git cat-file` fails). Everything below was read at HEAD 6f634fabe1ba54c5d94054a307392fe6d65141ab.

## TokenField's Backspace leaves a non-empty field and turns its text into a token
- where: packages/ui/src/components/TokenField/TokenField.tsx:108 (onInputKey), with :161 (onBlur={commit})
- scenario: the field holds tokens and the draft reads `abc`, caret moved to the start (Home). Backspace →
  the branch checks only `caretAtStart`, not that the draft is empty, so it calls `preventDefault` and
  `focus.request(value.length - 1)`. Focus moving to the chip blurs the input, and `onBlur={commit}` adds `abc` as a
  new token. The doc comment (:55) promises this move only for "Backspace in the empty field". It should require
  `draft === ''` for Backspace, so Backspace at the start of typed text does nothing, as it does in any text field.
- evidence: read
- severity: medium

## Reaching maxItems from the keyboard disables the focused input, and focus drops to the body
- where: packages/ui/src/components/TokenField/TokenField.tsx:158 (`disabled={disabled || full}`), :86 (commit)
- scenario: `maxItems={3}` with 2 tokens; the user types `c` and presses Enter. `commit` adds the third token, `full`
  becomes true, and the input that has focus is rendered `disabled`. A disabled element can't hold focus, so the
  browser moves focus to `document.body`. The keyboard user lands outside the field, with nothing moving focus to a
  chip. Removing a token by keyboard then means tabbing back in. Expected: focus moves to a chip (e.g. the last one)
  when the field fills, or the input becomes read-only instead of disabled.
- evidence: read (browser blur-on-disable behavior is inferred, not run)
- severity: medium

## A Tab's function `style` is dropped once its list is laid along a run
- where: packages/ui/src/components/Tabs/Tabs.tsx:171 (Tab)
- scenario: `<Tab id="a" style={({ isSelected }) => ({ color: isSelected ? 'red' : undefined })}>` inside a
  `TabList` laid along a curved `Along`. Once the slot is published, the slotted branch merges
  `typeof rest.style === 'object' ? rest.style : null` with the slot style. React Aria's render-prop style is a
  function, so it becomes `null` and the consumer's style is silently lost. The unslotted branch at :164 passes it
  through. Expected: call the function with the render props and merge its result with the slot's style.
- evidence: read
- severity: low

## The arc lab's tab-count knob can leave the controlled Tabs pointing at a tab that no longer exists
- where: packages/ui/src/components/Tabs/lab/TabsArcView.tsx:37-38,59 (TabsArcView)
- scenario: in the `OnAnArc` lab, select `Fonts` (the 6th section), then drag `Tabs` down to 4. `sections` drops
  `Fonts`, but `section` stays `'Fonts'`, so `selectedKey` names no tab: no tab is lit, no panel shows, and the
  readout still says `section: Fonts`. The lab should clamp `section` to the remaining sections when `tabs` shrinks.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Tabs/Tabs.module.css
packages/ui/src/components/Tabs/Tabs.stories.tsx
packages/ui/src/components/Tabs/Tabs.tsx
packages/ui/src/components/Tabs/index.ts
packages/ui/src/components/Tabs/lab/TabsArc.stories.module.css
packages/ui/src/components/Tabs/lab/TabsArc.stories.tsx
packages/ui/src/components/Tabs/lab/TabsArcView.tsx
packages/ui/src/components/TextArea/TextArea.module.css
packages/ui/src/components/TextArea/TextArea.stories.tsx
packages/ui/src/components/TextArea/TextArea.tsx
packages/ui/src/components/TextArea/index.ts
packages/ui/src/components/Toast/Toast.module.css
packages/ui/src/components/Toast/Toast.stories.module.css
packages/ui/src/components/Toast/Toast.stories.tsx
packages/ui/src/components/Toast/Toast.tsx
packages/ui/src/components/Toast/index.ts
packages/ui/src/components/Toast/queue.ts
packages/ui/src/components/Toast/refusals.ts
packages/ui/src/components/Toast/toastViewTransitions.css
packages/ui/src/components/ToggleChips/ToggleChips.module.css
packages/ui/src/components/ToggleChips/ToggleChips.stories.module.css
packages/ui/src/components/ToggleChips/ToggleChips.stories.tsx
packages/ui/src/components/ToggleChips/ToggleChips.tsx
packages/ui/src/components/ToggleChips/index.ts
packages/ui/src/components/TokenField/TokenChip.tsx
packages/ui/src/components/TokenField/TokenEditor.tsx
packages/ui/src/components/TokenField/TokenField.module.css
packages/ui/src/components/TokenField/TokenField.stories.tsx
packages/ui/src/components/TokenField/TokenField.tsx
packages/ui/src/components/TokenField/index.ts
packages/ui/src/components/TokenField/tokenDrag.ts
packages/ui/src/components/TokenField/tokenFocus.ts
packages/ui/src/components/ToolGroup/ToolGroup.module.css
packages/ui/src/components/ToolGroup/ToolGroup.stories.tsx
packages/ui/src/components/ToolGroup/ToolGroup.tsx
packages/ui/src/components/ToolGroup/index.ts
packages/ui/src/components/ToolOptionsBar/ActiveToolOptionsBar.stories.tsx
packages/ui/src/components/ToolOptionsBar/ActiveToolOptionsBar.tsx
packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.module.css
packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.stories.module.css
packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.stories.tsx
packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.tsx
packages/ui/src/components/ToolOptionsBar/index.ts
packages/ui/src/components/ToolPalette/ToolPalette.module.css
packages/ui/src/components/ToolPalette/ToolPalette.stories.module.css
packages/ui/src/components/ToolPalette/ToolPalette.stories.tsx

<!-- done: 4 findings, files read: 46 -->
