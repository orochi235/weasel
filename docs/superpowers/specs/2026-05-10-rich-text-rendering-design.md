# Rich text rendering — bold, italic, and inline runs

**Status:** design, awaiting implementation plan
**Date:** 2026-05-10

## Goal

Make the MSDF text-rendering pipeline support bold and italic, both as
node-level styling and as inline runs within a single text string. Multiple
font families and multiple sizes already work; this design adds the missing
variant axis and the rich-text data model that lets bold/italic appear within
a single string.

## Current state (one-paragraph summary)

`TextStyle` already declares `fontFamily`, `fontWeight`, and `fontStyle`. The
GPU MSDF pipeline (`drawText` → `GlyphLayout`) honors family + size but uses
the single atlas registered for the family — weight and style on the node only
affect canvas measurement and the contenteditable overlay, not the painted
glyphs. `registerFont(family, metricsUrl, atlasUrl)` registers one atlas per
family with no slot for variants. A separate canvas2d `parseMarkdownRuns` /
`createMarkdownRenderer` path already produces `StyledRun[]` with bold/italic
and renders them through native `fillText`, but it doesn't feed the GPU path.

## Decisions made during brainstorming

1. **Scope: inline runs (rich text), not just per-node bold/italic.**
2. **Data model: hybrid — runs are canonical, markdown is sugar.** Nodes
   store `StyledRun[]`; helpers parse markdown → runs and serialize runs →
   markdown for clipboard and ergonomic input.
3. **Font registry: variant-aware (mirrors `@font-face`).** `registerFont`
   takes a `{ weight, style }` variant; internal registry keys by
   `(family, weight, style)`; a resolver walks a defined fallback chain.
4. **Editing UX: round-trip + Cmd/Ctrl-B and Cmd/Ctrl-I keyboard toggles.**
   No floating toolbar in core.
5. **Variant glyphs: real atlases when registered, synthetic fallback (SDF
   threshold thicken / vertex skew) when not.**
6. **Drop `sizeFactor` from `StyledRun`. Drop bracket size markup
   (`[bigger]`/`(smaller)`) from `parseMarkdownRuns`.** Storage gets one size
   axis. Parent-relative sizing is a future scene-graph concern, separate
   from inline runs.
7. **Run-boundary kerning uses the left glyph's atlas table and size
   scaling.** Trivial to implement; visible benefit at mid-word style
   toggles.

## Architecture

Five pieces, four new and one modified:

1. **`src/features/text/runs.ts`** (new) — canonical inline-styling
   primitive. `StyledRun`, `toRuns`, `runsToPlainText`, `runsToMarkdown`,
   `markdownToRuns`, plus caret-math helpers `runsToDomRange` and
   `domRangeToRuns`.
2. **`src/features/text/atlas/registerFont.ts`** (modified) — variant-aware
   registry. New signature and resolver. Texture-cache key becomes
   `(family, weight, style)`.
3. **`src/features/text/atlas/GlyphLayout.ts`** (modified) — new `layoutRuns`
   entry point that walks `StyledRun[]`, switches atlas per run, applies
   kerning across run boundaries via the left atlas's table, accumulates
   x-advance, and tracks synthetic flags.
4. **`src/renderer/draw.ts`** (modified) — `TextDrawCommand` carries
   `runs: ResolvedRun[]` instead of `text: string`. `drawText` groups
   laid-out quads by `(family, weight, style, fill)` atlas binding and
   issues one draw call per group; sets `u_synthBold` and `u_synthItalic`
   uniforms when the resolved variant was synthetic.
5. **`src/features/text/useTextEdit.ts`** (modified) — overlay renders runs
   via styled `<span>`s; Cmd/Ctrl-B and Cmd/Ctrl-I split/merge runs at the
   selection or set a pending style at the caret; commit walks the DOM and
   emits `StyledRun[]` via a structural normalizer.

The shader (`textSdf`) gets a ~6-line patch for the two new uniforms.

## Data model

### `TextPose` (extension, non-breaking)

```ts
interface TextPose {
  text: string;            // canonical plain-text form
  runs?: StyledRun[];      // when present, authoritative
  style?: TextStyle;       // node-level defaults; per-run fields override
}
```

Invariant: when `runs` is present, `runsToPlainText(runs) === text`. A
`setRuns(runs)` helper derives `text` automatically — consumers don't
maintain both. Code that wants plain text (search, copy-as-plain, ARIA) goes
through `text`.

