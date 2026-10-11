# Move Action Phase Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: unbuilt.** This is step 1 of three in
`docs/superpowers/specs/2026-10-11-move-action-decomposition-design.md`. Delete this file when it merges.

**Goal:** Replace the 1,426-line `packages/core/src/interactions/actions/defaults/move.ts` with modules under `actions/move/` split by phase of the drag, and add a `check:size` ratchet so files stop growing.

**Architecture:** One readonly `MoveSession` is captured at press. Each `onMove` produces a `MoveFrame`. The release runs an ordered chain of commit paths that each return ops. Helpers take the session and return values; none writes into shared scratch.

**Tech Stack:** TypeScript, vitest (`--project=core`), the TypeScript compiler API for the size check.

## Ground rules for every task

- Work in the worktree from Task 0. Every path below is relative to that worktree's root; use its absolute path in every command and edit.
- Never start a browser. Never run the full suite locally; run only the files a task names.
- Commit by path: `git commit -m "…" -- <paths>`. Never `git add -A`.
- "Move verbatim" means cut the named function from `actions/move/action.ts` and paste it unchanged except for the signature change the task states. Do not rewrite logic, rename locals, or edit comments while moving.
- The move tests are the safety net. After each task run:
  `npx vitest run --project=core packages/core/src/interactions/actions/move packages/core/src/interactions/actions/__tests__ packages/core/src/interactions/dispatcher/move.integration.test.tsx packages/core/src/interactions/actions/planeInput.test.ts packages/core/src/interactions/actions/buildDeps.test.ts`
  Expected: every file passes, with the same test count as the Task 0 baseline. This is "the move suite" below.
- Typecheck is `npm run typecheck` (not a bare `tsc`).
- No file in `actions/move/` ends over 250 lines; no function over 80.
- Changesets are `patch`, always.

## File structure at the end

```
packages/core/src/interactions/actions/move/
  action.ts            descriptor; start/onMove/onEnd wiring
  session.ts           MoveSession, MoveFrame, beginMove
  capture.ts           what beginMove captures: start poses, frames, plane refs, gesture context
  delta.ts             planeDelta, localDelta, grabbedPoseAdapter, draggedWorldPose
  translate.ts         translateOps, unreleasedIds
  frame.ts             nextFrame: behaviors fold + previews for one move
  layout/types.ts      LayoutPlacement, LayoutPass, DropPass
  layout/dragged.ts    gatherDragged, carryDragged, selectionCenter
  layout/container.ts  pointInBounds, regionContains, pickContainer
  layout/dropPass.ts   runDropPass, groupBySourceContainer, sourceReflow
  layout/exits.ts      resolveLayoutExits
  layout/glide.ts      catchGliding, stepGlide, releasedPoses, landReleased
  commit/rebase.ts     rebaseTransformOp
  commit/layoutDrop.ts layoutDropOps
  commit/layoutRelease.ts layoutReleaseOps
  commit/reparent.ts   resolveDropTarget, reparentOps
  commit/index.ts      commitMove
  (existing) gestureAdapter.ts, landedDescendants.ts, options.ts, behaviors/, index.ts
  (moved in) move.*.test.ts, forNode.test.ts stays in defaults/
packages/core/src/features/groups/scenePoseAdapter.ts
scripts/check-size.mjs, check-size.d.mts, check-size.test.ts, check-size.allow.json
```

---

### Task 0: Worktree and baseline

- [ ] **Step 1: Create the worktree and enter it**

```bash
git -C /Users/mike/src/weasel worktree add ../weasel-move-split -b move-phase-split main
```

Then call `EnterWorktree` with path `/Users/mike/src/weasel-move-split` and say in chat that the session moved.

- [ ] **Step 2: Install**

Run: `npm ci`
Expected: exits 0. Do not commit `package-lock.json` if it changes.

- [ ] **Step 3: Record the baseline**

Run the move suite, but with the pre-move paths:
`npx vitest run --project=core packages/core/src/interactions/actions/defaults/move packages/core/src/interactions/actions/move packages/core/src/interactions/actions/__tests__ packages/core/src/interactions/dispatcher/move.integration.test.tsx packages/core/src/interactions/actions/planeInput.test.ts packages/core/src/interactions/actions/buildDeps.test.ts`
Expected: all pass. Write down the file count and test count; every later run must match them (plus the tests this plan adds).

---

### Task 1: `check:size`

**Files:**
- Create: `scripts/check-size.mjs`, `scripts/check-size.d.mts`, `scripts/check-size.test.ts`, `scripts/check-size.allow.json`
- Modify: `package.json` (scripts), `.github/workflows/ci.yml` (after the `check:frame-loops` step)

- [ ] **Step 1: Write the failing test**

`scripts/check-size.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { measure, verdict } from './check-size.mjs';

const CAPS = { lines: 400, fn: 120 };
const fnOf = (n: number) => `function f() {\n${'  x();\n'.repeat(n - 2)}}\n`;

describe('measure', () => {
  it('counts lines the way wc does', () => {
    expect(measure('a;\nb;\n').lines).toBe(2);
    expect(measure('a;\nb;').lines).toBe(2);
  });

  it('measures the longest function, nested ones included', () => {
    expect(measure(fnOf(10)).longestFunction).toBe(10);
    expect(measure(`const o = {\n  start() {\n    a();\n    b();\n  },\n};\n`).longestFunction).toBe(4);
    expect(measure(`const f = () => {\n  a();\n};\n`).longestFunction).toBe(3);
  });

  it('does not count a signature with no body', () => {
    expect(measure('interface A {\n  f(\n    a: number,\n  ): void;\n}\n').longestFunction).toBe(0);
  });

  it('parses tsx', () => {
    expect(measure('const A = () => (\n  <div />\n);\n', 'a.tsx').longestFunction).toBe(3);
  });
});

describe('verdict', () => {
  it('passes a file under both caps with no entry', () => {
    expect(verdict({ lines: 400, longestFunction: 120 }, undefined, CAPS)).toBe('ok');
  });

  it('fails a file over a cap with no entry', () => {
    expect(verdict({ lines: 401, longestFunction: 10 }, undefined, CAPS)).toBe('over');
    expect(verdict({ lines: 10, longestFunction: 121 }, undefined, CAPS)).toBe('over');
  });

  it('lets an allowlisted file stay at its recorded size', () => {
    expect(verdict({ lines: 900, longestFunction: 300 }, { lines: 900, longestFunction: 300 }, CAPS)).toBe('ok');
  });

  it('fails an allowlisted file that grew', () => {
    expect(verdict({ lines: 901, longestFunction: 10 }, { lines: 900 }, CAPS)).toBe('over');
    expect(verdict({ lines: 900, longestFunction: 121 }, { lines: 900 }, CAPS)).toBe('over');
  });

  it('fails an entry the file has shrunk below, so the gain is kept', () => {
    expect(verdict({ lines: 700, longestFunction: 10 }, { lines: 900 }, CAPS)).toBe('stale');
    expect(verdict({ lines: 100, longestFunction: 10 }, { lines: 900 }, CAPS)).toBe('stale');
    expect(verdict({ lines: 900, longestFunction: 200 }, { lines: 900, longestFunction: 300 }, CAPS)).toBe('stale');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/check-size.test.ts`
