# Node-Facets Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the kit's shape and routing registries as **facets** at the documentation + inspector layer. No runtime semantics change — only JSDoc reframe, a `facet` tag on inspector entries, a renamed inspector category (`nodeKinds` → `routingKinds`), and a shared "Facets" parent grouping in the tree.

**Architecture:** Five touch points: (1) supersession note on the 2026-05-21 spec, (2) JSDoc reframe on `NodeKindRegistry` and `defaultNodeKinds`, (3) `facet: 'shape' | 'routing'` field on `ShapeKindEntry` / renamed `RoutingKindEntry`, (4) rename + grouping in `RegistryInspector.tsx` and `RegistryTree.tsx`, (5) TODO follow-up redirected to the new spec. Tests update accordingly.

**Tech Stack:** TypeScript, React 18, Vitest. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`.

---

## File Structure

**Files to modify:**

- `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md` — append supersession note
- `src/core/scene/nodeKindRegistry.ts` — JSDoc reframe on `NodeKindRegistry`
- `src/core/scene/defaultNodeKinds.ts` — JSDoc reframe
- `apps/swillustrator/src/dev/registryData.ts` — rename `NodeKindEntry` → `RoutingKindEntry`, add `facet` field on shape + routing entries, rename `collectNodeKinds` → `collectRoutingKinds`, add `group` field on `TreeCategoryNode`, populate it for the two facet categories
- `apps/swillustrator/src/dev/registryData.test.ts` — update existing `collectNodeKinds` block to `collectRoutingKinds`; assert `facet` tag
- `apps/swillustrator/src/dev/registryProbe.tsx` — rename `nodeKinds` snapshot field to `routingKinds`
- `apps/swillustrator/src/dev/RegistryInspector.tsx` — rename category id/label `nodeKinds` → `routingKinds`, set `group: { id: 'facets', label: 'Facets' }` on shape + routing categories, update initial-state and memo deps
- `apps/swillustrator/src/dev/RegistryDetail.tsx` — rename `NodeKindEntry` import + `case 'nodeKind'` to `case 'routingKind'`, surface `facet` in the detail dl
- `apps/swillustrator/src/dev/RegistryTree.tsx` — render `group` parent above categories that share it
- `apps/swillustrator/src/dev/RegistryDetail.test.tsx` — rename the existing entry-kind test
- `docs/TODO.md` — redirect the "Convergence-target facets" P3 entry to the new spec

---

## Task 1: Spec docs (supersession + JSDoc reframe + TODO redirect)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`
- Modify: `src/core/scene/nodeKindRegistry.ts`
- Modify: `src/core/scene/defaultNodeKinds.ts`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Append supersession note to the May-21 spec**

In `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`, find the heading `## Convergence policy` (roughly the middle of the doc). Insert a `> **Superseded:**` blockquote immediately under that heading, BEFORE the existing text:

```markdown
> **Superseded by `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md` (2026-05-22):** future facets (label / icon / propertyRows / bindings / serialize) land as independent per-facet registries rather than optional fields on `NodeKind`. The convergence-policy table below describes the original intent; the facets-reframe spec is the load-bearing successor. The classifier API in the "Proposal" section above is unchanged.
```

Leave the rest of the spec untouched.

- [ ] **Step 2: Reframe JSDoc on `NodeKindRegistry`**

In `src/core/scene/nodeKindRegistry.ts`, find the JSDoc block above `export interface NodeKindRegistry` (around line 17-21). Replace the existing block with:

