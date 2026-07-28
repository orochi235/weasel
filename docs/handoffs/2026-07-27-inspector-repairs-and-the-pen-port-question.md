# Handoff: Bundle Inspector repairs, capability-gated chrome, and the pen-port question

## Status (updated 2026-07-27, later session)

**§4 is resolved — pen is ported.** See §4 below for what the investigation
actually found, which inverted this document's original premise. Sections 1–3
are unchanged and still accurate; they're recorded here for the gotchas, which
are the parts that cost time to find.

`main` is at `4c0dd47f` (merge of `pen-edit-port`). **Nothing is pushed past
`675797e4`** — six local commits now:

| Commit | Subject | Pushed |
| --- | --- | --- |
| `e4f5d327` | `fix(inspector): populate the tools view's empty columns` | ✅ |
| `675797e4` | `docs(chrome-caps): add a README for the module` | ✅ |
| `647b8a7a` | `refactor(chrome-caps): gate default chrome on capabilities, not mode ids` | ❌ local |
| `6901e3e4` | `docs(features): add a README to every feature module` | ❌ local |
| `d5ce4cbb` | `docs(handoff): inspector repairs, capability-gated chrome, pen-port question` | ❌ local |
| `3069a95d` + `4c0dd47f` | `feat(path-edit): port pen's anchor editing onto the Action layer` (+ merge) | ❌ local |

Gates: `tsc --noEmit` clean, full suite green (5108 passed / 4 skipped — down
from 5124 because the pen-edit and duplicate-overlay tests went with their
implementations; 44 new tests landed). `tsup build` still **not** run.

**Update, later session.** `npm run prepublishOnly` (`tsc --noEmit && vitest
run && tsup build`) run on this stack: **exit 0**, `tsup build` included — the
gap above is closed. A bare `npx vitest run` reports 614 files / 5352 passed
/ 4 skipped, more than `prepublishOnly`'s scoped run; both green. One further
commit landed since, `75d0cbc3`, closing the "Known rough edge" below.
Still nothing pushed.

A separate read-only audit of the tool/gesture/dispatch layers ran alongside
this work — `docs/handoffs/2026-07-27-tool-gesture-duplication-audit.md`. It
found the two-input-pipeline problem that several items here are downstream of,
plus a live bug (apps/draw's snap-to-grid silently does nothing for
rect/ellipse/line) and a stale claim in `CLAUDE.md`. Nothing from it is acted
on yet.

---

## 1. The Bundle Inspector's empty columns were three wrong-object bugs

Reported as "some table cells aren't populating, e.g. the entire action
column." None of it was styling.

### 1a. `select`'s bindings were invisible — read the Tool, not the def

`useSelectTool` spreads the `defineTool` result and **appends `bindings` to the
returned `Tool`**, not to the `ToolDef`:

```ts
const base = defineTool<SelectScratch>({ … });   // no bindings in here
return { ...base, initScratch, bindings: [ … ] } // ← eight of them, out here
```

`registryProbe` read `def.bindings`, so select's resize / rotate / clone / move
/ areaSelect / clearSelection — the bulk of what the tool does — never reached
the inspector at all. Select showed 6 routes; it has 14.

**The rule: read `t.bindings` off the runtime `Tool`.** That's what the
dispatcher reads. `defineTool` copies `def.bindings` onto the Tool it returns,
so reading the Tool covers both authoring styles; reading the def covers only
one. `useSelectTool` is currently the only built-in that does this, which is
exactly why it went unnoticed.

### 1b. Three routes were collapsing into one

Select declares three predicate-target drags — resize, rotate, and move — and
the v3 grammar renders **all of them** `[*] drag => predicate`, because it has
no notation for a `{ kindOf }` predicate target. The probe de-duped on the
formatted string, so two vanished and the third was labeled with the first
one's action.

`ToolEntry` now carries **both**:

- `routes: readonly string[]` — deduped, for catalog aggregation (the sidebar's
  Routes / Route-targets / Modifier-sets counts)
- `declaredRoutes: readonly DeclaredRoute[]` — ordered, **not** deduped, for the
  detail table

Don't collapse these back together. The DataGrid row key is `${i}:${route}`
precisely because the route string isn't unique.

### 1c. The `action` column rendered a source path

The column was labeled `action` but showed a `vscode://` file link, and the
actual action id was computed in the probe and thrown away. Now there's a real
`action` column (linking to the Action entry) plus a separate `source` column.

### The two source-tagging gaps this exposed

`vite-plugin-callback-source` only tagged function-valued object properties. It
skipped:

- **computed keys** — `[mods('shift')]: fn`, i.e. *every modifier variant* in
  every route sub-table
- **named handler consts** referenced by identifier — which is most of what
  `useSelectTool` does