Expected: FAIL, cannot resolve `./check-size.mjs`.

- [ ] **Step 3: Write the script**

`scripts/check-size.d.mts`:

```ts
export interface Size { lines: number; longestFunction: number }
export interface Allowed { lines?: number; longestFunction?: number }
export function measure(source: string, fileName?: string): Size;
export function verdict(size: Size, allowed: Allowed | undefined, caps: { lines: number; fn: number }): 'ok' | 'over' | 'stale';
```

`scripts/check-size.mjs`:

```js
#!/usr/bin/env node
/**
 * A source file past a few hundred lines is several things sharing one file,
 * and a function past a hundred is several steps sharing one body. This fails
 * the build on a new one.
 *
 * Files already over a cap are recorded in `check-size.allow.json` at the size
 * they had when recorded. An entry is a ceiling that only comes down: the file
 * fails when it grows past it, and the entry fails when the file shrinks below
 * it, until `npm run check:size -- --update` lowers it.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export const CAPS = { lines: 400, fn: 120 };

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'examples', 'generated']);
const isSource = (name) =>
  /\.(ts|tsx)$/.test(name) &&
  !/\.(test|spec|stories)\.(ts|tsx)$/.test(name) &&
  !name.endsWith('.d.ts');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (isSource(entry)) yield full;
  }
}

/** A file's line count and the line span of its longest function with a body. */
export function measure(source, fileName = 'file.ts') {
  const kind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
  let longestFunction = 0;
  const visit = (node) => {
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      longestFunction = Math.max(longestFunction, lineOf(node.getEnd()) - lineOf(node.getStart(sf)) + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
  return { lines, longestFunction };
}

/** What an entry for `size` records: only the measures over their cap. */
function entryFor(size, caps) {
  const entry = {};
  if (size.lines > caps.lines) entry.lines = size.lines;
  if (size.longestFunction > caps.fn) entry.longestFunction = size.longestFunction;
  return entry;
}

export function verdict(size, allowed, caps) {
  const maxLines = Math.max(caps.lines, allowed?.lines ?? 0);
  const maxFn = Math.max(caps.fn, allowed?.longestFunction ?? 0);
  if (size.lines > maxLines || size.longestFunction > maxFn) return 'over';
  if (!allowed) return 'ok';
  const now = entryFor(size, caps);
  return now.lines === allowed.lines && now.longestFunction === allowed.longestFunction ? 'ok' : 'stale';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const ALLOW = join(ROOT, 'scripts', 'check-size.allow.json');
  const update = process.argv.includes('--update');
  const seeding = update && !existsSync(ALLOW);
  const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : {};

  const next = {};
  const over = [];
  const stale = [];
  for (const pkg of readdirSync(join(ROOT, 'packages')).sort()) {
    const src = join(ROOT, 'packages', pkg, 'src');
    if (!existsSync(src) || !statSync(src).isDirectory()) continue;
    for (const file of walk(src)) {
      const rel = relative(ROOT, file);
      const size = measure(readFileSync(file, 'utf8'), file);
      const result = seeding ? 'stale' : verdict(size, allow[rel], CAPS);
      const entry = entryFor(size, CAPS);
      const keep = Object.keys(entry).length > 0;
      if (result === 'over') {
        over.push(`  ${rel}  ${String(size.lines).padStart(5)} lines, longest function ${String(size.longestFunction).padStart(4)}`);
        if (allow[rel]) next[rel] = allow[rel];
      } else if (keep) {
        next[rel] = entry;
        if (result === 'stale') stale.push(`  ${rel}`);
      } else if (result === 'stale') {
        stale.push(`  ${rel}`);
      }
    }
  }

  if (update) {
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    writeFileSync(ALLOW, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`check:size — allowlist written, ${Object.keys(sorted).length} entries.`);
  }
  if (over.length > 0) {
    console.error(
      `check:size — over ${CAPS.lines} lines or a function over ${CAPS.fn}, past what the allowlist records:\n` +
        over.join('\n') +
        '\n\nSplit the file along what owns what. --update never raises an entry.',
    );
    process.exit(1);
  }
  if (stale.length > 0 && !update) {
    console.error(
      'check:size — these shrank below their allowlist entry:\n' + stale.join('\n') +
        '\n\nRun `npm run check:size -- --update` to keep the gain.',
    );
    process.exit(1);
  }
  if (!update) console.log('sizes: no file or function grew past its cap.');
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/check-size.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Wire it and seed the allowlist**

In `package.json` scripts, after `"check:frame-loops"`:

```json
    "check:size": "node scripts/check-size.mjs",
```

In `.github/workflows/ci.yml`, after the `- run: npm run check:frame-loops` step:

```yaml
      # No source file or function grows past its cap; the allowlist's entries
      # only come down.
      - run: npm run check:size
```

Run: `npm run check:size -- --update` then `npm run check:size`
Expected: first prints `allowlist written, N entries`; second prints `sizes: no file or function grew past its cap.` Confirm `scripts/check-size.allow.json` lists `packages/core/src/interactions/actions/defaults/move.ts` with `"lines": 1426`.

Run: `npm run check:test-projects`
Expected: passes (a vitest project collects `scripts/check-size.test.ts`). If it reports the file uncollected, add it wherever `scripts/check-frame-loops.test.ts` is listed.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-size.mjs scripts/check-size.d.mts scripts/check-size.test.ts scripts/check-size.allow.json
git commit -m "add check:size, a ratchet on file and function length" -- scripts/check-size.mjs scripts/check-size.d.mts scripts/check-size.test.ts scripts/check-size.allow.json package.json .github/workflows/ci.yml
```

---

### Task 2: The rule in `CLAUDE.md`

**Files:** Modify `CLAUDE.md` (insert before `## Frame loops`)

- [ ] **Step 1: Add the section**

```markdown
## Module shape

**A helper takes what it reads and returns what it produces. No module takes
another's scratch whole.** A function handed a 28-field bag can be moved to
another file and is no more separate for it. Split an action's state by when it
changes — captured at press and readonly, replaced each frame, or private to one
behavior — and pass each function the part it uses.

`npm run check:size` fails on a source file over 400 lines or a function over
120. Files already over are recorded in `scripts/check-size.allow.json`, and an
entry only comes down: `npm run check:size -- --update` lowers it after a split
and never raises it.
```

- [ ] **Step 2: Commit**

```bash
git commit -m "state the module-shape rule and name check:size in CLAUDE.md" -- CLAUDE.md
```

---

### Task 3: Move the file and its tests into `actions/move/`

**Files:**
- Move: `actions/defaults/move.ts` → `actions/move/action.ts`
- Move: `actions/defaults/move.*.test.ts` and `move.test.ts` → `actions/move/`
- Modify: every importer

(`actions/` below is `packages/core/src/interactions/actions/`.)