```ts
/**
 * NodeKindRegistry — the **routing facet's** classifier registry.
 *
 * The kit thinks about a node along several **facets** (shape,
 * routing, label, icon, …) — independent per-axis registries. This
 * registry covers the routing facet: it answers "what routing-kind
 * string does this node's data map to?" The result flows into
 * declarative tool-routing tables (`{ target: 'rect', actionId: 'move' }`).
 *
 * Other facets (shape painters, future label/icon/propertyRows
 * registries) are their own registries — they are NOT optional
 * fields on `NodeKind`. See:
 * `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`.
 *
 * Instances are constructed by `<SceneCanvas>` from its `kinds` prop
 * and threaded into the synthesized adapter as a `kindOf(id)` method.
 * Direct use from consumer code is supported but not required for the
 * common SceneCanvas flow.
 */
```

- [ ] **Step 3: Reframe JSDoc on `NodeKind` and `defaultNodeKinds`**

Still in `src/core/scene/nodeKindRegistry.ts`, find the JSDoc above `export interface NodeKind` (top of the file). Replace with:

```ts
/**
 * NodeKind — a routing-facet classifier entry.
 *
 * The kit consults `NodeKindRegistry` (the routing facet's registry)
 * to derive a kind string for each scene node. Other facets (shape,
 * label, icon, …) are independent registries — fields like `label`
 * or `icon` are NOT future additions to this interface. See:
 * `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`.
 */
```

In `src/core/scene/defaultNodeKinds.ts`, find the JSDoc above `export const defaultNodeKinds`. Replace with:

```ts
/**
 * Default routing-facet classifiers covering the kit's built-in shape
 * tools (`KIT_SHAPE_KINDS`). The routing facet's default values
 * happen to mirror the shape facet's by name; the two facets remain
 * independent — a consumer can register routing kinds that have no
 * matching shape painter (e.g. `'group'`, `'sticky-note'`).
 *
 * Consumers using the kit's standard data shape spread
 * `defaultNodeKinds` into their `<SceneCanvas kinds={...}>` prop;
 * consumers with a custom data shape register their own classifiers.
 *
 * Kept in lockstep with `KIT_SHAPE_KINDS` via the barrel parity test
 * in `src/index.barrel.test.ts`.
 */
```

- [ ] **Step 4: Redirect TODO entry**

In `docs/TODO.md`, find the P3 entry "**(P3) Convergence-target facets.**" (around line 87). Replace its body with:

```markdown
- **(P3) Convergence-target facets.** Each kind-keyed concern (label/icon, propertyRows, bindings, subkinds, serialize/deserialize) lands as its own per-facet registry per the **node-facets reframe** at `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`. Tracked individually under the relevant TODO sections (per-kind property-row registry, default action icons, useScene op-log serialization).
```

- [ ] **Step 5: Verify**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS — no behavior changes.

```bash
npx vitest run
```
Expected: PASS — no behavior changes.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-05-21-node-kind-registry-design.md \
        src/core/scene/nodeKindRegistry.ts \
        src/core/scene/defaultNodeKinds.ts \
        docs/TODO.md
git commit -m "docs(facets): reframe NodeKindRegistry as routing-facet registry

Adds supersession note to the 2026-05-21 spec, reframes JSDoc on
NodeKindRegistry / NodeKind / defaultNodeKinds, and redirects the
TODO P3 'Convergence-target facets' entry to the new spec. No
runtime semantics change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `facet` tag to inspector entries

**Files:**
- Modify: `apps/swillustrator/src/dev/registryData.ts`
- Modify: `apps/swillustrator/src/dev/registryData.test.ts`

- [ ] **Step 1: Write failing assertion**

Open `apps/swillustrator/src/dev/registryData.test.ts`. Find the existing `describe('collectShapeKinds', ...)` block (or wherever shape-kind tests live — `collectShapeKinds` is invoked in the inspector). If a test block doesn't exist for `collectShapeKinds`, create one. Add an assertion to the existing default-kind test for `collectNodeKinds`:

```ts
// Inside the "returns every default kind marked as default" test for collectNodeKinds:
// (Adapt to actual variable name; the existing test loops `for (const entry of entries)`.)
expect(entry.facet).toBe('routing');
```

And add a sibling test for the shape-kind collector:

```ts
import { collectShapeKinds } from './registryData';

describe('collectShapeKinds — facet tag', () => {
  it('tags every entry with facet: shape', () => {
    const entries = collectShapeKinds();
    for (const entry of entries) {
      expect(entry.facet).toBe('shape');
    }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

`npx vitest run apps/swillustrator/src/dev/registryData.test.ts`
Expected: FAIL — `expected undefined to be 'routing'` / `'shape'`.

- [ ] **Step 3: Add `facet` field to entry types**

In `apps/swillustrator/src/dev/registryData.ts`:

a) Update `ShapeKindEntry` (around line 153). Add `facet: 'shape'` as a literal field:
```ts
export interface ShapeKindEntry {
  kind: 'shapeKind';
  /** Which facet this entry belongs to. Always `'shape'` for ShapeKindEntry —
   *  the field exists so the inspector can group entries by facet
   *  regardless of `kind`. */
  facet: 'shape';
  id: string;
  label: string;
  tool?: string;
  hookName?: string;
}
```

b) Update `NodeKindEntry`. While you're here, rename the interface to `RoutingKindEntry` and the discriminant `kind: 'nodeKind'` to `kind: 'routingKind'`:
```ts
export interface RoutingKindEntry {
  kind: 'routingKind';
  facet: 'routing';
  id: string;
  label: string;
  source: 'default' | 'consumer' | 'override';
  shapeKindId?: string;
}
```

c) Update the `TreeEntry` union — replace `NodeKindEntry` with `RoutingKindEntry`:
```ts
export type TreeEntry =
  | ToolEntry
  | ActionEntry
  | ShapeKindEntry
  | RoutingKindEntry  // was NodeKindEntry
  | BundleEntry
  …
```

d) Update `collectShapeKinds` to set `facet: 'shape'` on every returned entry. The function is around line 504. The existing return shape was `{ kind: 'shapeKind', id, label, tool, hookName }`; add `facet: 'shape'` to each object literal.

e) Rename `collectNodeKinds` → `collectRoutingKinds`. Update its return type to `readonly RoutingKindEntry[]`. Every returned object gets `kind: 'routingKind'` (was `'nodeKind'`) AND `facet: 'routing'`.

f) Also update `countForEntry` (around line 415) if it has a case for `'nodeKind'` — rename the case to `'routingKind'`. Search the file for `'nodeKind'` to find any other references.

- [ ] **Step 4: Run tests — expect PASS**

`npx vitest run apps/swillustrator/src/dev/registryData.test.ts`
Expected: PASS — both new assertions green.

- [ ] **Step 5: Run full release gate (other consumers may have type errors)**

```bash
npx tsc --noEmit
```
Expected: probably FAILS at this point — other files reference `NodeKindEntry` / `'nodeKind'`. Don't fix here; Task 3 migrates them. If you want to be tidy, fix only the imports in registryData.ts itself; defer the rest to Task 3.

- [ ] **Step 6: Commit**

```bash
git add apps/swillustrator/src/dev/registryData.ts apps/swillustrator/src/dev/registryData.test.ts
git commit -m "feat(inspector): facet tag on shape/routing kind entries

Rename NodeKindEntry → RoutingKindEntry; discriminant 'nodeKind' →
'routingKind'. Adds facet: 'shape' | 'routing' to both entry types
so the tree can group by facet. collectNodeKinds → collectRoutingKinds.
Downstream consumers in this commit will fail typecheck until the
next commit migrates them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate inspector consumers to renamed identifiers

**Files:**
- Modify: `apps/swillustrator/src/dev/registryProbe.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryDetail.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryDetail.test.tsx`

- [ ] **Step 1: Update probe snapshot field name**

In `apps/swillustrator/src/dev/registryProbe.tsx`, find `RegistrySnapshot`:
```ts
export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
  readonly nodeKinds: readonly NodeKind[];
}
```