### `StyledRun`

Promoted from `markdownText.ts` to `runs.ts`:

```ts
interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;     // overrides node style.fontFamily
  fontSize?: number;       // absolute, world units; overrides node style.fontSize
  fill?: Paint;            // overrides node style.fill
}
```

A run with everything optional omitted inherits the node style entirely:
`[{ text: "hello world" }]` is equivalent to the old `text: "hello world"`
path.

### Serialization

- **Plain text** (`runsToPlainText`) — concat of `text` fields. Used for
  `text` derivation, ARIA, plain-text copy.
- **Markdown** (`runsToMarkdown`) — `**bold**`, `*italic*`, `***both***`.
  Canonical clipboard format. No bracket-size markup.
- **No HTML in core.** Consumers wanting HTML write their own walker.

### `toRuns` funnel

`toRuns(input: string | StyledRun[])`:
- `string` → `[{ text: input }]` (newlines preserved as `\n` in the run text).
- `StyledRun[]` → sanity-checked, returned. Invalid runs throw in dev,
  warn-and-coerce in prod.

## Variant-aware font registry

### API

```ts
interface FontVariant {
  weight?: number;                  // default 400
  style?: 'normal' | 'italic';      // default 'normal'
}

registerFont(
  family: string,
  variant: FontVariant,             // {} for regular
  metricsUrl: string,
  atlasUrl: string,
): Promise<void>;
```

Existing call sites (tests + demo) must add the variant arg.

### Storage

Two-level map: `family → Map<variantKey, FontEntry>`, where
`variantKey = \`${weight}|${style}\``. Two-level enables cheap iteration of a
family's variants during fallback resolution.

### Resolver

```ts
resolveFontVariant(
  family: string,
  weight: number,
  style: 'normal' | 'italic',
): {
  entry: FontEntry | null;
  synthetic: { bold: boolean; italic: boolean };
};
```

Fallback chain, in order:

1. Exact `(family, weight, style)`.
2. Same style, nearest weight in same bucket (≥600 = bold, <600 = regular).
   Nearest by absolute distance; ties broken by higher weight.
3. `(family, 400, style)` — same style, regular weight.
4. `(family, weight, 'normal')` — same weight, no italic.
5. `(family, 400, 'normal')` — last resort within family.
6. `null` — caller warns once per `(family, weight, style)`.

Synthetic flags are computed from the gap between requested and resolved:

- `synthetic.bold = requested.weight >= 600 && resolved.weight < 600`
- `synthetic.italic = requested.style === 'italic' && resolved.style === 'normal'`

So a request for `(family, 700, 'italic')` that resolves to step 4
(`(family, 700, 'normal')`) gets `synthetic.bold = false` (real bold),
`synthetic.italic = true` (skew applied). These flags drive `drawText`'s
decision to apply the SDF-thicken / vertex-skew fakes.

### Texture cache key

`ensureFontTexture` keys by `(family, weight, style)` — one cache slot per
variant.

## Run layout (`layoutRuns`)

### Signature

```ts
layoutRuns(
  runs: ResolvedRun[],
  opts: { maxWidth?: number; lineHeight: number; align: 'left'|'center'|'right' },
  resolveAtlas: (r: ResolvedRun) => { entry: FontEntry; synthetic: { bold: boolean; italic: boolean } },
  origin: { x: number; y: number },
): LaidOutRuns;

interface LaidOutRuns {
  groups: Array<{
    family: string;
    weight: number;
    style: 'normal'|'italic';
    synthetic: { bold: boolean; italic: boolean };
    fill: Paint;
    quads: Quad[];
  }>;
  bounds: { width: number; height: number };
}
```

`ResolvedRun` is `StyledRun` with all node-defaults applied. Resolution
happens in `createTextLayer`, never inside `layoutRuns`.

### Rules

- **Kerning** uses the left glyph's atlas table and size scaling — applied
  identically within runs and across run boundaries. Missing kerning entries
  resolve to 0. The first glyph of a layout (no left glyph) gets no kerning.
- **Baseline**: alphabetic, shared across runs on the same line. Mixed-size
  runs sit on a common baseline. Line height = `max(fontSize * lineHeight)`
  across runs on the line.
- **Word wrap** (finite `maxWidth`): break at spaces; wraps inside a run
  split for layout purposes but the source `StyledRun[]` is unchanged.
  Ported from existing `layoutMarkdown`.
