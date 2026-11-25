I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole document is below instead.

The checkout's HEAD is `782733b19c`, not `04c3a6536306` as the brief says. I cited the tree that is checked out.

# Findings: apps.draw.src.dev.detail (round 45)

## A shape kind with no mounted tool shows another package's export as its source and doc
- where: apps/draw/src/dev/detail/KindDetail.tsx:22, 35-39, 47-49 (ShapeKindDetail)
- scenario: `collectShapeTrait` lists every `SHAPE_KINDS` key, including `image`, which has no tool. It always sets `tool: id`, and `hookName` is undefined when no tool is mounted.
  - The "authored by" row then shows `image`, a tool that doesn't exist.
  - `findSourceMatch(entry.hookName ?? entry.id)` looks up the bare word `image` in a name index built from every package's source. `vite-plugin-source-index/exportInfo.ts` lets the first declaration in sort order win, and `isIndexedSource` does not skip `*.fixture.ts`.
  - So the row resolves to `/packages/dither/src/pbt.fixture.ts:34`, `export function image(max = 12): fc.Arbitrary<RgbaImage>`. The panel shows that fixture as the image kind's source, along with its JSDoc ("An RGBA image up to `max` on a side…").
  - The same thing happens for `pen` or `pencil` in any canvas that doesn't mount their tools. The panel should show no source or authoring tool when there isn't one, not a bare-name match.
- evidence: read
- severity: medium

## GestureDetail calls tool subscriptions "legacy phase grammar", which no longer exists
- where: apps/draw/src/dev/detail/GestureDetail.tsx:88-91, 117, 123 (GestureDetail)
- scenario: open any gesture entry, e.g. `drag`.
  - The blurb says tools "subscribe to it via the legacy phase grammar; actions below bind to it via the modern dispatcher". The heading reads "Tools subscribing (phase grammar)" and the empty text "No tools subscribe via phase grammar."
  - The rows actually come from `ToolSurface.gestures`, which `registryProbe.tsx:236-244` fills from `Tool.bindings`. Those are bindings on the same dispatcher the actions use.
  - `registryEntries.ts:34-36` says a tool "has one binding list now, not an initial and an engaged route table". `buildRouteRegistry`'s doc calls the phase tables "the grammar that no longer exists".
  - The panel tells the reader that the listed tools use a removed mechanism.
- evidence: read
- severity: low

## PhaseOutputDetail describes `initial.overlay` and `claimsAll`, which are both gone
- where: apps/draw/src/dev/detail/GestureDetail.tsx:135-142 (PhaseOutputDetail)
- scenario: open the `overlay` phase output.
  - It says "Only `initial.overlay` is read by the runtime today". But the flag is `tool.overlay !== undefined` (`registryProbe.tsx:247`), and tools no longer have an initial/engaged table.
  - The fallback branch describes `claimsAll` ("routes every `pointerdown` to this tool"). `registryEntries.ts:26-28` says `claimsAll` was removed with its dispatcher. Any future output key would be described as that removed feature.
- evidence: read
- severity: low

## OpKindDetail names an `ops.*` factory that doesn't exist for a consumer-registered op kind
- where: apps/draw/src/dev/detail/OpDetail.tsx:13-16, 26-27 (OpKindDetail)
- scenario: an op kind registered through the public `registerOpFactory('myapp:stamp', …)` shows up in the Ops tree, because `collectOpKinds` reads `defaultOpRegistry.entries()`.
  - Its detail always renders "factory: `ops.myapp:stamp`" with "runtime: `undefined`", which claims a nonexistent export.
  - `collectOpFactories` makes the opposite decision for the same case: it drops a kind with no `ops` export (`typeof opFactoryFor(name) === 'function'`).
  - The factory row should be omitted, or marked absent, when `opFactoryFor` returns nothing.
- evidence: read
- severity: low

## RouteBadge drops a hover route's `held` requirement
- where: apps/draw/src/dev/detail/RouteBadge.tsx:45-85 (RouteBadge)
- scenario: `parseRoute` returns `held: 'required' | 'optional'` for `[*] hover +held` and `[*] hover ?held`. `routesForSpec` emits these for specs like loupe's `{ kind: 'hover', held: 'optional' }`.
  - RouteBadge renders phases, gesture, arg, modifiers and target, but never reads `parsed.held`.
  - So `hover +held`, `hover ?held` and plain `hover` render the same badge. Three routes that match different input look identical.
- evidence: read
- severity: low

## Files read
apps/draw/src/dev/detail/BundleDetail.tsx
apps/draw/src/dev/detail/ExportsDetail.tsx
apps/draw/src/dev/detail/GestureDetail.tsx
apps/draw/src/dev/detail/IconDetail.tsx
apps/draw/src/dev/detail/KindDetail.tsx
apps/draw/src/dev/detail/MetaDetail.tsx
apps/draw/src/dev/detail/OpDetail.tsx
apps/draw/src/dev/detail/RouteBadge.tsx
apps/draw/src/dev/detail/SlotDetail.tsx
apps/draw/src/dev/detail/shared.tsx
apps/draw/src/dev/detail/sourceLinks.tsx

<!-- done: 5 findings, files read: 11 -->