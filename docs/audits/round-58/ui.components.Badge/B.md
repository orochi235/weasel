I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document follows. One more thing: this checkout's HEAD is `a22801b42b`, not the frozen `b400d7039e`, so these findings are about the tree as it is here.

## A plain removable badge marks itself focused when its remove control takes focus
- where: packages/ui/src/components/Badge/Badge.tsx:190 (Badge, commonProps.onFocus/onBlur)
- scenario: `<Badge shape="notched" onRemove={f}>tag</Badge>` has no onClick, href or tooltip, so `split` is false. Tab to the × button. React's `onFocus` bubbles from the button to the root span. Because `!split` holds, `setFocused(true)` runs and the root gets `data-focused="true"`. BadgeDeco then draws the `.badge-focus` ring around the whole badge, and pill and plain get the CSS outline. The split path gives the opposite answer: Badge.test.tsx:241 pins "marks the root focused while the click target holds focus, not the remove control", and there focusing × leaves the root unmarked. The non-split root can't take focus itself, so its handlers should ignore focus that lands on the remove button, e.g. by checking `e.target === e.currentTarget`.
- evidence: read
- severity: medium

## `as="span"` with `onClick` drops the click handler on a plain badge but calls it on a removable one
- where: packages/ui/src/components/Badge/BadgeRoot.tsx:32 (BadgeRoot, span branch); packages/ui/src/components/Badge/BadgeLabel.tsx:49 (BadgeTarget shared.onClick)
- scenario: For `<Badge as="span" onClick={f}>x</Badge>`, `chooseElement` returns 'span' and Badge.tsx takes `onClick` out of `domProps`. BadgeRoot's span branch never attaches it, so a click does nothing. `<Badge as="span" onClick={f} onRemove={g} tooltip="t">x</Badge>` splits, and BadgeTarget's span (`role="img"`) branch spreads `shared.onClick`, so the same click calls `f`. Whether the option works depends only on whether the label splits off.
- evidence: read
- severity: medium

## `labelProps.className` and `aria-label` are overwritten on a removable badge's label
- where: packages/ui/src/components/Badge/BadgeLabel.tsx:43 (BadgeTarget, `shared`)
- scenario: Take `<Badge onClick={f} onRemove={g} labelProps={{ className: 'mine', 'aria-label': 'Filter: tag' }}>tag</Badge>`. `shared = { ...extra, className: s.target, 'aria-label': props['aria-label'] }` replaces the caller's className instead of merging it. It also replaces their `aria-label` with the badge's own, which is `undefined` here, so the label loses both. The handlers in `labelProps` are merged; these two attributes are dropped.
- evidence: read
- severity: low

## A fitted base reads its own padding only on mount and on content resize, so a padding change leaves the fit stale
- where: packages/ui/src/components/Badge/useInsets.ts:38 (useMeasured)
- scenario: Render a `fitsContent` base (quatrefoil, puzzle, octant-spline or octant-bspline) with a class that sets `--badge-pad-x: 12px`, then swap it for a class that sets `0px`. The `.content` element keeps its size, so ResizeObserver never fires and the layout effect, with deps `[ref, enabled]`, doesn't rerun. `measured.pad` stays at 12, the floor counts clearance that is gone, and the fitted `--badge-inset-*` come out too small. The label then overlaps the outline.
- evidence: read
- severity: low

## With a `padding` prop, a fitted base's insets are computed and then thrown away, so the content can overlap the outline
- where: packages/ui/src/components/Badge/useInsets.ts:26 (ownPadding) with packages/ui/src/components/Badge/Badge.module.css:90 (`--_pad-*`)
- scenario: Take `<Badge base="quatrefoil" padding={2}>LONG LABEL</Badge>`. The `--badge-pad-*` properties replace the whole `calc(pad + inset)` fallback, so the insets never reach `padding`. Meanwhile `ownPadding` still subtracts the inline inset from the computed padding (`max(0, 2 - I)`) as if the inset were part of it, and useInsets keeps fitting insets that no CSS rule applies. The label is drawn over the lobes that `fitsContent` exists to clear.
- evidence: read
- severity: low

## A composed badge with a mask-zone effect clips its body beyond 10% of the box
- where: packages/ui/src/components/Badge/BadgeDeco.tsx:48 (`<mask … x="-10" y="-10" width="120" height="120">`)
- scenario: Take `<Badge base="rounded-rect" bloat={8} effects={[{ type: 'perforations' }, { type: 'spikes', params: { length: 10 } }]}>X</Badge>` at about 20px tall. The mask region and its white rect cover only viewBox −10..110. The bloat and spikes push the outline about 40–50 units past the top and bottom, and that part is cut off flat. Without the perforations effect the same outline draws whole, because the SVG has `overflow: visible`.
- evidence: read
- severity: low

## The unknown-shape fallback is bypassed by prototype keys, and a bad `base` key throws
- where: packages/ui/src/components/Badge/Badge.tsx:155 (`SHAPES[shape] ?? SHAPES.pill`); packages/ui/src/components/Badge/composeSpec.ts:26 (`BASES[key]`)
- scenario: `shape="toString"` finds an `Object.prototype` member, which is truthy, so the pill fallback never fires. The badge renders no decoration and gets `data-shape="toString"`. `base="constructor"` resolves to `Object`, and BadgeDeco's `compose.base.build(...)` throws "build is not a function". Both lookups need an own-key check such as `Object.hasOwn`.
- evidence: read
- severity: low

## The `BadgeShape` doc says `square` is drawn in CSS, but it is a composed rounded-rect
- where: packages/ui/src/components/Badge/types.ts:4
- scenario: The doc says "`pill`, `plain` and `square` are drawn in CSS". `shapes/Square.tsx` doesn't set `renderMode: 'css'` and composes `base: 'rounded-rect'`, and `badgeShapeRendering('square')` returns `'composed'`. A reader who expects square to wrap inline like pill and plain is planning against the wrong rendering.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/Badge.module.css
packages/ui/src/components/Badge/Badge.stories.module.css
packages/ui/src/components/Badge/Badge.stories.tsx
packages/ui/src/components/Badge/Badge.tsx
packages/ui/src/components/Badge/BadgeDeco.tsx
packages/ui/src/components/Badge/BadgeLabel.tsx
packages/ui/src/components/Badge/BadgeRoot.tsx
packages/ui/src/components/Badge/badgeRoles.ts
packages/ui/src/components/Badge/catalog.ts
packages/ui/src/components/Badge/composeOutline.ts
packages/ui/src/components/Badge/composeSpec.ts
packages/ui/src/components/Badge/geometry.ts
packages/ui/src/components/Badge/index.ts
packages/ui/src/components/Badge/looks.ts
packages/ui/src/components/Badge/paddingSides.ts
packages/ui/src/components/Badge/powerlineProps.ts
packages/ui/src/components/Badge/types.ts
packages/ui/src/components/Badge/useCrawlPhase.ts
packages/ui/src/components/Badge/useInsets.ts
packages/ui/src/components/Badge/useSvgBox.ts
packages/ui/src/components/Badge/variantIcons.ts

<!-- done: 8 findings, files read: 21 -->