# Audit round 66: ui.components.TokenPanel

## A scale slider's track never shrinks back after its steps move by anything but a drag
- where: packages/ui/src/components/TokenPanel/Scale.tsx:127-129 (ScaleSlider)
- scenario: a generated `space` scale has steps 8px…64px, so the track spans log2(8/1.5)…log2(96). The user sets the
  base from 8 to 1 in the rule controls (or presses the group's Reset, or the consumer swaps the values), and the
  consumer regenerates the steps as 1px…8px. `setRange` only widens the range: min drops to log2(1), and max stays at
  log2(96). Every thumb is now in the lower half of the track, and the upper part is dead space that never comes back
  for as long as the component stays mounted. The comment says the range is held so it does not move under the
  pointer during a gesture, but nothing re-fits it once no gesture is running. It should re-fit to the current
  amounts (with the margin) when the steps change outside a drag, for example when the next press begins.
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

<!-- done: 1 findings, files read: 11 -->
