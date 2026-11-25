# Audit 29 — text and numbers, reviewer A

## formatUnit trims the zeros off a large value's exponent, writing 1.5e+30 as 1.5e+3
- where: packages/quantity/src/units.ts:107-111 (formatUnit)
- scenario: `formatUnit(1.5e30, 'mm', METRIC_MM)` — `toFixed(2)` returns `1.5e+30` for any |value| ≥ 1e21; the text holds a `.`, so the trailing-zero trim `replace(/0+$/, '')` strips the exponent's zero and returns `1.5e+3mm`, a number 27 orders of magnitude off. Any mantissa with a fraction and an exponent ending in 0 (1e21 × k for e+30, e+40, e+100…) is hit.
- evidence: ran (node: `(1.5e30).toFixed(2)` → `1.5e+30`, trimmed → `1.5e+3`)
- severity: low

## A duration range in `units` style drops the first end's last unit, writing 2m 5–3m 5s
- where: packages/quantity/src/composite.ts:27-41 (measureTail, rangeEnds)
- scenario: `presentRange(125, 185, duration({ style: 'units' }))`. Each end's parts are `[minutes, unit 'm', literal ' ', seconds, unit 's']`; `measureTail` takes the trailing `unit 's'` as the shared measure, so the first end is cut to `2m 5` and the text is `2m 5–3m 5s`, which reads as "2m 5" (no unit) to 3m 5s. The tail-sharing rule assumes a value has one unit; a multi-term value (duration `units`, any custom kind writing several unit parts) must keep its own. Same for `rangeParts`.
- evidence: ran (tsx on a scratch copy: `presentRange(125, 185, duration({ style: 'units' }), { locale: 'en-US' }).text` gives `2m 5–3m 5s`)
- severity: medium

## Registering the same bidi engine or shaper twice hands out two releases, and either one unregisters it for both
- where: packages/text/src/layout/engineSlot.ts:14-27 (engineSlot.register)
- scenario: two independent callers each run `registerBidi(bidi)` (the same `bidi` export of `@weasel-js/bidi` — the call is allowed, since only a *different* engine throws). The first caller's teardown runs its release: `registered === engine`, so the slot is set to `null` and the generation bumps, while the second caller's registration is still live and it never released. Every layout after that is laid out in logical order (RTL reversed) until something registers again. The same holds for `registerShaper(shaper)` with one shared shaper. Re-registering an identical engine should either count holders or hand back a release that does nothing.
- evidence: ran (tsx: two `register(bidi)` on one `engineSlot`, first release run, `get() === bidi` is false)
- severity: medium

## Text laid along a path ignores the node's `padding`, so it wraps at a different width than the node draws
- where: packages/text-tools/src/node/textItems.ts:34 (textEffectItems)
- scenario: a `kit:text` node with `style.wrap` on, `padding: 20` and a 200-wide pose used as a text-along-path source. The node draws (`textPoseOf` → `textBoxOf`) and outlines (`TEXT_PAINTER.outline` → `textOutlineOf(d, { ...pose, ...textBoxOf(d, pose) })`) in a 160-wide box, but `textEffectItems` calls `textClusters(data, { width: pose.width })`, so its "first line" is wrapped at 200 and can hold words the node itself puts on line two (and `align` centers/right-aligns within the wrong width). The items should be laid in `textBoxOf(d, pose).width`.
- evidence: read
- severity: medium

## Text laid along a path loses inherited paint: a node whose fill is `inherit` lays unfilled items, and `stroke: 'inherit'` passes through as the string
- where: packages/text-tools/src/node/textItems.ts:30-59 (textEffectItems); packages/core/src/domains/pathEffects/readSource.ts:26 (items called without `dep.inherited`); packages/text/src/textStyle.ts:243-244 (resolveTextStyleInto)
- scenario: a `kit:text` node with `fill: INHERIT` (and/or `stroke: INHERIT`) inside a group that sets a fill, used as a text-along-path source. The source's own `fill`/`stroke` are resolved against `dep.inherited` (`pathPaintOf`), and the node draws (`textPoseOf`) and outlines (`withInheritedPaint`) in the group's paint, but `effectItems(node, pose)` hands `node.data` raw to `textClusters`: `resolveFill('inherit')` with no inherited paint is `null`, so every item part has `fill: null` and the text along the path draws invisible (or stroke-only); `resolveTextStyleInto` keeps `paint.stroke ?? undefined` unresolved, so a part's `stroke` is the literal `'inherit'`, a string where a `Stroke` is expected. Items should wear the paint the node draws in.
- evidence: read
- severity: medium

## `fit: 'shrink'` keeps a scale found before a shaper or bidi engine was registered
- where: packages/text/src/layout/textFit.ts:113-138 (shrinkScale), :45-47 (sameOpts)
- scenario: a `fit: 'shrink'` text node is drawn once, then the app runs `registerShaper(await loadShaper())` (or `registerBidi`). `layoutRuns` now lays the same runs out with the registered engine (`layoutShaper(opts)` / `layoutBidi(opts)`), so ligatures, joining and kerning change the widths and the wrap; `cachedLayoutRuns` sees that (its variants match on `bidi` and `shaper`), and `textClusters` and the painter key on `textEngineGeneration()`. `shrinkScale`'s memo is dropped only when `faceGeneration()` moves and `sameOpts` compares no engine, so it hands back the scale searched under the old engine: the text is laid out with the new engine at a size that no longer fits the box (overflows it, or sits smaller than it must). The fit memo should key on the engines (or `textEngineGeneration()`) as the layout cache does.
- evidence: read
- severity: medium

## `effectiveRangeStyle` never reports a stroke, the node's or a run's
- where: packages/text/src/runs/effectiveRangeStyle.ts:35-38 (OVERRIDES), :59-68 (effectiveRangeStyle)
- scenario: a text node with `stroke` set (or a selected run with its own `stroke`, which `RangeStyle` carries — `stroke` is in rangeStyle.ts's `STYLE_KEYS`). `effectiveRangeStyle(styleAtRange(runs, a, b), style, { fill, stroke })` is documented as "what is actually rendering across a range ... every other key is the run's value where the range sets one, otherwise the node's", but `stroke` is neither copied from the resolved node paint (only `fill` is) nor in `OVERRIDES`, so the result has no `stroke` even when every character in the range draws outlined; an inspector reading it shows "no stroke".
- evidence: read
- severity: low

<!-- done: 7 findings, files read: 62 -->
