# Handoff — unify text rendering on MSDF (retire the 2-D `renderLabel`/markdown path)

> Goal: make the GL/MSDF text pipeline the **single** text renderer, and retire the
> separate canvas-2D rendering path (`renderLabel` + `createMarkdownRenderer` drawing
> straight to a `CanvasRenderingContext2D`). Driven by a real divergence bug (below).
> Scope this as its own workstream — it is **orthogonal to the eric→SceneCanvas
> migration** and should be sequenced after it, not folded in.

## Why (the forcing bug)
The two backends disagreed on what `align:'center'` means and silently produced
different output:
- **canvas-2D** (`features/text/renderLabel.ts`) uses **anchor** semantics — `x` is the
  text's midpoint (`rx = x - w/2`, `ctx.textAlign='center'`).
- **GL/MSDF** (`features/text/atlas/layoutRuns.ts`) used **box** semantics — `align`
  only distributed slack inside a finite `maxWidth`, and was a silent no-op without
  one. Point-anchored center/right text just left-anchored at `x`.

Fixed 2026-06-14 by making `layoutRuns` anchor on the line's own width when
`maxWidth` is infinite (commit-free; see `layoutRuns.ts` `alignShift` + the
`anchors center/right…` test). That closed the immediate bug, but the **root smell
remains: two independent text engines** (layout, alignment, measurement) that can
drift again. This handoff is about collapsing them.

## Current state of the two paths

### GL/MSDF path (the keeper)
- `features/text/textCommand.ts` → `kind:'text'` DrawCommand → `renderer/draw.ts`
  `drawText` → `atlas/layoutRuns.ts` (atlas glyph advances/kerning, multi-run
  bold/italic, alignment, wrapping) → MSDF shader.
- Metrics come from the registered font atlas (`atlas/registerFont.ts`). No DOM.
- **New (2026-06-14):** `measureTextBounds(text, style?)` in
  `features/text/measureTextBounds.ts` — a thin `resolveTextStyle → resolveRuns →
  layoutRuns → bounds` wrapper so consumers can measure text the way it will render.
  (Added for eric to drop a `0.6×char` width heuristic.) This is the seed of the
  unified measurement API.

### Canvas-2D path (to retire)
- `features/text/renderLabel.ts` — pill + text via `ctx.fillText`/`ctx.textAlign`.
  **Exported from the barrel but called by no one for rendering** (only a type import
  in `markdownText.ts`). Effectively dead as a renderer; still public API.
- `features/text/markdownText.ts` (`createMarkdownRenderer`, `layoutMarkdown`) —
  markdown (bold/italic) layout + paint to a 2-D context.
- `features/text/measureText.ts` (`measureText(ctx, …)`) — 2-D `ctx.measureText`
  measurement. Consumed by `fitTextPose.ts`, `hitTest.ts`, and (indirectly) the
  text-editing path `useSceneTextEdit.ts`.

### The one real 2-D consumer: eric's packet tiles
`eric/src/components/collection/CultivarIconView.tsx` → `PacketCanvas` renders
cultivar "seed packet" tiles into a **per-tile DOM `<canvas>` 2-D context** (not GL,
not uploaded as a texture). It uses 2-D-only effects the MSDF pipeline does not have
today:
- `strokeText` + `fillText` outlined caps (species name)
- `shadowBlur` drop shadows
- `letterSpacing` to justify caps to tile width
- interleaved vector drawing (rounded taxonomy lozenge)
- `createMarkdownRenderer(ctx, …)` for italic variety/taxonomy

This is the real work behind "MSDF-only": these tiles must be reproducible by the
MSDF pipeline before the 2-D renderer can go.

## What MSDF needs to grow to absorb the 2-D path
1. **Outline / stroke** around glyphs. MSDF is *excellent* at this (threshold the
   distance field at two levels) — likely a shader-uniform addition + a style field.
2. **Drop shadow / glow.** Also natural for SDF (distance falloff); offset + soft edge.
3. **Letter-spacing.** Trivial: add a per-glyph advance delta in `layoutRuns`
   (`penX += e.advance + letterSpacing`). Add `letterSpacing?` to `TextStyle`.
4. **Offscreen raster → bitmap.** A way to render MSDF text/whole tiles to an
   offscreen GL target and read back an `ImageBitmap`/canvas, so `CultivarIconView`
   can keep showing a static `<canvas>`/`<img>` tile without a live GL element per
   tile. (Or: render tiles in a shared offscreen GL canvas and `toDataURL`/transfer.)
5. **Unified measurement.** Collapse `measureText` (2-D ctx) and `measureTextBounds`
   (atlas) into one atlas-based source of truth, and re-home `fitTextPose` / `hitTest`
   / text-edit caret math onto it (they currently use `ctx.measureText`). This kills
   the divergence class permanently — both rendering and hit-testing measure the same
   way.

## Suggested sequence
1. Add `letterSpacing` to `TextStyle` + `layoutRuns` (smallest, unlocks tile caps).
2. Add glyph outline + shadow to the MSDF style/shader.
3. Re-home `fitTextPose`/`hitTest`/text-edit onto atlas metrics; deprecate
   `measureText(ctx,…)` in favor of the unified measure.
4. Build offscreen MSDF raster-to-bitmap; port `CultivarIconView`/`PacketCanvas` to it.
5. Port any markdown rendering to multi-run MSDF text (`layoutRuns` already does
   bold/italic runs via `resolveRuns`), then remove `renderLabel` + `markdownText`'s
   2-D rendering from the barrel (breaking change → changeset + major-ish bump; check
   other consuming projects first).

## Acceptance
- Packet tiles render via MSDF with visual parity (outline, shadow, spacing, italic).
- One measurement function backs both rendering and hit-testing.
- `renderLabel`/`createMarkdownRenderer` 2-D *rendering* removed from public API (or
  re-expressed as thin wrappers over the offscreen MSDF raster).
- No `CanvasRenderingContext2D` text drawing left in the rendering path (debug
  overlay in `debug/createDebugOverlayLayer.ts` may stay — it's a debug-only 2-D
  surface; decide explicitly).

## Key files
- `src/features/text/atlas/layoutRuns.ts` (MSDF layout; align fix + measure live here)
- `src/features/text/measureTextBounds.ts` (new atlas measure)
- `src/features/text/renderLabel.ts`, `markdownText.ts`, `measureText.ts`,
  `fitTextPose.ts`, `hitTest.ts`, `useSceneTextEdit.ts` (2-D subsystem to retire/re-home)
- `src/renderer/draw.ts` `drawText`/`drawTextGroup` + the MSDF shader (outline/shadow)
- eric: `src/components/collection/CultivarIconView.tsx` (the 2-D tile consumer)
