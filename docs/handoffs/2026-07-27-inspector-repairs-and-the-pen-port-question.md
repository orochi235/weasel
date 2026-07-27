# Handoff: Bundle Inspector repairs, capability-gated chrome, and the pen-port question

## Status (2026-07-27)

Four commits on `main`. **Two are pushed, two are not:**

| Commit | Subject | Pushed |
| --- | --- | --- |
| `e4f5d327` | `fix(inspector): populate the tools view's empty columns` | ✅ |
| `675797e4` | `docs(chrome-caps): add a README for the module` | ✅ |
| `647b8a7a` | `refactor(chrome-caps): gate default chrome on capabilities, not mode ids` | ❌ local |
| `6901e3e4` | `docs(features): add a README to every feature module` | ❌ local |

`origin/main` is at `675797e4`. Gates run before committing: `tsc --noEmit`
clean, full suite green (5124 passed / 4 skipped, up from 5118 — six new tests).
`tsup build` was **not** run; every change is under `apps/draw/` or is a
Markdown file or a `packages/core` source edit covered by the typecheck.

**The open question is §4 — porting pen.** Sections 1–3 are done and recorded
here for the gotchas, which are the parts that cost time to find.

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

`path-edit.*` stays mode-gated **on purpose** — it's the visual signature of one
specific mode, not a claim about permissions.

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

## 4. OPEN: porting pen to the bindings paradigm

Pen's Bundle Inspector entry has an entirely empty `action` column because
**pen declares no `bindings` at all** — every route is a phase-table route
running an inline `ActionFn`, so there's no registered Action to name. It's the
last major built-in on the legacy phase-grammar.

Two findings changed the shape of this task.

### 4a. Path editing is implemented twice

A complete action-based implementation already exists and is **live**:

- `editAnchorsAction`, `enterPathEditAction`, `exitPathEditAction`,
  `insertPathAnchorAction`, all registered in `useStandardActions.ts:145-148`
- bound **ambiently** — see `useSelectTool.ts:374`, which explains that a
  body-drag opts out when the pointerdown hit an anchor affordance, because
  otherwise "move's active-scope binding beats editAnchors's ambient-scope
  binding on every anchor drag"
- first-class dep at `depSchema.ts:388` (`editAnchors: EditAnchorsDep`)
- the dispatcher knows `'editAnchors.editingId'` as a logical mode
  (`dispatcher.ts:84`)

And pen carries its own parallel one: `usePenTool.ts` imports `enterEditMode` /
`exitEditMode` / `captureGestureBaseline` / `commitGestureOp` from
`./penEdit/scratch`, maintains `scratch.mode === 'edit'`, and implements its own
`selectAnchor`, `scissorsAtAnchor`, `nudgeSelectedAnchors`, `deleteAnchors`,
plus a reactive `isEditing` it hands consumers for styling.

Someone already noticed and deduped exactly one operation —
`usePenTool.ts:228`: "alt-click insert and `insertPathAnchorAction` share one
implementation."

**So for the edit half, "porting" is mostly a deletion, not a translation.**

**Not yet verified** (this is the actual investigation): whether both paths are
simultaneously reachable, or whether pen-active-edit and select-plus-path-edit
are mutually exclusive states; and whether their behavior has diverged. That
determines clean-delete vs. careful-reconciliation.

### 4b. Create mode is blocked on a real grammar gap

Pen's routes branch on tool scratch **25 times** — `scratch.mode`,
`scratch.current`, `scratch._pendingDown`. In the bindings model that would be
`eligible` rules, but `Selector` has only:

```
selection · mode · capability · gesturing · actionIs
modifierHeld · focused · hovering · hoveringSelected · zoomAtLeast · resizable
```

None reads tool scratch. "When the pen has an open subpath, clicking the first
anchor closes it, otherwise append" is **not expressible**. The
`{ when: (ctx) => … }` escape hatch doesn't help either — `when` receives a
`RuleCtx`, which also has no scratch.

Second obstacle: pen's `pointerDown` writes `_pendingDown` to scratch and
deliberately returns `none()` (does not engage); `click` or `drag` reads it back
on the next stage. Bindings dispatch to Actions with their own start/move/end
lifecycle — there is no stash-on-down / read-on-click seam.

So create mode needs a **new selector exposing tool-scratch predicates to
`RuleCtx`** before it can port at all. That's a shared-kit-contract change with
blast radius well beyond pen.

### Recommended order

1. Reconcile the duplicate path-edit implementation (§4a). Highest value,
   plausibly net-negative lines, no grammar changes.
2. Treat the scratch-selector gap (§4b) as its own decision. Leave create mode
   on the phase table until it's made.

Don't start §2 to enable §1 — §1 doesn't need it.

---

## Incidentals

- Pen's `modifiers` column reads all `—`, but pen *does* have modifier behavior:
  shift makes an anchor nudge 10px instead of 1. It's read imperatively inside
  the handler (`ctx.modifiers.shift`) rather than declared as a route, so the
  inspector cannot see it. Declared routes are introspectable; runtime modifier
  reads are not. Same class of invisibility as §4b.
- `rotate` is an overlay-only ambient tool with genuinely zero routes. Its
  Routes section now renders an explicit "This tool declares no routes." rather
  than being omitted, so "empty" reads differently from "failed to load". Its
  overlay lives on the returned `Tool`, not the def — same Tool-vs-def split as
  §1a, and it used to report "emits no overlay."
- The dev server for `apps/draw` was left running on :5174.
