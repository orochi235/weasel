# Audit round 60 — ui.components.part3 (blind reviewer)

Note: commit deaf03bd8ed407174fa289a1262d2699ffbe97db does not exist in this clone (`git cat-file` reports a bad
object); the files were read from the working tree as checked out (HEAD 6f634fabe1), whose listed paths carry no
uncommitted changes.

## `Disclosure` ignores `<Disabled>`/`<ReadOnly>` scopes and takes no `disabledReason`
- where: packages/ui/src/components/Disclosure/Disclosure.tsx:75 (Disclosure)
- scenario: `<Disabled reason="Locked"><DisclosureRow open onOpenChange={set} label="Shapes">…</DisclosureRow></Disabled>`
  → the twisty stays a live, enabled button and a press calls `onOpenChange(false)`; only a native `disabled` prop
  disables it, and then with no reason, tooltip or description. `Disabled.tsx` documents `DisableableProps` as what
  every kit component that is or holds a control takes, and every other control reads its scope through
  `useNativeHold`/`useControlHold`; `Disclosure` reads neither, so a disabled scope (e.g. a disabled `PropertyGroup`
  or tree section) leaves its fold control working. Should read `useNativeHold` (or at least `useDisabled`) like
  the other native-button controls.
- evidence: read (no hold hook imported anywhere under Disclosure/)
- severity: medium

## EasingPicker's "Convert to bezier" replaces 21 of the 31 named curves with CSS `ease`
- where: packages/ui/src/components/EasingPicker/EasingPicker.tsx:87 (EasingPicker, convert onClick; table at :14)
- scenario: value `'easeOutExpo'` (or any Quart, Quint, Expo, Circ, Back, Elastic or Bounce name) → the Convert
  button is offered (the curve is `named`), and pressing it calls `onChange({ bezier: [0.25, 0.1, 0.25, 1] })`, a
  materially different curve from the one plotted a moment earlier; the plot then jumps. `named` (offer Convert) and
  `BEZIER_OF` (can convert) answer "is this convertible?" two different ways. Either the button should be offered
  only for names in the table (Elastic/Bounce cannot be a single cubic), or the table should carry the standard
  approximations for Quart/Quint/Expo/Circ/Back.
- evidence: read (EASING_NAMES from packages/geom/src/easings.ts:150-163; BEZIER_OF covers linear + Quad/Cubic/Sine)
- severity: medium

## FillStrokeSwatch's chips ignore a `<Disabled>`/`<ReadOnly>` scope, so shift-click still toggles a paint to none
- where: packages/ui/src/components/FillStrokeSwatch/FillStrokeSwatch.tsx:66-83 (Chip trigger)
- scenario: `<Disabled reason="Nothing selected"><FillStrokeSwatch … onToggleNone={toggle} /></Disabled>` → the
  None/Swap/Default kit `Button`s read the scope and refuse, but each chip's trigger is a bare native `<button>` that
  reads no hold: it stays enabled, a click opens the paint editor and calls `onTargetChange`, and a shift-click calls
  `onToggleNone(slot)`, a paint change the scope was meant to refuse. Same under `<ReadOnly>`. The component also
  takes no `HoldProps`, unlike every other value control (`DisableableProps` is documented as what every kit control
  takes).
- evidence: read (no hold hook imported in FillStrokeSwatch/)
- severity: medium

## EffectCard's name field and Duplicate/Remove buttons stay reachable "to tell a reason" but never tell it
- where: packages/ui/src/components/EffectList/EffectCard.tsx:43-44, 73-92 (EffectCard)
- scenario: `<EffectList disabled disabledReason="Locked" …/>` (or `readOnly readOnlyReason="Shared"`) → the name
  `<input>` and the two action buttons get `aria-disabled` and stay in the tab order, per the comment "A hold with a
  reason keeps these focusable to tell it", but nothing gives them `aria-describedby` or a tooltip: focusing Remove
  announces "Remove A, dimmed" with no reason, and hovering shows nothing. The list calls `useControlAccess` rather than
  `useControlHold`/`useNativeHold`, so no `useHoldReason` runs for them (the switch and number get one only because
  they are kit controls reading the scope). The buttons also keep `cursor: pointer` and their hover color
  (EffectList.module.css:102-118 has no held rule), so they look live. Every other held control builds these attrs
  through `useControlHold().button()`/`focus`; this card hand-rolls a second version that drops the description.