Both are now tagged. **Capitalized consts are deliberately skipped**: wrapping
`const Foo = () => <svg/>` in `Object.assign(...)` hides the declaration from
react-refresh and silently downgrades the module to a full page reload. If you
loosen that check, you're trading Fast Refresh for source links.

Separately, the route→handler lookup built candidate labels with
`canonicalModifiers(...)`, which emits `shift=required`. Sub-tables are keyed
with `mods('shift')`, which is `shift`. **These never matched**, so every
modifier-variant route showed a blank source. Now uses a `ModifierCombo`.

### 1d. Every trait/op schema table was empty

All four ts-morph extractors in `apps/draw/vite-plugin-trait-schemas/` still
pointed at pre-`packages/core` paths (`src/core/scene/types.ts`, …) and were
failing **silently** — visible only as `[trait-schemas] … extractor failed`
lines in the dev-server log, which is easy to scroll past. Repointed at
`packages/core/src/…`; shape pose/data, op arguments, and node schemas populate
again.

Worth a habit: those log lines appear in `npm test` output too. They were there
the whole time.

### Still unfixed (deliberately)

`select`'s `dblTap` route and pen's four arrow-key routes show no source. Their
handlers come from factories — `forwardActionTo(...)`, `nudgeRouteFor(dx, dy)` —
so there is no function literal at the property position for the plugin to tag,
and the closure's real source would be one shared line anyway. The cell says so
on hover. Fixing it means propagating `__source` through those helpers.

---

## 2. Chrome defaults now gate on capabilities — and the trap that blocks

`interactions/actions/registry.tsx` already advised preferring `capability:`
rules over `mode:` rules (a capability rule survives new modes being added; a
mode rule has to be found and edited). The kit's own defaults table didn't
follow it. Converted:

- `selection.resize-handles` / `selection.rotation-handle` →
  `capability: 'transforms-selection'`
- `selection.outline` → `capability: { not: 'edits-anchors' }`

`path-edit.*` stayed mode-gated at the time, on the theory that it's the visual
signature of one specific mode rather than a claim about permissions.
**Superseded — see §4, bug 3.** That reasoning didn't survive contact: mode
`'normal'` is what every consumer without a mode registry reports, so the rule
was false exactly where the chrome was needed. Those two ids now gate on
`editingAnchors`, and `defaults.ts` has no `mode:` rules left at all.

**Behavior change, intended:** handles used to show in `text-edit` and `crop`,
neither of which allows `transforms-selection`. Grabbing one could only ever
have been a no-op. Unchanged in normal / isolation / free-transform / path-edit.

### The trap: an empty capability set is not a safe default

Both places that synthesize a `RuleCtx` without a mode registry used
`new Set()`. With an empty set **every `capability:` rule is false** — so a
default written the recommended way would have silently hidden its chrome for
every consumer that hasn't opted into modality. Only `apps/draw` wires
`getActiveMode`; nothing else does.

"No modes wired" means *everything the default mode permits*. Both paths now use
`DEFAULT_ALLOWED_CAPABILITIES` (`NORMAL.allows` + `IMPLICIT_TAGS`), exported
from `features/chrome-caps`. **If you add a third ctx-construction site, use it.**

