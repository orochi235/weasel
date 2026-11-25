I couldn't save the findings file: the write to `.skulkr/out/findings.md` was refused twice (only the first, partial write got through). Here is the whole document instead.

# Audit round 59: ui.components.Properties.part1

## A PropertyGroup's packing rules reach into a group nested inside it, so a nested `pack="pairs"` group stacks every row
- where: packages/ui/src/components/Properties/PropertyGroup.css:30 (`.group:not(.groupPairs) .groupBody > :not(.rowColor)`), :34, :46
- scenario: `<PropertyGroup title="Effect"><PropertyGroup title="Offset" pack="pairs"><PropertyField …X/><PropertyField …Y/></PropertyGroup></PropertyGroup>`. The rules put a descendant combinator between `.group…` and `.groupBody`, so the outer default-packed group's `:not(.groupPairs)` also matches the inner pairs group's body. That rule is (0,4,0) and sets `grid-column: 1 / -1`. The inner `.groupPairs .groupBody > * { grid-column: auto }` is (0,2,0) and loses, so X and Y each take the full width instead of pairing. The leak runs the other ways too: an outer `pack="one-up"` group (`.groupOneUp .groupBody > *`, later in source at equal specificity) forces a nested pairs group's rows to span, and an outer pairs group gives a nested group's rows `align-self: first baseline`. `PropertyList.css` scopes the same rules with child combinators (`.list:not(.listPairs) > …`, `.listPairs > *`), so a list nested in a list does not leak. The group's rules should be scoped to their own body the same way.
- evidence: read
- severity: medium

## A standalone slider disabled for a reason has no keyboard stop: the readout drops the reason and goes natively disabled
- where: packages/ui/src/components/Properties/NumberControls.tsx:232 (SliderReadout passes only `disabled={p.disabled}`), :291 (EditableReadout `useNativeHold({ disabled, … })`), :184 (SliderTrack `tabIndex`)
- scenario: `<PropertyControl kind="number" control="slider" name="Blur" value={4} disabled disabledReason="Locked" onChange={…} />`, a `SliderCell` with no row around it.
  - The track gets the reason and stays reachable, but its `tabIndex` is -1 because the readout is meant to be the keyboard's way in.
  - The readout's `useNativeHold` gets `disabled` with no reason, and outside a row no scope supplies one. So `reachable` is false and the readout becomes a native `disabled` input.
  - The readout never calls `hold.wrap`, so no tooltip shows the reason either.
  - The result is a slider with no tab stop at all, and a reason no keyboard or screen-reader user can reach.

  Inside a `PropertyRow`, the row's `Disabled` scope supplies the reason, so only the standalone cell is affected. The fix is to pass `disabledReason` through to the readout and wrap the readout in `hold.wrap`.
- evidence: read
- severity: medium

## A font-family or font-weight field drops its `id`, so a `<label htmlFor>` outside it names nothing
- where: packages/ui/src/components/Properties/FontControls.tsx:9 (FontFamilyControl), :26 (FontWeightControl)
- scenario: `<label htmlFor="ff">Font</label><PropertyControl kind="font-family" id="ff" … />`. The `Select` is rendered without `id`, so the label names nothing. `PropertyFieldBase.id` (fieldTypes.ts:46) promises an id to every control except radio, toggle, menu, switch and paint, and the enum select does pass it (`EnumControl.tsx:103`).
- evidence: read
- severity: medium

## A ColorControl with a separate alpha keeps a canceled gesture's "moved" flags, so the next commit also writes the alpha
- where: packages/ui/src/components/Properties/ColorControls.tsx:34-50 (`route`), :66
- scenario: `alpha={0.333}` with `onAlphaInput` and `onAlphaChange`.
  1. Dragging the opacity track sets `moved.current.alpha = true`.
  2. Escape calls `p.onCancel` directly, and `moved` is never reset.
  3. Picking a new hue and closing the picker then reads the stale flag and calls `onAlphaChange(0.33)`.

  That is an alpha edit the user never made, rounded from the stored 0.333. `moved` should be cleared on cancel, as it is on settle.
- evidence: read
- severity: low

## A disabled inline paint field remounts its editor, so the editor loses its local state whenever `disabled` flips
- where: packages/ui/src/components/Properties/ColorControls.tsx:98-107 (PaintControl)
- scenario: `control="inline"` with `disabled` driven by another field. Enabled, the root element is `<PaintInput>`; disabled, it is `<div><div inert><PaintInput/></div></div>`. Because the root element type changes, `PaintInput` unmounts and remounts on each flip and loses its selected stop, open kind editor and unsettled draft. Keeping the wrapper in both states, inert only while disabled, would keep the editor mounted.
- evidence: read
- severity: low

