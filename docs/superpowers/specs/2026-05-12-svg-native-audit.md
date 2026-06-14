# Swillustrator SVG round-trip audit

**Date:** 2026-05-12
**Method:** static read of source + tests
**Scope:** identify gaps in Swillustrator's SVG load/save flow before designing SVG-as-native.

## Summary

SVG load/save in Swillustrator goes through a deliberately narrow funnel: every Swillustrator `Obj` lowers to one of `weasel-svg`'s three node kinds (`path | text | group`), and every parsed node is read back as one of three Swillustrator `Obj` kinds (`rect | text | path`). The `weasel-svg` package itself is fairly complete for geometry — all SVG path commands, all primitive shapes, gradients, and stroke styling round-trip. The losses are concentrated at the Swillustrator bridge (`svgInterop.ts`) and at the App-level wiring: groups, layer order metadata, document size, opacity, gradients, and any styling richer than a single flat color are all silently dropped on the boundary even though `weasel-svg` can represent them. The bridge collapses the only currently-meaningful piece of document structure (groups) on every open, so a save→open cycle is a *guaranteed* loss whenever the user has used Group/Ungroup. Roughly 12–15 distinct gaps below.

## Round-trip fidelity gaps

Severities below: **blocker** = silent data loss the user notices on open; **minor** = data loss for an uncommon feature; **cosmetic** = correctness-preserving but representation differs.