The test fixture had the same incoherence — it claimed `mode: 'normal'` while
allowing nothing, so it could never have exercised a capability rule honestly.
It now derives capabilities from the mode it names, and tolerates
consumer-defined mode ids (which aren't in the preset) by requiring those tests
to pass `allowedCapabilities` explicitly.

---

## 3. Every `features/` module now has a README

15 modules, previously one README (chrome-caps). Each documents the non-obvious
constraint rather than restating the types — e.g. why `focus` exposes
`getFocused()` alongside `focused` (layers are built once, drawn every frame);
why `images` must keep the decoded bitmap out of node data (serialization); that
`groups`' `getPose` returns a **local** pose since nesting, so anything
world-space routes through `composeWorldPose`.

`chrome-caps/README.md` is the deepest one and doubles as the explanation of the
`Rule` grammar — which, despite the directory name, is the kit's **general
eligibility language**, used by `dispatcher.ts` and `Action.eligible`. Anyone
arriving from `eligible` lands in a directory whose name suggests they're lost.

---

## 4. RESOLVED: pen ported to the Action layer

Shipped in `3069a95d`. The section below records what the investigation found,
because the conclusion is the opposite of what this document originally
assumed and the reasoning is worth not re-deriving.

### 4a. The duplicate was real — but the DEAD copy was the richer one

The original text said "for the edit half, porting is mostly a deletion." That
was wrong, and the reason is worth stating plainly:

**Pen's edit mode was unreachable in every consumer in the repo.** All three
entries into it (dblclick, shift+click, alt+click) gate on the `getPathObj`
option. The only implementation of that option anywhere was the `toolBundle`
default in `useBuiltinShapeTools`, which requires `pose.kind` to be
`'polygon' | 'rect'`. No kit-created node has a `kind` on its pose — including
the ones the pen itself creates. **A path drawn with the pen could not be
edited by the pen.** It was live only in `usePenTool.edit.test.tsx`, which
supplies a hand-written `getPathObj`.

Meanwhile the Action-based path is what consumers actually get, and it was the
thinner of the two: drag anchor, drag control handle, alt-click insert,
enter/exit. Pen had all of that plus anchor selection, marquee, delete, nudge,
scissors, click-segment insert, and smooth-handle mirroring.

So this was a migration, not a deletion — net ~1980 added / ~2770 removed, but
the removals are the dead pen half and two duplicate overlays, not the
behaviors.

What landed:

- **`features/paths/anchorEdits.ts`** — the geometry, lifted off `PenScratch`
  onto a pure anchor-set model. Anchors are addressed by **flat index** (what
  the `anchor:N` affordances carry). `anchorEdits.test.ts` pins the invariant
  that `enumerateAnchors` and `pathToAnchors` agree on that ordering; every
  ported action edits the wrong anchor if they ever diverge.
- **New Actions** — `selectAnchor`, `nudgeAnchors.*`, `deleteAnchors`,
  `cutPathAtAnchor`, `marqueeAnchors`, all in `defaults/anchorEditing.ts`.
- **`editAnchorsAction`** gained multi-anchor drag and Alt-to-break-smoothness.
  Note the latter is a *bug fix*, not a port: it previously moved one coord via
  `withCoord` and never mirrored, so dragging a control handle broke every
  smooth curve.
- **`editAnchors` dep** carries the anchor selection (flat indices) and the
  in-flight marquee rect.
- Pen is create-only. `penEdit/`, `penEditOverlay`, the hit override,
  `PenEditState`, `isEditing`, and `getPathObj` are gone; `usePenTool` now
  returns the `Tool` directly instead of `{ tool, isEditing }`.

### 4b. The scratch-selector gap didn't block anything

§4b's worry — that porting needs a new `Selector` exposing tool scratch to
`RuleCtx` — turned out not to apply to the edit half at all. That half has no
tool scratch once it lives on the Action layer: its state is the `editAnchors`
dep, which actions already read. **The gap is real but belongs to pen's
*create* mode**, which still runs on the phase table and still branches on
`scratch.mode` / `scratch.current` / `scratch._pendingDown`. Unchanged, and
still its own decision.

### The gesture-layer fact that shaped the design

Worth knowing before touching anything nearby: **the dispatcher only dispatches
a drag binding after the pointer crosses the drag threshold.** A press that
never moves never reaches `start`. Verified in the running app — down/up on an
anchor logs a bare `click`, down/move-3px/up logs the same, and only a real
drag logs `pointerdown → editAnchors`.

That kills the obvious design (press-to-select inside `editAnchorsAction.start`,
where the affordance is already in hand). Clicks carry no affordance — the
dispatcher attaches those to `pointerdown` only — so `selectAnchor` resolves
the anchor from the click's world coords, the way `insertPathAnchorAction`
already did for segments. `editAnchorsAction` still syncs the selection when a
drag *begins* on an unselected anchor.

### Two node-level twins had to be kept apart, and it takes both mechanisms

`deleteAnchors` / `nudgeAnchors.*` / `marqueeAnchors` share gestures with
`delete` / `nudge.*` / `areaSelect`. Capability eligibility separates them when
a mode registry is wired; `enabled` fall-through separates them when one isn't
(no registry → no eligibility filtering at all). **Relying on either alone is
broken in one direction** — eligibility alone breaks every non-modal consumer,
`enabled` alone lets a node action fire inside path-edit. `anchorEditing.test.ts`
covers both.

### Four bugs fixed on the way, all reproduced live

1. **Escape leaked `editAnchors.editingId`.** apps/draw handles Escape in a
   capture-phase listener and calls `stopPropagation()`, so `exitPathEditAction`
   never ran. Mode left path-edit but the id stayed set: inert anchor squares
   kept drawing and `getSuppressedSelectionIds` kept the selection outline
   hidden. Fixed by **masking, not clearing** — `effectivePathEditingId()` in
   `SceneCanvas` returns `''` when the active mode no longer permits
   `edits-anchors`. Masking because the mode can change without re-rendering
   `SceneCanvas`, so there's no reliable moment to write state.
2. **Three overlays drew the same anchors.** The kit's
   `pathEditingOverlayLayer` (screen-space, keyed on `editingId`), apps/draw's
   `pathEditPainter` (world-space, keyed on `machine.getActiveTargetId()`, so
   its markers grew with zoom), and an unused third copy at
   `interactions/actions/edit-anchors/overlay.ts`. The app's drew on top and
   hid the kit's, so the duplication was only visible once one key went stale.
   Kit layer is now the sole owner; the other two are deleted.
3. **Anchors were visible but not grabbable outside apps/draw.** The overlay
   consulted no rule at all while `affordanceAt` gated on
   `isVisible('path-edit.anchors')`, whose default was `{ mode: 'path-edit' }`
   — false for every consumer without a mode registry. Both now gate on a new
   `editingAnchors` `RuleCtx` selector. **`defaults.ts` no longer has a single
   `mode:` rule.** See the chrome-caps README on why this is a *state*
   selector, not a `capability:` one.
4. **Shift-clicking a second anchor silently exited edit mode.** The select
   tool's pointerDown classifier called `applyClick` with shift, toggling the
   edited node out of the *node* selection; the dep reads that as the target
   vanishing. New `extendClickLocked` option locks extend-clicks while anchor
   editing. Only extend-clicks — a plain click still re-selects, so clicking a
   different node exits edit mode as before.

   This is a narrow instance of the audit's §3.4: tool routes are never
   eligibility-filtered, so `useSelectTool`'s phase-table pointerDown mutates
   the selection in modes that forbid it, while the same tool's
   `clearSelection` *binding* is correctly gated off. The general fix is
   still open.

   Note the option had to be threaded through `useSceneSelectTool`, which
   forwards a hand-picked field list rather than spreading — a new
   `useSelectTool` option is invisible until you add it there.

### RESOLVED: the clearSelection / selectAnchor rough edge

Fixed in `75d0cbc3`, and it did **not** need the eligibility-for-tool-routes
work this section originally assumed.

`selectAnchor` binds ambient `{ kind: 'click' }`. `useSelectTool` binds
`clearSelection` to `{ click, target: 'empty', mods: {} }` at *active* scope,
which outranks it. In path-edit mode that action is filtered out by capability
so anchor clicks win; in a consumer with no mode registry, clicking an anchor
that happens to sit over empty canvas cleared the node selection instead of
selecting the anchor. Anchors over the path body were unaffected.

The fix is the **`enabled` fall-through**, the second of the two mechanisms
this document already describes for the node-level twins:
`clearSelectionAction.enabled` declines while `editAnchors.editingId` is set,
and the dispatcher moves to the next candidate. It is the exact click twin of
the opt-out `areaSelectAction.start` performs for the drag gesture — that one
was written during the pen port and this one was simply missed. `clearSelection`
gained `editAnchors` in its `requires` so the deps bag carries it (the
dev-mode Proxy warns on undeclared reads).

**Why gating on the dep is safe** despite bug 1's Escape leak:
`useEditAnchorsDepSource` masks `editingId` to `''` unless the node exists, is
in the selection, *and* the active mode still permits `edits-anchors`. A
non-empty id therefore means anchor editing is genuinely live.

`clearSelection.ts`'s docblock also claimed an `enabled` guard the code never
had — the trailing comment said the opposite. Corrected.

**Verification, stated honestly.** Unit-level: `clearSelection.test.ts` and
`anchorEditing.test.ts` (new `clearSelection / selectAnchor handoff` block)
pin both directions; full suite green at 5352 passed / 4 skipped, `tsc
--noEmit` clean, `tsup build` clean. **Not reproduced live** — see the gap
below, which is the real reason.

### Open: the non-modal fall-through has no live consumer in this repo

Both `enabled` fall-throughs — this one and `areaSelect`/`marqueeAnchors` —
exist *only* for consumers with no mode registry. There is no such consumer
here that can enter path-edit: `apps/draw` wires `getActiveMode`, and nothing
under `apps/site/` does (zero `getActiveMode` hits) or enters path-edit at all.

So the branch these guards protect is unit-tested and never exercised in a
browser, in either direction. Every bug in §4 was caught by running the app;
this class structurally can't be. A small non-modal path-edit demo under
`apps/site/demos/` would give the mechanism a live home and would have caught
this one. Not done — it's a scope call, not an oversight.

---

## Incidentals

- Pen's `modifiers` column read all `—` while shift-nudge was implemented by
  reading `ctx.modifiers.shift` imperatively inside the handler. **Moot for
  that specific case now** — anchor nudging moved to `nudgeAnchors.*`, which
  declares its shift variant as a second binding, so the inspector can see it.
  The general point stands and is worth remembering: declared routes are
  introspectable, runtime modifier reads are not. Pen's create mode still reads
  shift and alt imperatively during the handle drag.
- `rotate` is an overlay-only ambient tool with genuinely zero routes. Its
  Routes section now renders an explicit "This tool declares no routes." rather
  than being omitted, so "empty" reads differently from "failed to load". Its
  overlay lives on the returned `Tool`, not the def — same Tool-vs-def split as
  §1a, and it used to report "emits no overlay."
- Dev servers left running: :5174 (main checkout) and :5180 (the
  `weasel-pen-port` worktree, since merged).
