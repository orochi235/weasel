I couldn't write the findings file: the first five findings are in `.skulkr/out/findings.md`, but the permission prompt for the rest was declined. Here is the whole document instead.

# Audit round 60 — ui.components.part3

## FillStrokeSwatch ignores Disabled/ReadOnly scopes: its chips still open the paint editor and commit edits
- where: packages/ui/src/components/FillStrokeSwatch/FillStrokeSwatch.tsx:66 (Chip), :112 (FillStrokeSwatch)
- scenario: `<Disabled reason="Layer locked"><FillStrokeSwatch … /></Disabled>`, or the same inside `<ReadOnly>`. The None, Swap and Default buttons are kit `Button`s, so they follow the scope. Each chip's trigger is a raw `<button>` that never reads `useControlAccess`. Clicking it still opens `PaintEditorPopover`, and `onInput`/`onChange` fire. Shift-click still calls `onToggleNone`, and focus still calls `onTargetChange`. The component doesn't take `HoldProps` either. Expected: a held swatch refuses changes, as `DisableableProps` asks of "every kit component that is or holds a control".
- evidence: read
- severity: medium

## EasingPicker's "Convert to bezier" replaces 21 of the 31 named curves with CSS `ease`
- where: packages/ui/src/components/EasingPicker/EasingPicker.tsx:14 (BEZIER_OF), :87
- scenario: with value `'easeOutBack'`, or any Quart, Quint, Expo, Circ, Back, Elastic or Bounce name, the Convert button is offered. Pressing it writes `{ bezier: [0.25, 0.1, 0.25, 1] }`, which is a visibly different curve, and nothing tells the user. Quart, Quint, Expo, Circ and Back have standard cubic-bezier fits that the table lacks. Elastic and Bounce have no fit, so for them the button shouldn't be offered.
- evidence: read (`EASINGS` in packages/geom/src/easings.ts:152 has 31 names; `BEZIER_OF` covers 10)
- severity: medium

## EffectList keeps its name field and buttons focusable "to tell" a reason, but never tells it
- where: packages/ui/src/components/EffectList/EffectCard.tsx:44, :73, :84, :89 (EffectCard)
- scenario: `<EffectList disabled disabledReason="Locked">`, or the list inside `<ReadOnly reason="Shared">`. The name input and the Duplicate and Remove buttons stay focusable with `aria-disabled`, as the comment says they should. But `access.reason` is never connected to them: there's no `aria-describedby` and no tooltip. The number (`ReorderHandle`) and the `Switch` in the same row do show "Locked".
- evidence: read (EffectList.hold.test.tsx checks only `aria-disabled`, never the description)
- severity: medium

## Disclosure ignores Disabled scopes, unlike every other kit control
- where: packages/ui/src/components/Disclosure/Disclosure.tsx:75
- scenario: `<Disabled><DisclosureRow …/></Disabled>`. The twisty never reads `useDisabled`, so it stays live and `onOpenChange` fires while the controls beside it are disabled. `Disabled` is documented to work "the way `<fieldset disabled>` does", which would disable this button. The stylesheet also only styles `:disabled`, so a twisty disabled with a reason wouldn't dim.
- evidence: read
- severity: low

## EasingPicker's Convert button under read-only is unmarked, where controlHold marks change-making buttons
- where: packages/ui/src/components/EasingPicker/EasingPicker.tsx:82
- scenario: under `<ReadOnly reason="Shared">`, the button drops `aria-readonly` and gets no other mark. It looks fully enabled but does nothing when pressed. `useControlHold().button(true)` marks the same kind of button `aria-disabled` and `data-disabled`.
- evidence: read
- severity: low

## EffectList's held Duplicate/Remove buttons look and hover exactly like live ones
- where: packages/ui/src/components/EffectList/EffectList.module.css:102, :116
- scenario: when the list is disabled or read-only, `.action` has no `:disabled` or `[aria-disabled]` rule. The buttons keep the pointer cursor, brighten on hover, and draw at full strength while every press is refused.
- evidence: read
- severity: low

