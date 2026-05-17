# Registry unification — Phase 14 strategy overview

Dependency map for the final wave of registry-unification work. Each sub-phase has its own plan doc; this file captures sequencing.

## Sub-phase summary

- **14a** — Click descriptor (`clearSelection`) + `ClickSpec` target classification + Phase 13 carryforward (dep wiring, clientToWorld audit). Establishes the click migration pattern for other tools.

- **14b** — Fill the three Phase 7.5 stubs:
  - `lassoSelectAction` (needs dispatcher pointer-stream extension)
  - `editAnchorsAction` (needs multi-phase OngoingHandle)
  - `viewport.pinchZoom` (needs multi-touch pump)
  Each requires non-trivial dispatcher work; unblocks lasso/anchor/pinch tool migrations in 14d.

- **14c** — Migrate tools whose actions are already real. Splits by cluster:
  - **14c.1 shape-tools**: useRectTool, useEllipseTool, useLineTool, usePolygonTool, useStarTool, usePencilTool — all use `useInsert` pattern → `insertAction` binding with `params.kind`.
  - **14c.2 specialty**: useCloneTool (→ cloneAction binding), useHandTool (needs new drag-pan descriptor), useEyedropperTool (needs new color-pick descriptor), useTextTool (needs new text-edit descriptor).

- **14d** — Migrate stub-dependent tools (after 14b): useLassoTool, useEditAnchorsTool.

- **14e** — Full legacy deletion. Delete useMove/useResize/useRotate/useAreaSelect/useInsert/useClone/useLassoSelect/useEditAnchors hooks; useSelectTool's dead route entries; useKeybinding (singular); DispatcherPresenceProvider; withLegacyRunBridge; Action.run.

- **14f** — Cosmetic: rename `gestureBinding → defaultBinding` kit-wide; delete `Action.defaultBinding: KeyBinding`; final docs cleanup.

## Sequencing

```
                          ┌─── 14b stub fills ───┐
                          │                       │
14a ──────┐               │                       v
          ├──────► 14c ───┴───► 14d ───► 14e ───► 14f
14c.1 ────┤                                       
14c.2 ────┘
```

**Parallel-safe pairs:**
- 14a + 14c.1 (foreground + background; disjoint files: 14a touches dispatcher + useSelectTool; 14c.1 touches shape-tool files)
- 14b + 14c (after 14a lands; 14b touches dispatcher, 14c touches per-tool files — still disjoint)

**Strictly serial:**
- 14a must land before 14c.2 (clearSelection/ClickSpec patterns inform some click migrations)
- 14b must land before 14d (stubs must be real before lasso/anchor tools migrate)
- 14c + 14d must both land before 14e (all consumers must migrate before hooks delete)

**Cross-cutting conflict files:**
- `src/index.ts` (barrel) — every phase touches it
- `docs/TODO.md` — every phase updates the status block
- `src/interactions/actions/useStandardActions.ts` — descriptors get registered here

Merge conflicts in these files are textual and resolvable inline.

## Risk concentration

- **14b** is the biggest unknown: three dispatcher extensions for distinct gesture patterns. Each could surface architectural gaps.
- **14e** is bulk deletion; the risk is missing a consumer in the grep.
- **14f** is mechanical (large grep+replace) but touches every callsite of `gestureBinding` — needs careful tsc verification.

## Current state

Phase 14a + 14c.1 (shape-tools) are appropriate to start now in parallel.