- [ ] **Step 1: Move with git**

```bash
cd packages/core/src/interactions/actions
git mv defaults/move.ts move/action.ts
for f in defaults/move.test.ts defaults/move.*.test.ts; do git mv "$f" "move/$(basename "$f")"; done
```

- [ ] **Step 2: Fix relative imports inside the moved files**

In `move/action.ts`, each `'../X'` that pointed at `actions/X` still does; each `'../move/X'` becomes `'./X'`; `'../../gestures/…'` and `'../../../layout/types'` are unchanged (same depth). In the moved tests, `'./move'` becomes `'./action'` and `'../depSchema'`-style imports are unchanged.

- [ ] **Step 3: Repoint importers**

Find them: `git grep -nE "defaults/move'|from '\./move'" -- packages apps`. Change each to the new path:

| File | New specifier |
|---|---|
| `packages/core/src/barrel/routing.ts` | `'../interactions/actions/move/action'` |
| `actions/defaults/index.ts` | `'../move/action'` |
| `actions/defaults/forNode.test.ts` | `'../move/action'` |
| `actions/useStandardActions.ts`, `actions/buildDeps.test.ts`, `actions/planeInput.test.ts` | `'./move/action'` |
| `actions/__tests__/geometryContract.test.ts` | `'../move/action'` |
| `actions/move/gestureAdapter.test.ts` | `'./action'` |
| `packages/core/src/interactions/dispatcher/move.integration.test.tsx` | `'../actions/move/action'` |

- [ ] **Step 4: Verify**

Run: `npm run typecheck` — expected: exits 0.
Run the move suite — expected: baseline counts.
Run: `npm run check:test-projects` — expected: passes.
In `scripts/check-size.allow.json`, rename the key `…/defaults/move.ts` to `…/move/action.ts` by hand (same numbers), then `npm run check:size` — expected: passes.

- [ ] **Step 5: Commit**

```bash
git add -u packages/core/src/interactions packages/core/src/barrel scripts/check-size.allow.json
git add packages/core/src/interactions/actions/move
git commit -m "move the move action and its tests into actions/move/"
```

(`git add -u` here stages only tracked files under those paths; check `git status` shows nothing staged outside them before committing.)

---

### Task 4: `scenePoseAdapter` leaves move

**Files:**
- Create: `packages/core/src/features/groups/scenePoseAdapter.ts`
- Modify: `actions/move/action.ts`

- [ ] **Step 1: Create the module** with the function moved verbatim:

```ts
import { definesFrame, documentPose } from 'core/scene/effectivePose';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseAdapter } from './composePose';

/** A `PoseAdapter` over a `Scene`. `getParent` answers the live parent at
 *  call time, so a parent changed mid-batch composes correctly. */
export function scenePoseAdapter(scene: Scene<unknown, string, unknown>): PoseAdapter<unknown> {
  return {
    getPose: (id) => documentPose(scene, scene.get(id as NodeId)!),
    getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => {
      const node = scene.get(id as NodeId);
      return node === undefined || definesFrame(node);
    },
  };
}
```

- [ ] **Step 2:** Delete `scenePoseAdapter` from `action.ts`, import it from `'features/groups/scenePoseAdapter'`, and drop `definesFrame`/`documentPose` from the `effectivePose` import only if nothing else in the file uses them (`documentPose` is still used by `hold`).

- [ ] **Step 3:** Run `npm run typecheck` and the move suite. Expected: clean, baseline counts.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/groups/scenePoseAdapter.ts
git commit -m "lift scenePoseAdapter out of the move action" -- packages/core/src/features/groups/scenePoseAdapter.ts packages/core/src/interactions/actions/move/action.ts
```

---

### Task 5: `MoveSession`, `MoveFrame`, and the transitional alias

Splits the type first so every later task can narrow one helper at a time with the tests green.

**Files:**
- Create: `actions/move/session.ts`, `actions/move/layout/types.ts`
- Modify: `actions/move/action.ts`

- [ ] **Step 1: Create `layout/types.ts`** — move `LayoutPlacement` and `LayoutPass` verbatim from `action.ts` (with their doc comments and the `layout/types` imports they need: `LayoutStrategy`, `LayoutContainer`, `LayoutChild`, `LayoutDragged`, `DropTarget as LayoutDropTarget` from `'../../../../layout/types'`), export both, and add:

```ts
/** One frame's layout result. `dropCenter` is set whenever anything was
 *  dragged, whether or not a container took the drop. */
export interface DropPass {
  dropCenter: { x: number; y: number };
  /** Null when no container accepted every member of the selection. */
  pass: LayoutPass | null;
  /** Displaced siblings' poses this frame, in each one's stored frame. */
  reflow: Map<NodeId, unknown>;
}
```

- [ ] **Step 2: Create `session.ts`** with the types (`beginMove` arrives in Task 11):

```ts
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { PoseComposition } from 'features/groups/composePose';
import type { GestureContext, MoveBehavior } from '../../gestures/types';
import type { LayoutDep, NodeAtPointDep } from '../depSchema';
import type { GeometryProjection } from '../geometryProjection';
import type { GestureLifecycle } from '../gestureLifecycle';
import type { MoveGestureAdapter } from './gestureAdapter';
import type { LayoutPass } from './layout/types';

export type ReparentOnDrop = 'off' | 'top' | 'above';

