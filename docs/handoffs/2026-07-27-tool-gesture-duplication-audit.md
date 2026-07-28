# Audit: duplication and unnecessary complexity in the tool / gesture / action / dispatch layers

Read-only audit, 2026-07-27, against `main` at `d5ce4cbb`. Scope: `packages/core/src/tools/`,
`packages/core/src/interactions/`, `packages/gestures/`, `packages/core/src/canvas/SceneCanvas*`,
`packages/core/src/features/chrome-caps/`.

**Excluded by instruction:** the pen-edit / `editAnchors` / path-edit implementation duplication
described in `docs/handoffs/2026-07-27-inspector-repairs-and-the-pen-port-question.md` §4a. Where a
finding below touches path-edit it is about a *different* axis (double-click detection, eligibility
gating) and says so.

Terminology follows `docs/taxonomy.md`: **gesture** = form of input, **action** = user-intent
operation, **interaction** = the binding of one to the other.

---

## 1. Summary

Most costly first.

- **Two complete pointer/keyboard event pipelines are attached to the same `<canvas>` element and
  neither knows about the other.** `<Canvas>` wires React pointer handlers + a document keydown
  listener into `tools.dispatcher`; `useGestureDispatcher` wires native listeners on the same
  element into the interactions `Dispatcher`. Every pointerdown, pointermove, pointerup, wheel, and
  keydown is processed twice, by two independent state machines, with independently-defined
  thresholds. This is the root cause of most findings below.

- **Three different definitions of "double click" are simultaneously live**, at 300 ms/8 px, 600 ms/8 px,
  and whatever the OS says. A double-click at ~400 ms fires two of the three.

- **Three uncoordinated `keydown` listeners**, none of which suppress the others. With the polygon
  tool active and a non-empty selection, `ArrowUp` both increments the polygon's side count (tool
  phase-table route) *and* nudges the selection (`nudge.up` action). I did not observe this in a
  browser — it is derived from the code paths cited in §4.1 — but no mechanism exists that would
  prevent it.

- **Four built-in shape tools (`rect`, `ellipse`, `line`, `pencil`) each carry a complete, fully
  dead legacy body** — a `useDragRect`/sample-capture gesture, a live-preview overlay layer, and a
  commit path — behind refs that are declared and never assigned. ~250 lines total. The user-visible
  consequence: `apps/draw`'s snap-to-grid toggle silently does nothing when drawing a rect, ellipse,
  or line, because the only code that consumed `snapPoint` for those tools is on the dead path.

- **`CLAUDE.md` names `useRectTool.ts` as the canonical reference implementation for tools that
  create scene objects. Everything it points at (`useDragRect` → `ctx.applyBatch([createInsertOp])`)
  is on that dead path.** Anyone following the reference writes a tool that does nothing.

- **Tool routes are never eligibility-filtered; Action bindings are.** `filterEligible` runs only in
  the interactions dispatcher. Concretely: in `path-edit` mode, `useSelectTool`'s phase-table
  pointerDown classifier still mutates the selection, while the same tool's `clearSelection` binding
  is correctly gated off. One tool, two behaviors, split by which dispatch system the route lives in.

- **Two different functions named `defineTool` are exported from the same package barrel** — an
  18-line identity helper (`@weasel-js/core`) and the 348-line declarative translator
  (`@weasel-js/core/routing`, also reachable as `routing.defineTool`). The identity one has no
  non-test caller.

- **Three built-ins bypass `defineTool`'s def and append to the returned `Tool`** — `select`
  (bindings), `hand` (bindings), `rotate` (overlay). The handoff records that this pattern already
  cost the Bundle Inspector eight invisible routes. It is not one tool's quirk.

