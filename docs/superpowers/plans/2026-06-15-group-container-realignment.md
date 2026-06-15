# Group → Container Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "group" mean structural nesting (a `ContainerNode`, round-tripping to SVG `<g>`), wire `group`/`ungroup` to create/dissolve containers, and delete the membership-list apparatus that was masquerading as "group."

**Architecture:** weasel currently has two concepts both reachable under the name "group": structural nesting (`ContainerNode`/`childrenOf` — the real group, native to SVG `<g>`) and a persisted membership list (`Group`/`GroupAdapter`/`expandToLeaves` — really a *saved selection*). We collapse this: the persistent, id-bearing, selectable-as-a-unit role belongs to **containers**; the transient "operate on N ids together" role is already served by **`selection`**. There is no remaining job for a membership entity, so it is deleted rather than renamed. `group`/`ungroup` (currently no-op stubs) become container insert/dissolve. SVG `<g>` re-points from `Group` records to `ContainerNode`s.

**Tech Stack:** TypeScript, React, Vitest, the kit's `Scene` (auto-undoable tree with `add`/`move`/`remove`/`batch`), `@weasel-js/svg` for SVG node types.

**Branch:** This is a sizable public-surface + behavior change. Start on a fresh branch off `main` (e.g. `refactor/group-is-container`), NOT on `chore/scrub-phase-references`.

**Pose-model assumption (read before Task 1):** Child poses are **absolute** by default (container-pose cascade is opt-in via `sceneToAdapter({ cascadeContainerPose })`). So creating a container and reparenting children under it does NOT move the children visually — the container's own pose is bounds/selection metadata only. Dragging the container moves children because `moveAction` already walks `childrenOf` and re-stamps each descendant by the drag delta. Group-drag therefore falls out for free once "group" = container; no new cascade code is needed.

---

## File Structure

**Kit — behavior changes (keep):**
- `src/interactions/actions/defaults/group.ts` — give `groupAction`/`ungroupAction` real `run` bodies (container create/dissolve).
- `src/interactions/actions/defaults/group.test.ts` — add behavioral tests (currently descriptor-only).
- `src/features/selection/overlay.ts` — swap the `groupAdapter`+`expandToLeaves` bounds path for a container/`childrenOf` path.

**Kit — keep untouched (these are NEST/structural, despite living under `features/groups/`):**
- `src/features/groups/composePose.ts`, `nestedHit.ts`, `children.ts`, `unionBounds.ts` — container machinery. NOT deleted.

**Kit — delete (SET/membership apparatus):**
- `src/features/groups/types.ts` (`Group`, `GroupAdapter`)
- `src/features/groups/resolve.ts` + `resolve.test.ts` (`expandToLeaves`, `resolveToOutermostGroup`)
- `src/features/groups/ops/` (createGroup, dissolveGroup, addToGroup, removeFromGroup + tests)
- `src/features/groups/orderedGroups.ts` + `orderedGroups.test.ts` (`withGroupOrdering` — the SET↔NEST bridge)
- `src/index.ts` export lines for the above
- `src/canvas/SceneCanvas.tsx:123` (`getGroup?` prop)

**apps/draw — re-point + delete:**
- `apps/draw/src/svgInterop.ts` — `<g>` ↔ `ContainerNode` instead of `Group`.
- `apps/draw/src/App.tsx` — drop the `groups` array/ref and `createGroupAdapter`; import/export through containers.
- `apps/draw/src/groupMembership.ts` + `groupMembership.test.ts` — delete.

**Docs:**
- `docs/taxonomy.md`, `CLAUDE.md` (Terminology), `docs/TODO.md`.

---

## Phase 1 — Structural `group`/`ungroup` actions

### Task 1: `groupAction.run` creates a container and reparents the selection

**Files:**
- Modify: `src/interactions/actions/defaults/group.ts`
- Test: `src/interactions/actions/defaults/group.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/interactions/actions/defaults/group.test.ts`:

