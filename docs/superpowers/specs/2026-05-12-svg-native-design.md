# Swillustrator SVG-native persistence — design

**Status:** design

**Scope:** Swillustrator's file format. The kit itself stays format-agnostic — its `Scene<TData, TLayer, TPose>` is a general primitive whose persistence is each consumer's choice.

## Goal

SVG is Swillustrator's *native* file format — Save and Open both use `.svg`. The persisted file is a valid SVG document that any browser, image viewer, or vector editor can render. Swillustrator-specific metadata that has no standard SVG equivalent (layers, paper-size enum, future parametric annotations) rides on a custom XML namespace (`xmlns:swill="https://swillustrator.app/svg-ext"`) — preserved on Swillustrator round-trip, gracefully ignored or stripped by third-party tools.

## Non-goals

- **Kit-wide persistence.** The kit's `Scene<TData>` carries arbitrary consumer data; only the consumer can lossless-encode it. Swillustrator's choice doesn't bind anyone else.
- **Lossless third-party round-trip.** Pasting a Swillustrator SVG through Figma → back to Swillustrator may lose layer membership, parametric origin, or other namespaced metadata. The rendered output is always preserved.
- **JSON-native escape hatch.** No `.swill.json` alternative. The custom namespace handles every metadata case we have or anticipate.
- **Multi-page documents v1.** Encoding is planned (`swill:page` elements) but Swillustrator doesn't have multi-page in the UI yet. The spec reserves the encoding so it doesn't conflict; implementation is deferred.

## File format conventions

- **Extension:** `.svg`. No custom extension. The `xmlns:swill` namespace declaration in the file is the marker that distinguishes a Swillustrator-authored SVG from a generic one.
- **MIME type:** `image/svg+xml`.
- **Namespace:** `xmlns:swill="https://swillustrator.app/svg-ext"`. Declared on the root `<svg>` element. The namespace URI does not need to resolve to an actual resource.
- **Encoding rule:** prefer namespaced *attributes on standard SVG elements* over namespaced *elements*. Reserve namespaced elements for content that has no natural SVG host. Rationale: attributes survive third-party round-trip better than custom elements.

## Feature matrix

The complete mapping from Swillustrator's data model to SVG encoding. Each row notes (a) the encoding, (b) status today, (c) third-party round-trip fidelity, (d) the work needed to ship.

