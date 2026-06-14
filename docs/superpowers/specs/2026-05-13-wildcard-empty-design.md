# Routing wildcard `'*'` matches empty hits — design

Date: 2026-05-13
Status: design, awaiting plan.

Supersedes one paragraph of
`docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`
("Lookup precedence" — the line that says "`'empty'` is its own kind;
it doesn't fall through to `'*'`"). Everything else in that spec
stands.

## Goal

Collapse the recurring "I need both `'*'` and `'empty'` to handle
every hit" pattern in route tables. Make `'*'` truly universal:
**any hit, including empty**. Explicit `empty:` entries still win
because they're checked first.

## Motivation

The original routing design (2026-05-12) declared `'empty'` a peer
key to `'*'` that doesn't fall through. This was a deliberate guard
against tools accidentally swallowing empty hits, but in practice
every interesting "classifier-style" tool (select, clone, eyedropper,
edit-anchors, pen) ends up listing the same handler twice — once
for `'*'` and once for `'empty'`. The kit's own builtins have five
of these duplicate-handler tables today, each carrying a comment
that apologizes for the wart:

> Empty is listed alongside '*' because the routing engine's '*'
> doesn't fall through to 'empty'.

That comment appears verbatim (with small wording variations) in
`useSelectTool`, `useEyedropperTool`, `useCloneTool`,
`useEditAnchorsTool`. The guard isn't earning its keep.

Worse, the current semantic actively misleads. `defineDragInsertTool`'s
click route is `'*': handler` with a comment saying "Universal route —
fires for every target (empty, node, affordance)." Today that's a
quiet lie: empty clicks fall through and the inserter never fires.
Flipping `'*'` to mean what the comment claims is a fix.

## Before / after

### `buildCandidateKeys` in `src/tools/routing/lookup.ts`

Today (lines 38–50):

```ts
function buildCandidateKeys(hit: HitResult): string[] {
  if (hit.category === 'empty') return ['empty'];
  // …
}
```

After:

```ts
function buildCandidateKeys(hit: HitResult): string[] {
  if (hit.category === 'empty') return ['empty', '*'];
  // …
}
```

Precedence order for empty hits becomes: `empty` → `*`. Explicit
`empty:` entries still win because they're tried first.

Precedence for non-empty hits is unchanged
(`kind` → `*:subkind` → `baseKind` → `*`).

### Consumer-side: typical collapse

Before:

```ts
pointerDown: {
  '*':   claimAtDown,
  empty: claimAtDown,
},
```

After:

```ts
pointerDown: {
  '*': claimAtDown,
},
```

### Consumer-side: opt-out when empty must NOT fire

Before (implicit — no `empty:` entry; relies on `'*'` not catching empty):

```ts
click: {
  '*': handler,   // implicitly skips empty
},
```

After (explicit opt-out):

```ts
click: {
  '*':   handler,
  empty: () => none(),
},
```

This is the migration tax: any consumer that previously relied on
the implicit skip must spell it out. In the weasel codebase the audit
turns up zero such cases — every kit/swillustrator route table either
lists `empty` explicitly already (so collapses cleanly) or actively
wants empty included (so accepts the new semantic). See "Migration"
below.

## Lookup-precedence semantic — full restatement

For a hit `h`:

| `h.category` | Candidate keys (in order)                            |
|--------------|-------------------------------------------------------|
| `empty`      | `empty`, `*`                                          |
| `node`/`affordance`, no subkind | `kind`, `*`                        |
| `node`/`affordance`, with subkind | `kind:subkind`, `*:subkind`, `baseKind`, `*` |

First match wins. Explicit `empty:` always beats `*` for empty hits
because it appears first. The four-level grammar for non-empty hits
is unchanged.

## Migration

### Audit — kit builtins (`src/tools/builtin/`)

Files using `'*'` in a route table:

| File | Route(s) | Action |
|---|---|---|
| `useEyedropperTool.ts` | `pointerDown` lists `'*': claimAtDown, empty: claimAtDown` | Collapse: drop `empty:` |
| `useEyedropperTool.ts` | `click` lists `'*': pickFromNode, empty: onEmptyClick` | Keep both — different handlers |
| `useSelectTool.ts` | `pointerDown` lists `'*': pointerDownBody, empty: pointerDownBody` | Collapse: drop `empty:` |
| `useSelectTool.ts` | `dblTap` lists `'*': forwardDblTap, empty: forwardDblTap` | Collapse: drop `empty:` |
| `useSelectTool.ts` | `drag` lists `'*': beginMove, empty: beginArea` | Keep both — different handlers |
| `useSelectTool.ts` | `click` lists `'*': collapseDeferredClick, empty: <modifier sub-table>` | Keep both — different handlers |
| `useCloneTool.ts` | `pointerDown` lists all kinds + `'*': onPointerDown, empty: onPointerDown` | Collapse: drop `empty:` and the per-kind entries (`'*'` alone covers them all). The classifier comment can be simplified |
| `useEditAnchorsTool.ts` | `pointerDown` lists `'*'` and `'empty'`, both run hand-rolled hit-test → clearSelection or capture | Collapse: drop `empty:` — handlers are functionally identical |
| `useUserPenTool.ts` | `pointerDown` and `click` each list `'*'` only | Accept new semantic — pen welcomes empty hits (that's the whole point of the tool) |
| `defineDragInsertTool.ts` | `click` lists `'*'` only | Accept new semantic — this is the **fix** for the existing comment claiming "fires for every target (empty, node, affordance)" |

### Audit — Swillustrator (`apps/swillustrator/src/`)

No application-level route tables — Swillustrator composes the kit's
built-in tools but never authors a `defineTool` spec directly. All
routing work happens inside kit builtins, which are covered above.
(`App.tsx`'s `pickEvery` wiring is the only routing-adjacent
configuration, and it's about hit-test classification, not route
keys — unaffected by this change.)

### Audit — demos

`demo/demos/ToolReflectionDemo.tsx` rebuilds a `ToolDef` mirroring
the select/hand tools so it can feed the action registry. After the
flip the select-tool stub can drop its `'empty'` entries to stay in
sync with the real builtin (cosmetic only — reflection still works
either way).

### Migration tally

- **Tables that list `'*'` and `'empty'` running the same handler
  (collapse-eligible):** 5 (eyedropper pointerDown, select
  pointerDown, select dblTap, clone pointerDown, edit-anchors
  pointerDown).
- **Tables that list `'*'` without `'empty'` (need a decision):** 2
  (user-pen `pointerDown` / `click`, drag-insert `click`). Both
  accept the new semantic — no opt-out needed.
- **Tables that list both with DIFFERENT handlers (keep as-is):** 3
  (eyedropper click, select drag, select click).
- **Opt-outs required:** 0.

### Edge cases discovered during the audit

- **`defineDragInsertTool` is currently buggy by the old contract.**
  Its `'*'` route claims to handle "empty, node, affordance" hits
  but never fires on empty under today's semantic. The new semantic
  retroactively makes the comment true. No test failure surfaces
  this today because drag-insert tools are exercised primarily
  through `drag`, not `click` — but a click on truly empty space
  with one of these tools active should commit a point-insert and
  doesn't. This is a latent fix shipped alongside the semantic flip.
- **`useCloneTool.ts` over-specifies.** It lists `rect`/`text`/`path`
  + `'*'` + `'empty'` all mapped to the same handler. After the flip,
  only `'*': onPointerDown` is needed; the per-kind entries become
  dead. This is mostly cleanup, not behavior change, but worth
  surfacing because someone reading the file might infer the per-kind
  rows mean something.
- **`useSelectTool.ts` click route on `empty:` uses a modifier
  sub-table.** The new precedence does not affect this — `empty`
  is still tried before `'*'` so the sub-table fires for empty
  hits as before. No change needed.
- **Modifier sub-tables on `'*'` for empty hits.** If a future
  consumer writes `'*': { default: a, [mods('shift')]: b }` with
  no `empty:` entry, that sub-table will now fire on empty hits.
  This is the intended new semantic; document it.

## Spec doc update

`docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`
gets a new subsection appended at the end of its existing
"Lookup precedence" section (or a forward-pointing note), saying:

> **Update 2026-05-13:** the original spec stated "`'empty'` is its
> own kind; it doesn't fall through to `'*'`. To match both, list
> them separately." This was reversed. `'*'` now matches empty hits
> too — empty falls through to `'*'` if no explicit `'empty'` entry
> is present. Explicit `'empty'` still wins because it's checked
> first. See `2026-05-13-wildcard-empty-design.md`.

The body of the original section can stay (it's still accurate for
non-empty hits, which is the bulk of what it describes); the one
incorrect sentence gets a strike-through or a footnote pointing at
the new spec.

## Test impact

The existing `src/tools/routing/lookup.test.ts` includes:

```ts
it('empty kind does not fall through to *', () => {
  // … expects undefined
});
```

This test pins the old behavior. After the flip it inverts: empty
**does** fall through to `'*'`, returning the universal handler.
The test gets renamed and its expectation flipped — that's T1's
TDD signal that the change landed correctly.

A new test should also cover: an explicit `empty:` entry beats `'*'`
for an empty hit. This is the precedence guarantee that makes the
opt-out story credible.

## Risks

- **Silent behavior change for any consumer outside this repo that
  relied on the old "implicit skip" semantic.** Low risk because the
  kit is unpublished beyond this repo and the only external surface
  is the `@weasel-js/core` package. Document in the CHANGELOG and
  flag in the routing spec.
- **Modifier sub-table on `'*'` now fires for empty.** Intended, but
  could surprise someone who only thought about the node case when
  writing the sub-table. Mitigated by spec doc update.

## Non-goals

- No new wildcard syntax (`'**'`, `'+'`, etc.).
- No change to the four-level grammar for non-empty hits.
- No change to modifier sub-table resolution.
- No change to the `HitResult` type or hit-test pipeline.

## Acceptance

- `resolveRoute(table, emptyHit, …)` returns the `'*'` handler when
  `table` has `'*'` but no `'empty'`.
- `resolveRoute(table, emptyHit, …)` returns the `'empty'` handler
  when `table` has both (precedence preserved).
- Every kit builtin's route tables that previously duplicated the
  same handler across `'*'` and `'empty'` are collapsed to a single
  `'*'` entry.
- The routing spec doc carries a forward-pointing note to this spec.
- Full `tsc --noEmit && vitest run` is green; existing test count
  stays flat aside from the renamed empty-fallthrough case (and any
  new precedence test).
