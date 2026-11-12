# Annotation options and a calibration lab — plan

**Status: unbuilt (2026-11-12).** Approved design, not yet implemented. Branch `feat/annotation-options`,
worktree `weasel-wt/annotation-options`, cut from `arc/labkit-overlay` because that arc edits `paint.ts` and
`AnnotationOverlay.tsx` (arrowheads in screen pixels). Rebase onto `main` once that arc lands in a batch.

For whoever builds this. It answers: how a lab's annotation marks get a width and color, how a floating palette
edits them, and how a calibration lab checks that marks land where the pointer went.

## 1. Width and color on a mark

Today every mark draws at `MARK_WIDTH = 2` world units in `#e5484d` (`annotations/paint.ts`). The weasel tools
each pane mounts (pencil, line, rect, ellipse, text) already declare shared `stroke` / `strokeWidth` tool options
and hand them to the insert as `extras.style`; labkit publishes no values and ignores the style.

- [ ] `AnnotationData` gains `width?: number` (world units) and `color?: string`; `AnnotationInit` and
      `AnnotationPatch` gain both, so `add` / `update` take them and `Annotation` reports them.
- [ ] One resolver, `markStroke(data, style)` in `paint.ts`: width `data.width ?? MARK_WIDTH`, color
      `style.color` (the status's) `?? data.color ?? MARK_COLOR`. `markCommands`, `svgNodes.ts` (SVG export) and
      `paintedMarks` (overview) all read it — no second copy. A point's ring stays `{ px: MARK_WIDTH }`.
- [ ] Text marks: `fontSize?: number` on the data, read the same way (`TEXT_SIZE` default).
- [ ] `insertFactories` in `AnnotationOverlay.tsx` copies `extras.style.strokeWidth` and a solid
      `extras.style.stroke` into the new mark's `width` / `color`.
- [ ] One `ToolOptionValues` per lab (`createToolOptionValues` from `@weasel-js/routing`), held beside the lab's
      tool slot and persisted through `usePersistedState('annotation-options', …)`. Each pane publishes it inside
      its isolated `WeaselProvider` with `useToolOptionValues`, so a setting reaches every trial.
- [ ] Defaults: the annotation tools' options default to `MARK_WIDTH` and `MARK_COLOR`, not core's shape
      defaults — pass them through each tool's use-site `share`/defaults rather than forking core's defs. If core
      has no use-site way to override a default, add one to `shapeToolOptions` callers (engine surface, not a
      labkit special case).
- [ ] Sharing: one width and one color across all annotation tools (core's shared style keys). Ruling
      2026-11-09: style shared by default.
- [ ] Changesets: one for mark width/color (labkit, `minor` — new API), one per further change below.

## 2. Floating options palette

- [ ] `annotations/AnnotationOptions.tsx`: a labkit `FloatingPanel` (`persist: 'annotation-options-panel'`)
      drawing the active tool's options group with ui's `Bar`, as `ToolOptionsBar` does. Mounted by the lab
      chrome where `LabChrome.tsx` resolves `activeToolId`.
- [ ] What it shows, by the lab's tool:

      | Tool | Palette |
      |---|---|
      | a drawing tool | its options: the next mark's width and color (text: size and color) |
      | Select, marks selected | the selection's width / color / size, mixed where they differ; edits restyle them |
      | Select, nothing selected; Interact | hidden |

- [ ] Restyling a selection goes through `annotations.update`, one trial undo step per slider drag or typed
      edit (coalesce like a ControlPanel burst). Setting the next mark's options is not an undo step.
- [ ] Color is a small swatch row plus a `ColorField`; width a `NumberField` with slider, min 0.5, max 40.
- [ ] Stories: `labkit/Annotations/AnnotationOptions` with each state in the table.

## 3. Calibration lab — a coloring book

A labkit story, `labkit/Annotations/Calibration`: one instrument whose picture is a set of exercises, each a faint
guide to trace. The maintainer fills it in; the lab scores every mark against its guide and can hand the result
back for review.

- [ ] `annotations/calibration/exercises.ts` — each exercise: id, instruction text, kind of mark expected, guide
      geometry in content units, and (where it applies) the width / color it asks for. The set:
      box a rectangle; ring a circle (ellipse tool); trace a diagonal line; arrow from A to B (direction counts);
      freehand around a circle and along a sine; hit five dots (point marks); place a text label in a box;
      a thick band to trace at width 8; one shape to mark in a named color.
- [ ] Conditions that break alignment, as the instrument's config: content drawn at 1×, 2× and 0.5× its intrinsic
      size; the target inside a scrolled pane; the target zoomed (`target.view`). `positionDependsOn` names the
      ones that move the picture, so the staleness path is exercised too.
- [ ] `annotations/calibration/score.ts`, pure: for each exercise, the closest mark of the expected kind and its
      error in content units and in screen pixels — rect/ellipse bounds deltas, line/arrow endpoint deltas,
      freehand mean and max distance to the guide, point distance, text anchor offset; width and color match.
      Unit tests per scorer.
- [ ] A side panel listing each exercise, its error (columns aligned, `tabular-nums`), and pass at ≤ 2 screen px
      against an untouched guide.
- [ ] **Copy report**: JSON to the clipboard — marks (`annotations.toJSON()`), scores, the active condition,
      `devicePixelRatio`, each target's measured rect and content size, user agent. Review reads it with
      `pbpaste`, re-renders the marks headlessly, and posts a capture of each condition to the wall.
- [ ] `calibration.browser.test.tsx`: drives every exercise with exact pointer paths in each condition and
      asserts each score is under 0.5 screen px and a pixel probe finds the mark's color on the guide — the
      automated half of the same check.

## Finishing

Scoped tests for the touched files (`--project=labkit`, `--maxWorkers=1`), `typecheck:packages -- labkit core`,
root `npm run typecheck`, `lint -w @weasel-js/labkit`, `check:size`, the browser test on the fleet by its file.
Then delete this plan; retire nothing in `docs/TODO.md` (no entry covers it).