Rename `nodeKinds` → `routingKinds` (the field is just a list of registered `NodeKind` entries — the type stays `readonly NodeKind[]`, only the field name changes to reflect what facet it represents):
```ts
export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
  readonly routingKinds: readonly NodeKind[];
}
```

Also update every `onSnapshot({ ... })` call site in the file: `nodeKinds: defaultNodeKinds` → `routingKinds: defaultNodeKinds`.

- [ ] **Step 2: Update `RegistryInspector.tsx`**

Find these locations:

a) Initial state at the top of the component:
```ts
const [runtime, setRuntime] = useState<RegistrySnapshot>({ tools: [], actions: [], nodeKinds: [] });
```
Rename `nodeKinds` → `routingKinds`.

b) The `useMemo` that collected node kinds:
```ts
const nodeKinds = useMemo(() => collectNodeKinds(runtime.nodeKinds), [runtime.nodeKinds]);
```
Rename to:
```ts
const routingKinds = useMemo(() => collectRoutingKinds(runtime.routingKinds), [runtime.routingKinds]);
```
And update the import: `collectNodeKinds` → `collectRoutingKinds`.

c) Category in the `all: TreeCategoryNode[]` array:
```ts
{ id: 'nodeKinds', label: 'Node kinds', entries: nodeKinds },
```
Becomes:
```ts
{ id: 'routingKinds', label: 'Routing kinds', entries: routingKinds },
```

d) Update the `useMemo` deps array — replace `nodeKinds` with `routingKinds`.

- [ ] **Step 3: Update `RegistryDetail.tsx`**

a) Replace the type import: `NodeKindEntry` → `RoutingKindEntry`.

b) Switch-case in `RegistryDetail`:
```ts
case 'nodeKind':      return <NodeKindDetail entry={entry} onNavigate={onNavigate} />;
```
Becomes:
```ts
case 'routingKind':   return <RoutingKindDetail entry={entry} onNavigate={onNavigate} />;
```

c) Rename the `NodeKindDetail` component to `RoutingKindDetail`. Update its `entry: NodeKindEntry` to `entry: RoutingKindEntry`. Inside the dl, the existing rows:
```tsx
<dt>kind</dt><dd><KindBadge label="node-kind" /></dd>
<dt>source</dt><dd><KindBadge label={entry.source} /></dd>
```
Add a `facet` row so the conceptual axis is visible in the detail pane:
```tsx
<dt>facet</dt><dd><KindBadge label={entry.facet} /></dd>
<dt>kind</dt><dd><KindBadge label="routing-kind" /></dd>
<dt>source</dt><dd><KindBadge label={entry.source} /></dd>
```

d) In `ShapeKindDetail` (around line 993), surface `facet: 'shape'` similarly. Add right after the existing `<dt>kind</dt><dd>shape</dd>` row:
```tsx
<dt>facet</dt><dd><KindBadge label={entry.facet} /></dd>
```

- [ ] **Step 4: Update `RegistryDetail.test.tsx`**

Find the test that renders a NodeKind entry (added in the inspector node-kinds work). Rename:
- the imported type / fixture from `NodeKindEntry` → `RoutingKindEntry`
- the fixture's `kind` field from `'nodeKind'` → `'routingKind'`
- add `facet: 'routing'` on the fixture

Same for any ShapeKindEntry fixtures — add `facet: 'shape'` so they typecheck.

- [ ] **Step 5: Run the release gate**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: PASS. All renamed identifiers must compile.

- [ ] **Step 6: Commit**

```bash
git add apps/swillustrator/src/dev/registryProbe.tsx \
        apps/swillustrator/src/dev/RegistryInspector.tsx \
        apps/swillustrator/src/dev/RegistryDetail.tsx \
        apps/swillustrator/src/dev/RegistryDetail.test.tsx
git commit -m "refactor(inspector): nodeKinds → routingKinds across consumers

Snapshot field, collector, category id/label, detail-pane component
and entry-kind discriminant all migrate to the routing-facet
nomenclature. Detail pane now surfaces the facet axis as a row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Add `group` field to `TreeCategoryNode` and render Facets parent

**Files:**
- Modify: `apps/swillustrator/src/dev/registryData.ts`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryTree.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.module.css`
- Test: new tests inline in existing inspector test files

