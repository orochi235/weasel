# @weasel-js/modes

## 1.2.0

## 1.1.0

## 1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

### Minor Changes

- 43482ce: A registry entry declares what it contributes and when it is eligible.

  `Contribution` is the entry type: `bindings`, `actions`, an `overlay`, a
  `presentation`, each optional and independent. `Tool<TScratch>` is now the
  **focus-declaring case** of one — it keeps only what a mode the user switches
  into needs (`initScratch`, the lifecycle hooks, the preview hooks, a `cursor`
  closing over its own scratch). An entry that only routes input declares only
  bindings and actions, which is what `@weasel-js/hud` always was.

  `Eligibility` is a set of conditions rather than one value, because one entry
  holds several: the hand tool is palette-selectable _and_ space-held. `focus`,
  `offhand: HotkeyTrigger`, `always`, `claimed`, plus `capabilities` as a modality
  filter — `@weasel-js/modes` now reads its tags from there. The scope tier a
  binding matches at is derived from whichever condition is live, ordered to match
  the dispatcher's existing hotkey > active > ambient walk. Nothing about that
  walk changed; what changed is that an entry lands in a tier because of what it
  declares about itself rather than which argument a consumer passed it in.

  `useContributions` is the assembly point, and `useTools` is a shim over it with
  its shape unchanged.

  **Breaking — `@weasel-js/hud`:** `createHudTool` / `useHudTool` are now
  `createHudContribution` / `useHudContribution`, with no alias. The old names were
  half of the same misstatement as the `as unknown as Tool<null>` cast they
  required; keeping them would preserve exactly what this corrects.

  **Breaking — `DispatcherContext.ambientToolIds` is removed.** A host driving the
  dispatcher directly declares `eligibility: { always: true }` on always-on entries
  instead. `useTools` consumers are unaffected; the shim sets it.

  **Behavior — a declared held-key trigger now wires itself.** `ToolDef.hotkey` was
  read by the inspector and wired nothing; the engagement lived in a host-side
  registration keyed by tool id (`BUILTIN_OFFHAND_ACTIONS`, now gone). Assembly
  registers the consolidated `tool.offhand` action from the declarations, so a tool
  that wants space declares it — `useHandTool` does. A host that also registered
  `tool.offhand` by hand should stop.

  **Behavior — `useTools` returns shallow copies** for ambient entries and
  `hotkey`-declaring tools, since it adds the declaration they were missing.
  Registry tools from `defineTool` are returned unchanged.

  **Behavior — route-conflict reporting now also sees action `defaultBinding`s.**
  The dispatcher always matched against them; the reporter never saw them, so a
  tool binding colliding with an action default went unreported. It no longer does.
  Dispatch is unchanged.

  Also added: `mergeContributions(...bundles)`, which concatenates and throws on a
  duplicate id rather than silently dropping one — the recorded plugin/bundling v1,
  whose deferral condition was "≥2 plugin-shaped features in flight."

  **Not done, so the seam is stated rather than implied:**
  `EligibilityState.heldTriggers` exists and `liveScope` honors it, but nothing
  populates it. `tool.offhand`'s invoker still reports engagement by pushing a tool
  _id_, which `engagedIds` reads, so the declaration registers the binding while
  the id carries the tier. Retiring that means changing `tool.offhand`'s contract.

## 0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
