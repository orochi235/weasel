# Text properties — two surfaces, one style model

Closes `docs/TODO.md` §Text's "(P2) Text properties panel (Character +
Paragraph)". Depends on
`docs/superpowers/specs/2026-07-28-font-package-extraction-design.md`, which
gives the family picker something to enumerate and the substitution notice
something to read.

## 1. The TODO's premise is stale

That entry was written 2026-05-11 and imagines a bespoke `<TextPropertiesPanel>`
in `@weasel-js/ui` that reads selection and dispatches style mutations.
`<SelectionPanel>` shipped 2026-07-20 and already does most of that job
generically: it derives sections and rows from core `NodePropertiesEntry`
schemas, aggregates values across a multi-selection with a `MIXED` sentinel,
and renders through pluggable `PropertyRenderer`s. Building a second panel
alongside it would duplicate aggregation, mixed-value rendering, and batching.

But it cannot do the whole job either. Schema leaves address **node paths**;
character styling addresses a **caret range**. Those are two different things
and they get two different surfaces:

| Surface | Binds to | Mechanism |
| --- | --- | --- |
| Sidebar, existing `SelectionPanel` | selection | schema leaves under `data.style.*` |
| Tool options bar, new | `editingId` + caret range | run algebra on `StyledRun[]` |

Everything below serves one of those two.

## 2. Nested paths in `@weasel-js/ui`

`SelectionPanel`'s model splits a node path at the **first** dot and reads one
level (`nodeValueAt`: `head` is `pose` or `data`, `key` indexes it directly).
`commit` mirrors that with a shallow spread. So `data.style.fontSize` resolves
to `data['style.fontSize']` — undefined — and writing it would create a
literally-dotted key.

Both generalize to N segments: `nodeValueAt` walks, `commit` does an immutable
nested set (`{...data, style: {...data.style, fontSize: v}}`). Existing
two-segment paths are the degenerate case, so no existing schema moves.
`aggregateValue`'s `MIXED` derivation is untouched — it already works purely
in terms of `nodeValueAt`.

This is the enabling change for the entire schema half, and it is worth doing
on its own terms: a one-level property model was always going to fail the
first nested data shape it met.

## 3. Schema leaves for the text kind

`packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts` gives the
`text` kind a Text group holding exactly one leaf — `data.text`, the content
string. It gains two groups:

- **Character** — `data.style.fontSize`, `data.style.fontFamily`,
  `data.style.fontWeight`, `data.style.fontStyle`, `data.style.letterSpacing`,
  `data.style.underline`, `data.style.strikethrough`, `data.style.fill`
- **Paragraph** — `data.style.align`, `data.style.lineHeight`

These are the node's defaults — what a run inherits when it doesn't override.
Multi-select and `MIXED` come free from `SelectionPanel`.

`data.style.fontFamily` renders as a select whose options come from
`listFonts()`. When a node's family isn't registered, the control shows the
requested family and the substitution from `ResolveResult.substituted`, rather
than a blank or a silently-corrected value.

## 4. New style keys

`TextStyle` gains three optional keys, and `StyledRun` gains the same three so
a range can override them:

```ts
letterSpacing?: number;    // world units, default 0
underline?: boolean;
strikethrough?: boolean;
```

`StyledRun` already carries `bold`, `italic`, `fontFamily`, `fontSize`, and
`fill`, so per-run overrides are the established pattern rather than a new
concept. `DEFAULT_TEXT_STYLE`, `resolveTextStyle`, and `ResolvedTextStyle`
extend in step.

Decoration is modeled as two booleans, not a `decoration: string[]` set,
because that is how the runs model already spells binary style flags
(`bold`/`italic`) and because CSS's `text-decoration-line` shorthand is not a
shape the renderer benefits from parsing.

## 5. Run algebra — the public foundation

`useTextEdit` handles bold/italic today through a private
`toggleFlagInRange(runs, start, end, flag)` that splits runs at the range
boundaries, patches the overlapping ones, and coalesces adjacent identical
runs. The hook returns `{ editingId, startEdit, cancelEdit, commit, isEditing }` —
no way to reach any of it. TODO open question (c) asked how to expose run-level
mutators; the answer follows `SelectionPanel`'s own precedent of a pure,
React-free `model.ts` beside a component.

Two pure functions, exported from core's text barrel:

```ts
styleAtRange(runs, start, end): RangeStyle
applyStyleToRange(runs, start, end, patch: Partial<StyledRun>): StyledRun[]
```

`RangeStyle` reports each key as a concrete value or `MIXED` — the same
sentinel meaning the panel uses, so both surfaces render indeterminate state
the same way. `toggleFlagInRange` becomes a special case of
`applyStyleToRange` and stays internal.

`useTextEdit`'s return grows three members that are thin wrappers over the
live DOM selection plus the functions above:

```ts
selection: { start: number; end: number } | null;
rangeStyle: RangeStyle | null;
applyStyleToSelection(patch: Partial<StyledRun>): void;
```