- [ ] **Step 1: Write failing test**

In `apps/swillustrator/src/dev/RegistryInspector.test.tsx` (or wherever inspector integration lives — confirm with `ls apps/swillustrator/src/dev/*.test.*`), add a test that asserts the rendered tree puts shape kinds and routing kinds under a shared "Facets" group heading:

```tsx
import { render } from '@testing-library/react';
import { RegistryInspector } from './RegistryInspector';

describe('RegistryInspector — facets grouping', () => {
  it('renders a Facets group containing Shape kinds and Routing kinds', () => {
    const { getByText } = render(<RegistryInspector />);
    // The Facets group heading is in the rendered tree
    expect(getByText('Facets')).toBeTruthy();
    // Both categories appear (RegistryInspector mounts a hidden probe canvas
    // that pushes a snapshot; we don't need to wait for it for the heading)
    expect(getByText('Shape kinds')).toBeTruthy();
    expect(getByText('Routing kinds')).toBeTruthy();
  });
});
```

If `RegistryInspector` requires providers / a router / etc. to render, mirror the pattern from existing tests in the same directory. If you can't get the inspector to render at the test seam without significant scaffolding, fall back to a unit test on `RegistryTree` directly: pass it a synthetic `nodes` array with two categories sharing the same `group`, and assert the heading renders.

- [ ] **Step 2: Run the failing test**

`npx vitest run apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: FAIL — `Facets` heading not in the rendered DOM.

- [ ] **Step 3: Add `group` field to `TreeCategoryNode`**

In `apps/swillustrator/src/dev/registryData.ts`, find `TreeCategoryNode` (around line 302). Add an optional `group` field:

```ts
export interface TreeCategoryNode {
  id: string;
  label: string;
  /** Optional grouping. Categories with the same `group.id` render under a
   *  shared parent heading in the tree (e.g. shape + routing both under
   *  Facets). Categories with no `group` render at the top level. */
  group?: {
    id: string;
    label: string;
  };
  entries: readonly TreeEntry[];
}
```

- [ ] **Step 4: Populate `group` in `RegistryInspector.tsx`**

In the `all: TreeCategoryNode[]` array, add `group: { id: 'facets', label: 'Facets' }` to the two relevant entries:

```ts
{ id: 'shapeKinds',   label: 'Shape kinds',   group: { id: 'facets', label: 'Facets' }, entries: shapeKinds },
{ id: 'routingKinds', label: 'Routing kinds', group: { id: 'facets', label: 'Facets' }, entries: routingKinds },
```

Leave all other categories ungrouped.

- [ ] **Step 5: Render groups in `RegistryTree.tsx`**

In `apps/swillustrator/src/dev/RegistryTree.tsx`, find where `filteredNodes` is mapped into the rendered output (after the existing `useMemo` blocks, in the returned JSX). The current render iterates over `filteredNodes` and emits a section per node.

Refactor to group adjacent nodes that share the same `group.id`. Concretely:

a) Add a helper above the return (or as a `useMemo` before it):

```ts
type RenderItem =
  | { kind: 'category'; node: TreeCategoryNode }
  | { kind: 'group'; id: string; label: string; nodes: readonly TreeCategoryNode[] };