```typescript
import { useScene } from 'core/scene/useScene';
import { makeSelection } from 'core/selection/useSelection';
import type { NodeId } from 'core/scene/types';

function setup() {
  const scene = useScene<Record<string, unknown>, 'main', { x: number; y: number; width: number; height: number }>({
    layers: ['main'],
  });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
  const selection = makeSelection();
  return { scene, selection, a, b };
}

describe('groupAction (behavior)', () => {
  it('wraps the selection in a new container, reparents members, selects the container', () => {
    const { scene, selection, a, b } = setup();
    selection.set([a, b]);

    groupAction.invoker!.run({ scene, selection } as never, undefined as never);

    const sel = selection.get();
    expect(sel.length).toBe(1);
    const containerId = sel[0] as NodeId;
    const container = scene.get(containerId)!;
    expect(container.kind).toBe('container');
    expect([...scene.childrenOf(containerId)]).toEqual([a, b]);
    // Container pose is the union AABB of members.
    expect(container.pose).toEqual({ x: 0, y: 0, width: 30, height: 40 });
  });

  it('leaves member poses unchanged (absolute-pose model)', () => {
    const { scene, selection, a, b } = setup();
    selection.set([a, b]);
    groupAction.invoker!.run({ scene, selection } as never, undefined as never);
    expect(scene.get(a)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(scene.get(b)!.pose).toEqual({ x: 20, y: 30, width: 10, height: 10 });
  });

  it('no-ops on empty selection', () => {
    const { scene, selection } = setup();
    selection.set([]);
    const before = scene.nodes.size;
    groupAction.invoker!.run({ scene, selection } as never, undefined as never);
    expect(scene.nodes.size).toBe(before);
  });
});
```

> If `useScene`/`makeSelection` import paths differ, mirror the imports used in `src/interactions/actions/defaults/delete.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/defaults/group.test.ts -t "wraps the selection"`
Expected: FAIL — the stub `run` does nothing, so selection stays `[a, b]`.

- [ ] **Step 3: Implement `groupAction.run`**

Replace the body of `src/interactions/actions/defaults/group.ts` for `groupAction` (keep `ungroupAction` as-is for now):

```typescript
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Action } from '../registry';
import { unionBounds, type RectPose } from 'features/groups/unionBounds';

/**
 * @experimental
 * `group` Action — wraps the current selection in a new structural
 * container (the real "group"; round-trips to SVG `<g>`). Members are
 * reparented under the container; their absolute poses are unchanged.
 * The container's pose is the union AABB of the members, for selection
 * bounds and hit-testing. One batched op = one undo entry.
 */
export const groupAction: Action & { requires: string[] } = {
  id: 'group',
  label: 'Group',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true } },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;
      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return;

      const nodes = ids.map((id) => scene.get(id)).filter((n): n is NonNullable<typeof n> => !!n);
      if (nodes.length === 0) return;

      // All members must share a layer (a container subtree is single-layer).
      const layer = nodes[0].layer;
      if (nodes.some((n) => n.layer !== layer)) return;

      // Parent = the shared parent if all members agree, else root (null).
      const parents = new Set(nodes.map((n) => n.parent));
      const parent = parents.size === 1 ? (nodes[0].parent as NodeId | null) : null;

      const pose = unionBounds(nodes.map((n) => n.pose as RectPose)) ?? { x: 0, y: 0, width: 0, height: 0 };

      scene.batch('Group', () => {
        const containerId = scene.add({
          kind: 'container',
          layer,
          pose: pose as unknown,
          data: {} as unknown,
          parent,
        });
        for (const id of ids) scene.move(id, containerId);
        selection.set([containerId]);
      });
    },
  },
  enabled: () => true,
};
```

> `data: {}` — containers are structural and draw nothing themselves; only their leaves draw. Consumers whose `drawOne` keys off `data` shape must treat empty/unknown container data as "no own visual" (verified for apps/draw in Task 5).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/interactions/actions/defaults/group.test.ts`
Expected: PASS (all descriptor + behavior tests).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/defaults/group.ts src/interactions/actions/defaults/group.test.ts
git commit -m "feat(group): groupAction wraps selection in a structural container"
```

