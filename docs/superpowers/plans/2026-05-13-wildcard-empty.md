# Routing wildcard `'*'` matches empty — implementation plan

Date: 2026-05-13
Spec: `docs/superpowers/specs/2026-05-13-wildcard-empty-design.md`

Bite-sized, TDD-first. Five tasks; T1 ships the kernel change; T2–T3
ride the cleanup; T4 updates the older spec doc; T5 sweeps.

## T1: flip `buildCandidateKeys` for empty hits

**Goal:** empty hits now produce `['empty', '*']` instead of
`['empty']`. Explicit `'empty'` still wins; `'*'` is the fallback.

**Files:**
- `src/tools/routing/lookup.ts`
- `src/tools/routing/lookup.test.ts`

**Steps:**

1. **Write the failing test first.** In `lookup.test.ts`, edit the
   existing "empty kind does not fall through to *" test. Replace
   the assertion to expect the `'*'` action to fire, and rename the
   test:

   ```ts
   it('empty hit falls through to *', () => {
     const star = vi.fn();
     const table: RouteTable<void> = { '*': star as ActionFn<void> };
     const empty: HitResult = { category: 'empty', kind: 'empty' };
     expect(resolveRoute(table, empty, noMods)?.action).toBe(star);
     expect(resolveRoute(table, empty, noMods)?.matchedKey).toBe('*');
   });
   ```

2. **Add a precedence guard test** right after it:

   ```ts
   it('explicit empty beats * for empty hits', () => {
     const star = vi.fn();
     const onEmpty = vi.fn();
     const table: RouteTable<void> = {
       '*':   star    as ActionFn<void>,
       empty: onEmpty as ActionFn<void>,
     };
     const empty: HitResult = { category: 'empty', kind: 'empty' };
     expect(resolveRoute(table, empty, noMods)?.action).toBe(onEmpty);
     expect(resolveRoute(table, empty, noMods)?.matchedKey).toBe('empty');
   });
   ```

3. Run `vitest run src/tools/routing/lookup.test.ts` — the renamed
   test should fail, the precedence guard should pass (since `'empty'`
   is already first in the lookup order today).

4. **Apply the one-line fix** in `src/tools/routing/lookup.ts`:

   ```ts
   if (hit.category === 'empty') return ['empty', '*'];
   ```

5. Re-run vitest — both tests should pass.

**Done when:** both tests green; `tsc --noEmit` clean.

## T2: collapse kit builtins that duplicate `'*'`/`'empty'`

**Goal:** remove the now-redundant `empty:` entries from every
builtin that listed the same handler for both keys. No behavior
change — just less code and clearer intent.

**Files (in order of clarity, smallest first):**

1. **`src/tools/builtin/useEyedropperTool.ts`**
   - Edit `pointerDown` route: drop the `empty: claimAtDown` line.
   - Update the surrounding comment to remove the "Empty is listed
     alongside '*' because the routing engine's '*' doesn't fall
     through to 'empty'" apology.
   - **Do not touch** `click` — that one has different handlers per
     key.

2. **`src/tools/builtin/useEditAnchorsTool.ts`**
   - Edit `pointerDown`: drop the `empty: (ctx) => { … }` block. The
     `'*'` handler does the same thing (hand-rolled hit-test).
   - Update the comment block (lines ~90–95) to describe the new
     semantic.

3. **`src/tools/builtin/useCloneTool.ts`**
   - Edit `pointerDown`: drop the explicit `rect`, `text`, `path`,
     and `empty` entries. Keep only `'*': onPointerDown`.
   - Update the comment to: "Universal route — the tool runs its own
     pickBest regardless of ctx.target.kind, so `'*'` (which now
     includes empty) covers every gesture."

4. **`src/tools/builtin/useSelectTool.ts`** — two routes to collapse:
   - `pointerDown`: drop `empty: pointerDownBody`.
   - `dblTap`: drop `empty: forwardDblTap`.
   - Leave `drag` and `click` alone — different handlers per key.
   - Update the two surrounding comments accordingly.

**TDD signal:** after each edit, run the tool's matching test file
(`useSelectTool.test.ts`, `useEyedropperTool.test.ts`, etc.). All
should continue to pass — this is a refactor, not a behavior change.

**Done when:** every builtin route table is minimal; all builtin
tool tests green; `tsc --noEmit` clean.

## T3: accept new semantic in tools that have `'*'` without `'empty'`

**Goal:** tools that previously declared `'*'`-only routes now also
receive empty hits. Audit each to confirm this is the desired
behavior; no code edits required unless behavior changed.

**Files:**

1. **`src/tools/builtin/useUserPenTool.ts`** — `pointerDown` and
   `click` are both `'*'`-only. The pen tool is fundamentally about
   placing points in empty space, so the new semantic is correct.
   **No code change.** Verify by running `useUserPenTool.test.tsx`.

2. **`src/tools/builtin/defineDragInsertTool.ts`** — `click` is
   `'*'`-only with a comment claiming "Universal route — fires for
   every target (empty, node, affordance)." Under the old semantic
   this was wrong; under the new one it's correct. **No code change**;
   the comment becomes accurate retroactively.

3. **Demo:** `demo/demos/ToolReflectionDemo.tsx` rebuilds a
   `ToolDef` mirroring select-tool routes. Drop the `empty: noOp`
   entries from `pointerDown` and `drag` and `dblTap` to keep the
   demo in sync with the real builtin. (`click` retains `empty:` —
   different shape there.)

**TDD signal:** run the relevant test files; existing tests should
pass unchanged.

**Done when:** audit complete, demo updated, tests green.

## T4: update the original routing spec doc

**File:**
`docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`

**Goal:** the "Lookup precedence" section's incorrect sentence is
flagged and a forward-pointer to the new spec is added.

**Steps:**

1. In the "Lookup precedence" section (around line 241), append a
   note after the line `\`'empty'\` is its own kind; it doesn't fall
   through to \`'*'\`. To match both, list them separately.`:

   > **Update 2026-05-13:** this was reversed. `'*'` now matches
   > empty hits too — empty falls through to `'*'` when no explicit
   > `'empty'` entry is present. Explicit `'empty'` still wins
   > because it's checked first. See
   > `docs/superpowers/specs/2026-05-13-wildcard-empty-design.md`.

2. Strike through (or wrap in a "~~old:~~" marker) the incorrect
   sentence to keep the historical record but make it unmistakably
   obsolete.

**Done when:** the doc reads clearly to someone arriving fresh —
they should not be able to walk away believing the old behavior is
current.

## T5: regression sweep

**Goal:** confirm nothing slipped.

**Commands:**

```bash
tsc --noEmit
vitest run
```

Then:

- Manual smoke in swillustrator: pick eyedropper, click empty space
  (background should be picked or onEmptyClick should fire as
  appropriate); switch to select tool, click empty space (should
  clear selection); marquee-drag from empty (should still work);
  alt-drag a rect with clone tool (should still clone).
- Check test count: should match pre-change count exactly (T1 renames
  one test and adds one — net +1). Anything else shifting suggests
  an over-broad collapse.

**Done when:** typecheck clean; full vitest green; smoke covers
select, eyedropper, clone, pen tools with at least one empty-hit
interaction each.

## Out of scope

- Renaming `'*'` to something more evocative (e.g. `'any'`).
- Introducing a `'**'` syntax for "really truly everything including
  affordances regardless of subkind." The four-level grammar plus
  empty fall-through covers known cases.
- Reflection/debug-overlay updates beyond what falls out of T1's
  `matchedKey` change (which already returns `'*'` for empty hits
  matched via fall-through — no extra code needed).