- evidence: read
- severity: low

## A FitScope keeps `data-fit-spent` after its label set changes to one that fits
- where: packages/ui/src/components/FitLabel/FitLabel.tsx:163-180 (useFitScope label-set effect) with
  packages/ui/src/components/FitLabel/fitRoom.ts:49-57 (settleSpent)
- scenario: a scope whose labels are all at their last form and still overflow gets `data-fit-spent` and
  `room.spentAt = clientWidth`. The labels are then swapped for shorter ones (a language switch, a different item
  set) at the same width → the effect resets `steppedAt` and `measured` but not `spentAt`, and `settleSpent` returns
  early while `spentAt !== null` unless the element has grown, so the element stays marked spent and the layout keeps
  granting it extra room although the new labels fit at their full forms. The font-load path (`refit`, :184-194)
  answers the same "labels may now fit" question by clearing `spentAt` and the attribute; the label-set path does not.
- evidence: read
- severity: low

## `--fit-natural` is measured in client (transformed) px on one branch and layout px on the other
- where: packages/ui/src/components/FitLabel/fitRoom.ts:25 (naturalWidth)
- scenario: a fit scope inside an ancestor with `transform: scale(0.5)` (a zoomed panel, any scaled host — the kit
  already corrects for this elsewhere, e.g. `fixedSeat`'s `clientScaleOf`) that does not overflow → `naturalWidth`
  returns `getBoundingClientRect().width`, half the layout width, and that is published as `--fit-natural` for a CSS
  `min-inline-size` that resolves in layout px; the floor is half what it should be, so the box can shrink below its
  full-form width. The overflowing branch uses `scrollWidth` (layout px), so the same element publishes a
  scale-dependent value or not depending on whether it overflows at measure time.
- evidence: read (inference about the transformed case; not run)
- severity: low

## The scale stage listens to the global `document.fonts`, the label stepper to the element's own document
- where: packages/ui/src/components/FitLabel/fitScale.ts:104,110 (ScaleStage.attach/detach)
- scenario: a fit scope rendered into another window's document (a popout portal) → `useFontLoads` (FitLabel.tsx:48)
  listens on `el.ownerDocument.fonts` and refits there, but `ScaleStage` listens on the opener's `document.fonts`, so
  a web font finishing in the popout never re-measures the scale members and they keep the scale measured in the
  fallback face. One question ("which document's font loads refit this scope") answered two ways.
- evidence: read
- severity: low

## Uncontrolled FloatingPanel ignores a change to `anchor` before it has ever been dragged
- where: packages/ui/src/components/FloatingPanel/FloatingPanel.tsx:38 (FloatingPanel)
- scenario: `<FloatingPanel anchor={side}>` with `side` changing from `'bottom-left'` to `'top-right'` (e.g. a
  layout flip) before any drag → `own` was seeded once by the `useState` initializer, so the panel stays bottom-left.
  The prop is documented as "Corner it rests in before it has ever been dragged", which the code honors only at mount.
- evidence: read
- severity: low

## useHoldReason binds its tooltip listeners to one element for as long as the reason is unchanged
- where: packages/ui/src/components/Disabled/HoldReason.tsx:27-56 (useHoldReason effect, deps `[reason]`)
- scenario: a held control whose element before the description is replaced while the reason stays the same (it
  remounts under a new key, or switches between two root elements, e.g. a field that swaps its input for a button)
  → the effect does not rerun, so `pointerover`/`focusin` stay on the detached element and `target.current` still
  points at it: the new element shows no tooltip for its reason and the Tooltip anchors to a node no longer in the
  document.
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

<!-- done: 9 findings, files read: 46 -->