| Feature | Encoding | Today | 3rd-party trip | Work |
|--|--|--|--|--|
| Rect | `<path d="M..L..L..Z"/>` with `fill`/`stroke`/`stroke-width` | ✓ | ✓ | none |
| Text | `<text x y>...</text>` with `font-family`/`font-size`/`fill` | partial | ✓ | text style fields below |
| Path (closed/open) | `<path d="..."/>` with `fill="none"` or solid | ✓ | ✓ | none |
| Z-order | sibling order in document | ✓ | ✓ | none |
| Solid fill / stroke | `fill="#rrggbb"` etc. | ✓ | ✓ | none |
| **Paper size** | `viewBox="0 0 W H"` + `width`/`height` w/ unit suffix; named preset on `<svg swill:paperSize="us-letter">` | ✗ | preset lost (named); dims preserved (✓) | T1 (one parser line + setDoc on open) |
| **Groups** | `<g>...</g>` with optional `swill:group-id="..."` | ✗ broken both ways | ✓ | T2 (save walks `groupsRef`; open populates `groupsRef`; bridge stops flattening) |
| Layers | `<swill:layers><swill:layer id name visible/></swill:layers>` at top; `swill:layer-id="..."` on each shape | ✗ | lost (acceptable) | T3 (new feature; depends on layer model in Swillustrator) |
| Gradients | `<linearGradient>`/`<radialGradient>` in `<defs>`, `fill="url(#id)"` | ✗ (no UI) | ✓ | future, when gradient UI lands |
| Alpha / opacity | `fill-opacity`, `stroke-opacity`, `opacity` | ✗ (no UI) | ✓ | future |
| Text style — font family | `font-family="Inter, sans-serif"` on `<text>` | partial | ✓ | T4 |
| Text style — font weight | `font-weight="700"` | partial | ✓ | T4 |
| Text style — italic | `font-style="italic"` | partial | ✓ | T4 |
| Text style — line height | `swill:line-height="1.4"` (no clean SVG attr) | ✗ | lost | T4 |
| Text style — fill (solid) | `fill="#rrggbb"` on `<text>` | partial | ✓ | T4 |
| Parametric origin (regular polygon, star) | `<swill:parametric kind sides cx cy r/>` adjacent to its `<path>`, OR `swill:kind="regular-polygon" swill:sides="6"` attr on the path | ✗ (Swillustrator doesn't track this internally either) | lost | deferred — additive feature |
| Multi-page documents | `<swill:page id label transform clip-rect>` at top; each shape carries `swill:page-id` | ✗ (no UI) | first page only renders | deferred — additive feature |
| Virtual groups (many-to-many membership) | `<swill:vgroup id name members="id1 id2 id3"/>` at top, alongside `<swill:layers>`. Real `<g>` groups stay tree-structured (single-membership); vgroups are a metadata-only overlay | ✗ (no model yet) | lost | deferred — additive feature; encoding reserved |
| Warnings on parse | `parseSvg`'s `warnings[]` surfaced to a toast UI in Swillustrator | ✗ | n/a | T5 |
| Doc title | `<title>` element at root | ✗ | ✓ | trivial — fold into T1 |

## Document-level encoding shape

A typical Swillustrator-authored SVG:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:swill="https://swillustrator.app/svg-ext"
     viewBox="0 0 816 1056"
     width="816"
     height="1056"
     swill:paperSize="us-letter"
     swill:units="px">
  <title>Untitled</title>
  <swill:layers>
    <swill:layer id="bg" name="Background" visible="true"/>
    <swill:layer id="content" name="Content" visible="true"/>
  </swill:layers>
  <g swill:layer-id="bg">
    <path d="M 0 0 L 816 0 L 816 1056 L 0 1056 Z" fill="#ffffff"/>
  </g>
  <g swill:layer-id="content" swill:group-id="g1">
    <path d="M 100 100 L 200 100 L 200 200 L 100 200 Z"
          fill="#3366ff" stroke="#000000" stroke-width="1.5"/>
    <text x="120" y="160" font-family="Inter, sans-serif" font-size="16" fill="#000000">
      Hello
    </text>
  </g>
</svg>
```

The `<swill:layers>` registry is always at the top; layer membership is a per-shape attribute. Groups are real `<g>` elements with an optional id attribute. Anything Swillustrator-specific lives under the `swill:` namespace; standard SVG content stays standard.

## Architecture

Three layers, each independently testable:

```
┌───────────────────────────────────────────────────────┐
│  Swillustrator App (apps/swillustrator/src/App.tsx)   │
│    file picker → svgInterop → setItems / setDoc       │
│    Save: itemsRef + groupsRef + doc → svgInterop      │
└─────────────────────┬─────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────┐
│  Swillustrator SVG bridge (svgInterop.ts)             │
│    Obj ↔ SvgNode + swill-namespace metadata          │
│    Paper size / groups / layers / warnings            │
└─────────────────────┬─────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────┐
│  @orochi235/weasel-svg                                │
│    parseSvg / serializeSvg                            │
│    Generic SVG ↔ SvgNode tree                         │
│    Knows about namespaces *generically*               │
│    (any xmlns:prefix passes through as a meta bag)    │
└───────────────────────────────────────────────────────┘
```

### Where namespace semantics live

weasel-svg stays domain-neutral. It does NOT know that `swill:paperSize="us-letter"` means "this is a US Letter document" — it only knows that `swill:paperSize` is a namespaced attribute on an `<svg>` element and preserves it round-trip.

**Generic namespace handling in weasel-svg:**

- `parseSvg(svg, opts?)` accepts an optional `namespaces?: Record<prefix, uri>` config. If a parsed element has attributes/children in any declared namespace, weasel-svg surfaces them as opaque structured data attached to the `SvgNode` or `ParseResult`. Unknown namespaces are preserved (round-tripped) but exposed only through a permissive `meta` bag.
- `SvgNode` types gain a `meta?: { [prefix:string]: { attrs?, elements? } }` field carrying the namespaced extras.
- `ParseResult` gains a document-level `documentMeta?: { [prefix:string]: { attrs?, elements? } }` for namespaced attrs/elements that lived on the root `<svg>`.
- `serializeSvg(nodes, opts)` accepts the same `namespaces` config + reads the `meta` bags off `SvgNode`s and the `documentMeta` from `SerializeOptions`. It writes the declarations, attributes, and elements back out.

**App-specific semantics in svgInterop.ts:**

- svgInterop declares the `swill` namespace once: `{ swill: 'https://swillustrator.app/svg-ext' }`.
- On save: builds `SvgNode.meta.swill.attrs = { 'layer-id': 'bg' }` etc. for each shape; builds `documentMeta.swill = { attrs: { paperSize: 'us-letter', units: 'px' }, elements: { layers: [...] } }`.
- On open: reads the same shape back out.
- The string `swill:paperSize`, the enum `'us-letter'`, the meaning of `<swill:layers>` — all of that lives only in svgInterop. weasel-svg sees structured opaque metadata it doesn't interpret.

Benefits of this split:
- weasel-svg stays usable by any future consumer that wants its own namespace.
- All "what does the swill: namespace mean?" lives in one file (svgInterop), not scattered.
- weasel-svg's surface stays small: parse/serialize + generic namespace pass-through, no app-specific feature creep.

## Implementation tasks (high-level)

The plan that follows this spec will break these into bite-sized steps.

- **T0: Generic namespace pass-through in weasel-svg.** Extend `parseSvg`/`serializeSvg` with a `namespaces?: { prefix → uri }` config. Surface namespaced attributes as a `meta` bag on each `SvgNode`, and namespaced root-level attributes/elements as `documentMeta` on the parse/serialize result. weasel-svg gains zero domain knowledge — purely opaque pass-through. Tests cover round-tripping arbitrary namespaced content.
- **T1: Paper-size round-trip.** Also extend weasel-svg's parse to surface the standard SVG `viewBox`/`width`/`height` attributes (gap from the audit). In svgInterop, declare the `swill` namespace, encode `paperSize`/`units` into `documentMeta.swill.attrs` on save, read them back on open, and call `setDoc`. Add round-trip tests with fixtures for `us-letter`, `a4`, and a custom size.
- **T2: Groups round-trip.** Use the existing `SvgGroupNode` plus the new `meta` bag from T0 for the optional `swill:group-id` attribute. Bridge stops flattening on import; instead surfaces nested structure to `groupsRef`. Save walks `groupsRef`. Add round-trip tests.
- **T3: Layers round-trip.** New encoding: `<swill:layers>` element at top (in `documentMeta.swill.elements`) + `swill:layer-id` per shape (in `meta.swill.attrs`). Requires Swillustrator to actually have a layer model first (it has a `LayerList` UI but no persisted layer data per the audit — check this and either reuse the existing kit-level layer concept or design Swillustrator's flavor). Likely needs its own brainstorm before plan.
- **T4: Text style round-trip.** Map `TextStyle` fields to SVG `<text>` attributes (font-family, font-size, font-weight, font-style, fill). Line-height encodes as `swill:line-height` (per-shape `meta.swill.attrs`). Round-trip tests for each field.
- **T5: Warning surfacing.** weasel-svg already returns `warnings[]` from `parseSvg`. Swillustrator's Open handler should display them — likely a transient toast or modal listing each warning. Lives in the UI layer, doesn't touch the bridge.
- **T6: Bridge tests.** Direct unit tests on `svgInterop.ts` — currently zero. Cover every `Obj` kind × every SvgNode kind cell, plus edge cases (empty paths, gradients dropping to solid, missing stroke).

## Out of scope (for now)

- **Multi-page documents.** Encoding is reserved (`<swill:page>`) but no UI in Swillustrator. Defer until a real driver appears.
- **Parametric origin tracking.** Swillustrator doesn't preserve "this was a 5-pointed star" once the tool finishes. Adding that requires modeling parametric kinds in `Obj`, which is a separate Swillustrator feature, not a format question. Reserve `<swill:parametric>` element for the future encoding.
- **Virtual groups (many-to-many membership).** Real `<g>` groups remain tree-structured with single-membership (decided in design discussion). When Swillustrator adds a virtual-groups feature for many-to-many selection sets, the encoding is reserved as `<swill:vgroup id name members="id1 id2 id3"/>` elements at the top of the document, alongside `<swill:layers>`. Virtual groups are metadata-only — they don't appear in the SVG tree, so third-party renderers see exactly the same flat shape order.
- **Gradients / alpha / patterns.** Standard SVG features; will fold in when Swillustrator adds the UI. No format design needed — they're standard.
- **Filters / masks / clip-paths.** Beyond Swillustrator's roadmap. weasel-svg will continue to emit `warnings[]` on import of files containing these; we don't preserve them.
- **Blend modes.** `<g style="mix-blend-mode:multiply">` is partial SVG. Swillustrator doesn't use these; defer to a later spec if a feature drives it.
- **Image / `<image>` elements.** Out of scope for v1; the kit's `WeaselRenderer` supports raster images but Swillustrator has no UI for them.
- **Animation.** SVG can encode `<animate>` etc. Not a Swillustrator concept.

## Testing strategy

Three layers, each with its own test file:

1. **weasel-svg unit tests** (`packages/weasel-svg/src/*.test.ts`): namespace parsing, viewBox surface, layer registry encoding, namespace round-trip for each new field. Extend the existing `roundtrip.test.ts`.
2. **svgInterop bridge tests** (`apps/swillustrator/src/svgInterop.test.ts` — new): every `Obj` × `SvgNode` cell, including the new metadata bag.
3. **Swillustrator integration** (existing harness, possibly visual regression): Save a known scene, reload, assert the rendered output matches.

Plus a small set of golden-file fixtures under `packages/weasel-svg/src/__fixtures__/`:
- `swillustrator-minimal.svg` — one rect, one text
- `swillustrator-groups.svg` — two groups with three shapes each
- `swillustrator-layers.svg` — three layers, multiple shapes
- `swillustrator-papers.svg` — one of each paper-size enum

These also serve as documentation of the on-disk format.

## Acceptance criteria

- A scene built in Swillustrator can be saved and reopened with **zero visible difference**.
- Saved files render correctly in Chrome / Safari / Firefox preview (no `swill:` content visible; standard SVG only).
- Saved files open in Inkscape with **layer registry and groups preserved** (Inkscape preserves unknown namespaces).
- Saved files open in Figma / Sketch as flattened SVG (rendered output preserved; metadata silently stripped).
- The audit's 12-15 gaps are addressed or explicitly deferred with rationale.
- weasel-svg's API surface stays clean: external consumers don't have to know about the `swill:` namespace to use parseSvg / serializeSvg — the metadata is optional.

## Migration

No format migration: there's no installed base of Swillustrator-saved SVGs in the wild yet (Swillustrator is pre-1.0; persistence is in-memory only outside of Save→file). The first version of the on-disk format is the canonical one.

If users have saved any Swillustrator SVGs prior to this spec, they will:
- Continue to render correctly (no breaking changes to the standard SVG content).
- Lose any features the old format couldn't encode anyway (groups, paper-size enum, layers — these were never persisted before).

## Future work

- **`<swill:parametric>` elements** when Swillustrator starts tracking parametric origin for shapes.
- **`<swill:page>` elements** when multi-page documents are designed.
- **Embedded font data** (`@font-face` with data URLs) for portable text rendering. Significant size cost; opt-in only.
- **Compressed `.svgz`** as an alternative file type for large documents.
- **A "Save flat SVG for sharing"** menu option that strips the `swill:` namespace, producing a leaner third-party-friendly file. Useful for users who want a clean export.

## Risk / open items

- **Inkscape compatibility verification:** the spec assumes Inkscape preserves unknown namespaces faithfully (this is documented behavior of `sodipodi:*` and `inkscape:*` namespaces). Spot-check with a real Inkscape round-trip before declaring T2 done.
- **Figma stripping behavior:** verify that Figma's SVG import silently strips unknown namespace elements without erroring or warning the user. If Figma errors, third-party round-trip is worse than expected.
- **`swill:paperSize` enum drift:** picking a permissive set of paper-size names (`us-letter`, `us-legal`, `a4`, `a3`, `tabloid`, `custom`). If Swillustrator adds new presets, the enum grows additively — old files with unknown presets fall back to "custom" + the explicit width/height.
- **Pages × layers interaction:** if both ever exist, does each page have its own layer registry, or do layers span pages? Need to decide before T3 lands, but until multi-page is a feature it's safe to assume single-page = single registry.