## Uncontrolled FloatingPanel ignores a changed `anchor` even before it has ever been dragged
- where: packages/ui/src/components/FloatingPanel/FloatingPanel.tsx:38
- scenario: no `value`, and `anchor` changes from `'bottom-left'` to `'top-right'` before any drag. `own` is set from `anchor` once, when the panel mounts, so the panel stays bottom-left. That contradicts the prop's doc: "Corner it rests in before it has ever been dragged".
- evidence: read
- severity: low

## FitLabel's scale stage watches font loads on the global `document`, its step stage on the element's own
- where: packages/ui/src/components/FitLabel/fitScale.ts:104, :110 (ScaleStage.attach/detach)
- scenario: a scope rendered into a popout window or iframe. `useFontLoads` (FitLabel.tsx:48) listens on `el.ownerDocument.fonts`, but `ScaleStage` listens on the opener's `document.fonts`. When a web font finishes loading in the popout, the labels step again but the scale members are never re-measured, so they keep the scale fitted to the fallback font.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Disabled/Disabled.stories.tsx
packages/ui/src/components/Disabled/Disabled.tsx
packages/ui/src/components/Disabled/HoldReason.tsx
packages/ui/src/components/Disabled/controlHold.tsx
packages/ui/src/components/Disabled/index.ts
packages/ui/src/components/Disabled/nativeHold.ts
packages/ui/src/components/Disabled/racHold.ts
packages/ui/src/components/Disabled/testing/holdCases.fixtures.tsx
packages/ui/src/components/Disclosure/Disclosure.module.css
packages/ui/src/components/Disclosure/Disclosure.stories.module.css
packages/ui/src/components/Disclosure/Disclosure.stories.tsx
packages/ui/src/components/Disclosure/Disclosure.tsx
packages/ui/src/components/Disclosure/index.ts
packages/ui/src/components/DragGhost/DragGhost.module.css
packages/ui/src/components/DragGhost/DragGhost.stories.module.css
packages/ui/src/components/DragGhost/DragGhost.stories.tsx
packages/ui/src/components/DragGhost/DragGhost.tsx
packages/ui/src/components/DragGhost/index.ts
packages/ui/src/components/DragGrip/DragGrip.stories.module.css
packages/ui/src/components/DragGrip/DragGrip.stories.tsx
packages/ui/src/components/DragGrip/DragGrip.tsx
packages/ui/src/components/DragGrip/index.ts
packages/ui/src/components/EasingPicker/EasingPicker.module.css
packages/ui/src/components/EasingPicker/EasingPicker.stories.tsx
packages/ui/src/components/EasingPicker/EasingPicker.tsx
packages/ui/src/components/EasingPicker/index.ts
packages/ui/src/components/EffectList/EffectCard.tsx
packages/ui/src/components/EffectList/EffectList.module.css
packages/ui/src/components/EffectList/EffectList.stories.module.css
packages/ui/src/components/EffectList/EffectList.stories.tsx
packages/ui/src/components/EffectList/EffectList.tsx
packages/ui/src/components/EffectList/index.ts
packages/ui/src/components/FillStrokeSwatch/FillStrokeSwatch.module.css
packages/ui/src/components/FillStrokeSwatch/FillStrokeSwatch.stories.tsx
packages/ui/src/components/FillStrokeSwatch/FillStrokeSwatch.tsx
packages/ui/src/components/FillStrokeSwatch/index.ts
packages/ui/src/components/FitLabel/FitLabel.stories.module.css
packages/ui/src/components/FitLabel/FitLabel.stories.tsx
packages/ui/src/components/FitLabel/FitLabel.tsx
packages/ui/src/components/FitLabel/fitRoom.ts
packages/ui/src/components/FitLabel/fitScale.ts
packages/ui/src/components/FitLabel/index.ts
packages/ui/src/components/FloatingPanel/FloatingPanel.module.css
packages/ui/src/components/FloatingPanel/FloatingPanel.stories.module.css
packages/ui/src/components/FloatingPanel/FloatingPanel.stories.tsx
packages/ui/src/components/FloatingPanel/FloatingPanel.tsx

<!-- done: 8 findings, files read: 46 -->