/** What a move captured at press. Nothing here changes during the drag. */
export interface MoveSession {
  readonly scene: Scene<unknown, string, unknown>;
  /** The drag roots. */
  readonly ids: readonly NodeId[];
  /** Descendants of the roots, previewed along with them. */
  readonly cascadeIds: readonly NodeId[];
  /** Start pose of every root and descendant. */
  readonly startPoses: ReadonlyMap<NodeId, unknown>;
  /** Ids whose frame is itself moving, so they ride it and are not translated. */
  readonly carried: ReadonlySet<NodeId>;
  /** For each moved id stored under a frame: its world pose and the frame's, at press. */
  readonly frames: ReadonlyMap<NodeId, { world: unknown; frameWorld: unknown }>;
  /** Ids grabbed mid-glide, with how far the pose shown stood from the document's. */
  readonly caught: ReadonlyMap<NodeId, { dx: number; dy: number }>;
  /** Per layer on another plane than the edited one: a point of its first root, in both. */
  readonly planeRefs: ReadonlyMap<string, { own: { x: number; y: number }; edited: { x: number; y: number } }>;
  readonly view: unknown;
  readonly projection: PoseDescriptor<unknown>;
  readonly descriptorOf: (id: NodeId | string) => PoseDescriptor<unknown>;
  readonly pc: PoseComposition<unknown>;
  readonly behaviors: readonly MoveBehavior<unknown>[];
  /** Reused across the drag; behaviors mutate its `scratch`. */
  readonly gestureCtx: GestureContext<unknown>;
  readonly adapter: MoveGestureAdapter<unknown>;
  readonly layout: LayoutDep | undefined;
  readonly applyOps?: (ops: Op[], label: string) => void;
  readonly geometryProjection?: GeometryProjection;
  readonly lifecycle: GestureLifecycle;
  readonly nodeAtPoint: NodeAtPointDep | undefined;
  readonly reparentOnDrop: ReparentOnDrop;
  readonly dragThresholdPx: number;
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface MoveFrame {
  readonly delta: { dx: number; dy: number };
  /** Stored-frame pose of every displaced id, roots and descendants. The
   *  layout pass adds the siblings it displaced. */
  readonly previews: Map<NodeId, unknown>;
}

/** The drag's state that is neither: what it publishes and what the layout
 *  pass last decided. Step 3 of the spec moves the layout half into a behavior. */
export interface MoveLive {
  currentDelta: { dx: number; dy: number };
  previews: Map<NodeId, unknown>;
  overrideEntries: Map<NodeId, { pose: unknown }>;
  reflowTargets: Map<NodeId, unknown>;
  gliding: Set<NodeId>;
  layoutPass: LayoutPass | null;
  dropCenter: { x: number; y: number } | null;
  lastWorld: { x: number; y: number } | null;
}
```

- [ ] **Step 3: Alias in `action.ts`.** Delete the `MoveScratch` interface, `LayoutPlacement`, `LayoutPass`, and the `ReparentOnDrop` type from `action.ts`, and add:

```ts
import type { MoveLive, MoveSession, ReparentOnDrop } from './session';
import type { LayoutPass, LayoutPlacement } from './layout/types';
export type { ReparentOnDrop };
/** Transitional: every helper is narrowed off this by the end of the plan. */
type MoveScratch = MoveSession & MoveLive;
```

In `start()`, add `reparentOnDrop` and `dragThresholdPx` to the `scratch` literal (computed from `params` exactly as `commitMove` and the existing `dragThresholdPx` local do today) and replace the later re-read of `reparentOnDrop` in `commitMove` with `scratch.reparentOnDrop`. `planeRefs` is filled after the literal is built; build it before, as a local `Map`, and pass it in. Type the literal `const scratch: MoveScratch = { … }`; the `readonly` fields accept the mutable maps.

- [ ] **Step 4:** `npm run typecheck`, the move suite. Expected: clean, baseline counts.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interactions/actions/move/session.ts packages/core/src/interactions/actions/move/layout/types.ts
git commit -m "split the move scratch into a readonly session and its live state" -- packages/core/src/interactions/actions/move
```

---

### Task 6: `delta.ts`

**Files:** Create `actions/move/delta.ts`; modify `action.ts`.

- [ ] **Step 1: Create the module.** Move `planeDelta`, `localDelta`, and `grabbedPoseAdapter` verbatim, changing each `scratch: MoveScratch` parameter to `session: MoveSession` (and `scratch.` to `session.` in the bodies), export them, and add:

```ts
/** The world pose `id` was dragged to: its pose at press composed up through
 *  `adapter`, moved by the drag as its own layer's plane measures it. */
export function draggedWorldPose(
  session: MoveSession,
  adapter: PoseAdapter<unknown>,
  id: NodeId,
  delta: { dx: number; dy: number },
): unknown {
  const start = composeWorldPose(adapter, id as string, session.pc.compose);
  const own = planeDelta(session, id, delta.dx, delta.dy);
  return translatePoseViaDescriptor(start, own.dx, own.dy, session.descriptorOf(id));
}
```

Imports: `composeWorldPose`, `type PoseAdapter` from `'features/groups/composePose'`; `translatePoseViaDescriptor` from `'core/geometry/poseDescriptor'`; `planeOf` from `'../planeInput'`; `toPlane` from `'core/viewport/parallax'`; `NodeId` from `'core/scene/types'`; `MoveSession` from `'./session'`.

`adapter` is a parameter on purpose: reparent-on-drop passes the plain scene adapter and the layout paths pass `grabbedPoseAdapter(session, …)`, as they do today. Do not unify them here.

- [ ] **Step 2: Use it at the three sites in `action.ts` that have `startWorld` only to translate it** — in `applyReparent`, and the two in the release branch of `commitMove` (`releaseDrop`'s `pose:` and the exits loop's `world`). The release site still needs `startWorld` for `originPose`; keep that line and replace only the `translatePoseViaDescriptor(startWorld, own.dx, own.dy, …)` expression with `draggedWorldPose(scratch, grabbedPoseAdapter(scratch, commitAdapter), id, { dx, dy })`. `runLayoutPass` keeps its own (it uses `poseDescriptorForNode`, not `descriptorOf`); Task 8 moves it as-is.

- [ ] **Step 3:** `npm run typecheck`, the move suite. Expected: clean, baseline counts.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/interactions/actions/move/delta.ts
git commit -m "move the drag-delta math into move/delta" -- packages/core/src/interactions/actions/move
```

---

### Task 7: `translate.ts`

**Files:** Create `actions/move/translate.ts`; modify `action.ts`.

- [ ] **Step 1:** Move `translateCommitOps` verbatim, renamed `translateOps`, with signature

```ts
export function translateOps(session: MoveSession, ids: Iterable<NodeId>, delta: { dx: number; dy: number }): Op[]
```

(replace the body's `dx`/`dy` with `delta.dx`/`delta.dy`), and `unreleasedIds` verbatim with `session: MoveSession`. Update the three call sites in `action.ts` to pass `{ dx, dy }`.

- [ ] **Step 2:** `npm run typecheck`, the move suite. Expected: clean, baseline counts.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/interactions/actions/move/translate.ts
git commit -m "move the default translate commit into move/translate" -- packages/core/src/interactions/actions/move
```

---

### Task 8: The layout pass returns its result

**Files:** Create `actions/move/layout/dragged.ts`, `container.ts`, `dropPass.ts`, `exits.ts`, `glide.ts`; modify `action.ts`.

`runLayoutPass` is 241 lines. It is cut at its own comment boundaries into the functions below. Bodies move verbatim; only what crosses a cut becomes a parameter or return value.

- [ ] **Step 1: `layout/dragged.ts`** — the part of `runLayoutPass` from `const d = scratch.projection` through the `selectionCenter` computation:

```ts
export interface DraggedChild {
  id: NodeId;
  arg: LayoutDragged<unknown>;
  center: { x: number; y: number };
}
/** Each dragged root in world, in the edited plane. */
export function gatherDragged(session: MoveSession, delta: { dx: number; dy: number }): DraggedChild[]
/** `c` carried into the plane `m` maps to; `c` itself when `m` is null. */
export function carryDragged(session: MoveSession, c: DraggedChild, m: PlaneMap | null): DraggedChild
/** Center of the bounds of everything dragged. */
export function selectionCenter(session: MoveSession, dragged: readonly DraggedChild[]): { x: number; y: number }
```

- [ ] **Step 2: `layout/container.ts`** — `regionContains` verbatim, plus the candidate walk and the pick:

```ts
export interface Bounds4 { x: number; y: number; width: number; height: number }
export function pointInBounds(b: Bounds4, at: { x: number; y: number }): boolean {
  return at.x >= b.x && at.x < b.x + b.width && at.y >= b.y && at.y < b.y + b.height;
}
export interface Candidate {
  id: NodeId;
  bounds: Bounds4;
  layout: LayoutStrategy<unknown>;
  zPath: number[];
  depth: number;
  /** The edited plane into this container's. */
  plane: PlaneMap | null;
}
/** The layout container that takes the drop at `center`, or null. */
export function pickContainer(
  session: MoveSession,
  dragged: readonly DraggedChild[],
  center: { x: number; y: number },
): Candidate | null
```

`pickContainer` holds `testInside`, `consider`, `walk`, and the topmost/innermost choice, verbatim. Replace the two hand-written AABB tests (in `testInside` here and in `holds` in `resolveLayoutExits`) with `pointInBounds`.

- [ ] **Step 3: `layout/dropPass.ts`** — `groupBySourceContainer` verbatim, and:

```ts
/** Place each dragged child in `dest` in turn. Null when the snap rejects
 *  any of them: a container that cannot take every member takes none. */
function placeAll(
  session: MoveSession, dest: Candidate, dragged: readonly DraggedChild[], probeOffset: { x: number; y: number },
): { placements: LayoutPlacement[]; destReflow: Map<NodeId, unknown> } | null

/** World poses of the leftovers that moved in each container the selection left. */
function sourceReflow(
  session: MoveSession, dragged: readonly DraggedChild[], destId: string,
): Map<string, unknown>

/** One frame's layout result, or null with no layout dep or nothing dragged. */
export function runDropPass(
  session: MoveSession,
  delta: { dx: number; dy: number },
  pointer: { x: number; y: number },
): DropPass | null
```

`runDropPass` does: return null without `session.layout`; `gatherDragged`; return null when empty; `selectionCenter`; `pickContainer`, returning `{ dropCenter, pass: null, reflow: new Map() }` when it is null; `placeAll`, same return when null; `sourceReflow`; then build `reflow` (each destination and source pose rebased to local with `rebaseLocalPose`, exactly as the two `showReflow` loops do) and `reflowIds`, and return `{ dropCenter, pass: { layout, container, placements, sourceReflow, reflowIds }, reflow }`.

`showReflow` is gone: the caller decides where `reflow` goes.

- [ ] **Step 4: `layout/exits.ts`** — `resolveLayoutExits` verbatim with signature

```ts
export function resolveLayoutExits(
  session: MoveSession, dropCenter: { x: number; y: number } | null, ids: Iterable<NodeId>,
): Map<NodeId, NodeId | null>
```

- [ ] **Step 5: `layout/glide.ts`**

```ts
/** Hold a node still gliding from an earlier reflow where it is shown. Returns
 *  how far that stands from its document pose, or null when it is not gliding. */
export function catchGliding(
  scene: Scene<unknown, string, unknown>,
  reflow: ReflowTransition | null,
  projection: PoseDescriptor<unknown>,
  id: NodeId,
): { dx: number; dy: number } | null

/** Send this frame's reflow targets gliding and settle what stopped reflowing. */
export function stepGlide(reflow: ReflowTransition, gliding: Set<NodeId>, targets: ReadonlyMap<NodeId, unknown>): void

export interface Released { local: unknown; parent: NodeId | null; world: unknown }
export function releasedPoses(session: MoveSession, previews: ReadonlyMap<NodeId, unknown>): Map<NodeId, Released>
export function landReleased(session: MoveSession, reflow: ReflowTransition, released: Map<NodeId, Released>): void
```

`catchGliding` is the body of the `hold` closure in `start()`, returning the offset instead of writing `caught`. `stepGlide` is the `if (reflow) { … }` block in `onMove`. `releasedPoses` and `landReleased` move verbatim.

- [ ] **Step 6: Call them from `action.ts`.** In `onMove`, replace the reset-and-`runLayoutPass` lines with:

```ts
const drop = runDropPass(scratch, scratch.currentDelta, moveCtx.drag.current);
scratch.dropCenter = drop?.dropCenter ?? null;
scratch.layoutPass = drop?.pass ?? null;
scratch.reflowTargets.clear();
const reflow = scratch.layout?.reflow;
for (const [id, pose] of drop?.reflow ?? []) {
  if (reflow) scratch.reflowTargets.set(id, pose);
  else scratch.previews.set(id, pose);
}
if (reflow) stepGlide(reflow, scratch.gliding, scratch.reflowTargets);
```

Delete `runLayoutPass`, `regionContains`, `groupBySourceContainer`, `resolveLayoutExits`, `releasedPoses`, `landReleased`, and `Released` from `action.ts`; update the remaining callers (`resolveLayoutExits(scratch, scratch.dropCenter, …)`, `releasedPoses(scratch, scratch.previews)`).

- [ ] **Step 7:** `npm run typecheck`, the move suite. Expected: clean, baseline counts. `move.layoutDropSubtree.test.ts` and the layout cases in `move.test.ts` are the ones that exercise this.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/interactions/actions/move/layout
git commit -m "make the move layout pass return its result instead of writing scratch" -- packages/core/src/interactions/actions/move
```

---

### Task 9: `commit/rebase.ts`, `layoutDrop.ts`, `layoutRelease.ts`

**Files:** Create the three; modify `action.ts`.

- [ ] **Step 1: `commit/rebase.ts`** — one function replaces `rebaseOpToLocal` and `rebaseReleased`:

```ts
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { rebaseLocalPose, type PoseAdapter, type PoseComposition } from 'features/groups/composePose';

/** A world-posed transform op as one in its node's stored frame: `from` under
 *  `fromParent`, `to` under `toParent`. Any other op is returned as it is. */
export function rebaseTransformOp(
  op: Op,
  adapter: PoseAdapter<unknown>,
  pc: PoseComposition<unknown>,
  fromParent: string | null,
  toParent: string | null,
): Op {
  if (op.name !== 'transform') return op;
  const a = op.args as { id: string; from: unknown; to: unknown; label?: string; coalesceKey?: string };
  return createTransformOp<unknown>({
    id: a.id,
    from: rebaseLocalPose(adapter, a.from, fromParent, pc.compose, pc.decompose),
    to: rebaseLocalPose(adapter, a.to, toParent, pc.compose, pc.decompose),
    label: a.label,
    coalesceKey: a.coalesceKey,
  });
}
```

Callers compute the parents: the drop path passes the node's current parent and `draggedIds.has(id) ? destId : current`; the release path passes the current parent twice. An op with no `id` in its args is passed through untouched before the parent lookup.

- [ ] **Step 2: `commit/layoutDrop.ts`**

```ts
/** The ops of a drop a layout container accepted: reparents, then each
 *  placement's `commitDrop`, then the source containers' reflow. */
export function layoutDropOps(session: MoveSession, pass: LayoutPass): Op[]
```

Body: the `if (scratch.layout && scratch.layoutPass) { … }` block of `commitMove` up to (not including) `if (ops.length > 0) commitOps(ops)`, returning `[...reparentOps, ...dropOps, ...reflowOps]`.

- [ ] **Step 3: `commit/layoutRelease.ts`**

```ts
/** What the source layouts and the exits decide for a drop no container took.
 *  `undefined` when none of them claims any dragged id. */
export function layoutReleaseOps(
  session: MoveSession,
  delta: { dx: number; dy: number },
  dropCenter: { x: number; y: number } | null,
): Op[] | undefined
```

Body: the `released`/`releasedOps`/`exits`/`exitOps` block of `commitMove`. Returns `undefined` when `released.size === 0 && exits.size === 0`, else `[...releasedOps, ...exitOps, ...translateOps(session, unreleasedIds(session, released).filter((id) => !exits.has(id)), delta)]`. It is over 80 lines as written; split the per-source loop into a local `releaseFrom(session, delta, srcId, leaving, adapter): { ops: Op[]; released: NodeId[] }` in the same file.

- [ ] **Step 4:** In `action.ts`'s `commitMove`, replace both blocks:

```ts
if (scratch.layout && scratch.layoutPass) {
  const ops = layoutDropOps(scratch, scratch.layoutPass);
  if (ops.length > 0) commitOps(ops);
  return committed;
}
const release = scratch.layout ? layoutReleaseOps(scratch, { dx, dy }, scratch.dropCenter) : undefined;
if (release !== undefined) {
  if (release.length > 0) commitOps(release);
  return committed;
}
```

- [ ] **Step 5:** `npm run typecheck`, the move suite. Expected: clean, baseline counts.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/interactions/actions/move/commit
git commit -m "move the layout drop and release commits into move/commit" -- packages/core/src/interactions/actions/move
```

---

### Task 10: Reparent-on-drop returns ops

The one behavior change. Today it writes to the scene inside `scene.batch`, bypassing a consumer's `applyOps`.

**Files:**
- Create: `actions/move/commit/reparent.ts`, `actions/move/move.reparentOps.test.ts`
- Modify: `actions/move/gestureAdapter.ts`, `actions/move/action.ts`
- Create: `.changeset/move-reparent-through-applyops.md`

- [ ] **Step 1: Write the tests**

`actions/move/move.reparentOps.test.ts`:

```ts
/**
 * Reparent-on-drop commits as ops: through the consumer's `applyOps` when one
 * is wired, and landing nothing when the container refuses the arrival.
 */
import { describe, it, expect, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { InvocationCtx } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { LayoutStrategy } from '../../../layout/types';
import { moveAction } from './action';

const A = asNodeId('a');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };

const refusing: LayoutStrategy<RectPose> = {
  snap: { pickTarget: () => null },
  childPoses: () => new Map(),
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
  commitDrop: () => [],
  arrive: () => null,
};

function makeScene(layout?: LayoutStrategy<RectPose>): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'leaf', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.add({
    id: T, kind: 'container', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 },
    ...(layout ? { layout } : {}),
  });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function drop(
  scene: Scene<unknown, string, unknown>,
  params: Record<string, unknown>,
  deps: Record<string, unknown> = {},
): void {
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(
    {
      world: { x: 5, y: 5 },
      modifiers: MODS,
      deps: { selection: { get: () => [A] as NodeId[] }, scene, nodeAtPoint: () => T, ...deps },
    } as unknown as InvocationCtx,
    { params: { reparentOnDrop: 'top', ...params } },
  );
  const at = { start: { x: 5, y: 5 }, current: { x: 55, y: 5 }, delta: { x: 50, y: 0 } };
  handle.onMove!({ world: { x: 55, y: 5 }, modifiers: MODS, deps: {}, drag: at } as unknown as InvocationCtx);
  handle.onEnd!({ world: { x: 55, y: 5 }, modifiers: MODS, deps: {}, drag: at } as unknown as InvocationCtx, 'commit');
}

describe('moveAction — reparentOnDrop commits as ops', () => {
  it('hands the reparent to the consumer applyOps hook', () => {
    const scene = makeScene();
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    drop(scene, {}, { applyOps });
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(applyOps.mock.calls[0][0].map((op) => op.name)).toEqual(['reparent', 'transform']);
    expect(scene.get(A)!.parent).toBe(null);
  });

  it('undoes a reparent in one step', () => {
    const scene = makeScene();
    drop(scene, {});
    expect(scene.get(A)!.parent).toBe(T);
    scene.undo();
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('lands nothing and reports no commit when the container refuses', () => {
    const scene = makeScene(refusing);
    const onGestureEnd = vi.fn();
    drop(scene, { onGestureEnd });
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('does the same when the move is transient', () => {
    const scene = makeScene(refusing);
    const onGestureEnd = vi.fn();
    drop(scene, { onGestureEnd, transient: true });
    expect(scene.get(A)!.parent).toBe(null);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run them against the current code**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/move/move.reparentOps.test.ts`
Expected: `hands the reparent to the consumer applyOps hook` FAILS (`applyOps` called 0 times). The other three PASS — they pin behavior the change must keep. If either refusal test fails here, stop and report: the test is not exercising what it claims.

- [ ] **Step 3: Give the gesture adapter `setLayer`.** In `gestureAdapter.ts`, add to the `MoveGestureAdapter` type `setLayer(id: string, layer: string): void;` and to the object `setLayer: (id, layer) => scene.setLayer(asNodeId(id), layer),`. `createSetLayerOp` applies through it.

- [ ] **Step 4: Write `commit/reparent.ts`.** Move `DropTarget` and `resolveDropTarget` verbatim, with signature `resolveDropTarget(session: MoveSession, at: { x: number; y: number } | null): DropTarget | null` (the caller computes `at` as `endCtx.drag ? endCtx.world : lastWorld`). Replace `applyReparent` with:

```ts
/** Reparent and reposition each moved root as ops, keeping the world pose the
 *  drag showed, then the ops that bring uncarried descendants along. */
export function reparentOps(
  session: MoveSession,
  target: DropTarget,
  delta: { dx: number; dy: number },
): Op[] {
  const { scene, pc, view } = session;
  const adapter = scenePoseAdapter(scene);
  const label = session.lifecycle.label;
  const ops: Op[] = [];
  // The destination's children as each op will find them: an earlier root's
  // landing shifts where a later one goes.
  const siblings = [...(target.newParent === null ? scene.roots : scene.childrenOf(target.newParent))];
  for (const id of session.ids) {
    if (!session.startPoses.has(id)) continue;
    const node = scene.get(id)!;
    const crossing = node.layer !== target.newLayer;
    const world = carryPose(
      session.descriptorOf(id),
      draggedWorldPose(session, adapter, id, delta),
      crossing ? planeToPlane(planeOf(view, node.layer), planeOf(view, target.newLayer)) : null,
    );
    const to = rebaseLocalPose(adapter, world, target.newParent as string | null, pc.compose, pc.decompose);

    let from = node.parent as string | null;
    if (crossing) {
      // The scene refuses a layer change on a node whose parent is on another layer.
      if (from !== null) {
        ops.push(createReparentOp({
          id: id as string, fromParentId: from, toParentId: null, label, coalesceKey: `reparent:${id}:orphan`,
        }));
        from = null;
      }
      ops.push(createSetLayerOp({ id: id as string, from: node.layer, to: target.newLayer, label }));
    }

    const was = siblings.indexOf(id);
    if (was >= 0) siblings.splice(was, 1);
    const hit = session.reparentOnDrop === 'above' && target.hitSibling
      ? siblings.indexOf(target.hitSibling)
      : -1;
    const toIndex = hit >= 0 ? hit + 1 : undefined;
    if (toIndex === undefined) siblings.push(id);
    else siblings.splice(toIndex, 0, id);

    ops.push(createReparentOp({
      id: id as string, fromParentId: from, toParentId: target.newParent as string | null, toIndex, label,
    }));
    ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to, label }));
  }
  return [...ops, ...translateOps(session, session.cascadeIds, delta)];
}
```

- [ ] **Step 5: Commit through `commitOps` in `action.ts`.** Replace the `reparentMode`/`dropTarget` lines and the `if (dropTarget) { … }` branch of `commitMove` (its `else` translate branch stays) with:

```ts
const dropTarget = scratch.reparentOnDrop !== 'off'
  ? resolveDropTarget(scratch, endCtx.drag ? endCtx.world : scratch.lastWorld)
  : null;
if (dropTarget) {
  const ops = reparentOps(scratch, dropTarget, { dx, dy });
  try {
    commitOps(ops);
  } catch (err) {
    // The transient path lets a refused arrival out; the recorded one reverts it inside the scene.
    if (!(err instanceof SceneArrivalRefused)) throw err;
  }
  // Either way a refusal leaves the roots where they were.
  committed = scratch.applyOps !== undefined
    || scratch.ids.some((id) => scratch.scene.get(id)?.parent === dropTarget.newParent);
}
```

Delete `applyReparent`, `resolveDropTarget`, and `DropTarget` from `action.ts`.

- [ ] **Step 6: Watch the naive version fail, then pass.** Before adding the `committed = …` line of Step 5 (leave `commitOps`'s own `committed = true`), run the test file: `lands nothing and reports no commit` must FAIL with `onGestureEnd` called with `true`. Add the line; all four PASS.

Run the move suite. Expected: baseline counts plus four. `move.reparentSubtree.test.ts`, `move.reparentEndCtx.test.ts`, and the `reparentOnDrop` cases in `move.test.ts`, `move.descriptor.test.ts`, and `planeInput.test.ts` are the regression net; a failure there is a real difference between the op path and the old direct writes, and gets fixed in `reparentOps`, not in the test.

- [ ] **Step 7: Changeset**

`.changeset/move-reparent-through-applyops.md`:

```markdown
---
'@weasel-js/core': patch
---

A move with `reparentOnDrop` now commits as ops (`reparent`, `setLayer`, `transform`) like every
other move commit, so it reaches a consumer's `applyOps` hook and history. It used to write to the
scene directly and bypass both. A consumer with its own history that relied on reparent drops
landing in the scene's history will now receive them instead.
```

Run: `npm run check:bumps` — expected: passes.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/interactions/actions/move/commit/reparent.ts packages/core/src/interactions/actions/move/move.reparentOps.test.ts .changeset/move-reparent-through-applyops.md
git commit -m "commit reparent-on-drop as ops, through the consumer applyOps hook" -- packages/core/src/interactions/actions/move .changeset/move-reparent-through-applyops.md
```

---

### Task 11: `capture.ts`, `beginMove`, `frame.ts`, `commit/index.ts`, and a thin `action.ts`

**Files:** Create `actions/move/capture.ts`, `frame.ts`, `commit/index.ts`; modify `session.ts`, `action.ts`.

- [ ] **Step 1: `capture.ts`** — the pieces of `start()` between the id resolution and the `scratch` literal, each verbatim behind a signature:

```ts
/** Start pose of each root and descendant, the descendants in walk order, and
 *  the offsets of any caught mid-glide. */
export function captureStartPoses(
  scene: Scene<unknown, string, unknown>, ids: readonly NodeId[],
  reflow: ReflowTransition | null, projection: PoseDescriptor<unknown>,
): { startPoses: Map<NodeId, unknown>; cascadeIds: NodeId[]; caught: Map<NodeId, { dx: number; dy: number }> }

/** Which ids ride a moving frame, and the world poses of the rest that sit under one. */
export function captureFrames(
  scene: Scene<unknown, string, unknown>, startPoses: ReadonlyMap<NodeId, unknown>, pc: PoseComposition<unknown>,
): { carried: Set<NodeId>; frames: Map<NodeId, { world: unknown; frameWorld: unknown }> }

/** For each layer on another plane: a point of its first root, in its own world and the edited one. */
export function capturePlaneRefs(
  scene: Scene<unknown, string, unknown>, ids: readonly NodeId[], view: unknown,
  frames: ReadonlyMap<NodeId, { world: unknown }>, startPoses: ReadonlyMap<NodeId, unknown>,
  projection: PoseDescriptor<unknown>,
): Map<string, { own: { x: number; y: number }; edited: { x: number; y: number } }>
```

`captureStartPoses` calls `catchGliding` for each node before reading its `effectivePose`, as `hold` is called today.

- [ ] **Step 2: `beginMove` in `session.ts`**

```ts
export interface MoveReaders {
  view: () => GestureContext<unknown>['view'];
  plane: () => GestureContext<unknown>['plane'];
}
/** Capture a drag at press. Null when there is nothing to move. Runs each
 *  behavior's `onStart`. */
export function beginMove(ctx: InvocationCtx, opts: BindingOpts | undefined): { session: MoveSession; readers: MoveReaders } | null
```

Body: the dep reads, the two early returns (`!selection || !scene`, `isAnchorOrControl`), `resolveParams`, `moveSources`, the three captures, the behaviors and lifecycle, the adapter, the `gestureCtx` literal, the `onStart` loop, and the `MoveSession` literal. It builds no `MoveLive`. Keep the comments that sit on those lines.

- [ ] **Step 3: `frame.ts`**

```ts
/** One move's delta and previews: the pointer's delta as the behaviors shaped
 *  it, and every displaced id's stored pose under it. */
export function nextFrame(session: MoveSession, readers: MoveReaders, moveCtx: InvocationCtx): MoveFrame
```

Body: `onMove` from `let dx = moveCtx.drag.delta.x` through the previews loop, returning `{ delta: { dx, dy }, previews }` with `previews` a new `Map`. Split the behavior fold into a local `foldBehaviors(session, readers, moveCtx, dx, dy): { dx; dy; posed: Map<NodeId, unknown> }` to stay under 80 lines.

- [ ] **Step 4: `commit/index.ts`**

```ts
export interface CommitInput {
  session: MoveSession;
  delta: { dx: number; dy: number };
  pass: LayoutPass | null;
  dropCenter: { x: number; y: number } | null;
  /** Where the pointer was let go; null when the end carried none and no move was seen. */
  at: { x: number; y: number } | null;
}
/** Commit the drag. Returns whether anything reached the document. */
export function commitMove(input: CommitInput): boolean
```

Body: `commitMove` from `action.ts`, with `commitOps` as a local and the paths in today's order: behaviors (`reduceBehaviorEnd`), the zero-delta return, `layoutDropOps`, `layoutReleaseOps`, reparent, `translateOps`.

- [ ] **Step 5: `action.ts` is what is left**

`start()` becomes:

```ts
start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
  const begun = beginMove(ctx, opts);
  if (!begun) return {};
  const { session, readers } = begun;
  const publish: PreviewOverrideState = { scene: session.scene, previews: new Map(), overrideEntries: new Map() };
  const gliding = new Set<NodeId>();
  let frame: MoveFrame = { delta: { dx: 0, dy: 0 }, previews: publish.previews };
  let drop: DropPass | null = null;
  let lastWorld: { x: number; y: number } | null = null;
  let engaged = false;
  return {
    kind: 'move',
    onMove(moveCtx: InvocationCtx): void {
      if (!moveCtx.drag) return;
      lastWorld = moveCtx.world;
      if (!engaged) {
        const s = moveCtx.drag.screenDelta;
        if (s && !pastDragThreshold({ clientX: 0, clientY: 0 }, { clientX: s.x, clientY: s.y }, session.dragThresholdPx)) return;
        engaged = true;
        session.lifecycle.start(session.ids as string[]);
      }
      frame = nextFrame(session, readers, moveCtx);
      drop = runDropPass(session, frame.delta, moveCtx.drag.current);
      const reflow = session.layout?.reflow;
      const targets = new Map<NodeId, unknown>();
      for (const [id, pose] of drop?.reflow ?? []) (reflow ? targets : frame.previews).set(id, pose);
      if (reflow) stepGlide(reflow, gliding, targets);
      // After the layout pass, so a reflowed sibling publishes too.
      publish.previews = frame.previews;
      syncPreviewOverrides(publish);
    },
    onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
      let committed = false;
      const reflow = session.layout?.reflow ?? null;
      const released = reflow ? releasedPoses(session, publish.previews) : null;
      try {
        // A press that never traveled `dragThresholdPx` was never a move:
        // its behaviors started, so they are canceled, not asked to commit.
        if (reason === 'commit' && engaged) {
          committed = commitMove({
            session,
            delta: frame.delta,
            pass: drop?.pass ?? null,
            dropCenter: drop?.dropCenter ?? null,
            at: endCtx.drag ? endCtx.world : lastWorld,
          });
        } else runBehaviorCancel(session.behaviors, session.gestureCtx);
      } finally {
        // After the commit, so no frame can paint the pre-drag pose between
        // the override going away and the document catching up.
        dropPreviewOverrides(publish);
        publish.previews.clear();
        if (reflow && released) {
          for (const id of gliding) reflow.settle(id as string);
          landReleased(session, reflow, released);
        }
        gliding.clear();
        session.lifecycle.end(committed);
      }
    },
    previewIds: () => publish.previews.keys(),
    previewPose: (id: string) => publish.previews.get(id as NodeId) ?? null,
    previewOpaqueIds: () => drop?.pass?.reflowIds ?? null,
  };
},
```

In `commitMove`, `landedDescendantOps` took `{ ...scratch, roots: scratch.ids, label }`; pass it
`{ scene, projection, startPoses, carried, roots: session.ids, label: session.lifecycle.label }`
from the session, and `commitGestureOps(session, session.lifecycle, …)`.

Delete the `MoveScratch` alias and `MoveLive` from `session.ts` and `action.ts`. Nothing may import `MoveLive` afterward: `git grep -n MoveLive packages/` prints nothing.

Keep the file's header doc comment, trimmed to what is still true of `action.ts`, and the `enabled` and `defaultBinding` comments.

- [ ] **Step 6: Verify**

Run: `npm run typecheck` — exits 0.
Run the move suite — baseline counts plus four.
Run: `wc -l packages/core/src/interactions/actions/move/*.ts packages/core/src/interactions/actions/move/*/*.ts | sort -rn | head` — no non-test file over 250.
Run: `npx vitest run --project=core packages/core/src/interactions` — expected: all pass (this is the directory the diff covers).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/interactions/actions/move/capture.ts packages/core/src/interactions/actions/move/frame.ts packages/core/src/interactions/actions/move/commit/index.ts
git commit -m "reduce the move action to wiring over a session, a frame, and a commit chain" -- packages/core/src/interactions/actions/move
```

