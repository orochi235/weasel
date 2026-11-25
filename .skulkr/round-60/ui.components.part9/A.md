I couldn't write `.skulkr/out/findings.md` because permission was denied, and git commands were blocked too, so I didn't check the last week's history. Here is the whole document:

```markdown
# Audit round 60 — ui.components.part9

## Adding the last token allowed by `maxItems` disables the focused input and drops focus to the body
- where: packages/ui/src/components/TokenField/TokenField.tsx:158 (TokenField, `disabled={disabled || full}`), with `commit` at :86
- scenario: `maxItems={3}` and two tokens. The user types "c" and presses Enter. `commit` adds the third token, and the next render sets `disabled` on the text field, which still has focus. The browser moves focus to `document.body`: no chip or field is focused, and the next Tab starts from the top of the page. `remove` calls `focus.request`, but `commit` doesn't. When an add fills the field, focus should move to the new last chip.
- evidence: read
- severity: medium

## A `Tab` laid along a run drops a function `style`
- where: packages/ui/src/components/Tabs/Tabs.tsx:171 (Tab)
- scenario: React Aria's `TabProps.style` may be a function of the render props (`style={({ isSelected }) => ({ … })}`). On the plain path, `rest.style` reaches `RACTab` untouched. On the slot path (inside `PageTabs`, or a `TabList` in a curved `Along`), the merge keeps `rest.style` only when `typeof rest.style === 'object'`, so a function style is dropped without a warning. The same prop works in a straight list and vanishes along a run. The slot path should call the function with the render props, or compose it as a function, and merge the result under the slot's placement style.
- evidence: read
- severity: low

## Pasted text with commas becomes one token, though "a comma is never text"
- where: packages/ui/src/components/TokenField/TokenField.tsx:104-107 (onInputKey) and :86 (commit)
- scenario: A comma ends a token only when it arrives as a keystroke in `onKeyDown`. Pasting `red, green, blue`, or an autofill or IME insertion that contains a comma, puts the commas into `draft` through `onChange`. Enter or blur then commits the single token `"red, green, blue"`, which the user could never have typed. The comment and the component docs say a comma always ends a token. `commit` (or `onChange`) should split the draft on commas the way the keystroke path does.
- evidence: read
- severity: low

## `ToggleChips` blocks touch scrolling over the whole set even without `sweep`
- where: packages/ui/src/components/ToggleChips/ToggleChips.module.css:10 (.root)
- scenario: `.root` sets `touch-action: none` unconditionally, but only the sweep drag needs it, and `SegmentSweeper` mounts only when `sweep` is set. A `ToggleChips` without `sweep`, such as the `Plain` story or a tall wrapping set of a dozen chips in a scrolling panel, still stops a touch that starts on it from panning the page or the panel. It should apply only while the set sweeps, for example through a `data-sweep` attribute on the root.
- evidence: read
- severity: low

## The arc lab's `tabs` knob leaves the controlled `selectedKey` naming a tab that no longer exists
- where: packages/ui/src/components/Tabs/lab/TabsArcView.tsx:37-38 (TabsArcView)
- scenario: Select "Fonts" (the 6th tab), then set the Tabs knob to 4. `sections` drops "Fonts" but `section` stays "Fonts", so the controlled `Tabs` gets a `selectedKey` that names no tab. No tab reads as chosen, no panel shows, and the State readout still says `section: Fonts`. The view should clamp `section` to the sections still shown.
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

<!-- done: 5 findings, files read: 46 -->
```

<!-- done: 5 findings, files read: 46 -->