## 6. `ToolOptionsBar` and the Character controls

**`ToolOptionsBar`** (`@weasel-js/ui`) is a horizontal chrome strip above the
workspace: an optional context label and a children slot, styled from theme
tokens, with no knowledge of text. Composition-based in v1. The natural
follow-on — rendering the active tool's `ToolPrefGroup` into it, so every tool
gets an options row — is deliberately not built yet, but the component is
shaped so it can be.

Note this is a genuinely new component. `OptionsBar` is a segmented toggle
group (a pill track of `aria-pressed` segments) and `ActionsBar`/`ActionBar`
are its button-shaped siblings; those are controls that go *inside* a bar, not
the bar.

**Draw reserves the row permanently** once it opts in, rather than mounting it
when editing starts. Mounting on demand resizes the workspace mid-edit, and in
apps/draw the canvas is sized to the page.

**The Character controls** are a draw-local group filling the bar, assembled
from components that already exist: `ToggleBar` for bold/italic/underline/
strikethrough, `NumberField` for size and tracking, `Select` for family,
`ColorField` for fill. Each reads `rangeStyle` and writes through
`applyStyleToSelection`. `MIXED` renders as an indeterminate control.

**Collapsed caret.** With no range selected, the bar edits the node's
`TextStyle` — the same values the sidebar shows — so it is never dead chrome
and the two surfaces stay visibly consistent. Illustrator's alternative
(a pending style applied to the next typed character) is stateful, invisible,
and not worth the machinery here.

## 7. Renderer work

**Tracking.** `layoutRuns` adds `letterSpacing` to each glyph advance after
kerning is applied. Zero cost when the value is 0.

**Decoration.** `drawText` emits decoration quads through the existing
path-fill program, not the SDF program — they are solid rectangles, not
glyphs. `BmFont` carries no underline metrics (only `info`, `common`, `chars`,
`kernings`), so geometry derives from `common.base` and the resolved font
size: underline just below the baseline, strikethrough at roughly 0.3 ×
ascender, thickness roughly 0.05 × font size. Each quad takes its run's own
fill. Adjacent runs sharing decoration and fill merge into a single quad so no
seam shows at the join.

## 8. Round-trips

- **SVG** — `letter-spacing` and `text-decoration` join the presentation
  attributes in `packages/svg/src/cascade.ts`, are read in `parse.ts` (both
  the element and `<tspan>` paths), and are written in `serialize.ts`
  alongside the existing `font-size` handling.
- **DOM overlay** — `runsToDom` builds one `<span data-run>` per run and sets
  inline styles on it (`fontWeight`, `fontStyle`, `fontSize`, `fontFamily`,
  `color`). The three new keys follow that same shape —
  `style.textDecoration` and `style.letterSpacing` — rather than introducing
  `<u>`/`<s>` element wrappers, which `domToRuns` would then have to unwrap as
  a second representation. A contenteditable session round-trips the new keys
  instead of dropping them on commit.

## 9. Scope boundary

Not in this spec: paragraph indent and space-before/after, tab stops, text on
a path, vertical writing modes, HarfBuzz shaping, a general tool-prefs
rendering for `ToolOptionsBar`, and the `markdownToRuns` AST promotion. Font
loading of unregistered web fonts is not attempted — the picker enumerates
what is registered, and the fallback policy from the font spec governs
everything else.

## 10. Testing

1. **Run algebra** carries the heaviest coverage, as pure functions with no
   React: splitting at range boundaries, patching partial overlaps, coalescing
   adjacent identical runs, and `MIXED` derivation for ranges that straddle a
   boundary. Round-trip properties (`applyStyleToRange` then `styleAtRange`
   returns the patched value) are cheap to assert and catch coalescing bugs.
2. **Nested paths** in `@weasel-js/ui`'s `model.ts` — read and write at two
   and three segments, plus a regression asserting existing two-segment paths
   behave identically.
3. **Schema wiring** — the text kind's schema produces the expected sections;
   a multi-select across text nodes with differing sizes aggregates to
   `MIXED`.
4. **Substituted family** surfaces in the picker rather than rendering blank.
5. **Decoration and tracking** get visual-regression baselines. Local capture
   has matched CI since the backing-store fix, so a local failure is real
   signal rather than the old ±1px drift.
6. **`ToolOptionsBar`** gets a Storybook story; the Character controls get an
   interaction test asserting a toggle reaches `applyStyleToSelection` with
   the right range.

## 11. Release

Lands as part of **0.7.0** — see §10 of the font-package spec for the
mechanics. This spec contributes its own `minor` changeset covering the
`TextStyle` / `StyledRun` additions, the `useTextEdit` return-shape growth,
the `ToolOptionsBar` export, and `@weasel-js/ui`'s nested-path model change.

Because the release is a single lockstep bump, the two specs can merge in
either order once both are green; only the *publish* has to wait for both. If
spec 1 ships alone for any reason, it ships as 0.7.0 and this spec's changeset
becomes 0.8.0 rather than retroactively joining.
