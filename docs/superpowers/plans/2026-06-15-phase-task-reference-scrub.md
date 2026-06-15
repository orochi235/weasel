# Handoff — Phase/Task reference scrub

**Date:** 2026-06-15
**Status:** parked, ready to pick up (scoped, not started)
**Branch to cut from:** `main` (clean, synced with `origin/main` at the time of writing)

This note hands off a deferred cleanup task so a fresh session can run it without
re-deriving the scope. It was parked mid-conversation while the move behavior
pipeline (below) was implemented.

---

## Context: what just shipped (so you don't re-touch it)

The **move behavior pipeline** (Phase 7) landed on `main` this session — commits
`b2e51bde..8410b0b3`. `moveAction` now runs `opts.behaviors`
(`snapToContainer` / `snapBackOrDelete` / `snapToGrid` / `snapToGuides`), with a
consumer surface (`selectTool={{ move: { behaviors: [...] } }}`) and a demo
(`MoveSnapDemo`). Spec: `docs/superpowers/specs/2026-06-15-move-behavior-pipeline-design.md`.
Plan: `docs/superpowers/plans/2026-06-15-move-behavior-pipeline.md`.

**Do not undo or re-touch that work.** In particular, two Phase 7 references in
`src/interactions/actions/defaults/move.ts` are STILL OPEN and must be left:
- the live-drag-overlay deferral (header comment, ~line 28),
- the deps-aware `Action.enabled` TODO (~line 499, "Phase 7 TODO (still standing)").

---

## The task

Mike: *"scrub our codebase and docs for references to numbered phases and tasks
that we're finished with and not tracking anymore."*

The phases/tasks (Phase 1–15, Task N, 14e, registry-unification phases, etc.)
were a development-process scaffolding. Most are long done; the phase numbers
linger in code comments and docs as dead bookkeeping. Strip the dead ones;
preserve rationale and still-open TODOs.

### Survey (as of 2026-06-15)

- **Source comments (non-test):** ~178 hits of `Phase N` / `Task N` across `src/`.
- **Tests:** ~49 hits.
- **Docs:** ~2549 hits — but **almost all live inside dated historical
  artifacts** under `docs/plans/`, `docs/specs/`, `docs/superpowers/plans/`,
  `docs/superpowers/specs/` (many files literally named `...-phase-N.md`).

Quick re-survey commands:
```bash
grep -rn "Phase [0-9]\|Task [0-9]" src/ --include="*.ts" --include="*.tsx" | grep -v ".test." | wc -l
grep -rhoE "Phase [0-9]+[a-z]?" src/ docs/ --include="*.ts" --include="*.tsx" --include="*.md" | sort | uniq -c | sort -rn
```

### Scope decisions (already made with Mike, apply them)

**IN scope — scrub these:**
1. **Source-code comments** in `src/` (and tests) where a phase/task number is
   pure historical bookkeeping, e.g. `// Phase 14e Task 7: withLegacyRunBridge is gone`.
   **Keep the rationale, delete the phase label.** Rewrite to state the fact
   without the process number (the *why* is useful; the bookkeeping number is noise).
2. **Living reference docs** — the top-level `docs/*.md` a consumer actually reads:
   primarily `docs/concepts.md`, `docs/taxonomy.md`, `docs/TODO.md` (these had the
   only phase refs among living docs at survey time; re-check `docs/conventions.md`,
   `docs/adapters.md`, `docs/extending.md`, `docs/hooks.md`). Strip stale phase
   references; keep the substance.

**OUT of scope — leave untouched:**
3. **Dated historical artifacts** under `docs/plans/`, `docs/specs/`,
   `docs/superpowers/plans/`, `docs/superpowers/specs/`. These ARE the project
   archive (git log + dated docs is the archive policy — see memory
   `feedback_todo_completed_retention`). Phase numbers there are intrinsic content,
   not stale cross-refs. Rewriting a file named `registry-unification-phase-7.md`
   to remove "phase 7" would be nonsensical. **Do not touch this tree.**
4. **Still-open TODOs keyed by a phase number.** If a comment says "Phase N TODO
   (still standing)" or otherwise describes unfinished work, it's still being
   tracked → leave it (and its number, which is the tracking handle). The
   instruction was explicitly "phases we're FINISHED with and not tracking."
   Known survivors: the two `move.ts` refs listed above.

### Approach suggestion

- This is a wide but low-risk mechanical sweep with per-reference judgment
  (dead bookkeeping vs. live TODO vs. load-bearing rationale). Good candidate
  for a fan-out: one pass over `src/` comments, one over the living docs, each
  rewriting in place. Verify no behavior change (`tsc --noEmit && npm test`).
- Per-reference rule of thumb: **does removing the phase number lose any
  information a current reader needs?** If the sentence still makes sense as a
  statement of fact without the number → strip the number. If the number points
  to open/tracked work → keep it. If unsure whether the work is done, check
  whether the thing it describes still exists in the code.
- Branch from `main` (e.g. `chore/scrub-phase-references`). Don't fold into an
  unrelated branch.

### Done-when

- No `Phase N` / `Task N` bookkeeping noise in `src/` comments or living docs,
  except genuinely-open TODOs.
- Historical `docs/(superpowers/)?(plans|specs)/` tree untouched.
- `tsc --noEmit && npm test` green (this is comments/docs only — no logic change).

---

## Repo state at handoff

- On `main`, clean, pushed (`origin/main` == `main`).
- Other local branches present but unrelated: `chore/todo-followups`,
  `feat/curve-editor-layers` (not part of this work).
- Release gate command (matches CI): `tsc --noEmit && npm test && npm run build`
  (`npm test` scopes to the jsdom projects; a bare `npx vitest run` pulls in the
  opt-in Playwright/browser project which needs `npx playwright install`).