- **Alignment**: per-line shift after positioning.
- **Empty runs** drop from layout but persist in the source array for
  caret-pending-style state.

### Grouping

Quads bucket by `(family, weight, style, fill)`. A paragraph alternating
`**bold** word **bold** word` collapses to two draw calls (regular + bold)
rather than six. Per-run `fill` adds a sub-bucket per atlas — uniform
change, cheap. Future optimization: pack color into a vertex attribute to
merge them.

## GPU draw

### `TextDrawCommand`

```ts
interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  runs: ResolvedRun[];
  style: ResolvedTextStyle;  // node-level resolved style for align, lineHeight, etc.
}
```

The old `text` field is removed. `createTextLayer` converts `(text, runs?,
style)` into `runs: ResolvedRun[]` before emitting the command.

### `drawText` flow

1. `layoutRuns(runs, ...)` → `LaidOutRuns`.
2. For each group:
   - Resolve atlas; `ensureFontTexture` uploads if needed.
   - Bind atlas; set `u_atlas`.
   - Set `u_color` from group's fill.
   - Set `u_synthBold` (~0.08 if synthetic else 0).
   - Set `u_synthItalic` (~0.21 rad if synthetic else 0).
   - Upload group's quad VBO/IBO; `drawElements`.
3. Free transient GL resources at end-of-command (existing pattern).

### Shader patch

Two new uniforms in `textSdf`. Pseudocode shape (exact attribute plumbing
sorted during implementation — vertex shader needs each glyph quad's
baseline-relative y, which is already derivable from existing attributes
but may need a small refactor):

```glsl
// vertex shader — synthetic italic skew
uniform float u_synthItalic;   // radians; 0 for non-synthetic
// Shift x by an amount proportional to distance above the glyph baseline.
// Quads above baseline lean right; quads at baseline are unchanged.

// fragment shader — synthetic bold via SDF threshold shift
uniform float u_synthBold;     // 0 for non-synthetic
float dist = median(msdf.rgb) - 0.5 + u_synthBold;
```

### Synthetic constants

- `u_synthItalic = 12° (0.2094 rad)` — standard oblique angle.
- `u_synthBold = 0.08` — empirical SDF threshold shift; thickens ~1px at
  16px size without breaking glyph topology.

**Tunable during implementation.** Visual tuning happens in slice 2 with a
demo node showing real-bold next to synthetic-bold side by side.

Both default to 0 when the variant resolved to a real atlas — real variants
always win.

## Rich-text editing (`useTextEdit`)

### Runs → DOM (on edit start)

Build the overlay's children by walking runs:

```ts
for (const run of runs) {
  const span = document.createElement('span');
  span.textContent = run.text;
  if (run.bold) span.style.fontWeight = '700';
  if (run.italic) span.style.fontStyle = 'italic';
  if (run.fontSize) span.style.fontSize = `${run.fontSize}px`;
  if (run.fontFamily) span.style.fontFamily = run.fontFamily;
  if (run.fill && 'color' in run.fill) span.style.color = run.fill.color;
  span.dataset.run = '';
  overlay.appendChild(span);
}
```

Newlines stay as literal `\n` in `textContent`; overlay uses
`white-space: pre-wrap` (already set today).

**Visual parity caveat:** the overlay renders the *browser's* bold/italic,
not the GPU's. For real-atlas families the GPU paints differently than the
contenteditable. Accepted — the geometry (caret position, line wrap) is
what matters for editing UX.

### Cmd-B / Cmd-I

Keydown handler intercepts `(meta|ctrl) + (b|i)`:

1. **Caret only (collapsed selection)** — set a "pending style" flag
   (`dataset.pendingBold = '1'`). Next typed character creates a new run
   with that style; pending state clears after.
2. **Range selection** — compute affected character range; split runs at
   boundaries; toggle bold/italic on runs inside; merge adjacent identical
   runs; rebuild DOM from new runs; restore selection over the same character
   range.

### Commit (Enter / blur)

Walk the overlay's `<span data-run>` children and emit `StyledRun[]`:

1. **Normalize.** Flatten any nested `<span>`/`<b>`/`<i>`/`<strong>`/`<em>`
   into a flat list. Treat `<br>` and `<div>` boundaries as `\n` in the
   preceding run.
2. **Coalesce.** Merge adjacent runs with identical styling.
3. **Result is canonical `StyledRun[]`.** Derive `text` via
   `runsToPlainText(runs)` and call `setRuns(runs)`.