- **Groups flatten on import.** `svgNodesToObjs` walks every group and inlines its leaves into a flat `Obj[]`. The `groupsRef` is unconditionally reset to `[]` on Open (App.tsx:1293). **Blocker**, in `svgInterop.ts:72-76`.
- **Groups are not emitted on export.** The save path is `itemsRef.current.map(objToSvgNode)` (App.tsx:1277) — a flat list. Swillustrator's `groupsRef` (its virtual-group registry) is never consulted. Even before Open clobbers groups, Save loses them. **Blocker**, in `App.tsx:1276-1281`.
- **Element-level opacity ignored on import and export.** `SvgPathNode.opacity` / `SvgTextNode.opacity` / `SvgGroupNode.opacity` are all preserved by parse/serialize but `Obj` has no `opacity` field. Per-shape opacity from an external SVG silently drops to fully opaque. **Minor**, in `svgInterop.ts:23-58, 77-115`.
- **Fill opacity (rgba / `fill-opacity`) lost.** `SvgPaint.solid` carries `opacity?`. `colorFromPaint` returns only `paint.color`; the opacity field is discarded. Same applies to stroke opacity. **Minor**, in `svgInterop.ts:120-129`.
- **Gradients downgrade to fallback solid color.** `colorFromPaint` returns `fallback` (black) for any `kind: 'gradient'` paint. A Chrome-rendered SVG with a gradient opens as a solid-black shape with no warning surfaced to the user. **Minor**, in `svgInterop.ts:125-128`.
- **Stroke styling fields lost on import.** `Obj` only models `stroke: string` + `strokeWidth: number`. `SvgStroke.cap`, `.join`, `.dash`, `.miterLimit`, `.opacity` are read by the parser, never copied into the `Obj`, and never re-emitted on save (since they don't exist on `Obj`). **Minor**, in `svgInterop.ts:88-115`.
- **`stroke-width` of 0 → no stroke at all.** On export, `if (o.strokeWidth > 0)` skips emitting `stroke` for zero-width strokes (`svgInterop.ts:43-45`). That's fine. But on import, the inverse is asymmetric: an SVG with `stroke="black"` and *no* `stroke-width` parses as `stroke.width=1`, which becomes a `RectObj` with `strokeWidth=1` — fine. An SVG with `stroke="none"` parses as `stroke=undefined`, and Swillustrator stores `stroke: '#000000'` (the fallback) with `strokeWidth: 0`. Subsequent editing of strokeWidth in Swillustrator will paint a default black stroke, not the (intentionally absent) original stroke color. **Cosmetic** / latent footgun, in `svgInterop.ts:90`.
- **Path-vs-rect identity is lost on open.** A Swillustrator-saved rect becomes `<path d="M h v h Z">` (`path-serializer.ts:21`). On re-import it comes back as a `path.kind === 'rect'` (because `weasel-svg` has a fast-path that recognizes axis-aligned `M h v h Z`), so the round-trip stays as `rect` in *most* cases. But any rect that ever passed through a non-axis-aligned group transform is promoted to PolygonPath and never returns to `rect`. Less critical than the others — it's a `RectObj` ↔ `PathObj` kind change, not pixel drift. **Cosmetic**, propagated through `shapes.ts:36-51`.
- **`PathObj.closed` derived from a magic number.** `isClosedPolygon` reads the raw command-stream and looks for `4 /* PATH_Z */` at the tail (`svgInterop.ts:146-151`). That magic constant is duplicated from `@weasel-js/core`'s `PATH_Z` symbol — if the kit ever renumbers the path opcodes, every saved SVG silently re-opens with `closed: true` flipped to `false` or vice versa. **Minor** (correctness-fragile), in `svgInterop.ts:146-151`.
- **Path bounds are recomputed from coords, not from the saved bbox.** `pathBounds` walks coords pairwise (`svgInterop.ts:131-144`). Two issues: (a) for paths with cubic control points the bounds include the control hulls, not the actual curve extents — control points often stick out beyond the visual bbox, so `width`/`height` overestimate after a round-trip; (b) this matters because `PathObj.{x,y,width,height}` is the selection/transform bbox the rest of Swillustrator manipulates. So a saved cubic shape comes back with a slightly larger handle bbox than it had at save time. **Minor**, in `svgInterop.ts:131-144` (use `boundsOfPath` from the kit instead — it's already imported by `serialize.ts`).
- **Multi-contour paths get a single bounding `(x,y,w,h)`.** Fine in principle, but combined with the cubic-control-hull issue above, complex paths drift more than simple ones.
- **Text dimensions guessed for external SVG.** The parser writes `width = 99999` for any `<text>` without `data-weasel-width` (`parse.ts:354`). When Swillustrator opens an SVG produced by Chrome/Safari/Inkscape, every text node becomes ~unbounded-width with a heuristic height — Swillustrator's selection box and any wrap-driven layout will be visibly wrong. **Minor → blocker** depending on consumer expectations, in `parse.ts:352-358`.
- **`text-anchor: middle/end` shifts the box origin invisibly.** `weasel-svg` records `style.align` from `text-anchor`, but the SVG `x` coordinate is interpreted by browsers as the anchor point — *not* the top-left of the text box. Currently `parseTextElement` stores `x` as-is (the anchor x), even when text-anchor is middle/end. After import, Swillustrator's bbox left edge is at the anchor point, not the left edge of the rendered text. **Minor**, in `parse.ts:306-326`.
- **`StyledRun[]` survives only one direction at a time in practice.** Parser builds `runs` for any `<tspan>`-bearing `<text>`; serializer emits `<tspan>`s when `node.runs` is set. But Swillustrator's bridge (`svgInterop.ts:78-86`) never copies `runs` onto `TextObj` (only `style`). So an external SVG with bold/italic runs imports as plain text, and Swillustrator can't yet *produce* runs at save time either. Net: rich text is lost in both directions today. **Minor**, in `svgInterop.ts:78-86`.

## Document-level metadata

- **Paper size is written to the SVG via `viewBox` but ignored on read.** Save passes `viewBox: { 0, 0, doc.size.width, doc.size.height }` (App.tsx:1278-1280). Parse ignores the `<svg viewBox>` entirely — `parseSvg` doesn't even look at `documentElement.getAttribute('viewBox')`, let alone `width`/`height`. **Blocker** for paper-size round-trip, in `parse.ts:55-62`.
- **`Document.size` is not restored on Open.** App.tsx:1283-1297 never calls `setDoc`. Open keeps the previously-loaded document's paper size, regardless of what the SVG declared. So Open Letter file → Letter doc; switch to A4 in UI → open a Letter file → still A4. **Blocker**, in `App.tsx:1283-1297`.
- **No `width` / `height` attributes emitted.** The serializer writes only `viewBox`. External tools (and `<img src>`) often need explicit `width`/`height` to render at intrinsic size. **Cosmetic** (external-rendering quality), in `serialize.ts:31-33`.
- **No document title round-trip.** Swillustrator has a `docTitle` UI field. Save uses it only for the filename. The SVG `<title>` element is parsed-but-ignored (it's in `IGNORED_TAGS` at `parse.ts:34`) and never emitted by the serializer. **Minor**.
- **No DPI / units / color profile / page metadata** — accepted; the `Document` interface comment in App.tsx:113 explicitly lists these as future fields.
- **viewBox sanity when explicitly passed.** When Save passes `{ 0, 0, w, h }`, the serializer trusts it (`serialize.ts:25`). Shapes outside that rect (e.g., dragged off-canvas) get clipped in external viewers. That's defensible behavior, but worth noting — there's no "extend viewBox to fit content" path on Save.

## Groups

- Swillustrator's `groupsRef` (`Group { id, members[] }`) is a parallel data structure to `items` (`App.tsx:257, 351-352`). It uses the kit's "virtual group" concept — no parent/child hierarchy, just member lists. Groups can nest (a group id may be a member of another group; `groups/types.ts:13-20`).
- **Save:** the entire `groupsRef` is dropped. `onSaveSvg` maps `itemsRef.current` straight to `SvgNode`s with no group structure (`App.tsx:1276-1281`).
- **Open:** `svgNodesToObjs` recursively flattens any `<g>` it sees (`svgInterop.ts:73-76`). Then App.tsx:1293 explicitly sets `groupsRef.current = []`.
- **Round-trip:** group → save → open ⇒ all groups dissolved. Nested groups, too.
- This is the single most user-visible defect in the round-trip today, because Group/Ungroup are first-class UI verbs in the ActionBar.

## Text style

What survives Swillustrator → SVG → Swillustrator (assuming bridge picks it up):

| Field            | SVG attr                 | Parser → SvgTextNode | Bridge → TextObj | Round-trip |
| ---------------- | ------------------------ | -------------------- | ---------------- | ---------- |
| fontSize         | `font-size`              | yes (`parse.ts:415`) | yes via `style`  | yes        |
| fontFamily       | `font-family`            | yes                  | yes              | yes        |
| fontWeight       | `font-weight`            | yes (numeric + string) | yes            | yes (numeric loses original string form like "bold" → 700 → "700" via `String()`) |
| fontStyle        | `font-style`             | yes (italic/normal)  | yes              | yes        |
| align            | `text-anchor`            | yes                  | yes              | yes, but see anchor-x note above |
| lineHeight       | `data-weasel-line-height`| yes                  | yes              | yes (lost when round-tripping through external editors that strip data-* attrs) |
| fill (solid)     | `fill`                   | yes                  | yes (via style)  | yes        |
| fill (gradient)  | `fill="url(#…)"`         | yes                  | **NO** — bridge only handles `style.fill: { color }`, falls back? Actually: bridge copies whole `style` object verbatim, so gradient fill survives the bridge round-trip in principle, but Swillustrator's render path likely doesn't honor gradient text fills | partial |
| opacity (text)   | `opacity`                | yes                  | **NO** — not on TextObj | dropped |
| runs (tspan)     | `<tspan>`                | yes                  | **NO** — bridge ignores `n.runs` | dropped |
| text content     | text content             | yes                  | yes              | yes        |
| stroke on text   | `stroke`                 | warned (`parse.ts:450`) | n/a            | n/a        |

Bottom line for text: the basic `TextStyle` fields (font-size/family/weight/style/align/fill solid) round-trip. Per-range styling (runs), opacity, and stroke don't.

## Unsupported elements / attributes

- `weasel-svg`'s parser **does** emit `warnings[]` for:
  - Unsupported element tags (`<use>`, `<mask>`, `<foreignObject>`, `<clipPath>`, `<filter>`, `<symbol>`, `<pattern>`, etc.) — generic `unsupported element: <tag>` message (`parse.ts:108`).
  - Unrecognized `fill`/`stroke` values (named colors outside the small inlined table, malformed strings).
  - Unsupported `stroke-linecap` / `stroke-linejoin` values, with fall-back behavior.
  - `<text stroke=...>` (warns and drops stroke).
  - Gradient transforms (`gradientTransform`) — silently *not* read per README "Lossy cases".
  - `<image>` — not in `SUPPORTED_LEAF_TAGS` or `IGNORED_TAGS`, so it gets a generic `unsupported element: <image>` warning. No image element support at all.
- **Swillustrator surfacing of warnings:** `console.warn('Open SVG warnings:', warnings)` (App.tsx:1287-1290). That's it. No toast, no modal, no UI indication that anything was dropped. The user gets a partially-loaded file with no notification.

## Bridge code (`svgInterop.ts`)

The file is short (208 lines) and explicitly self-documenting about its lossy edges:

- The file header docstring (lines 2-7) names two specific losses:
  - "RectObj's stroke/strokeWidth compresses to an SvgStroke" — minor; actually fine on save, but loses stroke styling fields.
  - "SvgGroupNode flattens on import" — see Groups section above.
- `svgNodesToObjs` doc (lines 62-66) admits "Unsupported leaf shapes (gradient fills, paint-not-solid) drop down to a black solid color so the document at least opens." No warning is surfaced from the bridge — `weasel-svg` may warn on parse, but the bridge silently downgrades gradients to black.
- `colorFromPaint` (lines 120-129) explicitly comments "Gradients can't be represented as Swillustrator's flat fill string yet — drop to fallback. Caller's UI shows a solid color; the gradient is lost."
- `isClosedPolygon` (146-151) uses the magic literal `4 /* PATH_Z */` instead of importing the symbol from `@weasel-js/core`. Fragile coupling.
- `pathBounds` (131-144) recomputes bounds from raw coords, not via `boundsOfPath` — overestimates bounds for cubic paths.
- No explicit TODO/FIXME comments, but the design intent ("intentionally lossy at the edges") is clearly stated as a v1 stance, not a bug.

## Missing tests

Things `roundtrip.test.ts` doesn't cover:

- **Element-level opacity.** No fixture exercises `opacity="0.5"` on a path, group, or text node.
- **`fill-opacity` / `stroke-opacity`.** No fixture.
- **rgba() colors.** None of the fixtures use rgba; the color parser handles it (per README) but it isn't asserted to round-trip with its alpha.
- **Groups with nested `<g>`s carrying their own `opacity` or non-transform attrs.** `NESTED_GROUPS_SVG` only uses transforms.
- **Groups on serialize.** Every round-trip test feeds parser output (which always collapses groups onto leaves) — there's no test that manually constructs an `SvgGroupNode` with a `transform` and serializes it. Coverage gap for the "consumers can still construct groups before serialize" pathway (`types.ts:9-11`).
- **External (non-weasel-authored) `<text>`** — every text fixture has `data-weasel-width` / `data-weasel-height`. The estimated-dimensions code path (`parse.ts:354-357`) is untested.
- **Text with `text-anchor` middle/end** and the resulting box-anchor mismatch.
- **`<text>` with a gradient fill on the parent vs. on a `<tspan>` run.**
- **`<image>` elements** — warning behavior untested (warnings.test.ts covers clipPath/filter/use/mask/foreignObject but not image).
- **`<svg viewBox>` round-trip** — the parser doesn't read `viewBox`, the serializer emits one computed from content. No test asserts what happens if the input declares a viewBox larger than the bounding box of its children.
- **Empty document** — `<svg></svg>` with no children. Bounds computation falls back to `{ 0, 0, 0, 0 }`; not asserted.
- **Malformed input** — `parserError`-bearing DOMs return `{ nodes: [], warnings: [...] }`. Not asserted in a test.
- **Bridge round-trip** — there is no test for `svgInterop.ts` at all. `Obj` → `SvgNode` → SVG string → `SvgNode` → `Obj` is the *actual* user-facing flow and has zero direct coverage.

## Recommended fixes (high-level)

Sized for the SVG-as-native spec to slot them into a phasing plan.

### Trivial (≤ 1 file each)

- **Surface warnings in the UI.** Replace `console.warn` with a toast/banner so users see when gradients, filters, or image elements were dropped.
- **Use `boundsOfPath` for `PathObj` bbox.** Drop the hand-rolled `pathBounds` in the bridge.
- **Import `PATH_Z` from the kit** rather than the magic `4` literal in `isClosedPolygon`.
- **Round-trip `viewBox`.** Add a `documentElement.getAttribute('viewBox')` read on parse (return alongside `nodes`/`warnings` as a third field). Swillustrator's `onOpenSvg` calls `setDoc({ size: { width: vbW, height: vbH } })`.
- **Emit `width` / `height` attrs** on the root `<svg>` alongside `viewBox`.

### Small (one feature each)

- **Plumb opacity through `Obj`.** Add `opacity?: number` to `BaseObj`, copy it both ways. Same for `fill-opacity` / `stroke-opacity` (either as separate fields or by parsing `#rrggbbaa`).
- **Preserve groups on round-trip.** Bridge needs `objsToSvgNodes(objs, groups)` (emitting `SvgGroupNode`s for each group) and `svgNodesToObjs(nodes)` returning `{ items, groups }`. Open writes the result to both `itemsRef` and `groupsRef`. Nesting works naturally because `Group.members[]` can contain group ids.
- **Surface gradient fills as a real Swillustrator paint type.** This is the only way to stop the silent downgrade-to-black. Bigger lift if `Obj.fill: string` becomes `Obj.fill: ActivePaint` everywhere, but the swatch UI already uses `ActivePaint`.
- **Carry stroke styling through.** Add `strokeCap`, `strokeJoin`, `strokeDash`, `strokeMiterLimit` to `RectObj`/`PathObj`. Most of these are already in the `ActiveSwatches` panel? — confirm during implementation.
- **Round-trip `<title>`.** Use it to drive `docTitle` on open; emit it on save.
- **Round-trip `runs`.** Bridge copies `n.runs` onto `TextObj` and back. Requires `TextObj.runs?: StyledRun[]` and rendering support — coordinate with rich-text spec.

### Nontrivial (cross-cutting design work)

- **SVG as the native scene format.** The current model has two parallel data shapes: Swillustrator's `Obj` and `weasel-svg`'s `SvgNode`. They both lower from / to mostly the same primitives, but with different field names, different invariants, and a hand-coded bridge in the middle that loses information. Making `SvgNode` the canonical in-memory model (or moving Swillustrator's `Obj` to a structural subtype of `SvgNode`) eliminates the bridge entirely. This is the natural next step suggested by the audit and matches the "SVG-as-native" framing.
- **Bridge-level round-trip test fixtures.** Add a test file at the App level that constructs `Obj[]` + `Group[]` fixtures, serializes, re-parses, and asserts equality. This is what would catch the group-flattening regression if the bridge changed.
- **External-text geometry heuristics.** Decide whether to keep `width = 99999` for unbounded imported text, run a measurement pass via the canvas's text renderer, or warn the user. Probably out of scope until rich-text is closer to stable.
- **Decide whether the serializer should auto-expand `viewBox` to include content drawn outside the page.** Today Save trusts the explicit `{ 0, 0, w, h }` from Swillustrator; off-canvas content is invisible in browsers. UX call: clip vs. expand vs. warn.
