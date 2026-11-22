# Audit round 66: ui.components.TokenPanel

## A scale slider's track widens to a regenerated step with no margin, pinning the end thumb, and never narrows back
- where: packages/ui/src/components/TokenPanel/Scale.tsx:127-129 (ScaleSlider)
- scenario: a `factors` scale `4px 8px 16px` starts with range `[log2(4/1.5), log2(16*1.5)]`. The user types base 2 in the rule controls, and the consumer regenerates `2px 4px 8px`. Line 128 widens the range to exactly `log2(2)`, without `MARGIN`, so the smallest thumb sits at the track's start and can't be dragged smaller. That is the case the `MARGIN` comment says the margin exists for. The first render answers the margin question with `MARGIN` and the widening answers it with none. The range also never contracts: type base 400 and back to 4, and the track keeps its 400-scale maximum, so every thumb crowds into the left part of the track. The track should keep a margin past the outermost steps whenever it re-fits to steps outside it, and should re-fit when the steps change from outside a gesture.
- evidence: read
- severity: medium

## A group with `scales` gets no base or rule controls when it has fewer than `familySize` steps
- where: packages/ui/src/components/TokenPanel/TokenPanel.tsx:53-77 (itemsOf), 261-270 (Section)
- scenario: `scales={{ radius: { tokens: ['--radius-sm', '--radius-md'], base: 4, rule: { kind: 'ratio', ratio: 2 } } }}` with the default `familySize` of 3. `itemsOf` files both tokens as plain rows, so `Scale` never mounts and nothing reads `scales.radius`. The base and rule controls the `scales` prop documents ("Such a group edits its base and rule above its steps") are silently dropped. The same happens to any generated group whose step count is under `familySize`, and to one where some step is not a plain number with a unit. A group named in `scales` should draw as a scale whatever its size.
- evidence: read
- severity: low

## An unset `fontWeight` token draws an empty option in the weight select
- where: packages/ui/src/components/TokenPanel/TokenControl.tsx:51-56 (TokenControl)
- scenario: a `fontWeight` token with `value: ''`. The panel expects unset tokens: `TokenRow` marks them `data-unset`, and the text input shows the `unset` placeholder. `WEIGHTS.includes('')` is false, so the options become the nine weights plus `{ value: '', label: '' }`, with `''` selected. The select shows a blank button, and its list ends in an unlabeled option that can be picked to write `''`. It should show an `unset` placeholder with only the nine weights to choose from, as the text control does.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/TokenPanel/Scale.module.css
packages/ui/src/components/TokenPanel/Scale.tsx
packages/ui/src/components/TokenPanel/TokenControl.tsx
packages/ui/src/components/TokenPanel/TokenPanel.module.css
packages/ui/src/components/TokenPanel/TokenPanel.stories.module.css
packages/ui/src/components/TokenPanel/TokenPanel.stories.tsx
packages/ui/src/components/TokenPanel/TokenPanel.tsx
packages/ui/src/components/TokenPanel/color.ts
packages/ui/src/components/TokenPanel/index.ts
packages/ui/src/components/TokenPanel/parts.tsx
packages/ui/src/components/TokenPanel/tokenTypes.ts

<!-- done: 3 findings, files read: 11 -->