Normalizer is the hairiest new code — budget time for cross-browser quirks
(Safari especially).

### Caret math

Selections stay in plain-text character offsets. Two new helpers in
`runs.ts`:

```ts
runsToDomRange(runs, charOffset): { node: Text; offset: number };
domRangeToRuns(overlay, range): { anchor: number; focus: number };
```

### Pending-style clearing

Clears on:
- Cursor movement (arrow keys, click).
- Any keypress that isn't the matching toggle.
- Selection change.

Matches conventional rich-text editor behavior.

## Migration

- `registerFont(family, metricsUrl, atlasUrl)` → `registerFont(family,
  variant, metricsUrl, atlasUrl)`. Mechanical update to in-tree call sites
  (`draw.test.ts`, `registerFont.test.ts`, demo entry).
- `TextDrawCommand.text` removed; only producer is `createTextLayer`
  in-tree.
- `StyledRun.bold`/`italic` become optional; `sizeFactor` removed; bracket
  markup removed from `parseMarkdownRuns`.

No external shim. Pre-1.0 project norm.

## Testing

### Unit (vitest)

- `runs.test.ts` — `toRuns`, `runsToPlainText`, `runsToMarkdown`,
  `markdownToRuns` round-trips.
- `registerFont.test.ts` — variant key storage; each step of the fallback
  chain has a dedicated test; texture-cache key uses
  `(family, weight, style)`.
- `GlyphLayout.test.ts` — multi-run line; mixed sizes share baseline; kerning
  uses left run's table across boundaries; word-wrap across runs; alignment
  per line.
- `draw.test.ts` — synthetic uniforms set correctly on fallback; per-run
  fill forces draw-call break.
- `useTextEdit.test.ts` — Cmd-B/I on selection splits and merges; pending
  style at caret; DOM-to-runs serializer handles `<br>`, `<div>`, nested
  spans, adjacent-same-style merging.

### Integration

- `TextDemo` updated to show a node with mixed bold/italic/size runs
  (markdown source).
- Manual visual check during development.

### GPU snapshots

Add fixtures exercising:
- Real bold (registered bold atlas).
- Real italic (registered italic atlas).
- Synthetic bold (italic-only family — should fall back to italic + thicken).
- Synthetic italic (regular-only family — should skew).

## Staging — three slices

Each slice is independently shippable.

### Slice 1 — Data model + variant registry

- New `runs.ts` with all helpers.
- `registerFont` variant signature + `resolveFontVariant` + variant-keyed
  texture cache.
- `TextPose.runs?` field; `createTextLayer` converts to a single-style
  atlas lookup (no per-run variant switching yet).
- All tests pass. Demo unchanged. No visible payoff yet.

### Slice 2 — Variant rendering + synthetic fallback

- `layoutRuns` with per-run atlas switching + cross-boundary kerning.
- `drawText` group-bucketed draw calls.
- Synthetic-bold / synthetic-italic shader uniforms + vertex skew + SDF
  threshold patch.
- Demo gets a rich-text node showcasing real bold (if bold atlas shipped)
  + synthetic bold (regular-only family).
- **Visual tuning pass on the synthetic constants happens here.**
- First visible payoff.

### Slice 3 — Rich-text editing

- Runs ↔ DOM serializer in `useTextEdit`.
- Cmd-B / Cmd-I (selection split/merge + pending caret style).
- Demo lets you double-click to edit and toggle bold/italic inline.

## Out of scope (recorded for future work)

- **Parent-relative font sizing** as a scene-graph mechanism (group node
  with `fontScale` descending to text children). Real want, separate
  design.
- Numeric weight axes beyond bold/regular buckets (300/500/900).
- Variable fonts.
- Per-run underline / strikethrough.
- Real (non-synthetic) variant atlas generation tooling — slice 2 ships a
  working synthetic-only path; producing Inter bold/italic atlases is a
  separate atlas-pipeline task.
- Cross-language shaping (CJK, RTL, complex scripts).
- HTML serialization in core.

## Risks and reminders

- **Synthetic constants (12°, 0.08) need visual tuning during slice 2.**
  Look at them then.
- DOM-to-runs serializer is the hairiest piece; budget time for Safari
  quirks.
- Per-run `fill` forces draw-call multiplication. Fine for hand-authored
  content; revisit if procedurally-styled paragraphs with many colors bite
  performance.