const renderItems = useMemo<readonly RenderItem[]>(() => {
  const out: RenderItem[] = [];
  const groupsSeen = new Map<string, { kind: 'group'; id: string; label: string; nodes: TreeCategoryNode[] }>();
  for (const node of filteredNodes) {
    if (!node.group) {
      out.push({ kind: 'category', node });
      continue;
    }
    let item = groupsSeen.get(node.group.id);
    if (!item) {
      item = { kind: 'group', id: node.group.id, label: node.group.label, nodes: [] };
      groupsSeen.set(node.group.id, item);
      out.push(item);
    }
    item.nodes.push(node);
  }
  return out;
}, [filteredNodes]);
```

b) Update the JSX to render `renderItems`:

```tsx
{renderItems.map((item) =>
  item.kind === 'group' ? (
    <div key={`group:${item.id}`} className={s.treeGroup}>
      <div className={s.treeGroupHeading}>{item.label}</div>
      {item.nodes.map((node) => /* existing single-category render block */)}
    </div>
  ) : (
    /* existing single-category render block, keyed by node.id */
  )
)}
```

The "existing single-category render block" is whatever the current JSX does per filteredNode. Extract it into an inline helper or duplicate verbatim — whichever keeps the diff readable.

c) Add CSS for `.treeGroup` and `.treeGroupHeading` to `apps/swillustrator/src/dev/RegistryInspector.module.css`:

```css
.treeGroup {
  /* Visual grouping container. Indent contained categories by a hair. */
}

.treeGroupHeading {
  /* Sticky-ish small label above grouped categories. */
  font-size: 0.78em;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  padding: 8px 12px 4px;
}
```

Adjust the indent or styling to match the existing tree's visual rhythm — read 30 lines around the existing category-section CSS for cues.

- [ ] **Step 6: Run the failing test — should now PASS**

`npx vitest run apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full release gate**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/swillustrator/src/dev/registryData.ts \
        apps/swillustrator/src/dev/RegistryInspector.tsx \
        apps/swillustrator/src/dev/RegistryTree.tsx \
        apps/swillustrator/src/dev/RegistryInspector.module.css \
        apps/swillustrator/src/dev/RegistryInspector.test.tsx
git commit -m "feat(inspector): Facets group parent for shape + routing categories

TreeCategoryNode gains an optional group field. RegistryTree renders
sibling categories that share group.id under a shared heading.
Shape kinds and Routing kinds now sit under a Facets parent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full release gate**

```bash
npx tsc --noEmit && npx vitest run && npx tsup
```
Expected: PASS — typecheck clean, tests green, build succeeds.

- [ ] **Step 2: Visual sanity check (optional but recommended)**

If you can run the swillustrator dev server (check `apps/swillustrator/package.json` scripts), open `#/dev/registry` and confirm:
- A "Facets" group heading appears above "Shape kinds" and "Routing kinds" sections.
- Other categories (Tools, Actions, Bundles, …) render outside the Facets group at the top level.
- Opening a Shape kind entry shows a `facet: shape` row in the detail.
- Opening a Routing kind entry shows a `facet: routing` row in the detail.

Not required; report if you skipped.

- [ ] **Step 3: Done**

Plan complete. Spec at `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`; no follow-up TODOs filed (the reframe redirects the existing P3 entry).

---

## Notes for the implementer

- **No runtime semantics change.** The kit's tool routing, dispatcher, scene adapter, and SceneCanvas wiring are all untouched. This is a docs + inspector reshape.
- **Don't extend the reframe to renaming the runtime registries.** `NodeKindRegistry` stays its name in code (the spec is explicit about this — back-compat). The reframe is at the JSDoc / inspector / spec-doc layer.
- **No new facets implemented.** Future facets (label / icon / propertyRows / bindings / serialize) each land in their own spec. This plan ships only the reshape of the two existing facets (shape + routing).
- **The `NodeKind` interface itself is unchanged.** Still `{ name, matches }`. Future facets attach as separate registries, not new fields on `NodeKind`.
- **The 2026-05-21 spec's "Convergence policy" section is now an artifact of historical intent.** The supersession note at the top of that section is the contract. Do not delete the table — it documents what we considered.