---

### Task 2: `ungroupAction.run` dissolves a container, freeing its children

**Files:**
- Modify: `src/interactions/actions/defaults/group.ts`
- Test: `src/interactions/actions/defaults/group.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `group.test.ts`:

```typescript
describe('ungroupAction (behavior)', () => {
  it('reparents a container’s children to its parent and removes the container', () => {
    const { scene, selection, a, b } = setup();
    selection.set([a, b]);
    groupAction.invoker!.run({ scene, selection } as never, undefined as never);
    const containerId = selection.get()[0] as NodeId;

    ungroupAction.invoker!.run({ scene, selection } as never, undefined as never);

    expect(scene.get(containerId)).toBeUndefined();
    expect(scene.get(a)!.parent).toBe(null);
    expect(scene.get(b)!.parent).toBe(null);
    expect(new Set(selection.get())).toEqual(new Set([a, b]));
  });

  it('ignores selected non-container nodes', () => {
    const { scene, selection, a } = setup();
    selection.set([a]);
    ungroupAction.invoker!.run({ scene, selection } as never, undefined as never);
    expect(scene.get(a)).toBeDefined();
    expect(scene.get(a)!.kind).toBe('leaf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/defaults/group.test.ts -t "reparents a container"`
Expected: FAIL — stub `ungroupAction.run` leaves the container in place.

- [ ] **Step 3: Implement `ungroupAction.run`**

Replace `ungroupAction` in `src/interactions/actions/defaults/group.ts`:

```typescript
/**
 * @experimental
 * `ungroup` Action — dissolves each selected container, reparenting its
 * children to the container's own parent (preserving order) and removing
 * the now-empty container. Selection becomes the freed children. Selected
 * non-container nodes are ignored. One batched op = one undo entry.
 */
export const ungroupAction: Action & { requires: string[] } = {
  id: 'ungroup',
  label: 'Ungroup',
  defaultBinding: { kind: 'key', key: 'g', mods: { mod: true, shift: true } },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;
      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return;

      const containers = ids.filter((id) => scene.get(id)?.kind === 'container');
      if (containers.length === 0) return;

      const freed: NodeId[] = [];
      scene.batch('Ungroup', () => {
        for (const containerId of containers) {
          const container = scene.get(containerId);
          if (!container || container.kind !== 'container') continue;
          const parent = (container.parent as NodeId | null) ?? null;
          // Insert children where the container sat among its siblings.
          const siblings = scene.childrenOf(parent as NodeId);
          const baseIndex = parent === null
            ? scene.roots.indexOf(containerId)
            : siblings.indexOf(containerId);
          const children = [...scene.childrenOf(containerId)];
          children.forEach((childId, i) => {
            scene.move(childId, parent, baseIndex < 0 ? undefined : baseIndex + i);
            freed.push(childId);
          });
          scene.remove(containerId);
        }
        selection.set(freed);
      });
    },
  },
  enabled: () => true,
};
```

> Remove the now-unused `ActionDisabledReason` import from `group.ts` if nothing else references it. Run `npx tsc --noEmit` to confirm.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/interactions/actions/defaults/group.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/defaults/group.ts src/interactions/actions/defaults/group.test.ts
git commit -m "feat(group): ungroupAction dissolves a container, freeing children"
```

---

## Phase 2 — Selection overlay reads container bounds via `childrenOf`

### Task 3: Replace the `groupAdapter`/`expandToLeaves` bounds path with a container path

**Files:**
- Modify: `src/features/selection/overlay.ts`
- Test: `src/features/selection/overlay.test.ts` (create if absent; otherwise extend)

**Context:** `composeSelectionPose` and `makeGroupAwareBoundsResolver` (`overlay.ts:107-180`) currently special-case `groupAdapter.getGroup(id)` by unioning `expandToLeaves` poses. Under the new model a selected container has its **own** pose, but to keep bounds live-accurate as children move we union the container's transitive leaf poses via `scene.childrenOf` instead. Swap the `groupAdapter?: GroupAdapter` option for a `getChildren?: (id: string) => readonly string[]` accessor (sourced from `scene.childrenOf`).

- [ ] **Step 1: Write the failing test**

Create/extend `src/features/selection/overlay.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { composeSelectionPose } from './overlay';

type P = { x: number; y: number; width: number; height: number };

describe('composeSelectionPose — container bounds via getChildren', () => {
  it('returns the union AABB of a container’s transitive leaf poses', () => {
    const poses: Record<string, P> = {
      c: { x: 0, y: 0, width: 0, height: 0 }, // container's own (stale) pose
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 30, width: 10, height: 10 },
    };
    const children: Record<string, string[]> = { c: ['a', 'b'], a: [], b: [] };
    const resolve = composeSelectionPose<P>({
      getStoredPose: (id) => poses[id],
      getChildren: (id) => children[id] ?? [],
      isContainer: (id) => (children[id]?.length ?? 0) > 0,
      getBounds: (p) => p,
      fromBounds: (b) => ({ ...b }),
    });
    expect(resolve('c')).toEqual({ x: 0, y: 0, width: 30, height: 40 });
    expect(resolve('a')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/selection/overlay.test.ts -t "container bounds"`
Expected: FAIL — `getChildren`/`isContainer` options don't exist yet; the resolver still expects `groupAdapter`.

- [ ] **Step 3: Implement the container-aware resolver**

In `src/features/selection/overlay.ts`:
1. Delete the imports `import type { GroupAdapter } from '../groups/types';` and `import { expandToLeaves } from '../groups/resolve';`. Keep `import { unionBounds } from '../groups/unionBounds';` (or its current path).
2. In `ComposeSelectionPoseOpts`, replace `groupAdapter?: GroupAdapter;` with:

```typescript
  /** Walk a container's direct children (e.g. `scene.childrenOf`). When
   *  supplied with `isContainer`, a selected container resolves to the
   *  union AABB of its transitive leaf poses instead of its own pose. */
  getChildren?: (id: string) => readonly string[];
  /** True when `id` is a structural container. */
  isContainer?: (id: string) => boolean;
```

3. Replace the group branch in `composeSelectionPose` with a container branch that recursively collects leaf ids via `getChildren`:

```typescript
  const { moveOverlay, resizeOverlay, getStoredPose, getChildren, isContainer } = opts;
  // ...resolveLeaf unchanged...

  const leavesOf = (id: string): string[] => {
    if (!getChildren || !isContainer || !isContainer(id)) return [id];
    const out: string[] = [];
    const visit = (nid: string) => {
      const kids = getChildren(nid);
      if (kids.length === 0) { out.push(nid); return; }
      for (const k of kids) visit(k);
    };
    visit(id);
    return out;
  };

  return (id: string): TPose | null => {
    if (isContainer?.(id)) {
      const leaves = leavesOf(id);
      if (leaves.length === 0) return null;
      const leafBounds = leaves.map((leafId) => getBounds(resolveLeaf(leafId)));
      const u = unionBounds(leafBounds as never);
      return u === null ? null : fromBounds(u as never);
    }
    return resolveLeaf(id);
  };
```

4. In `makeGroupAwareBoundsResolver` (rename to `makeContainerAwareBoundsResolver`), make the same `groupAdapter` → `getChildren`/`isContainer` substitution, unioning `getBounds(getPose(leafId))` over `leavesOf(id)`.
5. Update the exported opts type on the public resolver (`overlay.ts:201`) the same way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/selection/overlay.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors in `overlay.ts`.

- [ ] **Step 5: Wire the new options at the call site**

Find overlay call sites: `grep -rn "composeSelectionPose\|groupAdapter" src/canvas src/tools`. Replace any `groupAdapter={...}` / `groupAdapter:` argument with `getChildren: (id) => scene.childrenOf(id as NodeId)` and `isContainer: (id) => scene.get(id as NodeId)?.kind === 'container'`. Run `npx tsc --noEmit` to find every site.

- [ ] **Step 6: Commit**

```bash
git add src/features/selection/overlay.ts src/features/selection/overlay.test.ts src/canvas src/tools
git commit -m "refactor(overlay): resolve container bounds via childrenOf, drop GroupAdapter"
```

---

## Phase 3 — SVG `<g>` ↔ `ContainerNode` (apps/draw)

### Task 4: Rewrite `svgInterop` to map `<g>` to containers

**Files:**
- Modify: `apps/draw/src/svgInterop.ts`
- Test: `apps/draw/src/svgInterop.test.ts` (extend; create if absent)

**Context:** `objsToSvgNodes(items, groups)` and `svgNodesToObjsWithGroups(nodes, nextId)` currently translate `Group` member-lists ↔ `SvgGroupNode`. Re-point them to the scene's container tree: an `SvgGroupNode` (`kind:'group'`, `children[]`) becomes a `ContainerNode` with reparented children, and vice versa. SVG groups are inherently single-parent and structural, so the single-membership guard is deleted (it was compensating for the wrong primitive).

- [ ] **Step 1: Write the failing test**

Add to `apps/draw/src/svgInterop.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { svgNodesToScene, sceneNodesToSvg } from './svgInterop';

describe('svgInterop <g> ↔ container', () => {
  it('imports an <g> as a container with reparented children', () => {
    const svg = [{ kind: 'group', children: [
      { kind: 'path', /* ...minimal path node... */ } as never,
      { kind: 'path', /* ... */ } as never,
    ], meta: { wd: { attrs: { 'group-id': 'g1' } } } }];
    let seq = 0;
    const { nodes } = svgNodesToScene(svg as never, () => `svg-${++seq}`);
    const container = nodes.find((n) => n.kind === 'container');
    expect(container).toBeDefined();
    expect(container!.children.length).toBe(2);
  });

  it('round-trips container → <g> → container', () => {
    // build a scene with one container holding two leaves, export, re-import
    // and assert the container + 2 children survive.
  });
});
```

> Fill the minimal path-node shape from the existing `objToSvgNode` output in `svgInterop.ts`. Flesh out the round-trip body using the helpers added in Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/draw/src/svgInterop.test.ts -t "imports an <g>"`
Expected: FAIL — `svgNodesToScene`/`sceneNodesToSvg` don't exist yet.

- [ ] **Step 3: Implement container-based interop**

In `apps/draw/src/svgInterop.ts`:
1. Delete `interface Group { id: string; members: string[] }` (line 27) and the single-membership guard (lines 214-230).
2. Replace `svgNodesToObjsWithGroups` with `svgNodesToScene(nodes, nextId): { nodes: AddNodeSpec[] }` that walks `SvgGroupNode` → a container `AddNodeSpec` (`kind:'container'`, `parent` set to the enclosing group's id, `pose` = union AABB of children once known) and leaf nodes → leaf specs with `parent` pointing at the enclosing group id. Carry the `group-id` attr as the container's id so round-trips are stable.
3. Replace `objsToSvgNodes` with `sceneNodesToSvg(scene)` that walks `scene.roots` / `scene.childrenOf`, emitting an `SvgGroupNode` for each `kind:'container'` (recursing into `childrenOf`) and an `objToSvgNode` for each leaf. Stamp `meta.wd.attrs['group-id']` from the container id.
4. Keep `svgNodesToObjs` (the group-discarding wrapper, line 332) working by returning only the leaf specs, or delete it if Task 5 removes its last caller (`grep -rn "svgNodesToObjs\b" apps/draw/src`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/draw/src/svgInterop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/svgInterop.ts apps/draw/src/svgInterop.test.ts
git commit -m "refactor(draw): SVG <g> maps to scene containers, not Group records"
```

---

### Task 5: Update `App.tsx` import/export flow; drop the groups model

**Files:**
- Modify: `apps/draw/src/App.tsx`
- Delete: `apps/draw/src/groupMembership.ts`, `apps/draw/src/groupMembership.test.ts`

- [ ] **Step 1: Update the SVG import flow**

In `App.tsx` (around the import handler, ~lines 788-858): replace the `svgNodesToObjsWithGroups(...)` + topological group-building loop with `svgNodesToScene(...)`, adding the returned specs to the scene in order (parents before children — `scene.add` requires the parent to exist first; the spec list from Task 4 must be parent-ordered). Remove the `groups`/`remaining`/`idMap` bookkeeping.

- [ ] **Step 2: Update the SVG export flow**

Replace `objsToSvgNodes(items, groups)` with `sceneNodesToSvg(scene)` in the `downloadSvg` path (~line 85 import; find the export call with `grep -rn "objsToSvgNodes\|downloadSvg" apps/draw/src/App.tsx`).

- [ ] **Step 3: Remove the groups model + adapter wiring**

In `App.tsx`: delete the `groups` ref/state, the `createGroupAdapter(...)` call, and any `getGroup`/`groupAdapter` prop passed to `<SceneCanvas>`. The `onGroup`/`onUngroup` handlers (`trigger('group')`/`trigger('ungroup')`, ~lines 767-768) stay — they now hit the container-based kit actions. Keep the status-bar group count (`n.kind === 'container'`, ~lines 1502-1516).

- [ ] **Step 4: Delete the membership adapter files**

```bash
git rm apps/draw/src/groupMembership.ts apps/draw/src/groupMembership.test.ts
```

- [ ] **Step 5: Verify build + container rendering**

Run: `npx tsc --noEmit && npx vitest run --project=draw`
Expected: PASS. If `drawOne` for a container with `data: {}` throws or mis-renders, fix it to no-op for containers (containers draw nothing; children render via scene order). Add a draw-project test asserting a grouped container’s children still render and the container itself emits no own draw command.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Launch the draw app in the background (`npm run dev:draw`), draw two shapes, Cmd+G to group, drag the group (children follow), Cmd+Shift+G to ungroup, export SVG and confirm a `<g>` wraps the two shapes; re-import and confirm the container returns.

- [ ] **Step 7: Commit**

```bash
git add apps/draw/src/App.tsx
git commit -m "refactor(draw): group/ungroup + SVG via containers; remove groups model"
```

---

## Phase 4 — Delete the membership apparatus

### Task 6: Remove `Group`/`GroupAdapter`/`expandToLeaves`/ops + exports

**Files:**
- Delete: `src/features/groups/types.ts`, `resolve.ts`, `resolve.test.ts`, `orderedGroups.ts`, `orderedGroups.test.ts`, `src/features/groups/ops/` (all files + tests)
- Modify: `src/index.ts`, `src/canvas/SceneCanvas.tsx`

- [ ] **Step 1: Confirm zero remaining importers**

Run:
```bash
grep -rn "expandToLeaves\|resolveToOutermostGroup\|GroupAdapter\|withGroupOrdering\|createCreateGroupOp\|createDissolveGroupOp\|createAddToGroupOp\|createRemoveFromGroupOp\|from 'features/groups/types'\|from '../groups/types'\|from './types'" src apps demo packages
```
Expected: only matches inside the files being deleted in this task. If anything else matches, fix that consumer first (it was missed by Phases 2–3).

- [ ] **Step 2: Delete the SET files**

```bash
git rm src/features/groups/types.ts src/features/groups/resolve.ts src/features/groups/resolve.test.ts \
       src/features/groups/orderedGroups.ts src/features/groups/orderedGroups.test.ts
git rm -r src/features/groups/ops
```

- [ ] **Step 3: Remove the exports**

In `src/index.ts` delete:
```typescript
export type { Group, GroupAdapter } from './features/groups/types';
export { resolveToOutermostGroup, expandToLeaves } from './features/groups/resolve';
export { withGroupOrdering } from './features/groups/orderedGroups';
```
And the `GroupAdapter` mention in the doc comment at `src/index.ts:32`.

- [ ] **Step 4: Remove the `getGroup?` prop**

In `src/canvas/SceneCanvas.tsx` delete line 123 (`getGroup?(id: string): import('features/groups/types').Group | undefined;`) and any code referencing it.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. Fix any straggler imports surfaced by tsc.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: delete the membership-group apparatus (now containers + selection)"
```

---

### Task 7: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the release gate**

Run: `npm run typecheck && npm run test`
Expected: PASS. (This mirrors CI; `vitest` alone does not typecheck production code.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: ESM + DTS build success, no errors.

- [ ] **Step 3: Grep for orphaned "group" references**

Run: `grep -rniE "membership|expandToLeaves|GroupAdapter" src apps demo docs`
Expected: no references to the deleted membership concept (docs handled in Task 8). Note any survivors for Task 8.

---

## Phase 5 — Documentation & terminology

### Task 8: Anchor the corrected terminology

**Files:**
- Modify: `docs/taxonomy.md`, `CLAUDE.md`, `docs/TODO.md`

- [ ] **Step 1: Add a taxonomy entry**

In `docs/taxonomy.md`, near the `Node`/`Scene` definitions, add:

```markdown
### Group / Selection — not the same axis

- **Group** = a structural `ContainerNode` (`kind:'container'`, `children`). The
  real "group" (Cmd+G); round-trips to SVG `<g>`; its transform cascades to
  children (when container-pose cascade is enabled). Persistent, id-bearing,
  selectable as a unit.
- **Selection** = the transient, immutable set of currently-active ids
  (`selection.get()` / `selection.set()`). "Operate on these N as a unit" with
  no persistence and no id. Not a scene entity.

There is no persistent membership-list concept. A consumer wanting named, saved
selections holds its own `Record<string, string[]>` and calls `selection.set`.
```

- [ ] **Step 2: Update `CLAUDE.md` Terminology**

Add a "group = container; selection = transient id set" line to the Terminology section so future work doesn't reintroduce a membership "group."

- [ ] **Step 3: Prune stale TODO entries**

In `docs/TODO.md`, remove/adjust any entries that assumed the membership model or listed group-expansion as deferred (e.g. the `getChildren`-surface group-expansion note and any "cascading children / group expansion" deferral now satisfied by the container path). Leave the genuinely-open layout-sibling-reflow entry (`Tool overlay rendering of reflowed siblings`).

- [ ] **Step 4: Commit**

```bash
git add docs/taxonomy.md CLAUDE.md docs/TODO.md
git commit -m "docs: group = container, selection = transient id set; retire membership group"
```

---

## Self-Review Notes

- **Spec coverage:** group action (Task 1), ungroup action (Task 2), overlay (Task 3), SVG interop (Task 4), apps/draw flow + adapter deletion (Task 5), kit apparatus deletion + exports (Task 6), verification (Task 7), docs (Task 8). All four original threads — rename-via-deletion, group/ungroup-as-container, `<g>`-as-container, taxonomy — are covered.
- **Ordering keeps the build green:** behavior is added (1–2) and consumers re-pointed (3–5) *before* the apparatus is deleted (6). Task 6 Step 1 is a hard gate that fails loudly if a consumer was missed.
- **NEST preserved:** `composePose.ts`, `nestedHit.ts`, `children.ts`, `unionBounds.ts` are explicitly NOT deleted — they are the container machinery this plan leans on.
- **Open design note (not a blocker):** a container's stored pose can go stale as children move; the overlay sidesteps this by unioning live child bounds (Task 3). Keeping the container's *own* pose in sync with its children is a separate layout concern (`cascadeContainerPose` / layout strategies), out of scope here.
</content>
</invoke>
