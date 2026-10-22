# Content along a path, with text as one kind of content

**Status: designed 2026-10-21, nothing built.** Delete this doc once it lands, keeping anything durable in the
packages' own docs.

**For** whoever plans and builds it. **Answers:** how weasel lays any sequence of items — glyphs, scene shapes, DOM
controls — along any path, so that text along a path is one case of that rather than a feature of its own.

## Why

Three places already lay things along a curve, each its own way:

| Today | Where | What it places |
|---|---|---|
| `runPlaces` + `trackRun` + `placeOnRun` | ui `Bar/runPlaces.ts`, geom `track/run.ts`, ui `Along/placeOnRun.ts` | a row's DOM items along an arc, tipped, flipped to read |
| Repeat Along Path | geom `paths/repeatAlongPath.ts`, core path effect `repeatAlong` | copies of one shape along a path |
| Bend Along Path | geom `bendAlongPath`, core path effect `bendAlong` | one shape's outline warped along a spine |

Nothing places text along a path. Text is a sequence of items — glyphs, each with an advance — so it should come out
of the same placement as a row of controls, not out of a fourth mechanism.

## Terms

| Term | Meaning |
|---|---|
| **track shape** | geom's `TrackShape`: a curve mapping a 0..1 fraction to a point and direction, and a point back to a fraction. `line` and `arc` exist; `path` is reserved. |
| **run** | geom's `TrackRun`: a stretch of a shape in reading order, flipped to stay readable. |
| **item** | One rigid piece laid along a run: a length along the run, a cross-run extent, and an anchor line it sits on. |
| **place** | Where an item lands: a point, a tip angle, and its offset off the run. |

## Decisions (2026-10-21)

- **Items are rigid.** Each item is moved and tipped to the curve whole, the rule the arc controls already follow.
  Warping an item's outline along the curve is Bend Along Path, which stays a separate effect.
- **Text Along Path is a path-effect kind**, beside Bend Along and Repeat Along, taking the spine machinery they
  share: the effect node depends on `[text, path]`, follows edits to either live, and can retarget or release its
  path as one undo step (Mike, 2026-10-21).
- **The sources are hidden while the text sits on its path, and shown again on release** (Mike, 2026-10-21). Release
  deletes the effect node and shows its sources in one undo step. Hiding is a general path-effect option rather than
  text's alone, so Bend Along and Repeat Along can take it later; they keep showing their sources by default.
- **Editing hidden sources** (designer's call). Double-clicking the text on the path edits the source text node in
  place at the source's own position, shown while the edit lasts; the curved copy follows each keystroke. The path is
  edited by entering path edit on the effect, which edits its path source. Selecting the effect shows both sources'
  outlines faintly, so a user can see what the text was made from.
- **One placement primitive in geom.** `runPlaces` moves from ui to geom and grows into the function that turns
  item lengths into places on a run. Ui's rows, the new text effect and Repeat Along all call it.
- **A path track shape is built**, the reserved `'path'` kind, over geom's `measurePath` and `nearestOnPath`, so
  any of the above runs along an arbitrary path and not only an arc.
- **A path effect's source can be a sequence of items.** Today an `EffectSource` is one outline. It gains an
  optional item list; a text node's reader supplies one item per grapheme cluster, and any other source is a list of
  one. The text effect paints each item's outline at its place, in the source's paint, as `DerivedPart`s.
- **Glyphs are painted as outlines**, from the outline tier `textToPath` already uses, so the effect needs no
  per-glyph renderer transforms and exports to SVG and PDF as paths.

## The placement primitive (geom)

Given a run, each item's length along it, a gap, an alignment (`start`/`center`/`end`), a scroll offset, and how
items sit on the run (centered on it, or on an anchor line at an offset — a glyph's baseline, above or below the
path), it returns each item's place and whether it is clipped past either end. It is what `runPlaces` computes plus
the `trackRun.at` lookup `placeOnRun` does, in one call. The flip rule is the run's, so text below a circle's center
reads left to right, as controls do.

## Text along a path

- **Clusters, not code points.** One item per grapheme cluster as `layoutRuns` laid it, so ligatures, combining
  marks and emoji stay whole; a right-to-left run is laid in visual order. The advance between items is the laid
  advance, kerning included.
- **On the line.** Glyphs sit on their baseline by default; an offset moves the baseline above or below the path,
  and `center` sits them on their x-height middle.
- **Too long for the path.** Clip at the path's end by default; an option squeezes the tracking to fit instead.
- **One line.** The source's first laid line follows the path; a wrapped text node's later lines are dropped from
  the effect (stated in the effect's docs).
- **Which side, which way** (designer's call, 2026-10-21). The run's readable flip is the default, as on an arc. An
  effect option `side: 'auto' | 'path' | 'flipped'` overrides it: `'path'` follows the path's own direction and
  left-hand side (SVG `textPath`'s rule), `'flipped'` the reverse — so text can sit inside a curve or upside down on
  purpose. The primitive takes the same option, defaulting to `'auto'`, so `BarAlong` is unchanged.
- **Closed paths** (designer's call). Text starts at the path's first point plus a `start` distance along it, and on
  a closed path wraps past the seam; on an open path it clips at the end. The `'path'` track shape knows whether its
  path is closed. The baseline's distance off the path is `shift`, not `offset`, which stays the primitive's scroll.
- **Color glyphs** (designer's call). An emoji or other color glyph has no outline: its advance is kept and nothing is
  painted for it, and the effect's docs say so. The rest of the text still paints, unlike `textToPath`, which refuses
  the whole node.
- **The text node's pose** (designer's call). The path decides where and at what angle each glyph goes, so the node's
  rotation and skew are ignored; its scale applies as a font-size factor. A `{ px }` font size resolves at the
  source's world scale, as `textToPath` resolves it.
- **Decorations** (designer's call). Underline, strikethrough and overline are not drawn along a path in this pass;
  filed as a follow-up.
- **Picking and bounds** come from the derived path as for every path effect.

## Who calls it

| Caller | Change |
|---|---|
| ui `BarAlong`, `useRunScroll` | import placement from geom instead of `Bar/runPlaces.ts` |
| core path effects | a `textAlong` kind: `TextAlongEffect { kind: 'textAlong'; align; offset; anchor; overflow }` with sources `[text, path]` |
| core effect sources | a text node's reader supplies per-cluster outlines with advances |
| path-tools | a `textAlongAction` beside `bendAlongAction` and `repeatAlongAction`, in the same preset and settings form |
| draw | gets the action through path-tools' preset, as it does Bend Along |

## Goals and anti-goals

- **Goal:** in draw, select a text node and a path, run Text Along Path, and see the text follow the path; edit
  either and it follows; release the path and the text is plain again. Undo covers each step.
- **Goal:** the same placement, fed DOM spans, lays a label along an `Along` arc in ui — shown by a story and a
  browser test, not a new public component (designer's call); a curved-label component is filed as a follow-up.
- **Anti-goal:** a second placement routine. If a caller lays items along a run, it calls the geom primitive.
- **Anti-goal:** bending glyph outlines. That is Bend Along Path's job.

## Not covered

Editing text in place on the curve; vertical text; multi-line text along a path; text along a path as a property of
the text node rather than an effect (option (a), not chosen).

## Left to the builder

- The primitive's name and exact signature, and where in geom it lives (beside `track/run.ts`).
- How `EffectSource` carries items (a field on it, or a second reader) without slowing the shape-only effects.
- Whether Repeat Along moves onto the primitive in this work or follows; if it follows, file it.
- The settings form's fields for the text effect, following Bend Along's.
