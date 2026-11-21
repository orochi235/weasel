I couldn't write `.skulkr/out/findings.md` because the write permission was refused, so the whole findings document is below. All findings come from reading the code; I ran nothing.

## Dragging one step of a scale rewrites every other step whose amount has more than four decimals
- where: packages/ui/src/components/TokenPanel/Scale.tsx:121 and :139-153 (ScaleSlider, `places` / `commit`)
- scenario: take a scale `--size-a: 0.125rem`, `--size-b: 0.0625rem`, `--size-c: 0.03125rem`. `places` is `min(4, maxOf(amounts, decimalPlaces))`, which is 4. Drag or arrow only `--size-a`. The Slider's `onInput` returns every thumb and `commit` walks all of them. For the untouched `--size-c`, `round(2 ** log2(0.03125))` is `Number((0.03125).toFixed(4))`, which is 0.0313. That differs from `amounts[2]`, so `onChange('--size-c', '0.0313rem')` fires: a step nobody touched gets a new value and is marked overridden. In a `factors` scale it writes a refitted factor for that step instead. Only thumbs whose value actually moved should commit.
- evidence: read (`decimalPlaces` in packages/quantity/src/places.ts gives 5 for 0.03125; Scale.tsx:121 caps it to 4)
- severity: medium

## Switching a scale with base 0 to the `factors` rule flattens every step to the base
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:59 (refitScale, `case 'factors'`)
- scenario: take a `step` scale `{ base: 0, rule: { kind: 'step', step: 4 } }` with steps 0, 4, 8, 12. Refitting to `step` moves the base to the first step, so this state is easy to reach. Picking "each" calls `refitScale(scale, 'factors', [0, 4, 8, 12])`. Since `scale.base > 0` is false, every factor becomes 1 and the consumer regenerates every step as 0. The doc promises a scale "fitted to the amounts its steps have now"; this one throws them away.
- evidence: read
- severity: medium

## A dragged factors step whose factor rounds to zero does nothing, though the round-59 ruling says an unreachable step is overridden
- where: packages/ui/src/components/TokenPanel/Scale.tsx:148 (ScaleSlider `commit`)
- scenario: a `factors` scale has base 1000 and a step is dragged to 0.04. `roundFit(0.04 / 1000)` is 0, so `|| f` keeps the old factor. `onScaleChange` receives the unchanged scale, the drag is lost and the thumb snaps back. docs/unruled.md (round 59) rules that a step no factor can reach is overridden through `onChange` rather than "doing nothing". The guard should also require `roundFit(amount / base) > 0` and fall through to `onChange` otherwise.
- evidence: read
- severity: low

## inferTokenType reads a shadow whose color nests a function as a string
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:117 and :140 (PARTS, isShadow)
- scenario: call `inferTokenType('0 2px 4px color-mix(in srgb, rgb(0 0 0) 20%, transparent)')`. `PARTS` (`[a-z-]+\([^)]*\)`) stops at the first `)`, so the layer splits into `color-mix(in srgb, rgb(0 0 0)`, `20%,` and `transparent)`. That leaves three parts that are not lengths, so the value is typed `'string'` and filed under Other instead of Depth. Relative color syntax, which `parsesAsColor` accepts, fails the same way. The parts need the depth-counting scan that `layersOf` already does.
- evidence: read
- severity: low

## inferTokenType treats `dvh`/`svh`/`lvh` as dimensions but not `dvw`/`svw`/`lvw`, nor `vi`/`vb`/`cqi`/`cqb`/`cqmin`/`cqmax`
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:109 (DIMENSION)
- scenario: `'100dvh'` is typed `'dimension'` but `'100dvw'` is `'string'`; `'50cqw'` is a dimension but `'50cqi'` is a string. A token in the missing units gets a text field under Other, while its twin gets a number field under Size.
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

<!-- done: 5 findings, files read: 11 -->