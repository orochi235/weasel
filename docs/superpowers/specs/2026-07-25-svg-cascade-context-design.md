# SVG parser cascade context — design

**Status:** approved 2026-07-25
**Package:** `@weasel-js/svg` (`packages/svg/src/`)
**TODO item:** Paths & booleans → "Generic CSS cascade for `@weasel-js/svg`'s parser" (P2)

## Problem

Most SVG paint/text presentation properties *inherit*: `<g fill="red"><path d=…/></g>`
gives the path a red fill via cascade. The parser resolves this today by walking
the DOM parent chain **per attribute, at leaf-emit time** via `readInheritedAttr`
(`parse.ts:443`). A leaf with an inherited stroke triggers ~8 separate parent-chain
walks; the parser has ~12 `readInheritedAttr` call sites across `parseElement`,
`readPaint`, and `readStroke`.

This is O(depth) work repeated per attribute per leaf, and the logic is scattered.
As support for SVG's inheritable-attribute matrix grows, each new property needs its
own walk-up call plus independent knowledge of `style=""` parsing and the `inherit`
keyword. Two capabilities are also awkward or missing under the walk-up model:

1. **Text ignores the cascade entirely.** `readTextStyle` / `readTspanRun` read
   font/fill with plain `el.getAttribute` — self-only, no ancestor inheritance, no
   `style=""` support. `<g fill>`/`<g font-*>` do not reach `<text>`/`<tspan>`. This
   is a live bug.
2. **`currentColor`** resolution needs the inherited `color` value, which the
   per-attribute walk never tracks.

## Approach

Thread a resolved **`StyleContext`** down through the recursion, alongside the `ctm`
(transform matrix) that is already threaded. At each element we compute the current
cascade once, top-down; leaves read resolved values from the context instead of
walking the DOM. This mirrors how a browser's CSS cascade actually works and is the
natural extensible shape.

Rejected alternatives:
- **`getComputedStyle` browser fast path + threaded fallback.** jsdom does not
  reliably resolve SVG presentation attributes, so the fallback carries the test
  suite regardless — two code paths for no gain.
- **Memoize `readInheritedAttr` per element.** A band-aid on the band-aid; keeps the
  per-attribute model this refactor is meant to retire.

## Design

### New module: `packages/svg/src/cascade.ts`

Keeps `parse.ts` from growing and gives the cascade its own unit tests.

```ts
// Raw resolved value of each inheritable property in effect at this tree depth.
// Absent key = property unset all the way up → the consumer applies its own
// default (matching today's readInheritedAttr → null behavior).
export type StyleContext = Readonly<Record<string, string>>;
export const EMPTY_STYLE: StyleContext = {};

// The inheritable presentation properties the leaf/text parsers consume.
// Trivially extendable: add a property here and the leaf that reads it inherits.
const INHERITABLE = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
  'color',
  // + the font-* / text-anchor / letter-spacing properties that
  //   readTextStyle / readTspanRun currently read (enumerated during impl).
];

export function deriveStyle(parent: StyleContext, el: Element): StyleContext {
  const next = { ...parent };
  for (const prop of INHERITABLE) {
    const own = readStyleProp(el, prop) ?? el.getAttribute(prop);
    if (own == null || own === 'inherit') continue; // absent/inherit → keep parent
    next[prop] = own;
  }
  return next;
}

// style="" property scanner, moved here from parse.ts (unchanged behavior).
export function readStyleProp(el: Element, prop: string): string | null { … }
```

`deriveStyle` reproduces `readInheritedAttr`'s per-element resolution rule
(style-over-attr precedence via `readStyleProp(el,p) ?? el.getAttribute(p)`; `inherit`
and absence both fall through to the parent) — applied **once per element, top-down**
and stored, instead of re-walked per attribute at each leaf.

### Threading through the recursion

`StyleContext` occupies the same structural slot as `ctm`:

