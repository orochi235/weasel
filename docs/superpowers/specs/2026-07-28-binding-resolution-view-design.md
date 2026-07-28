# Binding Resolution — making precedence legible again

Closes the second open item of `docs/handoffs/2026-07-28-phase-tables-retired.md`:
apps/draw's inspector lost its Phases section and nothing replaced it.

## 1. What was actually lost

The phase tables made precedence **structurally** legible. A route lived at a
known coordinate — this tool, this phase, this gesture — so reading the table
told you what would win, and the shape of the table was the shape of the
decision.

Bindings moved precedence from structure to computation. It is now, in order:

1. **Scope** — `hotkey` > `active` > `ambient` (`SCOPE_PRIORITY` in
   `packages/core/src/interactions/dispatcher/matcher.ts`).
2. **Specificity** — a CSS-style 4-tuple, lexicographic, descending:
   `[target declared, count of required mods, phase declared, drop/paste MIME
   filter]`. `'optional'` modifiers do not count.
3. **Registration order** — stable sort preserves first-declared.
4. **Fall-through** — the dispatcher walks the sorted list and fires the first
   candidate whose eligibility and `enabled()` both pass. A disabled winner
   yields to the next.

None of that is visible anywhere. Today you can see one tool's bindings in
isolation (`ToolDetail`'s Routes table), or see what won *after* performing the
gesture (`DispatchTracePanel`) — but never "here is the live match set, ordered
the way the dispatcher orders it." The gap is not a missing table; it is that
the deciding procedure has no static view.

## 2. The kit gap: `resolveOnly` is the half-measure

`Dispatcher.resolveOnly(event, ctx)` already exists and is already public. It
replays the entire walk — scope assembly, `matchSorted`, eligibility filter,
per-candidate `enabled()` gate — and then throws away everything except the
winner.

The inspector needs exactly what `resolveOnly` computes and discards.

### `resolveAll`

Add a sibling that returns the whole ordered list, and reimplement `resolveOnly`
on top of it so the two cannot drift:

```ts
export interface ResolvedCandidate {
  actionId: string;
  action: Action;
  binding: GestureBinding;
  scope: BindingScope;
  ownerToolId: string | null;
  /** The tuple from `specificity(binding.spec)`, surfaced so a reader can see
   *  why one candidate outranks another rather than inferring it. */
  specificity: readonly [number, number, number, number];
  verdict:
    | { kind: 'would-fire' }
    | { kind: 'ineligible'; reason: string }
    | { kind: 'disabled'; reason: string }
    | { kind: 'shadowed' };
}

resolveAll(event: InputEvent, ctx: DispatcherContext): ResolvedCandidate[];
```

Ordering is `matchSorted`'s, unchanged. `shadowed` marks candidates that would
have fired but sit below one that fires first — the distinction between "this
was rejected" and "this never got asked" is the whole point of the view.

`resolveOnly` becomes the first `would-fire` entry mapped onto its existing
return shape. Its documented divergence — an ongoing invoker that matches but
returns an empty handle at `start()` makes a real dispatch fall through, and
prediction cannot see that — applies identically to `resolveAll` and is
documented there too.

**No behavior change.** One method added, one reimplemented in terms of it.

## 3. App side: two changes to ToolkitBuilder

`#/dev/toolkits` already mounts a real `<SceneCanvas>` from a bundle preset and
reflects on the result (Tools / Actions / Routes / Conflicts / Dispatch trace).
It is the page that already owns a live tool set, so the view lands there rather
than in `RegistryInspector`.

### 3.1 Routes widget gains `scope` and `specificity`

The catalog half is the existing Routes widget, under-reported. It lists every
route but never says which scope the binding rides or how specific it is —
the two fields that decide who wins.

### 3.2 New Resolution widget

Below Routes. Gesture-kind picker + target picker + modifier toggles synthesize
an `InputEvent`; `resolveAll` orders the candidates; the table renders them with
the winner marked and shadowed rows dimmed.

```
gesture [drag ▾]  target [selected-body ▾]  mods [⇧ ⌥ ⌘ ⌃]

  1 ?  pen      drag {isAnchorOrControl}  [1,0,0,1]  editAnchors
       └ predicate — evaluated against a synthesized hit
  2 ✓  select   drag selected-body        [1,0,0,1]  move       ← fires
  3 ·  viewport drag                      [0,0,0,1]  viewport.dragPan  shadowed
```

`InputEvent` arms are plain data, so synthesis needs no new machinery.

## 4. Predicate targets: where the answer is honest and where it isn't

`TargetSpec` is either a string form or `{ kindOf: (hit, bodyTarget) => boolean }`.
Predicates need a hit. Three cases, and they are not equally uncertain:

1. **Body classifications** (`empty` / `selected-body` / `unselected-body`).
   Set `bodyTarget`, leave `affordance` undefined. Predicates evaluate
   **truthfully** — `isAnchorOrControl(undefined)` is a real `false`, not a
   guess. This is the "press landed on the scene, not on chrome" case, and it
   is exactly right.

2. **Affordance kinds.** The target picker also offers chrome kinds, enumerated
   from the live tool set's declared `affordance:*` targets plus registered
   layer ids (`layer:weasel-hud`, …). Synthesize a minimal `{ kind }`
   `AffordanceHit`. Most kit predicates discriminate on `kind` alone
   (`isHudHit`, `isAnchorOrControl`), so these also evaluate truthfully.

3. **Predicates reading more than `kind`** — `payload`, `targetIds`, `anchor`.
   A synthesized hit cannot satisfy them, and there is no static way to detect
   which predicates do this.

So the `?` badge goes on **predicate-target rows only**, reading *evaluated
against a synthesized hit; a predicate reading more than `kind` may differ at
runtime*. Rows with string targets carry no caveat because they need none.
Blanketing the whole table in uncertainty would be the easier and less useful
choice.

## 5. `findConflicts`'s phase collapse — latent, with a named trigger

Adjacent finding, folded in because this work makes it load-bearing.

`RegistryEntry.phase` is typed `'initial' | 'engaged'` and derived by:

```ts
function phaseOf(phase: PhaseSpec | undefined): 'initial' | 'engaged' {
  return phase === 'engaged' ? 'engaged' : 'initial';
}
```

`PhaseSpec` is `'initial' | 'engaged' | '*' | readonly PhaseAtom[]`. The
identity check handles the two string cases and silently buckets the other two
as `'initial'`:

- `phase: '*'` (fires in either phase) → reported `initial`.
- `phase: [{ channel: '*', phase: 'engaged' }]` → reported `initial`, because
  an array is never `=== 'engaged'`.

`findConflicts` keys its dedup buckets on `entry.phase`, so a mis-bucketed
binding collides with genuinely-initial ones and reports a **false-positive
conflict**.

**This is latent, not live.** Every tool binding in the repo today uses only the
string forms (`usePolygonTool` / `useStarTool` wheel bindings, `phase:
'engaged'`), and `buildRouteRegistry` walks `Tool.bindings` only — so actions,
which *do* use the array form (`escape`, `cancelGesture`, `delete` all carry
`phase: [{ channel: '*', phase: … }]`), are out of scope today.

The trigger is this work: once a resolution view exists, widening conflict
detection to cover actions' `defaultBinding`s is the obvious next step, and that
is the moment the collapse starts lying. Fix it now, while the reason is
visible.

**Fix:** widen `RegistryEntry.phase` to `'initial' | 'engaged' | 'any'` and make
`phaseOf` total over `PhaseSpec`:

| `PhaseSpec` | Reported |
|---|---|
| `undefined` | `'any'` — no restriction, fires in either phase |
| `'initial'` | `'initial'` |
| `'engaged'` | `'engaged'` |
| `'*'` | `'any'` |
| `PhaseAtom[]` | `'any'` if any atom has `phase: '*'`; otherwise `'initial'` / `'engaged'` when every atom agrees; `'any'` when they disagree |

`PhaseAtom` is `{ channel: ChannelRef; phase: RoutePhase \| '*' }`, so the array
case reduces to the set of distinct `atom.phase` values — the `channel` field
does not affect which phase the binding fires in, only which channel's phase
state it reads, so it is not part of this collapse.

Note the current default flips: an unrestricted binding is reported `'any'`
where it used to report `'initial'`. That is the point — it stops colliding
with genuinely-initial bindings in `findConflicts`' bucket key. The existing
comment says the `'initial'` default was chosen to match "how the old `initial`
table read", which is a reason that retired with the tables.

This is visible, not just internal: most bindings declare no phase, so
ToolkitBuilder's Routes table will show `any` where it showed `initial`, and its
phase sort order changes. That is the correct reading — an unrestricted binding
does fire in either phase — but it is a display change to expect, not a
regression. `Conflict.phase` widens with `RegistryEntry.phase`, and the
Conflicts row renders the new value.

## 6. Scope boundary

Not in scope:

- **No live canvas coupling.** No hover subscription, no pointer feed. The view
  is static and driven by the pickers.
- **`DispatchTracePanel` unchanged.** It answers the retrospective question
  ("what did fire") and stays as it is. This view answers the prospective one.
- **`findConflicts`'s detection rules unchanged** beyond the phase fix. Broad-vs-
  narrow targets and differing modifier requirements are still deliberately not
  flagged.
- **No new `Dispatcher` handle for consumers.** `createDispatcher` and
  `DispatcherContext` are already public; the retired `ToolsApi.dispatcher` is
  not coming back.

## 7. Testing

**Kit** (`dispatcher.test.ts` or a sibling):

- Ordering across all three scopes for one event.
- Each verdict kind reachable: `would-fire`, `ineligible`, `disabled`,
  `shadowed`.
- The anti-drift invariant, pinned explicitly: for a set of events,
  `resolveOnly(e, ctx)` equals the first `would-fire` entry of
  `resolveAll(e, ctx)` (and `null` when there is none).
- Specificity tuple is reported, not recomputed differently from
  `specificity()`.

**Reflection** (`conflicts.test.ts`, `registry.test.ts`):

- `phaseOf` over all four `PhaseSpec` forms, including the array and `'*'`
  cases that currently collapse.
- No false-positive conflict between an `initial`-phase binding and an
  any-phase one.

**App** (`ToolkitBuilder` render test):

- Resolution widget over a fixed tool set: winner marked, shadowed rows
  present and distinguished, `?` badge on predicate-target rows and absent on
  string-target rows.
</content>