- **Two independent target/modifier matching engines** with incompatible modifier vocabularies. The
  incompatibility already produced a shipped bug (the inspector's blank source column) and required
  a dedicated bridging module (`reflection/modifierComboToParsed.ts`) to paper over.

- **Tool activation is registered twice** — as a raw document keydown listener and as the
  `tool.activate` Action — and neither honors the capability eligibility the ToolPalette greys tools
  out for.

---

## 2. The two dispatch systems

### What each owns

| | Tool routing (older) | Bindings → Action (newer) |
| --- | --- | --- |
| Entry point | `tools/dispatcher.ts` `createToolsDispatcher` | `interactions/dispatcher/dispatcher.ts` `createDispatcher` |
| Mounted by | `<Canvas>` — React `onPointerDown/Move/Up` (`Canvas.tsx:1573-1575`), native `wheel` (`Canvas.tsx:1315`), document `keydown`/`keyup` (`Canvas.tsx:1171`) | `useGestureDispatcher` — native listeners on the same canvas (`useGestureDispatcher.tsx:966-986`) |
| Authored as | `ToolDef.initial` / `.engaged` phase tables (`pointerDown`, `click`, `dblTap`, `drag`, `keyDown`, `keyUp`, `wheel`), keyed by hit-kind strings | `Tool.bindings: GestureBinding[]` + `Action.defaultBinding`, keyed by `GestureSpec` objects |
| Matching | `routing/lookup.ts` — 4-level key precedence (`kind` → `*:sub` → `base` → `*`), modifier sub-tables keyed by canonical combo strings, exact match + `default` | `dispatcher/matcher.ts` + `@weasel-js/gestures` — scope priority (hotkey > active > ambient), then CSS-style specificity tuples, then registration order |
| Fall-through | None. First matched key wins; a returning `none()` passes to the next *slot*, not the next route. | Specificity-ordered, with `enabled()` and empty-handle fall-through to the next candidate. |
| Eligibility | **None.** Zero references to `chrome-caps` / `RuleCtx` / `evaluate` anywhere under `packages/core/src/tools/`. | `filterEligible` against `Action.eligible` (`dispatcher.ts:696-708`), when the consumer wires `getRuleCtx` (`SceneCanvas.tsx:1809`, only when `getActiveMode` is passed). |
| Introspection | `buildActionRegistry` / `findConflicts` (walks `ToolDef` phases only — blind to `Tool.bindings`) | `ActionsRegistry.list()`, `Dispatcher.resolveOnly`, dev trace log |
| Overlays | `useTools.getActiveOverlays()` → `Tool.overlay` | `useDispatcherOverlayLayer` (`OngoingHandle.overlay()`) + `usePreviewGhostLayer` (`previewIds`/`previewPose`) |

### Where they overlap

Both systems see **every** pointer, wheel, and key event. There is no arbitration: the tools
dispatcher's `'claim'` return value never reaches the DOM as `preventDefault`/`stopPropagation`
(`Canvas.tsx:1169`, `Canvas.tsx:1257-1295`), and the interactions dispatcher's `'handled'` return
only preventDefaults for wheel and key (`useGestureDispatcher.tsx:411-413, 460-463`) — after the
tools dispatcher has already run.

Per-channel state:

| Channel | Tool routing | Bindings→Action | Coordinated? |
| --- | --- | --- | --- |
| drag threshold | 4 px (`tools/dispatcher.ts:319`) | 4 px (`useGestureDispatcher.tsx:328`) | No — two constants that happen to agree |
| double-tap window | 300 ms / 8 px (`tools/dispatcher.ts:321-322`) | 600 ms / 8 px (`useGestureDispatcher.tsx:355-356`) | No — and they disagree |
| click synthesis | sub-threshold pointerup → `pointer.onClick` (`tools/dispatcher.ts:613-636`) | no-drag-handle pointerup → `kind: 'click'` (`useGestureDispatcher.tsx:804-817`) | No |
| affordance hit-test | layer walk via `getHitTestContext` (`tools/dispatcher.ts:455-474`) | `affordanceAt` thunk (`useGestureDispatcher.tsx:500`) | No — two hit-test entry points |
| tool activation | document keydown (`useKeybindings.ts:119`) | `tool.activate` Action key bindings (`useKeybindings.ts:188`) | No |

The clean division that *does* exist: after the pen tool, only `select`, `polygon`, `star`, and
`hand`/viewport tools still declare phase-table routes at all, and those routes are now narrow
(a pointerDown classifier, click sub-tables, side/point-count arrow keys). Everything that mutates
the scene has moved to Actions. The tool-routing pipeline is therefore carrying its full event
machinery — threshold gating, double-tap synthesis, click synthesis, layer hit-testing, slot walk —
to serve a handful of surviving routes.

---

## 3. Findings

### 3.1 Two live pointer/keyboard pipelines on the same element — LARGE

**What.** `<Canvas>` and `useGestureDispatcher` each attach a full input state machine to the same
`<canvas>`, with independently-defined thresholds and synthesis rules.

**Evidence, tool side:**
- `packages/core/src/canvas/Canvas.tsx:1573-1575` — React `onPointerDown`/`Move`/`Up` on the canvas element.
- `packages/core/src/canvas/Canvas.tsx:1257`, `:1269`, `:1295` — those handlers call `tools.dispatcher.onPointerDown/Move/Up`.
- `packages/core/src/canvas/Canvas.tsx:1246-1248` — document-level `pointermove`/`pointerup`/`pointercancel` backstop.
- `packages/core/src/canvas/Canvas.tsx:1315-1316` — native non-passive `wheel` → `tools.dispatcher.onWheel`.
- `packages/core/src/canvas/Canvas.tsx:1171-1172` — document `keydown`/`keyup` → `tools.dispatcher`.

**Evidence, action side:**
- `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:976-981` — native `wheel`, `pointerdown`, `pointermove`, `pointerup`, `pointercancel` on the same canvas.
- `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:967-968` — window `keydown`/`keyup`.

**Reachability:** live in every `<SceneCanvas>`. `SceneCanvas.tsx` mounts both unconditionally
(`useGestureDispatcher` is gated only by an `enabled` flag that defaults true).

**Cost.** Every derived finding in this report (3.2, 3.3, 3.6) is downstream of this. Concretely
today it costs three incompatible double-click definitions and an unarbitrated keydown fan-out.
It also doubles the per-event work: two hit-tests, two modifier extractions, two coordinate
conversions per pointerdown.

**Recommendation.** The structural fix is to make one pipeline the DOM owner and have the other
consume normalized events from it. The interactions dispatcher is the better owner: it already has
world-coordinate conversion, affordance classification, body-target classification, eligibility
filtering, and specificity fall-through. `tools.dispatcher` would become a consumer of the same
`InputEvent` stream rather than a second listener set. **Large** — but see 3.2: much of what the
tool pipeline still serves is dead, so the surviving route surface it has to keep working for is
small (select's pointerDown classifier + click sub-tables, polygon/star arrow keys, pen).

---

### 3.2 Four shape tools carry a fully dead legacy body — MEDIUM, and it hides a live bug

**What.** `rect`, `ellipse`, `line`, and `pencil` each keep their pre-dispatcher gesture, live
preview overlay, and commit path. All four are unreachable: the ref that gates the commit is never
assigned, and the state the overlay reads is never written.

**Evidence — `rect`** (`packages/core/src/tools/builtin/rect/useRectTool.ts`):
- `:52` `const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);` — the only other reference is the read at `:62`. It is never assigned anywhere in the file, so `onEnd` at `:61-68` always returns `false`.
- `:58-69` the `useDragRect` gesture. Nothing calls `dr.start/move/end` — the tool declares no `drag` route (`initial:` at `:112-114` contains only `overlay`).
- `:74-86` the overlay reads `drRef.current.overlay`, which stays `null` because the gesture never starts.
- `:102-111` the live path: a single binding → `insertAction` with `params: { kind: 'rect' }`.

**Evidence — `ellipse`** (`useEllipseTool.tsx`): same shape — `applyOpsRef` at `:56` never assigned, `useDragRect` at `:62-75`, dead overlay at `:79-125`, live binding at `:141-149`.

**Evidence — `line`** (`useLineTool.tsx`): `writeState` (`:78-81`) is referenced only in the `useMemo` dependency array at `:144` — never called. `lineStateRef.current` therefore stays `null` and the overlay at `:85-117` always returns `[]`. Live path is the binding at `:133-139`.

**Evidence — `pencil`** (`usePencilTool.tsx`): `samplesRef` (`:85`) and `forceRenderRef` (`:87-88`) are never written or invoked; the overlay at `:90-114` always returns `[]`. Live path is the binding at `:130-136`.

**Reachability of the *consumers* of the dead surface:**
- `packages/core/src/canvas/SceneCanvas/useBuiltinShapeTools.tsx:101-154` still passes `create` factories to rect / ellipse / line / pencil and `snapPoint` to rect / ellipse / line.
- `apps/draw/src/App.tsx:1428-1433` passes `toolOptions={{ snapPoint }}` when the snap-to-grid toggle is on.
- `packages/core/src/canvas/deps/insert.ts` is what actually mints the nodes (`case 'rect'` at `:106`, `'ellipse'` `:114`, `'line'` `:117`, `'pencil'` `:154`, `'text'` `:182`). `insertAction` has no snap support at all — the only `snap` mention in `defaults/insert.ts` is `:25`, "deferred to a later phase."

**The live bug this hides.** `apps/draw`'s snap-to-grid affects select-drag (`selectTool={{ snap }}`,
`App.tsx:1427`) and pen (`usePenTool.ts:356, 538, 549, 564, 650` — pen is still on the phase table,
so its `snapPoint` genuinely works), but **not** rect, ellipse, line, polygon, star, or pencil
insertion. The `useBuiltinShapeTools.tsx:38-43` doc comment states the opposite: "Applied by the
rect / ellipse / line tools to every coord they ingest, so both the live overlay and the committed
geometry use snapped values."

**Second cost.** `/Users/mike/src/weasel/CLAUDE.md` under "Reference implementations" names
`useRectTool.ts` as "canonical pattern for tools that create scene objects: drag gesture via
`useDragRect`, undoable commit via `ctx.applyBatch([createInsertOp(...)])`. The `create` factory
lives on the tool." All three clauses describe the dead path.

**Recommendation.** Delete the dead bodies (roughly 250 lines across the four files) plus the now-
consumer-less `create` / `overlayStyle` / `minBounds` / `tolerance` / `closeThreshold` option fields
and the factories in `useBuiltinShapeTools.tsx`. Polygon and star already did this
(`useBuiltinShapeTools.tsx:128-133` explains why). Then decide `snapPoint` deliberately: either
give `insertAction` a snap hook, or drop `snapPoint` from `BuiltinToolOptions` and fix the comment.
Breaking change to `UseRectToolOptions`/`UseEllipseToolOptions`/`UseLineToolOptions`/
`UsePencilToolOptions`, but the fields are already no-ops. **Medium** for the deletion; the snap
decision is **small** if you drop it, **medium** if you wire it.

---

### 3.3 Three double-click detectors, three definitions — MEDIUM

**What.** Three independent double-click implementations, each feeding a different consumer.

**Evidence:**
1. `packages/core/src/tools/dispatcher.ts:321-322` — `dblTapWindowMs = 300`, `dblTapMaxDistance = 8`. Fires `Tool.dblTap.onTap`. Consumed by `useSelectTool.ts:305-307` → `forwardDblTap` → the consumer's `onDoubleTap` option.
2. `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:355-356` — `DOUBLE_CLICK_MAX_MS = 600`, `DOUBLE_CLICK_MAX_PX = 8`. Synthesizes `kind: 'doubleclick'` at `:828-841`. Consumed by `enterPathEditAction` (`defaults/enterPathEdit.ts:27-30`) and `enterTextEditAction` (`defaults/enterTextEdit.ts`), both registered in `useStandardActions.ts:146, 153`.
3. `packages/core/src/canvas/SceneCanvas.tsx:1229` — a raw native `dblclick` DOM listener, browser/OS timing. Fires the `onDoubleClick` prop.

**Reachability:** all three live in `apps/draw`. `App.tsx:1466` passes `onDoubleClick`, which routes
to `dispatchDoubleClickEntry` (`apps/draw/src/modality/doubleClickEntry.ts:8-25`) and calls
`machine.enterMode('path-edit' | 'isolation' | 'text-edit')`. Detector 2's `enterPathEditAction` is
registered by `<SceneCanvas>` unconditionally.

**Cost.** Two separate double-click → enter-path-edit implementations run on two different
detectors, and they disagree on the target: `enterPathEditAction` reads `selection.get()`
(`defaults/enterPathEdit.ts:38`), while `dispatchDoubleClickEntry` uses the hit id directly. A
double-click at ~400 ms fires detectors 2 and 3 but not 1; at ~250 ms it fires all three. Which
double-click behaviors a consumer gets depends on the millisecond gap, which is not something a
consumer can reason about.

(This is the *detection* axis, not the pen-edit-vs-editAnchors implementation duplication excluded
by the brief.)

**Recommendation.** Collapse to one. The interactions dispatcher's synthesized `doubleclick` is the
right one to keep — it carries `bodyTarget` and goes through eligibility. Remove
`tools/dispatcher.ts`'s dblTap machinery and `SceneCanvas`'s native listener; re-express
`onDoubleClick` as a consumer-registered Action bound to `{ kind: 'doubleClick' }`. **Medium.**

---

### 3.4 Tool routes are never eligibility-filtered — MEDIUM

**What.** `Action.eligible` is evaluated only on the Action side. Tool phase-table routes bypass
the mode/capability system entirely.

**Evidence (action side):** `interactions/dispatcher/dispatcher.ts:182-192` (`filterEligible`),
called at `:701-704` in `handleInput` and `:867-870` in `resolveOnly`, gated on `ctx.getRuleCtx`.

**Evidence (tool side):** `grep -rn "chrome-caps\|RuleCtx\|eligible\|evaluate(" packages/core/src/tools`
returns four hits, all of them prose in doc comments (`tools/types.ts:111,145,148`,
`tools/useTools.ts:12`). There is no rule evaluation anywhere in the tool-routing path.

**Concrete divergence inside one tool.** In `path-edit` mode (`packages/modes/src/presets/default.ts`
— `PATH_EDIT.allows = ['edits-anchors']`, nothing else):
- `useSelectTool.ts:291-293` routes pointerDown `'*'` to `pointerDownBody`, which calls
  `ctx.selection.applyClick(top, ctx.modifiers)` at `:234`. Ungated — the selection changes.
- `useSelectTool.ts:409` binds click-on-empty to `clearSelection`, whose
  `eligible: { capability: 'creates-selection' }` (`defaults/clearSelection.ts:40`) is **false** in
  path-edit. The selection does not clear.

So while editing anchors, clicking a shape re-selects it but clicking empty canvas does nothing.
Same tool, same gesture family, opposite gating — determined solely by which dispatch system the
route happens to live in.

`apps/draw` is the only consumer that wires `getActiveMode` (`App.tsx:1200`), so it is the only one
where any of this is observable — but it is also the only consumer with modes.

**Recommendation.** Two options. (a) Give `createToolsDispatcher` a `getRuleCtx` and require phase
routes to declare eligibility — this duplicates the rule machinery into the second system and I'd
argue against it. (b) Port the remaining phase-table routes to bindings so eligibility applies
uniformly — that's the same direction §4b of the pen handoff is already headed, and it needs the
scratch-selector decision made there. In the interim, `useSelectTool`'s pointerDown classifier
specifically should consult eligibility (it is the one ungated route that mutates persistent state).
**Small** for the select-specific patch; **large** for (b).

---

### 3.5 Two exported functions named `defineTool` — SMALL, high trap value

**What.** `@weasel-js/core` exports an 18-line identity helper named `defineTool`;
`@weasel-js/core/routing` (and `routing.defineTool` off the same barrel) exports the 348-line
declarative translator with the same name.

**Evidence:**
- `packages/core/src/tools/defineTool.ts:15-19` — identity. Re-exported at `tools/index.ts:1`, which reaches the barrel via `packages/core/src/index.ts:233` (`export * from './tools'`).
- `packages/core/src/tools/routing/defineTool.ts:39` — declarative. Re-exported at `tools/routing/index.ts:20`, reaching the barrel at `packages/core/src/index.ts:235` (`export * as routing`) and the `./routing` subpath (`packages/core/package.json:63-66`, `tsup.config.ts:13`).

**Reachability of the identity helper:** two callers, both tests —
`packages/core/src/tools/defineTool.test.ts:3` and
`packages/core/src/tools/builtin/eyedropper/useEyedropperTool.integration.test.ts:13`. Every
production tool imports the declarative one. **Dead-but-tested.**

**Cost.** `import { defineTool } from '@weasel-js/core'` compiles, type-checks, and produces a
`Tool` with no routes, no bindings, no cursor resolution, and no `def` for the inspector to read.
The name collision means the failure mode is silence, not an error.

**Recommendation.** Delete `packages/core/src/tools/defineTool.ts` and its test; drop the export
from `tools/index.ts`. Breaking for anyone importing it from the root barrel — nobody in-tree does.
**Small.**

---

### 3.6 Two matching engines with incompatible modifier vocabularies — MEDIUM

**What.** Route resolution is implemented twice, on different data models.

**Evidence:**
- `packages/core/src/tools/routing/lookup.ts:22-73` — `resolveRoute(table, hit, modifiers)`. Candidate keys built at `:38-50` (`kind` → `*:sub` → `base` → `*`); modifiers collapsed to a single canonical combo string at `:65-73` and matched exactly against a sub-table, falling back to `default`.
- `packages/core/src/interactions/dispatcher/matcher.ts:72-160` — `matchSorted`. Targets are `TargetSpec` values (string classes or `kindOf` predicates); modifiers are a per-key `ModSpec` tri-state (`true` = required, `'optional'`, absent = must-not-be-held); precedence is a 4-tuple specificity compare at `:72-99`.

The two modifier models are not isomorphic: `lookup.ts` can express "exactly Shift and nothing else"
(one combo string) but cannot express "Shift required, Alt optional"; `ModSpec` can express both but
has no notion of a canonical combo key.

**Cost, already paid.** From
`docs/handoffs/2026-07-27-inspector-repairs-and-the-pen-port-question.md` §1: "the route→handler
lookup built candidate labels with `canonicalModifiers(...)`, which emits `shift=required`.
Sub-tables are keyed with `mods('shift')`, which is `shift`. **These never matched**, so every
modifier-variant route showed a blank source." The bridging module that exists purely to translate
between the two vocabularies is `packages/core/src/tools/routing/reflection/modifierComboToParsed.ts`
(a one-line re-export of `modifierComboToParsed` / `canonicalModifiers` from `@weasel-js/gestures`).

Same handoff, §1b: the v3 route grammar "has no notation for a `{ kindOf }` predicate target," so
three distinct select routes all render as `[*] drag => predicate`. The tool-route grammar cannot
describe what the binding grammar expresses — that is the same gap seen from the reflection side.

**Recommendation.** Don't try to unify the grammars in place. The tool-route grammar is the one with
fewer remaining consumers; retiring it (3.4 recommendation (b)) removes both the second engine and
its bridge. **Large**, and blocked on the same scratch-selector decision as the pen port.

---

### 3.7 `predicates.ts` claims to be the single source of truth and is bypassed by the biggest consumer — SMALL

**What.** `interactions/dispatcher/predicates.ts` opens with: "Single source of truth for 'what does
this affordance kind mean' … Drift prevention." `useSelectTool` re-implements three of its
predicates inline, and one of the three is not equivalent.

**Evidence:**

| Shared predicate | `useSelectTool` inline copy |
| --- | --- |
| `isResizeHandle` — `predicates.ts:46-49` (`k.startsWith('handle:')`) | `useSelectTool.ts:341-345` (same logic, hand-rolled) |
| `isRotateHandle` — `predicates.ts:52-53` (`k === 'rotate-handle'`) | `useSelectTool.ts:353-355` (same logic, hand-rolled) |
| `isAnchorOrControl` — `predicates.ts:63-64`, built from `isAnchor` (`/^anchor:\d+$/`) and `isControlHandle` (`/^(controlIn\|controlOut):\d+$/`) | `useSelectTool.ts:384` — `/^(anchor\|controlIn\|controlOut):/`. **No trailing-index requirement and unanchored at the end.** |

**Reachability:** `predicates.ts` has exactly two importers —
`defaults/enterPathEdit.ts:17` (`isBody`) and `defaults/editAnchors.ts:28,115` (`isAnchorOrControl`).
`useSelectTool` is the only other place these shapes are tested and it imports none of them.

**Cost.** `editAnchors`'s ambient binding and `move`'s active binding are deliberately designed to
agree on what counts as an anchor hit (`useSelectTool.ts:370-375` explains that the move binding must
opt out precisely where editAnchors would win). They currently use two different regexes to decide.
Any affordance kind matching `anchor:` without a numeric index — or with a suffix after one —
classifies differently on the two sides, and the failure mode is "move steals the anchor drag,"
which is exactly the bug the opt-out exists to prevent.

**Recommendation.** Import `isResizeHandle` / `isRotateHandle` / `isAnchorOrControl` in
`useSelectTool` and delete the inline copies. **Small.**

---

### 3.8 Tool activation is registered twice — SMALL

**What.** `useKeybindings` wires the same behavior through both dispatch systems.

**Evidence:**
- `packages/core/src/tools/useKeybindings.ts:71-123` — a document `keydown` listener that resolves a key to a tool id via `matchesKeyBinding` and calls `toolsRef.current.setActive(...)` at `:107` / `:115`. The comment at `:68-70` calls this "the authoritative path."
- `packages/core/src/tools/useKeybindings.ts:159-190` — registers the consolidated `tool.activate` Action, whose `defaultBinding[]` carries one `{ kind: 'key' }` spec per tool (`defaults/toolActivate.ts:30-43`) and whose invoker calls `activeTool.setActive(toolId)` (`toolActivate.ts:53-58`).

**Reachability:** both live. `SceneCanvas.tsx` calls `useKeybindings` and mounts
`useGestureDispatcher` with `keyboard: true`. Pressing `R` runs both paths.

**Cost.** The duplicate `setActive` is idempotent, so it is not visibly broken. What it costs:
1. **Eligibility is unenforceable.** `Tool.capabilities` greys ineligible tools in the ToolPalette
   (see 3.10), but neither activation path checks it. Even adding `eligible` to `tool.activate`
   would not help, because the document listener bypasses the Action registry entirely.
2. Two key-matching implementations (`matchesKeyBinding` vs the gesture matcher) with different
   modifier semantics decide the same question.
3. The `resolveSwitch` loop (`:79-93`) reads `Tool.keybinding` from the registry while
   `buildToolActivateBindings` reads the same field and flattens array keys to `key[0]`
   (`useKeybindings.ts:180`). A tool with a multi-key alias activates via path 1 on all of its keys
   and via path 2 on only the first.

**Recommendation.** Delete the document listener; make `tool.activate` the only path, and add
`eligible` to it. The listener's stated justification — "tests and consumers that mount Canvas
without a full SceneCanvas stack" — is a test-harness concern, addressable by having those harnesses
mount an `<ActionsProvider>`. Escape-returns-to-default (`:102-110`) needs a home too; it is
arguably already `escapeAction`'s job. **Small-to-medium.**

---

### 3.9 Declared-but-unconsumed option surface — SMALL each, but consumers are actively misled

**`UseSelectToolOptions` — 7 of 14 fields are never read.**

Read: `pickEvery` (`:143`), `pickBest` (`:222`), `poseBounds` (`:142`), `move.behaviors` (`:318`),
`reparentOnDrop` (`:315`), `onDoubleTap` (`:136`), `debug` (dependency array only, `:414`).

Never read anywhere in the file: `boundsOf` (`:56`), `areaSelect` (`:66`),
`areaSelectOverlayStyle` (`:74`), `moveOverlayStyle` (`:77`), `drawGhost` (`:82`), `getNode` (`:88`),
`getSelection` (`:90`).

**Consumers still pass them:**
- `apps/site/demos/MultiSelectDemo.tsx:38,41` — passes `getSelection` and `areaSelect: { behaviors: [selectFromMarquee()] }`, with the comment "Marquee is opt-in at the kit level — restored here because the demo's whole point is multi-selection." It is not opt-in and this does nothing; the marquee works because of the unconditional `areaSelect` binding at `useSelectTool.ts:408`.
- `apps/site/demos/AnimationDemo.tsx:141` — passes a `drawGhost` implementation.
- `apps/site/demos/PointSnapDemo.tsx:67-69` — passes `boundsOf` and `getSelection`.
- `apps/site/demos/BezierEditDemo.tsx:218` — passes `areaSelect: { behaviors: [...] }`.

Per `CLAUDE.md`'s demo conventions ("terse and single-purpose … if a demo accumulates code that
isn't directly pertinent"), four demos carrying inert wiring is exactly the signal that convention
describes.

**`useTextTool`** (`useTextTool.ts:34-35`) takes `_options` and reads nothing; `:30-32` documents
`pointInsert`, `hitExisting`, `marqueeStyle`, `minBounds` as "currently ignored." Yet
`useBuiltinShapeTools.tsx:211-215` constructs a full `pointInsert` factory to hand it.

**`useInsertTool`** (`useInsertTool.ts:38-41`) takes `_adapter` and `_options` and reads neither.

**Recommendation.** Delete the unread fields and the demo/SceneCanvas code that supplies them.
Breaking, but every removed field is already a no-op — nothing observable changes. **Small.**

---

### 3.10 `Tool.capabilities` gates the palette, never dispatch — SMALL

The brief's premise needs one correction: `Tool.capabilities` **is** consumed outside the inspector,
but only for greying palette buttons.

**Evidence:**
- Declared: `tools/types.ts:151`, `tools/routing/types.ts:129`. Forwarded: `routing/defineTool.ts:283`, `routing/defineViewportTool.ts:25`.
- Consumed: `packages/ui/src/components/ToolPalette/ToolPalette.tsx:148` → `eligibleTool` (`packages/modes/src/eligibility.ts:12`) → `eligibleForMode` (`packages/modes/src/modeDefinition.ts:24`). Wired in `apps/draw/src/App.tsx:1394` (`modeRegistry={modality.machine.registry}`).
- Not consumed anywhere in either dispatcher (see 3.4's grep) or in `useTools.setActive` (`useTools.ts:173-183` checks registry membership only).
- The inspector's `capabilities` column is a *different, derived* object — `apps/draw/src/dev/registryProbe.tsx:144-149` builds `{ initScratch, onActivate, onDeactivate, hitOverride }` booleans, unrelated to `Tool.capabilities`.

**Cost.** In `text-edit` mode the palette greys the pen button, but `P` still activates pen
(3.8: neither activation path checks eligibility), and once active pen's phase-table routes run
unfiltered (3.4). The capability declaration therefore describes an intent the runtime does not
enforce — it is a visual hint only.

**Also dead:** `eligibleToolByCapabilities` (`packages/modes/src/eligibility.ts:18-23`) — exported at
`packages/modes/src/index.ts:10`, called only by `packages/modes/src/eligibility.test.ts`. Its
docstring proposes a palette-preview use case that does not exist.

**Recommendation.** Make `tool.activate` honor eligibility (folds into 3.8), which turns the palette
grey-out from a hint into a guarantee. Delete `eligibleToolByCapabilities` or build the preview it
was written for. **Small.**

---

### 3.11 `useInsertTool` is a duplicate of `useRectTool`'s live half — SMALL

**Evidence:**
- `packages/core/src/tools/builtin/insert/useInsertTool.ts:44-52` — `id: 'insert'`, `cursor: 'crosshair'`, `presentation` = `{ label: 'Rectangle', icon: RectIcon, group: 'shape' }` (`:19-23`), one binding `{ kind: 'drag' } → insert` with `params: { kind: 'rect' }`, empty `initial`.
- `packages/core/src/tools/builtin/rect/useRectTool.ts:90-115` — `id: 'rect'`, `cursor: 'crosshair'`, same presentation label/icon/group, the same single binding.

Modulo the tool id and the dead body (3.2), they are the same tool.

**Reachability:** `useInsertTool` has exactly one caller, `apps/site/demos/InsertDemo.tsx:38`. It is
not in `BUNDLE_TOOLS` (`SceneCanvas.tsx:254-262`) or `KNOWN_BUILTIN_IDS` (`SceneCanvas.tsx:1073-1076`).

**Recommendation.** Delete `useInsertTool` and repoint `InsertDemo` at `useRectTool` — or delete the
demo, since `SceneCanvas`'s default bundles already demonstrate insert. **Small.** Breaking for the
barrel export; no in-tree consumer besides the demo.

---

### 3.12 Dead exported surface — SMALL

Each verified by grepping `packages/` and `apps/` for call sites, excluding `dist/` and the symbol's
own tests.

| Symbol | Declared | Verdict |
| --- | --- | --- |
| `useEyedropperTool` | exported `tools/builtin/index.ts:41`, and thence the root barrel | **Dead-but-tested.** Only call sites are its own two tests plus a smoke instantiation in `tools/builtin/capabilities.test.ts:43`. No demo, no app, not in `BUNDLE_TOOLS`. |
| `usePointerGestures` | exported `packages/core/src/index.ts:230` | **Dead-but-tested.** Only caller is `usePointerGestures.test.ts`. `Canvas.test.tsx:507` mentions it in a test name only. `docs/taxonomy.md` §4 still documents it as "the pre-Tool-primitive entry point." |
| `ToolsDispatcher.resolveOnly` | `tools/dispatcher.ts:208`, impl `:297-316` + `:716-731` | **Dead-but-tested.** Only caller is `dispatcher.resolveOnly.test.ts`. Duplicates the *live* `Dispatcher.resolveOnly` (`interactions/dispatcher/dispatcher.ts:860`), which the hover-cursor pump uses at `useGestureDispatcher.tsx:684`. Two same-named prediction APIs; one has a consumer. |
| `ToolsDispatcher.getLastRoute` | `tools/dispatcher.ts:199` | **Dead.** Only consumer is `useToolDebugInfo`, itself dead (next row). |
| `useToolDebugInfo`, `ToolDebugOverlay`, `formatRouteResolved` | `routing/reflection/index.ts:8-10`, 145 lines across three files | **Dead.** No consumer under `apps/` or `packages/` outside their own tests. `apps/draw` built its own inspector (`apps/draw/src/dev/`) instead. |
| `useNestedSelectTool` | `tools/builtin/index.ts:12-15` | **Dead.** No caller anywhere, including tests. |
| `eligibleToolByCapabilities` | `packages/modes/src/index.ts:10` | **Dead-but-tested** (see 3.10). |

**Correction to a plausible-sounding claim I checked and rejected:** `buildActionRegistry` and
`findConflicts` (`routing/reflection/registry.ts:31`, `conflicts.ts:34`) are **live** —
`apps/draw/src/dev/ToolkitBuilder.tsx:144-145`, `apps/draw/src/dev/registryProbe.tsx:239`, and
`apps/site/demos/ToolReflectionDemo.tsx:49-50`. They belong in the reflection stack, not the dead
list.

**Recommendation.** Delete the seven rows above. **Small.** One naming note worth folding into any
touch of `registry.ts`: `buildActionRegistry` builds *route* entries from `ToolDef` phase tables
(`registry.ts:31-39`) and has nothing to do with the Actions Registry
(`interactions/actions/registry.tsx`) — it also cannot see `Tool.bindings`, which is precisely the
inspector bug from handoff §1a. `buildRouteRegistry` would say what it does and stop colliding with
the Action layer's vocabulary.

---

### 3.13 Per-tool ceremony — SMALL

Not a bug; quantified so the deletion work in 3.2 can be scoped.

- 33 `xRef.current = x` mirror assignments across 11 files under `packages/core/src/tools/builtin/`
  (`rotate`, `pinchZoom`, `polygon`, `pen`, `rect`, `ellipse`, `star`, `select`, `line`, `eyedropper`,
  `pencil`). A large fraction — every mirror in `rect`, `ellipse`, `line`, `pencil` — exists only to
  feed the dead paths in 3.2 and disappears with them.
- `usePenTool.ts:269-270` mirrors an entire 8-field options object twice per render.
- `useRotateTool.ts:106-115` declares `ghostOverlay`, a 10-line `RenderLayer` whose `draw` returns
  `[]` unconditionally ("structural placeholder retained so the tool's overlay shape is stable"),
  then spreads it into the combined overlay at `:129`.
- Three `useReducer((n) => n + 1, 0)` force-render bumps (`usePencilTool.tsx:86` — dead;
  `useDispatcherOverlayLayer.ts:63` and `usePreviewGhostLayer.ts:63` — live and driven by
  `dispatcher.subscribe`).

**Recommendation.** Fold into 3.2's deletion. Nothing here justifies a standalone refactor.

---

## 4. Cross-cutting observation: uncoordinated keydown fan-out

Worth calling out separately because it is the one place the two-pipeline problem is likely to be
producing wrong behavior today rather than just wasted work.

Three `keydown` listeners are attached at once, none suppressing the others:

1. `Canvas.tsx:1171` — document, → `tools.dispatcher.onKeyDown`. The handler is
   `(e) => tools.dispatcher.onKeyDown(e)`; it discards the return value and never calls
   `preventDefault` or `stopPropagation`, so a tool route "claiming" a key has no effect on the
   other two listeners.
2. `useGestureDispatcher.tsx:967` — window, → interactions dispatcher. Calls `preventDefault` at
   `:411-413` when handled, but by then listener 1 has already run.
3. `useKeybindings.ts:119` — document, tool activation.

**The concrete case.** With `polygon` active and a non-empty selection, pressing `ArrowUp`:
- `usePolygonTool.tsx:125-129` — `initial.keyDown.ArrowUp` increments `sidesRef` and returns `claim()`.
  Reachable: polygon's `initScratch` defaults to `() => null` (`routing/defineTool.ts:289`), so
  `phaseOf` always returns `initial`, and the tools dispatcher walks hotkey → active → ambient
  (`tools/dispatcher.ts:651-658`) with polygon in the active slot.
- `defaults/nudge.ts:101` — `nudge.up`'s bare-arrow binding matches on the interactions dispatcher.
  `eligible: { capability: 'transforms-selection' }` (`:105`) passes in `normal` mode; `enabled` gates
  on a non-empty selection.

Both fire. `star` has the same shape (`useStarTool.tsx:106-118`).

I have not confirmed this in a browser — flagged as a code-path derivation, not an observation. It
is cheap to check: activate polygon, select a shape, press ArrowUp, and watch both the side count and
the shape position.

---

## 5. Deliberately not flagged

- **`packages/core/src/tools/routing/{routeGrammar,keyRouteGrammar,modifiers,gestures}.ts` and
  `reflection/modifierComboToParsed.ts` are pure re-export shims for `@weasel-js/gestures`.** They
  look like duplication and are not: they are 1–28-line barrels that keep the kit's internal import
  paths stable across the geom/gestures/history extraction. Deleting them would churn a dozen import
  sites for zero behavioral gain. The *bridging* they enable (3.6) is the real cost, not the files.

- **`useDispatcherOverlayLayer` and `usePreviewGhostLayer` are separate layers.** They render
  different things — dispatcher-authored chrome (marquee, lasso polyline, insert preview) versus
  displaced scene-node silhouettes read from `previewIds`/`previewPose`. Documented at
  `useDispatcherOverlayLayer.ts:7-11`. Not duplication. (One stale claim: the module header at
  `:13-16` says the per-tool `select-overlay` rendering "run[s] side-by-side" with it — as of 3.2
  those tool overlays are dead, so nothing runs alongside. Comment fix, not a finding.)

- **`buildActionRegistry` / `findConflicts` vs `apps/draw/src/dev/registryProbe.tsx`.** The probe
  wraps `buildActionRegistry` (`registryProbe.tsx:16, 239`) rather than reimplementing it; the extra
  code in the probe is inspector presentation (source links, dedup policy, action-id resolution),
  which correctly lives in the app.

- **`Tool.hookName` is forwarded by `defineViewportTool` (`:26`) but not by `defineTool`.** Real
  inconsistency, but the field is read only off `tool.def` by the dev inspector
  (`ToolkitBuilder.tsx:226`, `RegistryDetail.tsx:1092,1131`), never off the Tool, so the asymmetry
  is invisible. Fix it opportunistically; it does not warrant its own change.

- **`ToolCtx.adapter: unknown`.** Reads as under-typed but is a documented deliberate choice
  (`CLAUDE.md`, `docs/taxonomy.md` §4).

- **The pen tool's edit-mode duplication** (`penEdit/scratch.ts` vs `editAnchorsAction` et al.) —
  excluded by the audit brief; already tracked in the 2026-07-27 inspector handoff §4a.

- **`docs/taxonomy.md` §4 and §2 still document `useMove`, `useResize`, `useRotate`, `useAreaSelect`,
  `useInsert`, `useClone`, `useLassoSelect`, `useEditAnchors`, and `usePointerGestures` as the live
  gesture layer.** All of those hooks except `usePointerGestures` (3.12) have been deleted — the only
  remaining references are JSDoc `@see` lines in the action descriptors that replaced them. This is
  documentation drift rather than code duplication, so it isn't a finding, but it is worth a doc pass
  alongside any of the work above: the taxonomy is the file the project tells contributors to read
  first.
