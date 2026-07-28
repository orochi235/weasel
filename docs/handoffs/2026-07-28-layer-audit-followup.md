# Layer-audit follow-up: what got fixed, what's left

Work against `docs/handoffs/2026-07-27-tool-gesture-duplication-audit.md`, on branch
`layer-audit` (branched from `main` at `270223f8`).

Gates: `tsc --noEmit` clean, `vitest run` 5317 passing / 4 skipped, 606 files.

---

## 1. Summary

Nine of the audit's thirteen findings are closed, plus the §4 cross-cutting bug. The
one structurally-large finding (§3.1 — two live dispatch pipelines) is partly done and
the remainder is now a P1 TODO entry, because its last blockers are the pen port's
open design question and the select tool's pointerDown classifier.

**The audit undersold the problem in one specific way.** It described the duplicate
paths as mostly-wasted work with a couple of derived risks. In practice, wherever two
paths existed, *the newer one was silently broken and the older one was carrying it*.
Every duplicate removed exposed a real defect underneath:

| Removed | What it was hiding |
| --- | --- |
| Shape tools' `useDragRect` bodies | Snap-to-grid did nothing for any insertion; the pencil's pressure/tilt capture never reached the scene; Shift-constrain and Alt-mirror for the line tool were dead |
| `useKeybindings`'s document keydown listener | `useKeybindings` was mounted **above** `<ActionsProviderIfRoot>`, so `tool.activate` / `tool.offhand` were never registered in any `<SceneCanvas>`; tool-shortcut modifier flags were written to the wrong field and could never match; multi-key aliases were truncated to the first key |
| Polygon/star `initial.keyDown` routes | `polygon.adjustSides` / `star.adjustPoints` were never registered either (same layering bug), so the documented wheel-during-drag adjustment was dead |
| `SceneCanvas`'s native `dblclick` listener | `onDoubleClick` had no test coverage at all |

Two further defects surfaced while testing the fixes: an axis-aligned line could never
be inserted (the commit guard rejected any zero-area AABB), and the insert preview and
the insert commit derived their geometry through separate code paths.

---

## 2. Closed

| Finding | Commit | Note |
| --- | --- | --- |
| 3.5 two `defineTool`s | `c39f0601` | identity helper deleted |
| 3.12 dead exported surface | `c39f0601` | `usePointerGestures`, `useNestedSelectTool`, the `ToolDebugOverlay` stack, `ToolsDispatcher.resolveOnly`/`getLastRoute`, `eligibleToolByCapabilities` |
| 3.2 dead shape-tool bodies | `b2a68f8e` | + snap dep, line modifiers, pencil pressure |
| 3.11 `useInsertTool` | `b2a68f8e` | deleted; `InsertDemo` repointed at `useRectTool` |
| 3.13 per-tool ceremony | `b2a68f8e` | folded into the deletion |
| 3.7 duplicated predicates | `0bbcf1a3` | the anchor regex was genuinely non-equivalent |
| 3.9 unread option surface | `0bbcf1a3` | + the whole dead `area-select/behaviors` tree |
| 3.3 three double-click detectors | `410795da` | one detector; `onDoubleClick` is an observer |
| 3.8 / 3.10 double-registered activation | `6e7ce053` | one path, eligibility enforced |
| §4 uncoordinated keydown fan-out | `672475c3` | **reproduced**, then fixed |
| 3.4 (interim) | `29e36764` | select classifier gated on `selectionAllowed` |

### Notable decisions

- **`onDoubleClick` is an observer, not an Action.** The audit suggested re-expressing
  it as a binding. That was tried and is wrong: the dispatcher is first-match-wins, so
  as a binding it loses to `enterPathEdit` on every body hit and silently stops firing.
  The new smoke tests caught it. It now observes the dispatcher's synthesized
  `doubleclick` — one detector, notification semantics preserved.