- `parseChildren(parent, ctm, style, gradients, onWarn, uriToPrefix)` — new `style` param.
- `parseElement(el, ctm, style, …)` — new `style` param.
- `parseTextElement(el, ctm, style, gradients, onWarn)` — new `style` param.
- `<g>` and nested `<svg>`: `const childStyle = deriveStyle(style, el)`, passed down
  alongside the existing `childCtm`.
- Leaf branch: `const leafStyle = deriveStyle(style, el)` (folds the element's own
  attrs onto the inherited cascade). `readPaint` / `readStroke` / the `fill-rule`
  check / the `<line>`-fill gate read from `leafStyle['fill']` etc. instead of
  calling `readInheritedAttr`.
- Root: `parseChildren(root, IDENTITY_MATRIX, EMPTY_STYLE, …)`.

`readInheritedAttr` is **deleted** (all call sites migrate to `leafStyle[...]`).
`readPaint(el, …)` / `readStroke(el, …)` change signature to take the resolved
`StyleContext` (or the individual resolved strings) rather than the `Element`.

### Text cascade fix

`parseTextElement` derives `leafStyle` from the threaded context and hands it to
`readTextStyle`; `<tspan>` runs derive further from the text element's style before
`readTspanRun`. Result: `<g fill>`/`<g font-*>` reach text, and `style=""` works on
text — both broken today.

### currentColor

At the `readPaint` / `readStroke` seam, a value of `currentColor` (case-insensitive)
resolves to `leafStyle['color'] ?? '#000000'` before being handed to the color parser
(`parsePaintAttr` in `color.ts`). Black is the SVG initial value for `color` when it
is unset up-chain.

### Stroke gate (unchanged semantics, noted)

`readStroke`'s "emit a stroke only if `stroke` or `stroke-width` is set somewhere
up-chain" gate becomes
`leafStyle['stroke'] != null || leafStyle['stroke-width'] != null` — identical
behavior, moved verbatim.

## Explicitly out of scope / unchanged

- **`opacity` and `transform` stay self-only.** `opacity` does **not** inherit in
  SVG; threading it would be a correctness regression. `readOpacityAttr` and
  `parseTransform` are untouched, and neither property is in `INHERITABLE`.
- **`style=""` stays the regex scanner.** No real CSS parser; `!important` still
  unsupported.
- **`<style>` elements / class selectors** remain unsupported. Selector matching is a
  separate item from inheritance threading.

## Testing

- **Behavior-preserving:** existing `parse.test.ts` fill/stroke cascade tests stay
  green (fill/stroke output is byte-identical). `roundtrip.test.ts` stays green (the
  cascade-resolved leaf output must still round-trip).
- **New `cascade.test.ts` unit tests** for `deriveStyle`: own value wins over parent;
  `inherit` keyword keeps parent; absent property keeps parent; `style=""` beats
  presentation attr on the same element; multi-level nesting resolves to nearest
  ancestor.
- **New `parse.test.ts` cases:** `<text>`/`<tspan>` inherits fill + font from `<g>`;
  `style=""` honored on text; tspan inherits from its text parent; `currentColor`
  resolves against inherited `color`; `currentColor` defaults to black when `color`
  is unset.

## Files touched

- `packages/svg/src/cascade.ts` — **new** (`StyleContext`, `EMPTY_STYLE`,
  `INHERITABLE`, `deriveStyle`, `readStyleProp` moved from `parse.ts`).
- `packages/svg/src/cascade.test.ts` — **new**.
- `packages/svg/src/parse.ts` — thread `style` through
  `parseChildren`/`parseElement`/`parseTextElement`; migrate `readPaint`/`readStroke`
  and the inline `fill-rule`/`<line>` sites; delete `readInheritedAttr`; move
  `readStyleProp` out; add `currentColor` resolution; fold text onto the context.
- `packages/svg/src/parse.test.ts` — new text-cascade + currentColor cases.