## A disabled inline paint field outside a row drops its `disabledReason`
- where: packages/ui/src/components/Properties/ColorControls.tsx:101-106
- scenario: `<PropertyControl kind="paint" control="inline" disabled disabledReason="Set by the style" … />`. The swatch branch passes the reason to `PaintField` (line 80). The inline branch never reads `p.disabledReason`, so no tooltip or description carries it. Inside a row, the row's help reads the reason; a standalone control silently loses it.
- evidence: read
- severity: low

## A menu enum whose chosen option has a non-text label loses the value from the button's accessible name
- where: packages/ui/src/components/Properties/EnumControl.tsx:51-53
- scenario: an option `{ value: 'sm', label: <i>Small</i>, short: ['S'] }` is chosen. `reads` is that element, so `named` falls back to the field name alone: "Size", not "Size: S". `aria-label` overrides the visible text, so the value is never announced, even though the code's own comment says the name "has to carry both". The menu items already use the fallback `nameOf(o.label) ?? o.short?.[0] ?? o.value` (line 63); the button name should use it too.
- evidence: read
- severity: low

## DialogRow's `aria-label` replaces its summary, so a screen reader never hears the value the row shows
- where: packages/ui/src/components/Properties/DialogRow.tsx:92
- scenario: `<DialogRow label="Globs" summary="a, b">`. The button's accessible name is "Edit Globs", and the visible summary "a, b" is never announced. EnumControl's menu button avoids this by naming itself `name: value`.
- evidence: read
- severity: low

## CurveField's vertical flip commits values off the step grid, where every drag commit is snapped
- where: packages/ui/src/components/Properties/CurveField.tsx:95-103 (handleFlipVertical)
- scenario: `min={0} max={1} step={0.3}` gives the grid 0, 0.3, 0.6, 0.9. A point at y = 0.3 flips to 0.7 and is committed as is, while drags go through `snapped` (`snapToStep(y, step, min)` plus a clamp). The same happens whenever the step doesn't divide `max - min`. So two edit paths disagree on which values the curve can hold; the flip should go through `snapped`.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Properties/ColorControls.tsx
packages/ui/src/components/Properties/CurveField.module.css
packages/ui/src/components/Properties/CurveField.stories.tsx
packages/ui/src/components/Properties/CurveField.tsx
packages/ui/src/components/Properties/CurveMarks.tsx
packages/ui/src/components/Properties/DialogRow.stories.tsx
packages/ui/src/components/Properties/DialogRow.tsx
packages/ui/src/components/Properties/EnumControl.tsx
packages/ui/src/components/Properties/FontControls.tsx
packages/ui/src/components/Properties/NumberControls.tsx
packages/ui/src/components/Properties/Properties.gallery.stories.module.css
packages/ui/src/components/Properties/Properties.gallery.stories.tsx
packages/ui/src/components/Properties/Properties.metrics.stories.module.css
packages/ui/src/components/Properties/Properties.metrics.stories.tsx
packages/ui/src/components/Properties/Properties.module.css
packages/ui/src/components/Properties/PropertyAutoReadout.stories.tsx
packages/ui/src/components/Properties/PropertyAutoReadout.tsx
packages/ui/src/components/Properties/PropertyCaption.tsx
packages/ui/src/components/Properties/PropertyControl.stories.tsx
packages/ui/src/components/Properties/PropertyField.stories.module.css
packages/ui/src/components/Properties/PropertyField.stories.tsx
packages/ui/src/components/Properties/PropertyField.tsx
packages/ui/src/components/Properties/PropertyGroup.css
packages/ui/src/components/Properties/PropertyGroup.stories.tsx
packages/ui/src/components/Properties/PropertyGroup.tsx
packages/ui/src/components/Properties/PropertyHelp.module.css
packages/ui/src/components/Properties/PropertyHelp.stories.tsx
packages/ui/src/components/Properties/PropertyHelp.tsx
packages/ui/src/components/Properties/PropertyList.css
packages/ui/src/components/Properties/PropertyList.stories.module.css
packages/ui/src/components/Properties/PropertyList.stories.tsx
packages/ui/src/components/Properties/PropertyList.tsx
packages/ui/src/components/Properties/PropertyNote.stories.tsx
packages/ui/src/components/Properties/PropertyPanel.css
packages/ui/src/components/Properties/PropertyPanel.stance.css
packages/ui/src/components/Properties/PropertyPanel.stories.module.css
packages/ui/src/components/Properties/PropertyPanel.stories.tsx

<!-- done: 9 findings, files read: 37 -->