- **`ToolDef.actions` is a new seam.** Tool hooks must not call `useAction`: they run
  wherever the consumer calls them, which for `<SceneCanvas>` is above the
  `<ActionsProvider>`, where the registration silently no-ops. Tools declare the
  actions they own; `useToolActions` registers them from inside the provider.

- **`snap` is a dep, not a tool option.** `SnapDep` in `depSchema.ts`, sourced by
  `<SceneCanvas>` from `toolOptions.snapPoint`, applied by `insertAction` to the drag
  origin and current point. Freehand pencil samples are deliberately not snapped.

- **Stylus data rides the drag trail.** `PointerDownEvent` / `PointerMoveEvent` carry
  `pressure`/`tiltX`/`tiltY`; the dispatcher accumulates them as `DragSample[]` on
  `InvocationCtx.drag.points`. Mapping pressure to geometry is the consumer's call —
  `VertexWidthsDemo` does it in an `insertNodeFactories` entry.

### Behavior changes worth knowing

1. **Escape does one thing per press.** It is now a first-match-wins ladder: cancel
   gesture → exit path-edit → clear selection → return to default tool. Previously the
   tool reset fired *in parallel* with whatever the dispatcher did, because they were
   separate listeners.
2. **`mod` in tool keybindings is platform-aware.** meta on mac, ctrl elsewhere, other
   platform's key forbidden. The deleted `matchesKeyBinding` accepted meta OR ctrl
   everywhere, so Cmd+D used to fire on Windows.
3. **Ineligible tools are no longer reachable by shortcut.** The palette grey-out is a
   guarantee rather than a hint.
4. **`actions={null}` no longer implies an empty registry** — tool keybinding actions
   are gated by `enableKeybindings` instead.

---

## 3. Left open

- **§3.1 / §3.6 — retire the phase-table grammar.** Now a P1 entry in `docs/TODO.md`
  with the current inventory. Blocked on the pen port's scratch-selector decision
  (inspector handoff §4b) for the largest remaining table.

- **`useEyedropperTool` was NOT deleted.** The audit lists it as dead-but-tested and
  recommends removing it with the other six rows. It is a functioning public tool with
  real behavior, not duplicated machinery — deleting it is feature removal, not
  dead-code cleanup. Left in place deliberately; say the word if it should go.

- **apps/draw enters path-edit twice** — via `onDoubleClick` → `dispatchDoubleClickEntry`
  and via the kit's `enterPathEditAction`. They now at least agree on *when* a double
  click happened. Whether the app should keep both routes is an app-level question.

- **`docs/hooks.md` still documents deleted gesture hooks** (`useAreaSelect`,
  `useClone`, `useMove`, …). `docs/taxonomy.md` got the correction pass; `hooks.md`
  needs the same. Filed as P3.

---

## 4. Breaking changes for consumers

All of these were no-ops before removal, so nothing observable changes — but they are
source-breaking:

- `defineTool` from `@weasel-js/core` (use `@weasel-js/core/routing`)
- `useInsertTool`, `useNestedSelectTool`, `usePointerGestures`, `useToolDebugInfo`,
  `ToolDebugOverlay`, `formatRouteResolved`, `eligibleToolByCapabilities`
- `selectFromMarquee`, `UseAreaSelectOptions`, `AreaSelectBehavior`, and
  `<SceneCanvas selectTool={{ areaSelect }}>` — marquee is unconditional
- `UseSelectToolOptions`: `boundsOf`, `areaSelect`, `areaSelectOverlayStyle`,
  `moveOverlayStyle`, `drawGhost`, `getNode`, `getSelection`, `onDoubleTap`; the
  interface also drops its `TNode` type parameter
- `useRectTool` / `useEllipseTool` / `useLineTool` / `usePencilTool` / `useTextTool`
  now take no arguments
- `Tool.dblTap` / `DblTapChannel` / `ToolDef.dblTap` / dispatcher `dblTap` + `now` options