---

### Task 12: Close out

- [ ] **Step 1: Ratchet.** Run `npm run check:size -- --update`, then `npm run check:size`. Expected: `packages/core/src/interactions/actions/move/action.ts` is gone from `scripts/check-size.allow.json`, and no `actions/move/` path is in it. If one is, a function there is over 120 lines: split it; do not keep the entry.

- [ ] **Step 2: The checks CI runs.** `npm run lint`, `npm run typecheck`, `npm run check:imports`, `npm run check:test-projects`, `npm run check:bumps`. Expected: each exits 0.

- [ ] **Step 3: `docs/TODO.md`.** Rewrite the entry that begins "**(P2) `defaults/move.ts` is 1,426 lines doing four jobs.**" to:

```markdown
- **(P2) A layout drop is not a move behavior.** `actions/move/` is split by phase, with the layout
  pass and reparent-on-drop as commit paths inside it. Steps 2 and 3 of
  `docs/superpowers/specs/2026-10-11-move-action-decomposition-design.md` are unbuilt: three
  additions to the behavior contract, then both paths lifted out as `MoveBehavior`s.
```

and delete the entry that begins "**(P3) An action's code has two homes.**" only if `actions/defaults/` holds no other action with a sibling directory; it does (resize, rotate, flip, …), so instead change its last sentence to "`move` is done; the rest follow it."

- [ ] **Step 4: The spec.** In `docs/superpowers/specs/2026-10-11-move-action-decomposition-design.md`, change the status line to "**Status: step 1 landed; steps 2 and 3 unbuilt.**", delete the "What is wrong" table rows step 1 fixed and the whole "Step 1" section, and delete the `check:size` and `CLAUDE.md` bullets under "Keeping it this way". Delete this plan file (`git rm`).

- [ ] **Step 5: Commit**

```bash
git rm -q docs/superpowers/plans/2026-10-11-move-action-phase-split.md
git commit -m "retire the move phase-split plan and narrow the spec to what is left" -- scripts/check-size.allow.json docs/TODO.md docs/superpowers
```

- [ ] **Step 6: Merge and test.** Merge `move-phase-split` into `main` (fast-forward if possible; resolve conflicts yourself), switch the session back with `ExitWorktree` (`keep`), remove the worktree and delete the branch. Start the full suite on the fleet with the `onto-test` skill in the background and do not wait on it. Do not push.

- [ ] **Step 7: Report** what merged, the commit range, that nothing is pushed, and that the layout drag was not looked at in a browser (it is the spec's step 3 check, and this step changed no layout behavior on purpose).
